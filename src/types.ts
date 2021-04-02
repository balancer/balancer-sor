import { BigNumber } from './utils/bignumber';

// TODO: add poolType and pairType
// TODO: rename balanceIn -> Bi to easily use maths from python
export interface PoolPairData {
    id: string;
    poolType?: string; // Todo: make this a mandatory field?
    pairType?: string; // Todo: make this a mandatory field?
    tokenIn: string;
    tokenOut: string;
    balanceIn?: BigNumber;
    balanceOut?: BigNumber;
    weightIn?: BigNumber; // Weights are only defined for weighted pools
    weightOut?: BigNumber; // Weights are only defined for weighted pools
    swapFee: BigNumber;
    allBalances: BigNumber[]; // Only for stable pools
    invariant?: BigNumber; // Only for stable pools
    amp?: BigNumber; // Only for stable pools
    tokenIndexIn?: number; // Only for stable pools
    tokenIndexOut?: number; // Only for stable pools
    decimalsIn: number;
    decimalsOut: number;
}

export interface Path {
    id: string; // pool address if direct path, contactenation of pool addresses if multihop
    swaps: Swap[];
    poolPairData?: PoolPairData[];
    limitAmount?: BigNumber;
    filterEffectivePrice?: BigNumber; // TODO: This is just used for filtering, maybe there is a better way to filter?
}

export type Swap = {
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
    amp: string;
    totalWeight: string;
    balanceBpt: string;
    tokens: SubGraphToken[];
    tokensList: string[];
}

export interface SubGraphToken {
    address: string;
    balance: string;
    decimals: string | number;
    denormWeight?: string;
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
    tokenInIndex: number;
    tokenOutIndex: number;
    amountIn?: string;
    amountOut?: string;
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
// NEW CLASS CODE
export enum SwapTypes {
    SwapExactIn,
    SwapExactOut,
}

export enum PoolTypes {
    Weighted,
    Stable,
}

export enum SwapPairType {
    Direct,
    HopIn,
    HopOut,
}

export enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

export interface PoolDictionary {
    [poolId: string]: PoolBase;
}

export interface PoolPairDictionary {
    [tokenInOut: string]: PoolPairBase;
}

// TODO - This will change with SG schema update
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
    id: string; // pool address if direct path, contactenation of pool addresses if multihop
    swaps: Swap[];
    poolPairData: PoolPairBase[];
    limitAmount: BigNumber;
    pools: PoolBase[];
    filterEffectivePrice?: BigNumber; // TODO: This is just used for filtering, maybe there is a better way to filter?
}

export interface SubgraphPoolBase {
    id: string;
    swapFee: string;
    totalShares: string;
    tokens: SubGraphToken[];
    tokensList: string[];
    amp?: string;
    totalWeight?: string;
}

export interface PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    tokensList: string[];
    parsePoolPairData: (tokenIn: string, tokenOut: string) => PoolPairBase;
    getNormalizedLiquidity: (poolPairData: PoolPairBase) => BigNumber;
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
