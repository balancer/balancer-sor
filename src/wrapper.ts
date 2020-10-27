import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import {
    SubGraphPools,
    SubGraphPool,
    Swap,
    PoolDictionary,
    Path,
    EffectivePrice,
    Pools,
} from './types';
const sor = require('./index');

interface ProcessedData {
    pools: PoolDictionary;
    paths: Path[];
    epsOfInterest: EffectivePrice[];
}

interface ProcessedCache {
    [PairId: string]: ProcessedData;
}

interface FetchedTokens {
    [Token: string]: boolean;
}

export class SOR {
    provider: JsonRpcProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber = new BigNumber('100000');
    tokenCost = {};
    fetchedTokens: FetchedTokens = {};
    subgraphCache: SubGraphPools = { pools: [] };
    onChainCache: Pools = { pools: [] };
    processedDataCache = {};

    MULTIADDR: { [chainId: number]: string } = {
        1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
        42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
    };

    SUBGRAPH_URL: { [chainId: number]: string } = {
        1: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer',
        42: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan',
    };

    constructor(
        Provider: JsonRpcProvider,
        GasPrice: BigNumber,
        MaxPools: number,
        ChainId: number
    ) {
        this.provider = Provider;
        this.gasPrice = GasPrice;
        this.maxPools = MaxPools;
        this.chainId = ChainId;
    }

    /*
    Find and cache cost of token.
    */
    async setCostOutputToken(TokenOut: string, Cost: BigNumber = null) {
        TokenOut = TokenOut.toLowerCase();

        if (Cost === null) {
            // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations
            const costOutputToken = await sor.getCostOutputToken(
                TokenOut,
                this.gasPrice,
                this.swapCost,
                this.provider
            );

            this.tokenCost[TokenOut] = costOutputToken;
        } else {
            this.tokenCost[TokenOut] = Cost;
        }
    }

    /*
    Uses multicall contact to fetch all onchain balances for cached Subgraph pools.
    */
    async fetchOnChainPools(SubgraphPools: SubGraphPools): Promise<Pools> {
        if (SubgraphPools.pools.length === 0) {
            console.error('ERROR: No Pools To Fetch.');
            return { pools: [] };
        }

        let onChainPools: Pools = await sor.getAllPoolDataOnChain(
            SubgraphPools,
            this.MULTIADDR[this.chainId],
            this.provider
        );

        // Error with multicall
        if (!onChainPools) return { pools: [] };

        return onChainPools;
    }

    async fetchPairPools(
        TokenIn: string,
        TokenOut: string,
        PurgeCache: boolean = true
    ): Promise<boolean> {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        if (PurgeCache) {
            this.purgeCaches();
            return await this.fetchNewPools(TokenIn, TokenOut);
        } else if (
            this.fetchedTokens[TokenIn] &&
            this.fetchedTokens[TokenOut]
        ) {
            return true;
        } else if (
            !this.fetchedTokens[TokenIn] &&
            !this.fetchedTokens[TokenOut]
        ) {
            return await this.fetchNewPools(TokenIn, TokenOut);
        } else if (!this.fetchedTokens[TokenIn]) {
            return await this.updatePools(TokenIn);
        } else if (!this.fetchedTokens[TokenOut]) {
            return await this.updatePools(TokenOut);
        }

        return false;
    }

    hasPairPools(TokenIn, TokenOut): boolean {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        if (this.fetchedTokens[TokenIn] && this.fetchedTokens[TokenOut])
            return true;
        else return false;
    }

    // Updates onChain balances for all pools in existing cache
    async updateOnChainBalances(): Promise<boolean> {
        try {
            let previousStringify = JSON.stringify(this.onChainCache); // Used for compare

            this.onChainCache = await this.fetchOnChainPools(
                this.subgraphCache
            );

            // If new pools are different from previous then any previous processed data is out of date so clear
            if (previousStringify !== JSON.stringify(this.onChainCache)) {
                this.processedDataCache = {};
            }

            return true;
        } catch (err) {
            console.error(`updateOnChainBalances(): ${err.message}`);
            return false;
        }
    }

    // Fetches pools that contain TokenIn, TokenOut or both (Subgraph & Onchain)
    private async fetchNewPools(
        TokenIn: string,
        TokenOut: string
    ): Promise<boolean> {
        try {
            this.subgraphCache = await sor.getFilteredPools(
                TokenIn,
                TokenOut,
                this.SUBGRAPH_URL[this.chainId]
            );
            this.onChainCache = await this.fetchOnChainPools(
                this.subgraphCache
            );
            this.fetchedTokens[TokenIn] = true;
            this.fetchedTokens[TokenOut] = true;
            return true;
        } catch (err) {
            this.fetchedTokens[TokenIn] = false;
            this.fetchedTokens[TokenOut] = false;
            console.error(`Issue Fetching New Pools: ${TokenIn} ${TokenOut}`);
            console.error(err.message);
            return false;
        }
    }

    // Adds any pools that contain token and don't already exist to cache (Subgraph & Onchain)
    private async updatePools(Token: string): Promise<boolean> {
        try {
            let poolsWithToken: SubGraphPools = await sor.getPoolsWithToken(
                Token
            );

            let newPools: SubGraphPool[] = poolsWithToken.pools.filter(pool => {
                return !this.subgraphCache.pools.some(
                    existingPool => existingPool.id === pool.id
                );
            });

            if (newPools.length > 0) {
                let newOnChain = await this.fetchOnChainPools({
                    pools: newPools,
                });
                this.subgraphCache.pools = this.subgraphCache.pools.concat(
                    newPools
                );
                this.onChainCache.pools = this.onChainCache.pools.concat(
                    newOnChain.pools
                );
            }
            this.fetchedTokens[Token] = true;
            return true;
        } catch (err) {
            this.fetchedTokens[Token] = false;
            console.error(`Issue Updating Pools: ${Token}`);
            console.error(err.message);
            return false;
        }
    }

    purgeCaches() {
        this.fetchedTokens = {};
        this.subgraphCache = { pools: [] };
        this.onChainCache = { pools: [] };
        this.processedDataCache = {};
    }

    /*
    Main function to retrieve swap information.
    Will fetch & use onChain balances.
    Can use cached pool info by setting PurgeCache=false but be aware balances may be out of date.
    */
    async getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        PurgeCache: boolean = true
    ): Promise<[Swap[][], BigNumber]> {
        // The Subgraph returns tokens in lower case format so we must match this
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();
        // Retrieves pool information
        let isFetched = await this.fetchPairPools(
            TokenIn,
            TokenOut,
            PurgeCache
        );

        let [swaps, total] = await this.getSwapsWithCache(
            TokenIn,
            TokenOut,
            SwapType,
            SwapAmt,
            this.SUBGRAPH_URL[this.chainId],
            this.MULTIADDR[this.chainId]
        );

        return [swaps, total];
    }

    async getSwapsWithCache(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        SubgraphUrl: string,
        MulticallAddr: string
    ): Promise<[Swap[][], BigNumber]> {
        let pools: PoolDictionary,
            paths: Path[],
            epsOfInterest: EffectivePrice[];
        // If token pair has been processed before use that info to speed up execution
        let cache = this.processedDataCache[`${TokenIn}${TokenOut}${SwapType}`];

        if (!cache) {
            // If not previously cached we must process all paths/prices.

            // Always use onChain info
            // Some functions alter pools list directly but we want to keep original so make a copy to work from
            let poolsList = JSON.parse(JSON.stringify(this.onChainCache));

            // Retrieves all pools that contain both tokenIn & tokenOut, i.e. pools that can be used for direct swaps
            // Retrieves intermediate pools along with tokens that are contained in these.
            let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
            [
                directPools,
                hopTokens,
                poolsTokenIn,
                poolsTokenOut,
            ] = sor.filterPools(poolsList.pools, TokenIn, TokenOut);

            // Sort intermediate pools by order of liquidity
            let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
            [
                mostLiquidPoolsFirstHop,
                mostLiquidPoolsSecondHop,
            ] = sor.sortPoolsMostLiquid(
                TokenIn,
                TokenOut,
                hopTokens,
                poolsTokenIn,
                poolsTokenOut
            );

            // Finds the possible paths to make the swap
            let pathData;
            [pools, pathData] = sor.parsePoolData(
                directPools,
                TokenIn,
                TokenOut,
                mostLiquidPoolsFirstHop,
                mostLiquidPoolsSecondHop,
                hopTokens
            );

            // Finds sorted price & slippage information for paths
            paths = sor.processPaths(pathData, pools, SwapType);

            epsOfInterest = sor.processEpsOfInterestMultiHop(
                paths,
                SwapType,
                this.maxPools
            );

            this.processedDataCache[`${TokenIn}${TokenOut}${SwapType}`] = {
                pools: pools,
                paths: paths,
                epsOfInterest: epsOfInterest,
            };
        } else {
            // Using pre-processed data
            pools = cache.pools;
            paths = cache.paths;
            epsOfInterest = cache.epsOfInterest;
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

        return [swaps, total];
    }
}
