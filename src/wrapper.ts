import { ethers } from 'ethers';
import { BigNumber } from './utils/bignumber';
import {
    SubGraphPools,
    Swap,
    PoolDictionary,
    Path,
    EffectivePrice,
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

export class SOR {
    isSubgraphFetched: boolean;
    isOnChainFetched: boolean;
    subgraphPools;
    subgraphPoolsFormatted;
    onChainPools;
    provider: ethers.providers.JsonRpcProvider;
    // Default multi address for mainnet
    multicallAddress: string = '0xF700478148B84E572A447d63b29fD937Fd511147';
    gasPrice: BigNumber;
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber = new BigNumber('100000');
    tokenCost;
    maxPools: number;
    processedCache: ProcessedCache;

    constructor(
        Provider: ethers.providers.JsonRpcProvider,
        GasPrice: BigNumber,
        MaxPools: number
    ) {
        this.isSubgraphFetched = false;
        this.isOnChainFetched = false;
        this.provider = Provider;
        this.gasPrice = GasPrice;
        this.maxPools = MaxPools;
        this.tokenCost = {};
        this.processedCache = {};
    }

    /*
    Fetch all public & active pools from Subgraph.
    Will clear cached onChain pools and processed paths if new pools are different from cached.
    SubgraphUrl can be passed to override default set in .env.
    */
    async fetchSubgraphPools(SubgraphUrl: string = '') {
        this.isSubgraphFetched = false;

        let previousStringify = JSON.stringify(this.subgraphPools); // Used for compare

        this.subgraphPools = await sor.getAllPublicSwapPools(SubgraphUrl);
        let newStringify = JSON.stringify(this.subgraphPools);
        if (newStringify !== previousStringify) {
            this.isOnChainFetched = false; // New pools so any previous onchain info is out of date.
            this.subgraphPoolsFormatted = JSON.parse(newStringify); // format alters pools so make copy first
            sor.formatSubgraphPools(this.subgraphPoolsFormatted);
            this.processedCache = {}; // Clear processed cache as data changed
        }
        this.isSubgraphFetched = true;
    }

    /*
    Uses multicall contact to fetch all onchain balances, weights and fees for cached Subgraph pools.
    Will clear cached processed paths if new pools are different from cached.
    MulticallAddr can be passed to override default mainnet multicall address.
    */
    async fetchOnChainPools(MulticallAddr: string = '') {
        this.isOnChainFetched = false;

        if (!this.isSubgraphFetched) {
            console.error(
                'ERROR: Must fetch Subgraph pools before getting On-Chain.'
            );
            return;
        }
        let previousStringify = JSON.stringify(this.onChainPools); // Used for compare

        this.onChainPools = await sor.getAllPoolDataOnChainNew(
            this.subgraphPools,
            MulticallAddr === '' ? this.multicallAddress : MulticallAddr,
            this.provider
        );

        // Error with multicall
        if (!this.onChainPools) return;

        // If new pools are different from previous then any previous processed data is out of date so clear
        if (previousStringify !== JSON.stringify(this.onChainPools)) {
            this.processedCache = {};
        }

        this.isOnChainFetched = true;
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
    Main function to retrieve swap information.
    Will always use onChain pools if available over Subgraph pools.
    If using Subgraph pools by default swaps are checked using data retrieved from onChain.
    Can be overridden with CheckOnChain.
    */
    async getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        SubgraphUrl: string = '',
        MulticallAddr: string = ''
    ): Promise<[Swap[][], BigNumber]> {
        // The Subgraph returns tokens in lower case format so we must match this
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        if (!this.isSubgraphFetched || !this.isOnChainFetched) {
            let [swaps, total] = await this.getSwapsWithoutCache(
                TokenIn,
                TokenOut,
                SwapType,
                SwapAmt,
                SubgraphUrl,
                MulticallAddr
            );
            return [swaps, total];
        } else {
            let [swaps, total] = await this.getSwapsWithCache(
                TokenIn,
                TokenOut,
                SwapType,
                SwapAmt,
                SubgraphUrl,
                MulticallAddr
            );
            return [swaps, total];
        }
    }

    async getSwapsWithoutCache(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        SubgraphUrl: string,
        MulticallAddr: string
    ): Promise<[Swap[][], BigNumber]> {
        // Fetch pools that have either tokenIn or tokenOut or both
        console.time('SG');
        let subGraphPools = await sor.getFilteredPools(
            TokenIn,
            TokenOut,
            SubgraphUrl
        );
        console.timeEnd('SG');

        console.time('OC');

        // Fetch on-chain balances
        let poolsList = await sor.getAllPoolDataOnChainNew(
            subGraphPools,
            MulticallAddr === '' ? this.multicallAddress : MulticallAddr,
            this.provider
        );
        console.timeEnd('OC');

        console.time('PROCESS');
        // Retrieves all pools that contain both tokenIn & tokenOut, i.e. pools that can be used for direct swaps
        // Retrieves intermediate pools along with tokens that are contained in these.
        let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
        [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
            poolsList.pools,
            TokenIn,
            TokenOut
        );

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
        let pathData, pools: PoolDictionary;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            TokenIn,
            TokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        // Finds sorted price & slippage information for paths
        let paths: Path[] = sor.processPaths(pathData, pools, SwapType);

        let epsOfInterest: EffectivePrice[] = sor.processEpsOfInterestMultiHop(
            paths,
            SwapType,
            this.maxPools
        );

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
            pools, // Need to keep original pools for cache
            paths,
            SwapType,
            SwapAmt,
            this.maxPools,
            costOutputToken,
            epsOfInterest
        );
        console.timeEnd('PROCESS');

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
        let cache = this.processedCache[`${TokenIn}${TokenOut}${SwapType}`];

        if (!cache) {
            // If not previously cached we must process all paths/prices.

            // Always use onChain info if available
            // Some functions alter pools list directly but we want to keep original so make a copy to work from
            let poolsList;
            if (this.isOnChainFetched)
                poolsList = JSON.parse(JSON.stringify(this.onChainPools));
            else
                poolsList = JSON.parse(
                    JSON.stringify(this.subgraphPoolsFormatted)
                );

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

            this.processedCache[`${TokenIn}${TokenOut}${SwapType}`] = {
                pools: pools,
                paths: paths,
                epsOfInterest: epsOfInterest,
            };
        } else {
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
