import { BigNumber, BigNumberish, parseFixed } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';
import { BigNumber as OldBigNumber } from './utils/bignumber';
import { getBestPaths } from './router';
import { getWrappedInfo, setWrappedInfo } from './wrapInfo';
import { formatSwaps } from './formatSwaps';
import { PoolCacher } from './poolCacher';
import { RouteProposer } from './routeProposal';
import { filterPoolsByType } from './routeProposal/filtering';
import { SwapCostCalculator } from './swapCostCalculator';
import { getLidoStaticSwaps, isLidoStableSwap } from './pools/lido';
import { isSameAddress } from './utils';
import { EMPTY_SWAPINFO } from './constants';
import {
    SwapInfo,
    SwapTypes,
    NewPath,
    PoolFilter,
    Swap,
    SubgraphPoolBase,
    SwapOptions,
    TokenPriceService,
    PoolDataService,
    SorConfig,
} from './types';
import { Zero } from '@ethersproject/constants';

export class SOR {
    private readonly poolCacher: PoolCacher;
    private readonly routeProposer: RouteProposer;
    readonly swapCostCalculator: SwapCostCalculator;

    private readonly defaultSwapOptions: SwapOptions = {
        gasPrice: parseFixed('50', 9),
        swapGas: BigNumber.from('35000'),
        poolTypeFilter: PoolFilter.All,
        maxPools: 4,
        timestamp: Math.floor(Date.now() / 1000),
        forceRefresh: false,
    };

    /**
     * @param {Provider} provider - Provider.
     * @param {SorConfig} config - Chain specific configuration for the SOR.
     * @param {PoolDataService} poolDataService - Generic service that fetches pool data from an external data source.
     * @param {TokenPriceService} tokenPriceService - Generic service that fetches token prices from an external price feed. Used in calculating swap cost.
     */
    constructor(
        public provider: Provider,
        private readonly config: SorConfig,
        poolDataService: PoolDataService,
        tokenPriceService: TokenPriceService
    ) {
        this.poolCacher = new PoolCacher(poolDataService);
        this.routeProposer = new RouteProposer(config);
        this.swapCostCalculator = new SwapCostCalculator(
            config,
            tokenPriceService
        );
    }

    getPools(): SubgraphPoolBase[] {
        return this.poolCacher.getPools();
    }

    /**
     * fetchPools Retrieves pools information and saves to internal pools cache.
     * @returns {boolean} True if pools fetched successfully, False if not.
     */
    async fetchPools(): Promise<boolean> {
        return this.poolCacher.fetchPools();
    }

    /**
     * getSwaps Retrieve information for best swap tokenIn>tokenOut.
     * @param {string} tokenIn - Address of tokenIn.
     * @param {string} tokenOut - Address of tokenOut.
     * @param {SwapTypes} swapType - SwapExactIn where the amount of tokens in (sent to the Pool) is known or SwapExactOut where the amount of tokens out (received from the Pool) is known.
     * @param {BigNumberish} swapAmount - Either amountIn or amountOut depending on the `swapType` value.
     * @returns {SwapInfo} Swap information including return amount and swaps structure to be submitted to Vault.
     */
    async getSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmount: BigNumberish,
        swapOptions?: Partial<SwapOptions>
    ): Promise<SwapInfo> {
        if (!this.poolCacher.finishedFetching) return cloneDeep(EMPTY_SWAPINFO);

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
            this.config,
            BigNumber.from(swapAmount)
        );

        let swapInfo: SwapInfo;
        if (isLidoStableSwap(this.config.chainId, tokenIn, tokenOut)) {
            swapInfo = await getLidoStaticSwaps(
                filteredPools,
                this.config.chainId,
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

        swapInfo = setWrappedInfo(swapInfo, swapType, wrappedInfo, this.config);

        return swapInfo;
    }
    /**
     * getCostOfSwapInToken Calculates and saves price of a swap in outputToken denomination. Used to determine if extra swaps are cost effective.
     * @param {string} outputToken - Address of outputToken.
     * @param {number} outputTokenDecimals - Decimals of outputToken.
     * @param {BigNumber} gasPrice - Gas price used to calculate cost.
     * @param {BigNumber} swapGas - Gas cost of a swap. Default=35000.
     * @returns {BigNumber} Price of a swap in outputToken denomination.
     */
    async getCostOfSwapInToken(
        outputToken: string,
        outputTokenDecimals: number,
        gasPrice: BigNumber,
        swapGas?: BigNumber
    ): Promise<BigNumber> {
        if (gasPrice.isZero()) return Zero;
        return this.swapCostCalculator.convertGasCostToToken(
            outputToken,
            outputTokenDecimals,
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

        const paths = this.routeProposer.getCandidatePaths(
            tokenIn,
            tokenOut,
            swapType,
            pools,
            swapOptions
        );

        if (paths.length == 0) return cloneDeep(EMPTY_SWAPINFO);

        // Path is guaranteed to contain both tokenIn and tokenOut
        let tokenInDecimals;
        let tokenOutDecimals;
        paths[0].swaps.forEach((swap) => {
            // Inject token decimals to avoid having to query onchain
            if (isSameAddress(swap.tokenIn, tokenIn)) {
                tokenInDecimals = swap.tokenInDecimals;
            }
            if (isSameAddress(swap.tokenOut, tokenOut)) {
                tokenOutDecimals = swap.tokenOutDecimals;
            }
        });

        const costOutputToken = await this.getCostOfSwapInToken(
            swapType === SwapTypes.SwapExactIn ? tokenOut : tokenIn,
            swapType === SwapTypes.SwapExactIn
                ? tokenOutDecimals
                : tokenInDecimals,
            swapOptions.gasPrice,
            swapOptions.swapGas
        );

        // Returns list of swaps
        const [swaps, total, marketSp, totalConsideringFees] =
            this.getBestPaths(
                paths,
                swapAmount,
                swapType,
                tokenInDecimals,
                tokenOutDecimals,
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
    private getBestPaths(
        paths: NewPath[],
        swapAmount: BigNumber,
        swapType: SwapTypes,
        tokenInDecimals: number,
        tokenOutDecimals: number,
        costOutputToken: BigNumber,
        maxPools: number
    ): [Swap[][], BigNumber, string, BigNumber] {
        // swapExactIn - total = total amount swap will return of tokenOut
        // swapExactOut - total = total amount of tokenIn required for swap

        const [inputDecimals, outputDecimals] =
            swapType === SwapTypes.SwapExactIn
                ? [tokenInDecimals, tokenOutDecimals]
                : [tokenOutDecimals, tokenInDecimals];

        const [swaps, total, marketSp, totalConsideringFees] = getBestPaths(
            paths,
            swapType,
            swapAmount,
            inputDecimals,
            outputDecimals,
            maxPools,
            costOutputToken
        );

        return [
            swaps,
            parseFixed(
                total.dp(outputDecimals, OldBigNumber.ROUND_FLOOR).toString(),
                outputDecimals
            ),
            marketSp.toString(),
            parseFixed(
                totalConsideringFees
                    .dp(outputDecimals, OldBigNumber.ROUND_FLOOR)
                    .toString(),
                outputDecimals
            ),
        ];
    }
}
