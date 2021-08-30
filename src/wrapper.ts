import { BaseProvider } from '@ethersproject/providers';
import { BigNumber, ZERO } from './utils/bignumber';
import { EMPTY_SWAPINFO } from './constants';
import { smartOrderRouter } from './router';
import { getWrappedInfo, setWrappedInfo } from './wrapInfo';
import { formatSwaps } from './formatSwaps';
import { PoolCacher } from './poolCaching';
import { RouteProposer } from './routeProposal';
import { filterPoolsByType } from './routeProposal/filtering';
import { SwapCostCalculator } from './swapCost';
import { getLidoStaticSwaps, isLidoStableSwap } from './pools/lido/lidoHelpers';
import {
    SwapInfo,
    SwapTypes,
    NewPath,
    PoolDictionary,
    PoolFilter,
    Swap,
    SubgraphPoolBase,
    SwapOptions,
} from './types';

export class SOR {
    provider: BaseProvider;
    chainId: number;

    poolCacher: PoolCacher;
    private routeProposer: RouteProposer;
    swapCostCalculator: SwapCostCalculator;

    private readonly defaultSwapOptions: SwapOptions = {
        gasPrice: new BigNumber('50e9'),
        swapGas: new BigNumber("35000"),
        poolTypeFilter: PoolFilter.All,
        maxPools: 4,
        timestamp: Math.floor(Date.now() / 1000),
        forceRefresh: false,
    };

    constructor(
        provider: BaseProvider,
        chainId: number,
        poolsSource: string | SubgraphPoolBase[]
    ) {
        this.poolCacher = new PoolCacher(provider, chainId, poolsSource);
        this.routeProposer = new RouteProposer();
        this.swapCostCalculator = new SwapCostCalculator(provider, chainId);
        this.provider = provider;
        this.chainId = chainId;
    }

    async getCostOfSwapInToken(
        outputToken: string,
        gasPrice: BigNumber,
        swapGas?: BigNumber
    ): Promise<BigNumber> {
        if (gasPrice.isZero()) return ZERO;
        return this.swapCostCalculator.convertGasCostToToken(
            outputToken,
            gasPrice,
            swapGas
        );
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
        poolsData: SubgraphPoolBase[] = []
    ): Promise<boolean> {
        return this.poolCacher.fetchPools(isOnChain, poolsData);
    }

    async getSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmount: BigNumber,
        swapOptions?: Partial<SwapOptions>
    ): Promise<SwapInfo> {
        if (!this.poolCacher.finishedFetchingOnChain)
            return { ...EMPTY_SWAPINFO };

        // Set any unset options to their defaults
        const options: SwapOptions = {
            ...this.defaultSwapOptions,
            ...swapOptions,
        };

        const pools: SubgraphPoolBase[] = JSON.parse(
            JSON.stringify(this.poolCacher.getPools())
        );

        const filteredPools = filterPoolsByType(pools, options.poolTypeFilter);

        const wrappedInfo = await getWrappedInfo(
            this.provider,
            swapType,
            tokenIn,
            tokenOut,
            this.chainId,
            swapAmount
        );

        let swapInfo: SwapInfo;
        if (isLidoStableSwap(this.chainId, tokenIn, tokenOut)) {
            swapInfo = await getLidoStaticSwaps(
                filteredPools,
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
                filteredPools,
                options
            );
        }

        if (swapInfo.returnAmount.isZero()) return swapInfo;

        swapInfo = setWrappedInfo(
            swapInfo,
            swapType,
            wrappedInfo,
            this.chainId
        );

        return swapInfo;
    }

    // Will process swap/pools data and return best swaps
    private async processSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmount: BigNumber,
        pools: SubgraphPoolBase[],
        swapOptions: SwapOptions
    ): Promise<SwapInfo> {
        if (pools.length === 0) return { ...EMPTY_SWAPINFO };

        const {
            pools: poolsOfInterest,
            paths,
        } = this.routeProposer.getCandidatePaths(
            tokenIn,
            tokenOut,
            swapType,
            pools,
            swapOptions
        );

        const costOutputToken = await this.getCostOfSwapInToken(
            swapType === SwapTypes.SwapExactIn ? tokenOut : tokenIn,
            swapOptions.gasPrice,
            swapOptions.swapGas,
        );

        // Returns list of swaps
        const [
            swaps,
            total,
            marketSp,
            totalConsideringFees,
        ] = this.getOptimalPaths(
            poolsOfInterest,
            paths,
            swapAmount,
            swapType,
            costOutputToken,
            swapOptions.maxPools
        );

        const swapInfo = formatSwaps(
            swaps,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            total,
            totalConsideringFees,
            marketSp
        );

        return swapInfo;
    }

    /**
     * Find optimal routes for trade from given candidate paths
     */
    private getOptimalPaths(
        pools: PoolDictionary,
        paths: NewPath[],
        swapAmount: BigNumber,
        swapType: SwapTypes,
        costOutputToken: BigNumber,
        maxPools: number
    ): [Swap[][], BigNumber, BigNumber, BigNumber] {
        // swapExactIn - total = total amount swap will return of tokenOut
        // swapExactOut - total = total amount of tokenIn required for swap
        return smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmount,
            maxPools,
            costOutputToken
        );
    }
}
