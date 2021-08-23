import { BaseProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import { ZERO } from './utils/bignumber';
import {
    SwapInfo,
    DisabledOptions,
    SwapTypes,
    NewPath,
    PoolDictionary,
    SubGraphPoolsBase,
    SwapOptions,
    PoolFilter,
    WETHADDR,
    VAULTADDR,
    MULTIADDR,
    ZERO_ADDRESS,
    setWrappedInfo,
    getLidoStaticSwaps,
    isLidoStableSwap,
    getWrappedInfo,
    formatSwaps,
    calculatePathLimits,
    smartOrderRouter,
    filterPoolsOfInterest,
    filterHopPools,
    fetchSubgraphPools,
    getOnChainBalances,
    getCostOutputToken,
    bnum,
} from './index';

export class SOR {
    provider: BaseProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber;
    isUsingPoolsUrl: boolean;
    poolsUrl: string;
    subgraphPools: SubGraphPoolsBase;
    tokenCost = {};
    onChainBalanceCache: SubGraphPoolsBase = { pools: [] };
    processedDataCache = {};
    finishedFetchingOnChain = false;
    disabledOptions: DisabledOptions;

    constructor(
        provider: BaseProvider,
        gasPrice: BigNumber,
        maxPools: number,
        chainId: number,
        poolsSource: string | SubGraphPoolsBase,
        swapCost: BigNumber = new BigNumber('100000'),
        disabledOptions: DisabledOptions = {
            isOverRide: false,
            disabledTokens: [],
        }
    ) {
        this.provider = provider;
        this.gasPrice = gasPrice;
        this.maxPools = maxPools;
        this.chainId = chainId;
        this.swapCost = swapCost;
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
                tokenOut.toLowerCase() === WETHADDR[this.chainId].toLowerCase()
            ) {
                this.tokenCost[tokenOut.toLowerCase()] = this.gasPrice
                    .times(this.swapCost)
                    .div(bnum(10 ** 18));
                return this.tokenCost[tokenOut.toLowerCase()];
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
        isOnChain = true,
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
                    subgraphPools = await fetchSubgraphPools(this.poolsUrl);
                else subgraphPools = this.subgraphPools;
            }

            const previousStringify = JSON.stringify(this.onChainBalanceCache); // Used for compare

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
        isOnChain = true
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
            MULTIADDR[this.chainId],
            VAULTADDR[this.chainId],
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
        swapAmt: BigNumber,
        swapOptions: SwapOptions = {
            poolTypeFilter: PoolFilter.All,
            timestamp: 0,
        }
    ): Promise<SwapInfo> {
        let swapInfo: SwapInfo = {
            tokenAddresses: [],
            swaps: [],
            swapAmount: ZERO,
            swapAmountForSwaps: ZERO,
            tokenIn: '',
            tokenOut: '',
            returnAmount: ZERO,
            returnAmountConsideringFees: ZERO,
            returnAmountFromSwaps: ZERO,
            marketSp: ZERO,
        };

        const wrappedInfo = await getWrappedInfo(
            this.provider,
            swapType,
            tokenIn,
            tokenOut,
            this.chainId,
            swapAmt
        );

        if (this.finishedFetchingOnChain) {
            const pools = JSON.parse(JSON.stringify(this.onChainBalanceCache));
            if (!(swapOptions.poolTypeFilter === PoolFilter.All))
                pools.pools = pools.pools.filter(
                    p => p.poolType === swapOptions.poolTypeFilter
                );

            if (isLidoStableSwap(this.chainId, tokenIn, tokenOut)) {
                swapInfo = await getLidoStaticSwaps(
                    pools,
                    this.chainId,
                    wrappedInfo.tokenIn.addressForSwaps,
                    wrappedInfo.tokenOut.addressForSwaps,
                    swapType,
                    wrappedInfo.swapAmountForSwaps,
                    this.provider
                );
            } else {
                swapInfo = await this.processSwaps(
                    wrappedInfo.tokenIn.addressForSwaps,
                    wrappedInfo.tokenOut.addressForSwaps,
                    swapType,
                    wrappedInfo.swapAmountForSwaps,
                    pools,
                    true,
                    swapOptions.timestamp
                );
            }

            if (swapInfo.returnAmount.isZero()) return swapInfo;

            swapInfo = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                this.chainId
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
        useProcessCache = true,
        currentBlockTimestamp = 0
    ): Promise<SwapInfo> {
        let swapInfo: SwapInfo = {
            tokenAddresses: [],
            swaps: [],
            swapAmount: ZERO,
            swapAmountForSwaps: ZERO,
            tokenIn: '',
            tokenOut: '',
            returnAmount: ZERO,
            returnAmountConsideringFees: ZERO,
            returnAmountFromSwaps: ZERO,
            marketSp: ZERO,
        };

        if (onChainPools.pools.length === 0) return swapInfo;
        let pools: PoolDictionary, paths: NewPath[], marketSp: BigNumber;

        // If token pair has been processed before that info can be reused to speed up execution
        const cache = this.processedDataCache[
            `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
        ];

        // useProcessCache can be false to force fresh processing of paths/prices
        if (!useProcessCache || !cache) {
            // If not previously cached we must process all paths/prices.

            // Always use onChain info
            // Some functions alter pools list directly but we want to keep original so make a copy to work from
            const poolsList = JSON.parse(JSON.stringify(onChainPools));
            let pathData: NewPath[];
            let hopTokens: string[];
            [pools, hopTokens] = filterPoolsOfInterest(
                poolsList.pools,
                tokenIn,
                tokenOut,
                this.maxPools,
                this.disabledOptions,
                currentBlockTimestamp
            );

            [pools, pathData] = filterHopPools(
                tokenIn,
                tokenOut,
                hopTokens,
                pools
            );

            [paths] = calculatePathLimits(pathData, swapType);

            // Update cache if used
            if (useProcessCache)
                this.processedDataCache[
                    `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
                ] = {
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
        let swaps: any, total: BigNumber, totalConsideringFees: BigNumber;
        [swaps, total, marketSp, totalConsideringFees] = smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmt,
            this.maxPools,
            costOutputToken
        );

        if (useProcessCache)
            this.processedDataCache[
                `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
            ].marketSp = marketSp;

        swapInfo = formatSwaps(
            swaps,
            swapType,
            swapAmt,
            tokenIn,
            tokenOut,
            total,
            totalConsideringFees,
            marketSp
        );

        return swapInfo;
    }
}
