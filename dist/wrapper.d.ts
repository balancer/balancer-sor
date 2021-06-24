import { BaseProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import {
    SwapInfo,
    DisabledOptions,
    SwapTypes,
    SubGraphPoolsBase,
} from './types';
export declare class SOR {
    MULTIADDR: {
        [chainId: number]: string;
    };
    VAULTADDR: {
        [chainId: number]: string;
    };
    WETHADDR: {
        [chainId: number]: string;
    };
    provider: BaseProvider;
    gasPrice: BigNumber;
    maxPools: number;
    chainId: number;
    swapCost: BigNumber;
    isUsingPoolsUrl: Boolean;
    poolsUrl: string;
    subgraphPools: SubGraphPoolsBase;
    tokenCost: {};
    onChainBalanceCache: SubGraphPoolsBase;
    processedDataCache: {};
    finishedFetchingOnChain: boolean;
    disabledOptions: DisabledOptions;
    constructor(
        provider: BaseProvider,
        gasPrice: BigNumber,
        maxPools: number,
        chainId: number,
        poolsSource: string | SubGraphPoolsBase,
        swapCost?: BigNumber,
        disabledOptions?: DisabledOptions
    );
    setCostOutputToken(
        tokenOut: string,
        tokenDecimals: number,
        cost?: BigNumber
    ): Promise<BigNumber>;
    fetchPools(
        isOnChain?: boolean,
        poolsData?: SubGraphPoolsBase
    ): Promise<boolean>;
    private fetchOnChainBalances;
    getSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmt: BigNumber,
        timestamp?: number
    ): Promise<SwapInfo>;
    processSwaps(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        swapAmt: BigNumber,
        onChainPools: SubGraphPoolsBase,
        wrapOptions: any,
        useProcessCache?: boolean,
        currentBlockTimestamp?: number
    ): Promise<SwapInfo>;
}
