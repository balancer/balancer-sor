import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
} from '../../types';
export interface LinearPoolToken {
    address: string;
    balance: string;
    decimals: string | number;
}
export interface LinearPoolPairData extends PoolPairBase {
    id: string;
    address: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    rate: BigNumber;
    target1: BigNumber;
    target2: BigNumber;
}
export declare class LinearPool implements PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: string;
    tokens: LinearPoolToken[];
    tokensList: string[];
    rate: BigNumber;
    target1: BigNumber;
    target2: BigNumber;
    MAX_IN_RATIO: BigNumber;
    MAX_OUT_RATIO: BigNumber;
    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: LinearPoolToken[],
        tokensList: string[],
        rate: string,
        target1: string,
        target2: string
    );
    setTypeForSwap(type: SwapPairType): void;
    parsePoolPairData(tokenIn: string, tokenOut: string): LinearPoolPairData;
    getNormalizedLiquidity(poolPairData: LinearPoolPairData): BigNumber;
    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): BigNumber;
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void;
    _exactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _BPTInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmoutGivenIn(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmexactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmexactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evminGivenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmtokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmbptInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: BigNumber
    ): BigNumber;
}
