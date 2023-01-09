import { PoolBase, PoolPairBase } from '../types';
import { BigNumber as OldBigNumber } from '../utils/bignumber';

export type PoolAddressDictionary = {
    [address: string]: PoolBase;
};

export type PoolPairMap = {
    [tokenInTokenOut: string]: {
        poolPair: PoolPairBase;
        normalizedLiquidity: OldBigNumber;
    }[];
};

export interface PathGraphEdgeLabel {
    poolId: string;
    poolAddress: string;
    normalizedLiquidity: OldBigNumber;
    poolPair: PoolPairBase;
    isPhantomBptHop: boolean;
}

export interface PathGraphEdge extends PathGraphEdgeLabel {
    tokenIn: string;
    tokenOut: string;
}

export interface PathGraphTraversalConfig {
    maxDepth: number;
    maxNonBoostedPathDepth: number;
    maxNonBoostedSegmentsInBoostedPath: number;
    approxPathsToReturn: number;
}
