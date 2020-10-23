import { BigNumber } from './utils/bignumber';
import {
    PoolPairData,
    Path,
    Pool,
    PoolDictionary,
    DisabledOptions,
} from './types';
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
export declare function calcInGivenOutForPool(
    Pools: any,
    PoolAddr: string,
    TokenIn: string,
    TokenOut: string,
    AmtIn: any
): BigNumber;
