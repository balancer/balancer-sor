import { Web3Provider } from '@ethersproject/providers';
import { PoolPairData, Pools, SubGraphPools } from './types';
export declare function parsePoolDataOnChain(
    pools: any,
    tokenIn: string,
    tokenOut: string,
    multiAddress: string,
    provider: Web3Provider
): Promise<PoolPairData[]>;
export declare function getAllPoolDataOnChain(
    pools: SubGraphPools,
    multiAddress: string,
    provider: Web3Provider
): Promise<Pools>;
