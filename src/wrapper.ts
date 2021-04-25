import { BaseProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import { bnum } from './bmath';
import { getCostOutputToken } from './costToken';
import { getOnChainBalances } from './multicall';
import {
    filterPoolsOfInterest,
    filterHopPools,
    getPoolsFromUrl,
} from './pools';
import { calculatePathLimits, smartOrderRouter } from './sorClass';
import { formatSwaps } from './helpersClass';
import {
    SwapInfo,
    DisabledOptions,
    SwapTypes,
    NewPath,
    PoolDictionary,
    SubgraphPoolBase,
    SubGraphPoolsBase,
} from './types';
import { ZERO_ADDRESS } from './index';

export class SOR {
    MULTIADDR: { [chainId: number]: string } = {
        1: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
        42: '0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A',
    };

    VAULTADDR: { [chainId: number]: string } = {
        1: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        42: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    };

    WETHADDR: { [chainId: number]: string } = {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        42: '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
    };

    provider: BaseProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber = new BigNumber('100000');
    isUsingPoolsUrl: Boolean;
    poolsUrl: string;
    subgraphPools: SubGraphPoolsBase;
    tokenCost = {};
    onChainBalanceCache: SubGraphPoolsBase = { pools: [] };
    poolsForPairsCache = {};
    processedDataCache = {};
    finishedFetchingOnChain: boolean = false;
    disabledOptions: DisabledOptions;

    constructor(
        provider: BaseProvider,
        gasPrice: BigNumber,
        maxPools: number,
        chainId: number,
        poolsSource: string | SubGraphPoolsBase,
        disabledOptions: DisabledOptions = {
            isOverRide: false,
            disabledTokens: [],
        }
    ) {
        this.provider = provider;
        this.gasPrice = gasPrice;
        this.maxPools = maxPools;
        this.chainId = chainId;
        // The pools source can be a URL (e.g. pools from Subgraph) or a data set of pools
        if (typeof poolsSource === 'string') {
            this.isUsingPoolsUrl = true;
            this.poolsUrl = poolsSource;
        } else {
            this.isUsingPoolsUrl = false;
            this.subgraphPools = poolsSource;
        }
        this.disabledOptions = disabledOptions;
    }

    /*
    Find and cache cost of token.
    If cost is passed then it manually sets the value.
    */
    async setCostOutputToken(
        tokenOut: string,
        tokenDecimals: number,
        cost: BigNumber = null
    ): Promise<BigNumber> {
        tokenOut = tokenOut.toLowerCase();

        if (cost === null) {
            // Handle ETH/WETH cost
            if (
                tokenOut === ZERO_ADDRESS ||
                tokenOut === this.WETHADDR[this.chainId]
            ) {
                return this.gasPrice.times(this.swapCost).div(bnum(10 ** 18));
            }
            // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations
            const costOutputToken = await getCostOutputToken(
                tokenOut,
                this.gasPrice,
                this.swapCost,
                this.provider,
                this.chainId
            );

            this.tokenCost[tokenOut] = costOutputToken.div(
                bnum(10 ** tokenDecimals)
            );
            return this.tokenCost[tokenOut];
        } else {
            this.tokenCost[tokenOut] = cost;
            return cost;
        }
    }

    /*
    Saves updated pools data to internal onChainBalanceCache.
    If isOnChain is true will retrieve all required onChain data. (false is advised to only be used for testing)
    If poolsData is passed as parameter - uses this as pools source.
    If poolsData was passed in to constructor - uses this as pools source.
    If pools url was passed in to constructor - uses this to fetch pools source.
    */
    async fetchPools(
        isOnChain: boolean = true,
        poolsData: SubGraphPoolsBase = { pools: [] }
    ): Promise<boolean> {
        try {
            // If poolsData has been passed to function these pools should be used
            const isExternalPoolData =
                poolsData.pools.length > 0 ? true : false;

            let subgraphPools: SubGraphPoolsBase;

            if (isExternalPoolData) {
                subgraphPools = JSON.parse(JSON.stringify(poolsData));
                // Store as latest pools data
                if (!this.isUsingPoolsUrl) this.subgraphPools = subgraphPools;
            } else {
                // Retrieve from URL if set otherwise use data passed in constructor
                if (this.isUsingPoolsUrl)
                    subgraphPools = await getPoolsFromUrl(this.poolsUrl);
                else subgraphPools = this.subgraphPools;
            }

            let previousStringify = JSON.stringify(this.onChainBalanceCache); // Used for compare

            // Get latest on-chain balances (returns data in string/normalized format)
            this.onChainBalanceCache = await this.fetchOnChainBalances(
                subgraphPools,
                isOnChain
            );

            // If new pools are different from previous then any previous processed data is out of date so clear
            if (
                previousStringify !== JSON.stringify(this.onChainBalanceCache)
            ) {
                this.processedDataCache = {};
            }

            this.finishedFetchingOnChain = true;

            return true;
        } catch (err) {
            // On error clear all caches and return false so user knows to try again.
            this.finishedFetchingOnChain = false;
            this.onChainBalanceCache = { pools: [] };
            this.processedDataCache = {};
            console.error(`Error: fetchPools(): ${err.message}`);
            return false;
        }
    }

    /*
    Uses multicall contract to fetch all onchain balances for pools.
    */
    private async fetchOnChainBalances(
        subgraphPools: SubGraphPoolsBase,
        isOnChain: boolean = true
    ): Promise<SubGraphPoolsBase> {
        if (subgraphPools.pools.length === 0) {
            console.error('ERROR: No Pools To Fetch.');
            return { pools: [] };
        }

        // Allows for testing
        if (!isOnChain) {
            console.log(
                `!!!!!!! WARNING - Not Using Real OnChain Balances !!!!!!`
            );
            return subgraphPools;
        }

        // This will return in normalized/string format
        const onChainPools: SubGraphPoolsBase = await getOnChainBalances(
            subgraphPools,
            this.MULTIADDR[this.chainId],
            this.VAULTADDR[this.chainId],
            this.provider
        );

        // Error with multicall
        if (!onChainPools) return { pools: [] };

        return onChainPools;
    }

    async getSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmt: BigNumber
    ): Promise<SwapInfo> {
        let swapInfo: SwapInfo = {
            tokenAddresses: [],
            swaps: [],
            swapAmount: bnum(0),
            tokenIn: '',
            tokenOut: '',
            returnAmount: bnum(0),
            marketSp: bnum(0),
        };

        // The Subgraph returns tokens in lower case format so we must match this
        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();

        const WETH = this.WETHADDR[this.chainId].toLowerCase();
        const wrapOptions = { isEthSwap: false, wethAddress: WETH };

        if (tokenIn === ZERO_ADDRESS) {
            tokenIn = WETH;
            wrapOptions.isEthSwap = true;
        }
        if (tokenOut === ZERO_ADDRESS) {
            tokenOut = WETH;
            wrapOptions.isEthSwap = true;
        }

        if (this.finishedFetchingOnChain) {
            // All Pools with OnChain Balances is already fetched so use that
            swapInfo = await this.processSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                this.onChainBalanceCache,
                wrapOptions
            );
        } else {
            // Haven't retrieved all pools/balances so we use the pools for pairs if previously fetched
            if (!this.poolsForPairsCache[this.createKey(tokenIn, tokenOut)])
                return swapInfo;

            swapInfo = await this.processSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                this.poolsForPairsCache[this.createKey(tokenIn, tokenOut)],
                wrapOptions,
                false
            );
        }

        return swapInfo;
    }

    // Will process swap/pools data and return best swaps
    // useProcessCache can be false to force fresh processing of paths/prices
    async processSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmt: BigNumber,
        onChainPools: SubGraphPoolsBase,
        wrapOptions: any,
        useProcessCache: boolean = true
    ): Promise<SwapInfo> {
        let swapInfo: SwapInfo = {
            tokenAddresses: [],
            swaps: [],
            swapAmount: bnum(0),
            tokenIn: '',
            tokenOut: '',
            returnAmount: bnum(0),
            marketSp: bnum(0),
        };

        if (onChainPools.pools.length === 0) return swapInfo;

        let pools: PoolDictionary, paths: NewPath[], marketSp: BigNumber;
        // If token pair has been processed before that info can be reused to speed up execution
        let cache = this.processedDataCache[`${tokenIn}${tokenOut}${swapType}`];

        // useProcessCache can be false to force fresh processing of paths/prices
        if (!useProcessCache || !cache) {
            // If not previously cached we must process all paths/prices.

            // Always use onChain info
            // Some functions alter pools list directly but we want to keep original so make a copy to work from
            let poolsList = JSON.parse(JSON.stringify(onChainPools));
            let pathData: NewPath[];
            [pools, pathData] = this.processPairPools(
                tokenIn,
                tokenOut,
                poolsList.pools
            );

            [paths] = calculatePathLimits(pathData, swapType);

            // Update cache if used
            if (useProcessCache)
                this.processedDataCache[`${tokenIn}${tokenOut}${swapType}`] = {
                    pools: pools,
                    paths: paths,
                    marketSp: marketSp,
                };
        } else {
            // Using pre-processed data from cache
            pools = cache.pools;
            paths = cache.paths;
            marketSp = cache.marketSp;
        }

        let costOutputToken = this.tokenCost[tokenOut];

        if (swapType === SwapTypes.SwapExactOut)
            costOutputToken = this.tokenCost[tokenIn];

        // Use previously stored value if exists else default to 0
        if (costOutputToken === undefined) {
            costOutputToken = new BigNumber(0);
        }

        // Returns list of swaps
        // swapExactIn - total = total amount swap will return of tokenOut
        // swapExactOut - total = total amount of tokenIn required for swap
        let swaps: any, total: BigNumber;
        [swaps, total, marketSp] = smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmt,
            this.maxPools,
            costOutputToken
        );

        if (useProcessCache)
            this.processedDataCache[
                `${tokenIn}${tokenOut}${swapType}`
            ].marketSp = marketSp;

        swapInfo = formatSwaps(
            swaps,
            swapType,
            swapAmt,
            tokenIn,
            tokenOut,
            total,
            marketSp,
            wrapOptions
        );

        if (wrapOptions.isEthSwap) {
            if (swapInfo.tokenIn === wrapOptions.wethAddress)
                swapInfo.tokenIn = ZERO_ADDRESS;
            if (swapInfo.tokenOut === wrapOptions.wethAddress)
                swapInfo.tokenOut = ZERO_ADDRESS;
        }

        return swapInfo;
    }

    /*
    This is used as a quicker alternative to fetching all pools information.
    A subset of pools for token pair is found by checking swaps for range of input amounts.
    The onchain balances for the subset of pools is retrieved and cached for future swap calculations (i.e. when amts change).
    */
    async fetchFilteredPairPools(
        tokenIn: string,
        tokenOut: string,
        isOnChain: boolean = true
    ): Promise<boolean> {
        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();

        // If Zero Address (Eth sentinel) is passed replace it with Weth
        if (tokenIn === ZERO_ADDRESS) {
            tokenIn = this.WETHADDR[this.chainId].toLowerCase();
        }

        if (tokenOut === ZERO_ADDRESS) {
            tokenOut = this.WETHADDR[this.chainId].toLowerCase();
        }

        try {
            let allPoolsNonBig: SubGraphPoolsBase;

            // Retrieve from URL if set otherwise use data passed
            if (this.isUsingPoolsUrl)
                allPoolsNonBig = await getPoolsFromUrl(this.poolsUrl);
            else
                allPoolsNonBig = JSON.parse(JSON.stringify(this.subgraphPools));

            // Convert to BigNumber format
            /*
            let allPools = await this.pools.formatPoolsBigNumber(
                allPoolsNonBig
            );
            */
            let allPools: SubGraphPoolsBase = allPoolsNonBig;

            // These can be shared for both swap Types
            let pools: PoolDictionary, pathData: NewPath[];
            [pools, pathData] = this.processPairPools(
                tokenIn,
                tokenOut,
                allPools.pools
            );

            // Find paths and prices for swap types
            let pathsExactIn: NewPath[];
            // Deep copy that keeps BigNumber format
            let pathsCopy = [...pathData];
            [pathsExactIn] = calculatePathLimits(
                pathsCopy,
                SwapTypes.SwapExactIn
            );

            let pathsExactOut: NewPath[];
            pathsCopy = [...pathData];
            [pathsExactOut] = calculatePathLimits(
                pathsCopy,
                SwapTypes.SwapExactOut
            );

            // Use previously stored value if exists else default to 0
            let costOutputToken = this.tokenCost[tokenOut];
            if (costOutputToken === undefined) {
                costOutputToken = new BigNumber(0);
            }

            let allSwaps = [];

            let range = [
                bnum('0.01'),
                bnum('0.1'),
                bnum('1'),
                bnum('10'),
                bnum('100'),
                bnum('1000'),
            ];

            // Calculate swaps for swapExactIn/Out over range and save swaps (with pools) returned
            range.forEach(amt => {
                let amtIn = amt;
                let amtOut = amtIn;

                let swaps: any, total: BigNumber;
                [swaps, total] = smartOrderRouter(
                    JSON.parse(JSON.stringify(pools)), // Need to keep original pools
                    pathsExactIn,
                    SwapTypes.SwapExactIn,
                    amtIn,
                    this.maxPools,
                    costOutputToken
                );

                allSwaps.push(swaps);
                [swaps, total] = smartOrderRouter(
                    JSON.parse(JSON.stringify(pools)), // Need to keep original pools
                    pathsExactOut,
                    SwapTypes.SwapExactOut,
                    amtOut,
                    this.maxPools,
                    costOutputToken
                );

                allSwaps.push(swaps);
            });

            // List of unique pool addresses
            let filteredPools: string[] = [];
            // get unique swap pools
            allSwaps.forEach(swap => {
                swap.forEach(seq => {
                    seq.forEach(p => {
                        if (!filteredPools.includes(p.pool))
                            filteredPools.push(p.pool);
                    });
                });
            });

            // Get list of pool infos for pools of interest
            let poolsOfInterest: SubgraphPoolBase[] = [];
            for (let i = 0; i < allPoolsNonBig.pools.length; i++) {
                let index = filteredPools.indexOf(allPoolsNonBig.pools[i].id);
                if (index > -1) {
                    filteredPools.splice(index, 1);
                    poolsOfInterest.push(allPoolsNonBig.pools[i]);
                    if (filteredPools.length === 0) break;
                }
            }

            let onChainPools: SubGraphPoolsBase = { pools: [] };
            if (poolsOfInterest.length !== 0) {
                // Get latest onchain balances for pools of interest(returns data in string / normalized format)
                onChainPools = await this.fetchOnChainBalances(
                    {
                        pools: poolsOfInterest,
                    },
                    isOnChain
                );
            }

            // Add to cache for future use
            this.poolsForPairsCache[
                this.createKey(tokenIn, tokenOut)
            ] = onChainPools;

            return true;
        } catch (err) {
            console.error(`Error: fetchFilteredPairPools(): ${err.message}`);
            // Add to cache for future use
            this.poolsForPairsCache[this.createKey(tokenIn, tokenOut)] = {
                pools: [],
            };
            return false;
        }
    }

    // Finds pools and paths for token pairs. Independent of swap type.
    private processPairPools(
        tokenIn: string,
        tokenOut: string,
        poolsList: SubgraphPoolBase[]
    ): [PoolDictionary, NewPath[]] {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];
        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            poolsList,
            tokenIn,
            tokenOut,
            this.maxPools,
            this.disabledOptions
        );
        [poolsOfInterestDictionary, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            poolsOfInterestDictionary
        );

        return [poolsOfInterestDictionary, pathData];
    }

    // Used for cache ids
    createKey(Token1: string, Token2: string): string {
        return Token1 < Token2 ? `${Token1}${Token2}` : `${Token2}${Token1}`;
    }

    // Check if pair data already fetched (using fetchFilteredPairPools)
    hasDataForPair(tokenIn: string, tokenOut: string): boolean {
        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();

        if (
            this.finishedFetchingOnChain ||
            this.poolsForPairsCache[this.createKey(tokenIn, tokenOut)]
        )
            return true;
        else return false;
    }
}
