import { BigNumber } from './utils/bignumber';
export interface PoolPairData {
    id: string;
    poolType?: string;
    pairType?: string;
    tokenIn: string;
    tokenOut: string;
    balanceIn?: BigNumber;
    balanceOut?: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    swapFee: BigNumber;
    weightIn?: BigNumber;
    weightOut?: BigNumber;
    allBalances: BigNumber[];
    invariant?: BigNumber;
    amp?: BigNumber;
    tokenIndexIn?: number;
    tokenIndexOut?: number;
    lpShares?: BigNumber;
    time?: BigNumber;
    principalToken?: string;
    baseToken?: string;
}
export interface Path {
    id: string;
    swaps: Swap[];
    poolPairData?: PoolPairData[];
    limitAmount?: BigNumber;
    filterEffectivePrice?: BigNumber;
}
export declare type Swap = {
    pool: string;
    tokenIn: string;
    tokenOut: string;
    swapAmount?: string;
    limitReturnAmount?: string;
    maxPrice?: string;
    tokenInDecimals: number;
    tokenOutDecimals: number;
};
export interface SubGraphPools {
    pools: SubGraphPool[];
}
export interface SubGraphPool {
    id: string;
    swapFee: string;
    totalWeight: string;
    totalShares: string;
    tokens: SubGraphToken[];
    tokensList: string[];
    poolType?: string;
    amp: string;
    lpShares?: BigNumber;
    time?: BigNumber;
    principalToken?: string;
    baseToken?: string;
}
export interface SubGraphToken {
    address: string;
    balance: string;
    decimals: string | number;
    weight?: string;
}
export interface SubGraphPoolDictionary {
    [poolId: string]: SubGraphPool;
}
export interface DisabledOptions {
    isOverRide: boolean;
    disabledTokens: DisabledToken[];
}
export interface DisabledToken {
    address: string;
    symbol: string;
}
export interface SwapV2 {
    poolId: string;
    assetInIndex: number;
    assetOutIndex: number;
    amount: string;
    userData: string;
}
export interface SwapInfo {
    tokenAddresses: string[];
    swaps: SwapV2[];
    swapAmount: BigNumber;
    returnAmount: BigNumber;
    tokenIn: string;
    tokenOut: string;
    marketSp: BigNumber;
}
export declare enum SwapTypes {
    SwapExactIn = 0,
    SwapExactOut = 1,
}
export declare enum PoolTypes {
    Weighted = 0,
    Stable = 1,
    Element = 2,
}
export declare enum SwapPairType {
    Direct = 0,
    HopIn = 1,
    HopOut = 2,
}
export declare enum PairTypes {
    BptToToken = 0,
    TokenToBpt = 1,
    TokenToToken = 2,
}
export interface PoolDictionary {
    [poolId: string]: PoolBase;
}
export interface PoolPairDictionary {
    [tokenInOut: string]: PoolPairBase;
}
export interface PoolPairBase {
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    decimalsIn: number;
    decimalsOut: number;
}
export interface NewPath {
    id: string;
    swaps: Swap[];
    poolPairData: PoolPairBase[];
    limitAmount: BigNumber;
    pools: PoolBase[];
    filterEffectivePrice?: BigNumber;
}
export interface SubGraphPoolsBase {
    pools: SubgraphPoolBase[];
}
export interface SubgraphPoolBase {
    id: string;
    address: string;
    poolType: string;
    swapFee: string;
    totalShares: string;
    tokens: SubGraphToken[];
    tokensList: string[];
    totalWeight?: string;
    amp?: string;
    lpShares?: BigNumber;
    time?: BigNumber;
    principalToken?: string;
    baseToken?: string;
}
export interface PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    tokensList: string[];
    parsePoolPairData: (tokenIn: string, tokenOut: string) => PoolPairBase;
    getNormalizedLiquidity: (poolPairData: PoolPairBase) => BigNumber;
    getLimitAmountSwap: (
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ) => BigNumber;
    updateTokenBalanceForPool: (token: string, newBalance: BigNumber) => void;
    _exactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _exactTokenInForBPTOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _exactBPTInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _tokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _tokenInForExactBPTOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _BPTInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _spotPriceAfterSwapExactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _spotPriceAfterSwapExactTokenInForBPTOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _spotPriceAfterSwapExactBPTInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _spotPriceAfterSwapTokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _spotPriceAfterSwapTokenInForExactBPTOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _spotPriceAfterSwapBPTInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _evmoutGivenIn: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _evmexactTokenInForBPTOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _evmexactBPTInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _evminGivenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _evmtokenInForExactBPTOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _evmbptInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
}
export interface WeightedPool extends PoolBase {
    totalWeight: string;
}
