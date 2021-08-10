import {
    DisabledOptions,
    SubgraphPoolBase,
    PoolDictionary,
    NewPath,
} from './types';
import { WeightedPool } from './pools/weightedPool/weightedPool';
import { StablePool } from './pools/stablePool/stablePool';
import { ElementPool } from './pools/elementPool/elementPool';
export declare function filterPoolsOfInterest(
    allPools: SubgraphPoolBase[],
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    disabledOptions?: DisabledOptions,
    currentBlockTimestamp?: number
): [PoolDictionary, string[]];
export declare function parseNewPool(
    pool: SubgraphPoolBase,
    currentBlockTimestamp?: number
): WeightedPool | StablePool | ElementPool | undefined;
export declare function filterHopPools(
    tokenIn: string,
    tokenOut: string,
    hopTokens: string[],
    poolsOfInterest: PoolDictionary
): [PoolDictionary, NewPath[]];
