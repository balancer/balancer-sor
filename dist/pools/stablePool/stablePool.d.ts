import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
} from '../../types';
export interface StablePoolToken {
    address: string;
    balance: string;
    decimals: string | number;
}
export interface StablePoolPairData extends PoolPairBase {
    id: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    allBalances: BigNumber[];
    invariant: BigNumber;
    amp: BigNumber;
    tokenIndexIn: number;
    tokenIndexOut: number;
}
export declare class StablePool implements PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    amp: string;
    swapFee: string;
    totalShares: string;
    tokens: StablePoolToken[];
    tokensList: string[];
    constructor(
        id: string,
        amp: string,
        swapFee: string,
        totalShares: string,
        tokens: StablePoolToken[],
        tokensList: string[]
    );
    setTypeForSwap(type: SwapPairType): void;
    parsePoolPairData(tokenIn: string, tokenOut: string): StablePoolPairData;
    getNormalizedLiquidity(poolPairData: StablePoolPairData): BigNumber;
    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): BigNumber;
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void;
    _exactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactTokenInForBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactBPTInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _BPTInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmoutGivenIn: (
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmexactTokenInForBPTOut: (
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmexactBPTInForTokenOut: (
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evminGivenOut: (
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmtokenInForExactBPTOut: (
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmbptInForExactTokenOut: (
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ) => BigNumber;
}
