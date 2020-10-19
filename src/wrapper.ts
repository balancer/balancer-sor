import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import { SubGraphPools, Swap } from './types';
import _ from 'lodash';
const sor = require('./index');

export class SOR {
    isSubgraphFetched: boolean;
    isOnChainFetched: boolean;
    subgraphPools;
    subgraphPoolsFormatted;
    onChainPools;
    provider: JsonRpcProvider;
    // Default multi address for mainnet
    multicallAddress: string = '0xeefba1e63905ef1d7acba5a8513c70307c1ce441';
    gasPrice: BigNumber;
    // avg Balancer swap cost. Can be updated manually if required.
    swapCost: BigNumber = new BigNumber('100000');
    tokenCost;
    maxPools: number;

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
    }

    async fetchSubgraphPools(SubgraphUrl: string = '') {
        this.isSubgraphFetched = false;
        let previous = _.cloneDeep(this.subgraphPools);
        this.subgraphPools = await sor.getAllPublicSwapPools(SubgraphUrl);
        if (!_.isEqual(this.subgraphPools, previous)) {
            this.isOnChainFetched = false; // New pools so any previous onchain info is out of date.
            this.subgraphPoolsFormatted = _.cloneDeep(this.subgraphPools); // format alters pools so make copy first
            sor.formatSubgraphPools(this.subgraphPoolsFormatted);
        }
        this.isSubgraphFetched = true;
    }

    async fetchOnChainPools(MulticallAddr: string = '') {
        this.isOnChainFetched = false;

        if (!this.isSubgraphFetched) {
            console.error(
                'ERROR: Must fetch Subgraph pools before getting On-Chain.'
            );
            return;
        }

        this.onChainPools = await sor.getAllPoolDataOnChain(
            this.subgraphPools,
            MulticallAddr === '' ? this.multicallAddress : MulticallAddr,
            this.provider
        );

        // Error with multicall
        if (!this.onChainPools) return;

        this.isOnChainFetched = true;
    }

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
        let onChainPools = await sor.getAllPoolDataOnChain(
            poolsToCheck,
            MulticallAddr === '' ? this.multicallAddress : MulticallAddr,
            this.provider
        );

        // Checks Subgraph swaps against Onchain pools info.
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

    async getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        CheckOnChain: boolean = true,
        MulticallAddr: string = ''
    ): Promise<[Swap[][], BigNumber]> {
        console.time('getSwaps');
        if (!this.isSubgraphFetched) {
            console.error('ERROR: Must fetch pools before getting a swap.');
            return;
        }

        // Some function alter pools list directly but we want to keep original so make a copy to work from
        let poolsList;
        if (this.isOnChainFetched) poolsList = _.cloneDeep(this.onChainPools);
        else poolsList = _.cloneDeep(this.subgraphPoolsFormatted);

        // The Subgraph returns tokens in lower case format so we must match this
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        let costOutputToken = this.tokenCost[TokenOut];
        if (costOutputToken === undefined) {
            costOutputToken = new BigNumber(0);
        }

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
        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            TokenIn,
            TokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        // Finds sorted price & slippage information for paths
        let paths = sor.processPaths(pathData, pools, SwapType);

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            SwapType,
            this.maxPools
        );

        // Returns list of swaps
        // swapExactIn - total = total amount swap will return of TokenOut
        // swapExactOut - total = total amount of TokenIn required for swap
        let swaps, total;
        [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
            pools,
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

        console.timeEnd('getSwaps');

        return [swaps, total];
    }
}
