import { BigNumber } from './utils/bignumber';
import {
    PoolPairData,
    Path,
    Pool,
    PoolDictionary,
    DisabledOptions,
    DisabledToken,
} from './types';
export declare function toChecksum(address: any): string;
export declare function getLimitAmountSwap(
    poolPairData: PoolPairData,
    swapType: string
): BigNumber;
export declare function getLimitAmountSwapPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string
): BigNumber;
export declare function getSpotPricePath(
    pools: PoolDictionary,
    path: Path
): BigNumber;
export declare function getSpotPrice(poolPairData: PoolPairData): BigNumber;
export declare function getSlippageLinearizedSpotPriceAfterSwapPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string
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
): Promise<[Pool[], Pool[], string[]]>;
export declare const formatSubgraphPools: (pools: any) => void;
