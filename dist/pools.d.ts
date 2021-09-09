import {
    DisabledOptions,
    SubgraphPoolBase,
    PoolDictionary,
    NewPath,
} from './types';
export declare function filterPoolsOfInterest(
    allPools: SubgraphPoolBase[],
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    disabledOptions: DisabledOptions,
    currentBlockTimestamp: number,
    chainId: any
): [PoolDictionary, string[]];
export declare function filterHopPools(
    tokenIn: string,
    tokenOut: string,
    hopTokens: string[],
    poolsOfInterest: PoolDictionary
): [PoolDictionary, NewPath[]];
export declare function addPathsUsingLinearPools(
    tokenIn: string,
    tokenOut: string,
    chainId: number,
    poolsOfInterest: PoolDictionary
): [PoolDictionary, NewPath[]];
