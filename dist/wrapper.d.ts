import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import { SubGraphPools, Swap, Pools } from './types';
export declare class SOR {
    provider: JsonRpcProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    swapCost: BigNumber;
    tokenCost: {};
    onChainCache: Pools;
    poolsForPairsCache: {};
    processedDataCache: {};
    ipfs: any;
    isAllFetched: boolean;
    MULTIADDR: {
        [chainId: number]: string;
    };
    IPNS: {
        [chainId: number]: string;
    };
    constructor(
        Provider: JsonRpcProvider,
        GasPrice: BigNumber,
        MaxPools: number,
        ChainId: number
    );
    setCostOutputToken(TokenOut: string, Cost?: BigNumber): Promise<void>;
    fetchPools(): Promise<boolean>;
    fetchOnChainPools(SubgraphPools: SubGraphPools): Promise<Pools>;
    getSwaps(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber
    ): Promise<[Swap[][], BigNumber]>;
    getSwapsWithCache(
        TokenIn: string,
        TokenOut: string,
        SwapType: string,
        SwapAmt: BigNumber,
        OnChainPools: Pools,
        UserProcessCache?: boolean
    ): Promise<[Swap[][], BigNumber]>;
    fetchFilteredPairPools(
        TokenIn: string,
        TokenOut: string,
        SwapType: string
    ): Promise<void>;
}
