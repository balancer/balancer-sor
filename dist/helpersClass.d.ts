import { BigNumber } from './utils/bignumber';
import {
    NewPath,
    PoolDictionary,
    SwapTypes,
    PoolBase,
    PoolPairBase,
    Swap,
    SwapInfo,
} from './types';
import { BaseProvider } from '@ethersproject/providers';
export declare function getHighestLimitAmountsForPaths(
    paths: NewPath[],
    maxPools: number
): BigNumber[];
export declare function getEffectivePriceSwapForPath(
    pools: PoolDictionary,
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber;
export declare function getOutputAmountSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber;
export declare function getSpotPriceAfterSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber;
export declare function getOutputAmountSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber;
export declare function getSpotPriceAfterSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber;
export declare function getDerivativeSpotPriceAfterSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber;
export declare function getDerivativeSpotPriceAfterSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber;
export declare function EVMgetOutputAmountSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber;
export declare function formatSwaps(
    swapsOriginal: Swap[][],
    swapType: SwapTypes,
    swapAmount: BigNumber,
    tokenIn: string,
    tokenOut: string,
    returnAmount: BigNumber,
    returnAmountConsideringFees: BigNumber,
    marketSp: BigNumber
): SwapInfo;
export interface WrappedInfo {
    swapAmountOriginal: BigNumber;
    swapAmountForSwaps: BigNumber;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
}
export interface TokenInfo {
    addressOriginal: string;
    addressForSwaps: string;
    wrapType: WrapTypes;
    rate: BigNumber;
}
export declare enum WrapTypes {
    None = 0,
    ETH = 1,
    stETH = 2,
}
export declare function getWrappedInfo(
    provider: BaseProvider,
    swapType: SwapTypes,
    tokenIn: string,
    tokenOut: string,
    chainId: number,
    swapAmount: BigNumber
): Promise<WrappedInfo>;
export declare function setWrappedInfo(
    swapInfo: SwapInfo,
    swapType: SwapTypes,
    wrappedInfo: WrappedInfo,
    chainId: number
): SwapInfo;
