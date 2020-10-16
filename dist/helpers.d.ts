import { BigNumber } from './utils/bignumber';
import {
    PoolPairData,
    Path,
    Pool,
    PoolDictionary,
    Swap,
    DisabledOptions,
    DisabledToken,
    SubGraphPools,
} from './types';
export declare function toChecksum(address: any): string;
export declare function getLimitAmountSwap(
    poolPairData: PoolPairData,
    swapType: string
): BigNumber;
export declare function getLimitAmountSwapPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    poolPairData: any
): BigNumber;
export declare function getSpotPricePath(
    pools: PoolDictionary,
    path: Path,
    poolPairData: any
): BigNumber;
export declare function getSpotPrice(poolPairData: PoolPairData): BigNumber;
export declare function getSlippageLinearizedSpotPriceAfterSwapPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    poolPairData: any
): BigNumber;
export declare function getSlippageLinearizedSpotPriceAfterSwap(
    poolPairData: PoolPairData,
    swapType: string
): BigNumber;
export declare function getReturnAmountSwapPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber;
export declare function getReturnAmountSwap(
    pools: PoolDictionary,
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber;
export declare function updateTokenBalanceForPool(
    pool: any,
    token: string,
    balance: BigNumber
): any;
export declare function getNormalizedLiquidity(
    poolPairData: PoolPairData
): BigNumber;
export declare const parsePoolData: (
    directPools: PoolDictionary,
    tokenIn: string,
    tokenOut: string,
    mostLiquidPoolsFirstHop?: Pool[],
    mostLiquidPoolsSecondHop?: Pool[],
    hopTokens?: string[]
) => [PoolDictionary, Path[]];
export declare const parsePoolPairData: (
    p: Pool,
    tokenIn: string,
    tokenOut: string
) => PoolPairData;
export declare function getTokenPairsMultiHop(
    token: string,
    poolsTokensListSet: any
): unknown[][];
export declare function filterPoolsWithTokensDirect(
    allPools: Pool[], // The complete information of the pools
    tokenIn: string,
    tokenOut: string,
    disabledOptions?: DisabledOptions
): PoolDictionary;
export declare function filterPoolsWithoutMutualTokens(
    allPools: Pool[],
    tokenOne: string,
    tokenTwo: string,
    disabledTokens?: DisabledToken[]
): [PoolDictionary, Set<string>, PoolDictionary, Set<string>];
export declare function filterPoolsWithTokensMultihop(
    allPools: Pool[], // Just the list of pool tokens
    tokenIn: string,
    tokenOut: string,
    disabledOptions?: DisabledOptions
): [Pool[], Pool[], string[]];
export declare const formatSubgraphPools: (pools: any) => void;
export declare function filterPools(
    allPools: Pool[], // The complete information of the pools
    tokenIn: string,
    tokenOut: string,
    disabledOptions?: DisabledOptions
): [PoolDictionary, string[], PoolDictionary, PoolDictionary];
export declare function sortPoolsMostLiquid(
    tokenIn: string,
    tokenOut: string,
    hopTokens: string[],
    poolsTokenInNoTokenOut: PoolDictionary,
    poolsTokenOutNoTokenIn: PoolDictionary
): [Pool[], Pool[]];
export declare function checkSwapsExactIn(
    swaps: Swap[][],
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    totalAmtOut: BigNumber,
    allPoolsNonZeroBalances: any
): [Swap[][], BigNumber];
export declare function checkSwapsExactOut(
    swaps: Swap[][],
    tokenIn: string,
    tokenOut: string,
    amountOut: BigNumber,
    totalAmtIn: BigNumber,
    allPoolsNonZeroBalances: any
): [Swap[][], BigNumber];
export declare function calcInGivenOutForPool(
    Pools: any,
    PoolAddr: string,
    TokenIn: string,
    TokenOut: string,
    AmtIn: any
): BigNumber;
export declare function getPoolsFromSwaps(
    Swaps: Swap[][],
    subGraphPools: SubGraphPools
): SubGraphPools;
