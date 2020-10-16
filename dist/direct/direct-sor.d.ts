import { BigNumber } from '../utils/bignumber';
import { Pool, Swap, SwapAmount, EffectivePrice } from './types';
export declare const smartOrderRouter: (
    balancers: Pool[],
    swapType: string,
    targetInputAmount: BigNumber,
    maxBalancers: number,
    costOutputToken: BigNumber
) => SwapAmount[];
export declare const smartOrderRouterEpsOfInterest: (
    balancers: Pool[],
    swapType: string,
    targetInputAmount: BigNumber,
    maxBalancers: number,
    costOutputToken: BigNumber,
    epsOfInterest: EffectivePrice[]
) => SwapAmount[];
export declare const calcTotalOutput: (
    swaps: Swap[],
    poolData: Pool[]
) => BigNumber;
export declare const calcTotalInput: (
    swaps: Swap[],
    poolData: Pool[]
) => BigNumber;
export declare const formatSwapsExactAmountIn: (
    sorSwaps: SwapAmount[],
    maxPrice: BigNumber,
    minAmountOut: BigNumber
) => Swap[];
export declare const formatSwapsExactAmountOut: (
    sorSwaps: SwapAmount[],
    maxPrice: BigNumber,
    maxAmountIn: BigNumber
) => Swap[];
export declare function processBalancers(
    balancers: Pool[],
    swapType: string
): Pool[];
export declare function processEpsOfInterest(
    sortedBalancers: Pool[],
    swapType: string
): EffectivePrice[];
