import { BigNumber } from './utils/bignumber';
import { Path, Swap, EffectivePrice, PoolDictionary } from './types';
export declare const MAX_UINT: import('@ethersproject/bignumber').BigNumber;
export declare function processPaths(
    paths: Path[],
    pools: PoolDictionary,
    swapType: string
): Path[];
export declare function processEpsOfInterestMultiHop(
    sortedPaths: Path[],
    swapType: string,
    maxPools: number
): EffectivePrice[];
export declare const smartOrderRouterMultiHopEpsOfInterest: (
    pools: PoolDictionary,
    paths: Path[],
    swapType: string,
    totalSwapAmount: BigNumber,
    maxPools: number,
    costReturnToken: BigNumber,
    pricesOfInterest: EffectivePrice[]
) => [Swap[][], BigNumber];
export declare const calcTotalReturn: (
    pools: PoolDictionary,
    paths: Path[],
    swapType: string,
    pathIds: string[],
    swapAmounts: BigNumber[]
) => BigNumber;
