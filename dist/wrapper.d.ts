import { BaseProvider } from '@ethersproject/providers';
import { BigNumber } from './utils/bignumber';
import { SwapInfo, DisabledOptions, SwapTypes, SubGraphPoolsBase, SwapOptions } from './index';
export declare class SOR {
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
    constructor(provider: BaseProvider, gasPrice: BigNumber, maxPools: number, chainId: number, poolsSource: string | SubGraphPoolsBase, swapCost?: BigNumber, disabledOptions?: DisabledOptions);
    setCostOutputToken(tokenOut: string, tokenDecimals: number, cost?: BigNumber): Promise<BigNumber>;
    fetchPools(isOnChain?: boolean, poolsData?: SubGraphPoolsBase): Promise<boolean>;
    private fetchOnChainBalances;
    getSwaps(tokenIn: string, tokenOut: string, swapType: SwapTypes, swapAmt: BigNumber, swapOptions?: SwapOptions): Promise<SwapInfo>;
    processSwaps(tokenIn: string, tokenOut: string, swapType: SwapTypes, swapAmt: BigNumber, onChainPools: SubGraphPoolsBase, useProcessCache?: boolean, currentBlockTimestamp?: number): Promise<SwapInfo>;
}
