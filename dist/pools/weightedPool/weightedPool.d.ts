import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
} from '../../types';
export interface WeightedPoolToken {
    address: string;
    balance: string;
    decimals: string | number;
    weight?: string;
}
export interface WeightedPoolPairData extends PoolPairBase {
    id: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber;
    weightOut: BigNumber;
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
}
export declare class WeightedPool implements PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    swapFee: string;
    totalShares: string;
    tokens: WeightedPoolToken[];
    totalWeight: string;
    tokensList: string[];
    constructor(
        id: string,
        swapFee: string,
        totalWeight: string,
        totalShares: string,
        tokens: WeightedPoolToken[],
        tokensList: string[]
    );
    setTypeForSwap(type: SwapPairType): void;
    parsePoolPairData(tokenIn: string, tokenOut: string): WeightedPoolPairData;
    getNormalizedLiquidity(poolPairData: WeightedPoolPairData): BigNumber;
    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): BigNumber;
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void;
    _exactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _exactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _tokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _BPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmoutGivenIn(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmexactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmexactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evminGivenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmtokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
    _evmbptInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber;
}
