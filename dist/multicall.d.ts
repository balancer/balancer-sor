import { BaseProvider } from '@ethersproject/providers';
import { Pools, SubGraphPools } from './types';
export declare function getAllPoolDataOnChain(
    pools: SubGraphPools,
    multiAddress: string,
    provider: BaseProvider
): Promise<Pools>;
