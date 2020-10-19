import { JsonRpcProvider } from '@ethersproject/providers';
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
    provider: JsonRpcProvider;
    multicallAddress: string;
    gasPrice: BigNumber;
    swapCost: BigNumber;
    tokenCost: any;
    maxPools: number;
    processedCache: ProcessedCache;
    constructor(
        Provider: JsonRpcProvider,
        GasPrice: BigNumber,
        MaxPools: number
    );
    fetchSubgraphPools(SubgraphUrl?: string): Promise<void>;
    fetchOnChainPools(MulticallAddr?: string): Promise<void>;
    setCostOutputToken(TokenOut: string, Cost?: BigNumber): Promise<void>;
    onChainCheck(
        Swaps: Swap[][],
        Total: BigNumber,
        SwapType: string,
        TokenIn: string,
        TokenOut: string,
        SwapAmt: BigNumber,
        MulticallAddr: string
    ): Promise<[Swap[][], BigNumber]>;
    getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        CheckOnChain?: boolean,
        MulticallAddr?: string
    ): Promise<[Swap[][], BigNumber]>;
}
export {};
