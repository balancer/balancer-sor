import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import {
    SubGraphPools,
    Swap,
    PoolDictionary,
    Path,
    EffectivePrice,
} from './types';
import _ from 'lodash';
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
    provider: JsonRpcProvider;
    // Default multi address for mainnet
    multicallAddress: string = '0xF700478148B84E572A447d63b29fD937Fd511147';
    gasPrice: BigNumber;
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber = new BigNumber('100000');
    tokenCost;
    maxPools: number;
    processedCache: ProcessedCache;

    constructor(
        Provider: JsonRpcProvider,
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
        let previous = _.cloneDeep(this.subgraphPools);
        this.subgraphPools = await sor.getAllPublicSwapPools(SubgraphUrl);
        if (!_.isEqual(this.subgraphPools, previous)) {
            this.isOnChainFetched = false; // New pools so any previous onchain info is out of date.
            this.subgraphPoolsFormatted = _.cloneDeep(this.subgraphPools); // format alters pools so make copy first
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

        let previous = _.cloneDeep(this.onChainPools);
        this.onChainPools = await sor.getAllPoolDataOnChainNew(
            this.subgraphPools,
            MulticallAddr === '' ? this.multicallAddress : MulticallAddr,
            this.provider
        );

        // Error with multicall
        if (!this.onChainPools) return;

        // If new pools are different from previous then any previous processed data is out of date so clear
        if (!_.isEqual(previous, this.onChainPools)) {
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
    Checks a swap list against latest onchain pool info.
    Will update any invalid swaps.
    Normally used when using Subgraph balances only.
    */
    async onChainCheck(
        Swaps: Swap[][],
        Total: BigNumber,
        SwapType: string,
        TokenIn: string,
        TokenOut: string,
        SwapAmt: BigNumber,
        MulticallAddr: string
    ): Promise<[Swap[][], BigNumber]> {
        // Gets pools used in swaps
        let poolsToCheck: SubGraphPools = sor.getPoolsFromSwaps(
            Swaps,
            this.subgraphPools
        );

        // Get onchain info for swap pools
        let onChainPools = await sor.getAllPoolDataOnChainNew(
            poolsToCheck,
            MulticallAddr === '' ? this.multicallAddress : MulticallAddr,
            this.provider
        );

        // Checks swaps against Onchain pools info.
        // Will update any invalid swaps for valid.
        if (SwapType === 'swapExactIn')
            [Swaps, Total] = sor.checkSwapsExactIn(
                Swaps,
                TokenIn,
                TokenOut,
                SwapAmt,
                Total,
                onChainPools
            );
        else
            [Swaps, Total] = sor.checkSwapsExactOut(
                Swaps,
                TokenIn,
                TokenOut,
                SwapAmt,
                Total,
                onChainPools
            );

        return [Swaps, Total];
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
        CheckOnChain: boolean = true,
        MulticallAddr: string = ''
    ): Promise<[Swap[][], BigNumber]> {
        if (!this.isSubgraphFetched) {
            console.error('ERROR: Must fetch pools before getting a swap.');
            return;
        }

        // The Subgraph returns tokens in lower case format so we must match this
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        // Use previously stored value if exists else default to 0
        let costOutputToken = this.tokenCost[TokenOut];
        if (costOutputToken === undefined) {
            costOutputToken = new BigNumber(0);
        }

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
                poolsList = _.cloneDeep(this.onChainPools);
            else poolsList = _.cloneDeep(this.subgraphPoolsFormatted);

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

        // Returns list of swaps
        // swapExactIn - total = total amount swap will return of TokenOut
        // swapExactOut - total = total amount of TokenIn required for swap
        let swaps, total;
        [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
            _.cloneDeep(pools), // Need to keep original pools for cache
            paths,
            SwapType,
            SwapAmt,
            this.maxPools,
            costOutputToken,
            epsOfInterest
        );

        // Perform onChain check of swaps if using Subgraph balances
        if (!this.isOnChainFetched && CheckOnChain && swaps.length > 0) {
            [swaps, total] = await this.onChainCheck(
                swaps,
                total,
                SwapType,
                TokenIn,
                TokenOut,
                SwapAmt,
                MulticallAddr === '' ? this.multicallAddress : MulticallAddr
            );
        }

        return [swaps, total];
    }
}
