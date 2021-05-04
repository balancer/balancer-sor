import {
    DisabledOptions,
    SubgraphPoolBase,
    SubGraphPoolsBase,
    PoolDictionary,
    NewPath,
} from './types';
export declare function getPoolsFromUrl(
    URL: string
): Promise<SubGraphPoolsBase>;
export declare function filterPoolsOfInterest(
    allPools: SubgraphPoolBase[],
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    disabledOptions?: DisabledOptions
): [PoolDictionary, string[]];
export declare function filterHopPools(
    tokenIn: string,
    tokenOut: string,
    hopTokens: string[],
    poolsOfInterest: PoolDictionary
): [PoolDictionary, NewPath[]];
