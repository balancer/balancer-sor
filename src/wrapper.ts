import { BaseProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import * as sor from './index';
import { POOLS } from './index';
import { SwapV2, SwapInfo, SubGraphPools, Pools, Token, Pool } from './types';
import { bnum } from './bmath';

// import {
//     SubGraphPool,
//
//     Swap,
//     PoolDictionary,
//     Path,
//     EffectivePrice,
//     Pools,
// } from './types';
// import { bnum, scale } from './bmath';

export class SOR {
    MULTIADDR: { [chainId: number]: string } = {
        1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
        42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
    };

    provider: BaseProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber = new BigNumber('100000');
    isUsingPoolsUrl: Boolean;
    poolsUrl: string;
    subgraphPools: SubGraphPools;
    tokenCost = {};
    pools: POOLS;
    onChainCache: Pools = { pools: [] };
    poolsForPairsCache = {};
    processedDataCache = {};
    finishedFetchingOnChain: boolean = false;

    constructor(
        provider: BaseProvider,
        gasPrice: BigNumber,
        maxPools: number,
        chainId: number,
        poolsSource: string | SubGraphPools
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

        this.pools = new POOLS();
    }

    /*
    Find and cache cost of token.
    If cost is passed then it manually sets the value.
    */
    async setCostOutputToken(tokenOut: string, cost: BigNumber = null) {
        tokenOut = tokenOut.toLowerCase();

        if (cost === null) {
            // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations
            const costOutputToken = await sor.getCostOutputToken(
                tokenOut,
                this.gasPrice,
                this.swapCost,
                this.provider,
                this.chainId
            );

            this.tokenCost[tokenOut] = costOutputToken;
        } else {
            this.tokenCost[tokenOut] = cost;
        }
    }

    // Fetch allPools from URL then retrieve OnChain balances
    async fetchPools(): Promise<boolean> {
        try {
            let subgraphPools: SubGraphPools;

            // Retrieve from URL if set otherwise use data passed
            if (this.isUsingPoolsUrl)
                subgraphPools = await this.pools.getAllPublicSwapPools(
                    this.poolsUrl
                );
            else subgraphPools = this.subgraphPools;

            let previousStringify = JSON.stringify(this.onChainCache); // Used for compare

            // Get latest on-chain data TODO - IMPLEMENT THIS FOR V2
            // Convert to BigNumber format - THIS IS A PLACE HOLDER FOR NOW
            this.onChainCache = await this.fetchOnChainPools(subgraphPools);

            // If new pools are different from previous then any previous processed data is out of date so clear
            if (previousStringify !== JSON.stringify(this.onChainCache)) {
                this.processedDataCache = {};
            }

            this.finishedFetchingOnChain = true;

            return true;
        } catch (err) {
            // On error clear all caches and return false so user knows to try again.
            this.finishedFetchingOnChain = false;
            this.onChainCache = { pools: [] };
            this.processedDataCache = {};
            console.error(`Error: fetchPools(): ${err.message}`);
            return false;
        }
    }

    /*
    Uses multicall contract to fetch all onchain balances for pools.
    */
    private async fetchOnChainPools(
        SubgraphPools: SubGraphPools
    ): Promise<Pools> {
        if (SubgraphPools.pools.length === 0) {
            console.error('ERROR: No Pools To Fetch.');
            return { pools: [] };
        }
        /*
        let onChainPools: Pools = await sor.getAllPoolDataOnChain(
            SubgraphPools,
            this.MULTIADDR[this.chainId],
            this.provider
        );

        // Error with multicall
        if (!onChainPools) return { pools: [] };
        */
        // !!!!!!! TODO - Below is a placeholder for multicall that converts to bignumber format with NO scaling
        const onChainPools: Pools = { pools: [] };

        for (let i = 0; i < SubgraphPools.pools.length; i++) {
            let tokens: Token[] = [];

            let p: Pool = {
                id: SubgraphPools.pools[i].id,
                swapFee: bnum(SubgraphPools.pools[i].swapFee),
                totalWeight: bnum(SubgraphPools.pools[i].totalWeight),
                tokens: tokens,
                tokensList: SubgraphPools.pools[i].tokensList,
            };

            SubgraphPools.pools[i].tokens.forEach(token => {
                let decimals = Number(token.decimals);

                p.tokens.push({
                    address: token.address,
                    balance: bnum(token.balance),
                    decimals: decimals,
                    denormWeight: bnum(token.denormWeight),
                });
            });
            onChainPools.pools.push(p);
        }

        return onChainPools;
    }

    async getSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: string,
        swapAmt: BigNumber
    ): Promise<SwapInfo> {
        // The Subgraph returns tokens in lower case format so we must match this
        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();

        let swapInfo: SwapInfo = {
            tokenAddresses: [],
            swaps: [],
            tradeAmount: bnum(0),
            tokenIn: '',
            tokenOut: '',
        };

        if (this.finishedFetchingOnChain) {
            // All Pools with OnChain Balances is already fetched so use that
            swapInfo = await this.processSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                this.onChainCache
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
                false
            );
        }

        // !!!!!!! TODO - Remember marketSp

        return swapInfo;
    }

    // Will process swap/pools data and return best swaps
    // useProcessCache can be false to force fresh processing of paths/prices
    async processSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: string,
        swapAmt: BigNumber,
        onChainPools: Pools,
        useProcessCache: boolean = true
    ): Promise<SwapInfo> {
        const swap: SwapV2 = {
            poolId: 'test',
            tokenInIndex: 0,
            tokenOutIndex: 1,
            amountIn: '1000000000000000000',
            userData: '0x',
        };

        const swapInfo: SwapInfo = {
            tokenAddresses: [tokenIn, tokenOut],
            swaps: [swap],
            tradeAmount: swapAmt,
            tokenIn,
            tokenOut,
        };

        return swapInfo;
        /*
        if (OnChainPools.pools.length === 0) return [[[]], bnum(0), bnum(0)];

        let pools: PoolDictionary,
            paths: Path[],
            epsOfInterest: EffectivePrice[],
            marketSp: BigNumber;
        // If token pair has been processed before that info can be reused to speed up execution
        let cache = this.processedDataCache[`${TokenIn}${TokenOut}${SwapType}`];

        // useProcessCache can be false to force fresh processing of paths/prices
        if (!useProcessCache || !cache) {
            // If not previously cached we must process all paths/prices.

            // Always use onChain info
            // Some functions alter pools list directly but we want to keep original so make a copy to work from
            let poolsList = JSON.parse(JSON.stringify(OnChainPools));

            let pathData: Path[];
            [pools, pathData] = this.processPairPools(
                TokenIn,
                TokenOut,
                poolsList
            );

            [paths, epsOfInterest, marketSp] = this.processPathsAndPrices(
                pathData,
                pools,
                SwapType
            );

            // Update cache if used
            if (useProcessCache)
                this.processedDataCache[`${TokenIn}${TokenOut}${SwapType}`] = {
                    pools: pools,
                    paths: paths,
                    epsOfInterest: epsOfInterest,
                    marketSp: marketSp,
                };
        } else {
            // Using pre-processed data from cache
            pools = cache.pools;
            paths = cache.paths;
            epsOfInterest = cache.epsOfInterest;
            marketSp = cache.marketSp;
        }

        // Use previously stored value if exists else default to 0
        let costOutputToken = this.tokenCost[TokenOut];
        if (costOutputToken === undefined) {
            costOutputToken = new BigNumber(0);
        }

        // Returns list of swaps
        // swapExactIn - total = total amount swap will return of TokenOut
        // swapExactOut - total = total amount of TokenIn required for swap
        let swaps, total;
        [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            SwapType,
            SwapAmt,
            this.maxPools,
            costOutputToken,
            epsOfInterest
        );

        return [swaps, total, marketSp];
        */
    }

    // Used for cache ids
    private createKey(Token1: string, Token2: string): string {
        return Token1 < Token2 ? `${Token1}${Token2}` : `${Token2}${Token1}`;
    }
}

//     /*
//     This is used as a quicker alternative to fetching all pools information.
//     A subset of pools for token pair is found by checking swaps for range of input amounts.
//     The onchain balances for the subset of pools is retrieved and cached for future swap calculations (i.e. when amts change).
//     */
//     async fetchFilteredPairPools(
//         TokenIn: string,
//         TokenOut: string
//     ): Promise<boolean> {
//         TokenIn = TokenIn.toLowerCase();
//         TokenOut = TokenOut.toLowerCase();

//         try {
//             // Get all IPFS pools (with balance)
//             let allPoolsNonBig = await this.pools.getAllPublicSwapPools(
//                 this.poolsUrl
//             );

//             // Convert to BigNumber format
//             let allPools = await this.pools.formatPoolsBigNumber(
//                 allPoolsNonBig
//             );

//             let decimalsIn = 0;
//             let decimalsOut = 0;

//             // Find token decimals for scaling
//             for (let i = 0; i < allPools.pools.length; i++) {
//                 for (let j = 0; j < allPools.pools[i].tokens.length; j++) {
//                     if (allPools.pools[i].tokens[j].address === TokenIn) {
//                         decimalsIn = Number(
//                             allPools.pools[i].tokens[j].decimals
//                         );
//                         if (decimalsIn > 0 && decimalsOut > 0) break;
//                     } else if (
//                         allPools.pools[i].tokens[j].address === TokenOut
//                     ) {
//                         decimalsOut = Number(
//                             allPools.pools[i].tokens[j].decimals
//                         );
//                         if (decimalsIn > 0 && decimalsOut > 0) break;
//                     }
//                 }

//                 if (decimalsIn > 0 && decimalsOut > 0) break;
//             }

//             // These can be shared for both swap Types
//             let pools: PoolDictionary, pathData: Path[];
//             [pools, pathData] = this.processPairPools(
//                 TokenIn,
//                 TokenOut,
//                 allPools
//             );

//             // Find paths and prices for swap types
//             let pathsExactIn: Path[], epsExactIn: EffectivePrice[];
//             [pathsExactIn, epsExactIn] = this.processPathsAndPrices(
//                 JSON.parse(JSON.stringify(pathData)),
//                 pools,
//                 'swapExactIn'
//             );

//             let pathsExactOut: Path[], epsExactOut: EffectivePrice[];
//             [pathsExactOut, epsExactOut] = this.processPathsAndPrices(
//                 pathData,
//                 pools,
//                 'swapExactOut'
//             );

//             // Use previously stored value if exists else default to 0
//             let costOutputToken = this.tokenCost[TokenOut];
//             if (costOutputToken === undefined) {
//                 costOutputToken = new BigNumber(0);
//             }

//             let allSwaps = [];

//             let range = [
//                 bnum('0.01'),
//                 bnum('0.1'),
//                 bnum('1'),
//                 bnum('10'),
//                 bnum('100'),
//                 bnum('1000'),
//             ];

//             // Calculate swaps for swapExactIn/Out over range and save swaps (with pools) returned
//             range.forEach(amt => {
//                 let amtIn = scale(amt, decimalsIn);
//                 let amtOut = amtIn;
//                 if (decimalsIn !== decimalsOut)
//                     amtOut = scale(amt, decimalsOut);

//                 let swaps, total;
//                 [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
//                     JSON.parse(JSON.stringify(pools)), // Need to keep original pools
//                     pathsExactIn,
//                     'swapExactIn',
//                     amtIn,
//                     this.maxPools,
//                     costOutputToken,
//                     epsExactIn
//                 );

//                 allSwaps.push(swaps);
//                 [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
//                     JSON.parse(JSON.stringify(pools)), // Need to keep original pools
//                     pathsExactOut,
//                     'swapExactOut',
//                     amtOut,
//                     this.maxPools,
//                     costOutputToken,
//                     epsExactOut
//                 );

//                 allSwaps.push(swaps);
//             });

//             // List of unique pool addresses
//             let filteredPools: string[] = [];
//             // get unique swap pools
//             allSwaps.forEach(swap => {
//                 swap.forEach(seq => {
//                     seq.forEach(p => {
//                         if (!filteredPools.includes(p.pool))
//                             filteredPools.push(p.pool);
//                     });
//                 });
//             });

//             // Get list of pool infos for pools of interest
//             let poolsOfInterest: SubGraphPool[] = [];
//             for (let i = 0; i < allPoolsNonBig.pools.length; i++) {
//                 let index = filteredPools.indexOf(allPoolsNonBig.pools[i].id);
//                 if (index > -1) {
//                     filteredPools.splice(index, 1);
//                     poolsOfInterest.push(allPoolsNonBig.pools[i]);
//                     if (filteredPools.length === 0) break;
//                 }
//             }

//             let onChainPools: Pools = { pools: [] };
//             if (poolsOfInterest.length !== 0) {
//                 // Retrieves onchain balances for pools list
//                 onChainPools = await sor.getAllPoolDataOnChain(
//                     { pools: poolsOfInterest },
//                     this.MULTIADDR[this.chainId],
//                     this.provider
//                 );
//             }

//             // Add to cache for future use
//             this.poolsForPairsCache[
//                 this.createKey(TokenIn, TokenOut)
//             ] = onChainPools;

//             return true;
//         } catch (err) {
//             console.error(`Error: fetchFilteredPairPools(): ${err.message}`);
//             // Add to cache for future use
//             this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)] = {
//                 pools: [],
//             };
//             return false;
//         }
//     }

//     // Finds pools and paths for token pairs. Independent of swap type.
//     processPairPools(
//         TokenIn: string,
//         TokenOut: string,
//         poolsList
//     ): [PoolDictionary, Path[]] {
//         // Retrieves intermediate pools along with tokens that are contained in these.
//         let directPools: PoolDictionary,
//             hopTokens: string[],
//             poolsTokenIn: PoolDictionary,
//             poolsTokenOut: PoolDictionary;
//         [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
//             poolsList.pools,
//             TokenIn,
//             TokenOut,
//             this.maxPools
//         );

//         // Sort intermediate pools by order of liquidity
//         let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
//         [
//             mostLiquidPoolsFirstHop,
//             mostLiquidPoolsSecondHop,
//         ] = sor.sortPoolsMostLiquid(
//             TokenIn,
//             TokenOut,
//             hopTokens,
//             poolsTokenIn,
//             poolsTokenOut
//         );

//         // Finds the possible paths to make the swap
//         let pathData: Path[];
//         let pools: PoolDictionary;
//         [pools, pathData] = sor.parsePoolData(
//             directPools,
//             TokenIn,
//             TokenOut,
//             mostLiquidPoolsFirstHop,
//             mostLiquidPoolsSecondHop,
//             hopTokens
//         );

//         return [pools, pathData];
//     }

//     // SwapType dependent - calculates paths prices/amounts
//     processPathsAndPrices(
//         PathArray: Path[],
//         PoolsDict: PoolDictionary,
//         SwapType: string
//     ): [Path[], EffectivePrice[], BigNumber] {
//         const paths: Path[] = sor.processPaths(PathArray, PoolsDict, SwapType);

//         const bestSpotPrice = sor.getMarketSpotPrice(paths);

//         const eps: EffectivePrice[] = sor.processEpsOfInterestMultiHop(
//             paths,
//             SwapType,
//             this.maxPools
//         );

//         return [paths, eps, bestSpotPrice];
//     }

//     // Used for cache ids
//     private createKey(Token1: string, Token2: string): string {
//         return Token1 < Token2 ? `${Token1}${Token2}` : `${Token2}${Token1}`;
//     }

//     // Check if pair data already fetched (using fetchFilteredPairPools)
//     hasDataForPair(TokenIn: string, TokenOut: string): boolean {
//         TokenIn = TokenIn.toLowerCase();
//         TokenOut = TokenOut.toLowerCase();

//         if (
//             this.finishedFetchingOnChain ||
//             this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)]
//         )
//             return true;
//         else return false;
//     }
// }
