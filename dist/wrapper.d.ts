import { ethers } from 'ethers';
import { BigNumber } from './utils/bignumber';
import { Swap, PoolDictionary, Path, EffectivePrice } from './types';
interface ProcessedData {
    pools: PoolDictionary;
    paths: Path[];
    epsOfInterest: EffectivePrice[];
}
interface ProcessedCache {
    [PairId: string]: ProcessedData;
}
export declare class SOR {
    isSubgraphFetched: boolean;
    isOnChainFetched: boolean;
    subgraphPools: any;
    subgraphPoolsFormatted: any;
    onChainPools: any;
    provider: ethers.providers.JsonRpcProvider;
    multicallAddress: string;
    gasPrice: BigNumber;
    swapCost: BigNumber;
    tokenCost: any;
    maxPools: number;
    processedCache: ProcessedCache;
    constructor(
        Provider: ethers.providers.JsonRpcProvider,
        GasPrice: BigNumber,
        MaxPools: number
    );
    fetchSubgraphPools(SubgraphUrl?: string): Promise<void>;
    fetchOnChainPools(MulticallAddr?: string): Promise<void>;
    setCostOutputToken(TokenOut: string, Cost?: BigNumber): Promise<void>;
    getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        SubgraphUrl?: string,
        MulticallAddr?: string
    ): Promise<[Swap[][], BigNumber]>;
    getSwapsWithoutCache(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        SubgraphUrl: string,
        MulticallAddr: string
    ): Promise<[Swap[][], BigNumber]>;
    getSwapsWithCache(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        SubgraphUrl: string,
        MulticallAddr: string
    ): Promise<[Swap[][], BigNumber]>;
}
export {};
