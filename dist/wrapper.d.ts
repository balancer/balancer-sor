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
    gasPrice: BigNumber;
    swapCost: BigNumber;
    tokenCost: any;
    maxPools: number;
    processedCache: ProcessedCache;
    chainId: number;
    MULTIADDR: {
        [chainId: number]: string;
    };
    SUBGRAPH_URL: {
        [chainId: number]: string;
    };
    constructor(
        Provider: ethers.providers.JsonRpcProvider,
        GasPrice: BigNumber,
        MaxPools: number,
        ChainId: number
    );
    fetchSubgraphPools(): Promise<void>;
    fetchOnChainPools(): Promise<void>;
    setCostOutputToken(TokenOut: string, Cost?: BigNumber): Promise<void>;
    getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber
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
