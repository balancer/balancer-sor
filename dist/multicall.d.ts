import { ethers } from 'ethers';
import { PoolPairData, Pools, SubGraphPools } from './types';
export declare function parsePoolDataOnChain(
    pools: any,
    tokenIn: string,
    tokenOut: string,
    multiAddress: string,
    provider: ethers.providers.Web3Provider
): Promise<PoolPairData[]>;
export declare function getAllPoolDataOnChain(
    pools: SubGraphPools,
    multiAddress: string,
    provider: ethers.providers.Web3Provider
): Promise<Pools>;
export declare function getAllPoolDataOnChainNew(
    pools: SubGraphPools,
    multiAddress: string,
    provider: ethers.providers.Web3Provider
): Promise<Pools>;
