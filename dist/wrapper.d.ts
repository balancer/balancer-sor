import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import { SubGraphPools, Swap, Pools } from './types';
interface FetchedTokens {
    [Token: string]: boolean;
}
export declare class SOR {
    provider: JsonRpcProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    swapCost: BigNumber;
    tokenCost: {};
    fetchedTokens: FetchedTokens;
    subgraphCache: SubGraphPools;
    onChainCache: Pools;
    processedDataCache: {};
    MULTIADDR: {
        [chainId: number]: string;
    };
    SUBGRAPH_URL: {
        [chainId: number]: string;
    };
    constructor(
        Provider: JsonRpcProvider,
        GasPrice: BigNumber,
        MaxPools: number,
        ChainId: number
    );
    setCostOutputToken(TokenOut: string, Cost?: BigNumber): Promise<void>;
    fetchOnChainPools(SubgraphPools: SubGraphPools): Promise<Pools>;
    fetchPairPools(
        TokenIn: string,
        TokenOut: string,
        PurgeCache?: boolean
    ): Promise<boolean>;
    hasPairPools(TokenIn: any, TokenOut: any): boolean;
    updateOnChainBalances(): Promise<boolean>;
    private fetchNewPools;
    private updatePools;
    purgeCaches(): void;
    getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        PurgeCache?: boolean
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
