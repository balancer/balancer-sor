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
    marketSp: BigNumber,
    wrapOptions?: {
        isEthSwap: boolean;
        wethAddress: string;
    }
): SwapInfo;
