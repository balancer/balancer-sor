import { BigNumber } from './utils/bignumber';
import { SwapTypes, NewPath, PoolDictionary, Swap } from './types';
export declare const MAX_UINT: string;
export declare function calculatePathLimits(
    paths: NewPath[],
    swapType: SwapTypes
): [NewPath[], BigNumber];
export declare function getLimitAmountSwapForPath(
    path: NewPath,
    swapType: SwapTypes
): BigNumber;
export declare const smartOrderRouter: (
    pools: PoolDictionary,
    paths: NewPath[],
    swapType: SwapTypes,
    totalSwapAmount: BigNumber,
    maxPools: number,
    costReturnToken: BigNumber
) => [Swap[][], BigNumber, BigNumber, BigNumber];
export declare const calcTotalReturn: (
    paths: NewPath[],
    swapType: SwapTypes,
    swapAmounts: BigNumber[]
) => BigNumber;
