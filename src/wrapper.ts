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
    getLidoStaticSwaps,
    isLidoStableSwap,
    Swap,
    filterPoolsByType,
    SubgraphPoolBase,
} from './index';
import { calculatePathLimits, smartOrderRouter, createPaths } from './router';
import { getWrappedInfo, setWrappedInfo } from './wrapInfo';
import { formatSwaps } from './formatSwaps';
import { PoolCacher } from './poolCaching';
import { SwapCostCalculator } from './swapCost';

const EMPTY_SWAPINFO: SwapInfo = {
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

export class SOR {
    provider: BaseProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    processedDataCache: Record<
        string,
        { pools: PoolDictionary; paths: NewPath[] }
    > = {};
    disabledOptions: DisabledOptions;

    poolCacher: PoolCacher;
    swapCostCalculator: SwapCostCalculator;

    constructor(
        provider: BaseProvider,
        gasPrice: BigNumber,
        maxPools: number,
        chainId: number,
        poolsSource: string | SubGraphPoolsBase,
        swapCost?: BigNumber,
        disabledOptions: DisabledOptions = {
            isOverRide: false,
            disabledTokens: [],
        }
    ) {
        this.poolCacher = new PoolCacher(
            provider,
            chainId,
            typeof poolsSource === 'string' ? poolsSource : poolsSource.pools
        );
        this.provider = provider;
        this.gasPrice = gasPrice;
        this.maxPools = maxPools;
        this.chainId = chainId;
        this.disabledOptions = disabledOptions;
        this.swapCostCalculator = new SwapCostCalculator(chainId, swapCost);
    }

    async getCostOfSwapInToken(
        outputToken: string,
        tokenDecimals = 18
    ): Promise<BigNumber> {
        return this.swapCostCalculator.convertGasCostToToken(
            outputToken,
            tokenDecimals,
            this.gasPrice
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
        poolsData: SubGraphPoolsBase = { pools: [] }
    ): Promise<boolean> {
        return this.poolCacher.fetchPools(isOnChain, poolsData.pools);
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
        if (!this.poolCacher.finishedFetchingOnChain) return EMPTY_SWAPINFO;

        const pools: SubgraphPoolBase[] = JSON.parse(
            JSON.stringify(this.poolCacher.getPools())
        );

        const filteredPools = filterPoolsByType(
            pools,
            swapOptions.poolTypeFilter
        );

        const wrappedInfo = await getWrappedInfo(
            this.provider,
            swapType,
            tokenIn,
            tokenOut,
            this.chainId,
            swapAmt
        );

        let swapInfo: SwapInfo;
        if (isLidoStableSwap(this.chainId, tokenIn, tokenOut)) {
            swapInfo = await getLidoStaticSwaps(
                { pools: filteredPools },
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
                { pools: filteredPools },
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
        if (onChainPools.pools.length === 0) return EMPTY_SWAPINFO;

        const { pools, paths } = this.getCandidatePaths(
            tokenIn,
            tokenOut,
            swapType,
            onChainPools,
            useProcessCache,
            currentBlockTimestamp
        );

        const costOutputToken = await this.getCostOfSwapInToken(
            swapType === SwapTypes.SwapExactIn ? tokenOut : tokenIn
        );

        // Returns list of swaps
        const [
            swaps,
            total,
            marketSp,
            totalConsideringFees,
        ] = this.getOptimalPaths(
            pools,
            paths,
            swapAmt,
            swapType,
            costOutputToken
        );

        const swapInfo = formatSwaps(
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

    /**
     * Given a list of pools and a desired input/output, returns a set of possible paths to route through
     */
    private getCandidatePaths(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        onChainPools: SubGraphPoolsBase,
        useProcessCache = true,
        currentBlockTimestamp = 0
    ): { pools: PoolDictionary; paths: NewPath[] } {
        if (onChainPools.pools.length === 0) return { pools: {}, paths: [] };

        // If token pair has been processed before that info can be reused to speed up execution
        const cache = this.processedDataCache[
            `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
        ];

        // useProcessCache can be false to force fresh processing of paths/prices
        if (useProcessCache && !!cache) {
            // Using pre-processed data from cache
            return {
                pools: cache.pools,
                paths: cache.paths,
            };
        }

        // Some functions alter pools list directly but we want to keep original so make a copy to work from
        const poolsList = JSON.parse(JSON.stringify(onChainPools));

        const [mostLiquidPools, pathData] = createPaths(
            poolsList.pools,
            tokenIn,
            tokenOut,
            this.maxPools,
            this.disabledOptions,
            currentBlockTimestamp
        );

        const [paths] = calculatePathLimits(pathData, swapType);

        // Update cache if used
        if (useProcessCache) {
            this.processedDataCache[
                `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
            ] = {
                pools: mostLiquidPools,
                paths: paths,
            };
        }

        return { pools: mostLiquidPools, paths };
    }

    /**
     * Find optimal routes for trade from given candidate paths
     */
    private getOptimalPaths(
        pools: PoolDictionary,
        paths: NewPath[],
        swapAmount: BigNumber,
        swapType: SwapTypes,
        costOutputToken: BigNumber
    ): [Swap[][], BigNumber, BigNumber, BigNumber] {
        // swapExactIn - total = total amount swap will return of tokenOut
        // swapExactOut - total = total amount of tokenIn required for swap
        return smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmount,
            this.maxPools,
            costOutputToken
        );
    }
}
