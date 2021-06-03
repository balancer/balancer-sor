import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
} from '../../types';
export interface ElementPoolToken {
    address: string;
    balance: string;
    decimals: string | number;
}
export interface ElementPoolPairData extends PoolPairBase {
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
    totalShares: BigNumber;
    expiryTime: number;
    unitSeconds: number;
    principalToken: string;
    baseToken: string;
    currentBlockTimestamp: number;
}
export declare class ElementPool implements PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    swapFee: string;
    totalShares: string;
    tokens: ElementPoolToken[];
    tokensList: string[];
    expiryTime: number;
    unitSeconds: number;
    principalToken: string;
    baseToken: string;
    currentBlockTimestamp: number;
    constructor(
        id: string,
        swapFee: string,
        totalShares: string,
        tokens: ElementPoolToken[],
        tokensList: string[],
        expiryTime: number,
        unitSeconds: number,
        principalToken: string,
        baseToken: string
    );
    setCurrentBlockTimestamp(timestamp: number): void;
    setTypeForSwap(type: SwapPairType): void;
    parsePoolPairData(tokenIn: string, tokenOut: string): ElementPoolPairData;
    getNormalizedLiquidity(poolPairData: ElementPoolPairData): BigNumber;
    getLimitAmountSwap(
        poolPairData: ElementPoolPairData,
        swapType: SwapTypes
    ): BigNumber;
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void;
    _exactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactTokenInForBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactBPTInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _BPTInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmoutGivenIn: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmexactTokenInForBPTOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmexactBPTInForTokenOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evminGivenOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmtokenInForExactBPTOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmbptInForExactTokenOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
}
