import {
    BigNumber,
    BigNumberish,
    formatFixed,
    parseFixed,
} from '@ethersproject/bignumber';
import { BaseProvider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';
import { BigNumber as OldBigNumber, bnum } from './utils/bignumber';
import { getBestPaths } from './router';
import { getWrappedInfo, setWrappedInfo } from './wrapInfo';
import { formatSwaps } from './formatSwaps';
import { PoolCacher } from './poolCaching';
import { RouteProposer } from './routeProposal';
import { filterPoolsByType } from './routeProposal/filtering';
import { SwapCostCalculator } from './swapCost';
import { getLidoStaticSwaps, isLidoStableSwap } from './pools/lido';
import { isSameAddress } from './utils';
import { EMPTY_SWAPINFO } from './constants';
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
import { Zero } from '@ethersproject/constants';

export class SOR {
    poolCacher: PoolCacher;
    private routeProposer: RouteProposer;
    swapCostCalculator: SwapCostCalculator;

    private readonly defaultSwapOptions: SwapOptions = {
        gasPrice: parseFixed('50', 9),
        swapGas: BigNumber.from('35000'),
        poolTypeFilter: PoolFilter.All,
        maxPools: 4,
        timestamp: Math.floor(Date.now() / 1000),
        forceRefresh: false,
    };

    constructor(
        public provider: BaseProvider,
        public chainId: number,
        poolsSource: string | null,
        initialPools: SubgraphPoolBase[] = []
    ) {
        this.poolCacher = new PoolCacher(
            provider,
            chainId,
            poolsSource,
            initialPools
        );
        this.routeProposer = new RouteProposer();
        this.swapCostCalculator = new SwapCostCalculator(provider, chainId);
    }

    getPools(): SubgraphPoolBase[] {
        return this.poolCacher.getPools();
    }

    /*
    Saves updated pools data to internal onChainBalanceCache.
    If isOnChain is true will retrieve all required onChain data. (false is advised to only be used for testing)
    If poolsData is passed as parameter - uses this as pools source.
    If poolsData was passed in to constructor - uses this as pools source.
    If pools url was passed in to constructor - uses this to fetch pools source.
    */
    async fetchPools(
        poolsData: SubgraphPoolBase[] = [],
        isOnChain = true
    ): Promise<boolean> {
        return this.poolCacher.fetchPools(poolsData, isOnChain);
    }

    async getSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmount: BigNumberish,
        swapOptions?: Partial<SwapOptions>
    ): Promise<SwapInfo> {
        if (!this.poolCacher.finishedFetchingOnChain)
            return cloneDeep(EMPTY_SWAPINFO);

        // Set any unset options to their defaults
        const options: SwapOptions = {
            ...this.defaultSwapOptions,
            ...swapOptions,
        };

        const pools: SubgraphPoolBase[] = this.poolCacher.getPools();

        const filteredPools = filterPoolsByType(pools, options.poolTypeFilter);

        const wrappedInfo = await getWrappedInfo(
            this.provider,
            swapType,
            tokenIn,
            tokenOut,
            this.chainId,
            BigNumber.from(swapAmount)
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

    async getCostOfSwapInToken(
        outputToken: string,
        gasPrice: BigNumber,
        swapGas?: BigNumber
    ): Promise<BigNumber> {
        if (gasPrice.isZero()) return Zero;
        return this.swapCostCalculator.convertGasCostToToken(
            outputToken,
            gasPrice,
            swapGas
        );
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
        if (pools.length === 0) return cloneDeep(EMPTY_SWAPINFO);

        const { pools: poolsOfInterest, paths } =
            this.routeProposer.getCandidatePaths(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                swapOptions
            );

        if (paths.length == 0) return { ...EMPTY_SWAPINFO };

        // Path is guaranteed to contain both tokenIn and tokenOut
        let tokenInDecimals;
        let tokenOutDecimals;
        paths[0].swaps.forEach((swap) => {
            // Inject token decimals to avoid having to query onchain
            if (isSameAddress(swap.tokenIn, tokenIn)) {
                this.swapCostCalculator.setTokenDecimals(
                    tokenIn,
                    swap.tokenInDecimals
                );
                tokenInDecimals = swap.tokenInDecimals;
            }
            if (isSameAddress(swap.tokenOut, tokenOut)) {
                this.swapCostCalculator.setTokenDecimals(
                    tokenOut,
                    swap.tokenOutDecimals
                );
                tokenOutDecimals = swap.tokenOutDecimals;
            }
        });

        const costOutputToken = await this.getCostOfSwapInToken(
            swapType === SwapTypes.SwapExactIn ? tokenOut : tokenIn,
            swapOptions.gasPrice,
            swapOptions.swapGas
        );

        // Returns list of swaps
        const [swaps, total, marketSp, totalConsideringFees] =
            this.getBestPaths(
                poolsOfInterest,
                paths,
                swapAmount,
                swapType,
                tokenInDecimals,
                tokenOutDecimals,
                costOutputToken,
                swapOptions.maxPools
            );

        console.log('swaps', swaps);

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
    private getBestPaths(
        pools: PoolDictionary,
        paths: NewPath[],
        swapAmount: BigNumber,
        swapType: SwapTypes,
        tokenInDecimals: number,
        tokenOutDecimals: number,
        costOutputToken: BigNumber,
        maxPools: number
    ): [Swap[][], BigNumber, OldBigNumber, BigNumber] {
        // swapExactIn - total = total amount swap will return of tokenOut
        // swapExactOut - total = total amount of tokenIn required for swap

        const [inputDecimals, outputDecimals] =
            swapType === SwapTypes.SwapExactIn
                ? [tokenInDecimals, tokenOutDecimals]
                : [tokenOutDecimals, tokenInDecimals];

        const [swaps, total, marketSp, totalConsideringFees] = getBestPaths(
            cloneDeep(pools),
            paths,
            swapType,
            swapAmount,
            inputDecimals,
            maxPools,
            costOutputToken
        );

        return [
            swaps,
            parseFixed(
                total.dp(outputDecimals, OldBigNumber.ROUND_FLOOR).toString(),
                outputDecimals
            ),
            marketSp,
            parseFixed(
                totalConsideringFees
                    .dp(outputDecimals, OldBigNumber.ROUND_FLOOR)
                    .toString(),
                outputDecimals
            ),
        ];
    }
}
