import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
} from '../../types';
export interface MetaStablePoolToken {
    address: string;
    balance: string;
    decimals: string | number;
    priceRate?: string;
}
export interface MetaStablePoolPairData extends PoolPairBase {
    id: string;
    address: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    swapFee: BigNumber;
    swapFeeScaled: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    allBalances: BigNumber[];
    allBalancesScaled: BigNumber[];
    invariant: BigNumber;
    amp: BigNumber;
    tokenIndexIn: number;
    tokenIndexOut: number;
    tokenInPriceRate: BigNumber;
    tokenOutPriceRate: BigNumber;
}
export declare class MetaStablePool implements PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    swapFeeScaled: BigNumber;
    totalShares: string;
    tokens: MetaStablePoolToken[];
    tokensList: string[];
    AMP_PRECISION: BigNumber;
    MAX_IN_RATIO: BigNumber;
    MAX_OUT_RATIO: BigNumber;
    ampAdjusted: BigNumber;
    constructor(
        id: string,
        address: string,
        amp: string,
        swapFee: string,
        totalShares: string,
        tokens: MetaStablePoolToken[],
        tokensList: string[]
    );
    setTypeForSwap(type: SwapPairType): void;
    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): MetaStablePoolPairData;
    getNormalizedLiquidity(poolPairData: MetaStablePoolPairData): BigNumber;
    getLimitAmountSwap(
        poolPairData: MetaStablePoolPairData,
        swapType: SwapTypes
    ): BigNumber;
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void;
    _exactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactTokenInForBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactBPTInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _BPTInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmoutGivenIn(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evminGivenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmexactTokenInForBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmexactBPTInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmtokenInForExactBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmbptInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber;
}
