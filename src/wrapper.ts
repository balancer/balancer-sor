import { BigNumber, BigNumberish, parseFixed } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';
import { BigNumber as OldBigNumber } from './utils/bignumber';
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

    /**
     * @param {Provider} provider - Provider.
     * @param {number} chainId - Id of chain.
     * @param {string | null} poolsSource - Pass Subgraph URL used to retrieve pools or null to use initialPools.
     * @param {SubgraphPoolBase[]} initialPools - Can be set with initial pools to use.
     */
    constructor(
        public provider: Provider,
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
        this.swapCostCalculator = new SwapCostCalculator(chainId);
    }

    getPools(): SubgraphPoolBase[] {
        return this.poolCacher.getPools();
    }

    /**
     * fetchPools Retrieves pools information and saves to internal pools cache.
     * @param {SubgraphPoolBase[]} poolsData - If empty pools will be fetched from source in constructor. If pools passed they will be used as pools source.
     * @param {boolean} isOnChain - If isOnChain is true will retrieve all required onChain data. (false is advised to only be used for testing)
     * @returns {boolean} True if pools fetched successfully, False if not.
     */
    async fetchPools(
        poolsData: SubgraphPoolBase[] = [],
        isOnChain = true
    ): Promise<boolean> {
        return this.poolCacher.fetchPools(poolsData, isOnChain);
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
            swapOptions,
            this.chainId
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
