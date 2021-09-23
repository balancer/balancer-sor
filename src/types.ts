import { BigNumber } from './utils/bignumber';

export type NoNullableField<T> = {
    [P in keyof T]: NonNullable<T[P]>;
};

export enum SwapTypes {
    SwapExactIn,
    SwapExactOut,
}

export enum PoolTypes {
    Weighted,
    Stable,
    Element,
    MetaStable,
}

export enum SwapPairType {
    Direct,
    HopIn,
    HopOut,
}

export interface SwapOptions {
    gasPrice: BigNumber;
    swapGas: BigNumber;
    timestamp: number;
    maxPools: number;
    poolTypeFilter: PoolFilter;
    forceRefresh: boolean;
}

export type PoolPairBase = {
    id: string;
    address: string;
    poolType: PoolTypes;
    swapFee: BigNumber;
    tokenIn: string;
    tokenOut: string;
    decimalsIn: number;
    decimalsOut: number;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
};

export interface Swap {
    pool: string;
    tokenIn: string;
    tokenOut: string;
    swapAmount?: string;
    limitReturnAmount?: string;
    maxPrice?: string;
    tokenInDecimals: number;
    tokenOutDecimals: number;
}

export interface SubgraphPoolBase {
    id: string;
    address: string;
    poolType: string;
    swapFee: string;
    totalShares: string;
    tokens: SubgraphToken[];
    tokensList: string[];

    // Weighted & Element field
    totalWeight?: string;

    // Stable specific fields
    amp?: string;

    // Element specific fields
    expiryTime?: number;
    unitSeconds?: number;
    principalToken?: string;
    baseToken?: string;

    // LBP specific fields
    swapEnabled?: boolean;
}

export type SubgraphToken = {
    address: string;
    balance: string;
    decimals: number;
    priceRate: string;
    // WeightedPool field
    weight: string | null;
};

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
    swapAmountForSwaps?: BigNumber; // Used with stETH/wstETH
    returnAmount: BigNumber;
    returnAmountFromSwaps?: BigNumber; // Used with stETH/wstETH
    returnAmountConsideringFees: BigNumber;
    tokenIn: string;
    tokenOut: string;
    marketSp: BigNumber;
}

export interface PoolDictionary {
    [poolId: string]: PoolBase;
}

export interface PoolPairDictionary {
    [tokenInOut: string]: PoolPairBase;
}

export interface NewPath {
    id: string; // pool address if direct path, contactenation of pool addresses if multihop
    swaps: Swap[];
    poolPairData: PoolPairBase[];
    limitAmount: BigNumber;
    pools: PoolBase[];
    filterEffectivePrice?: BigNumber; // TODO: This is just used for filtering, maybe there is a better way to filter?
}

export enum PoolFilter {
    All = 'All',
    Weighted = 'Weighted',
    Stable = 'Stable',
    MetaStable = 'MetaStable',
    LBP = 'LiquidityBootstrapping',
}

export interface PoolBase {
    poolType: PoolTypes;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    tokensList: string[];
    setTypeForSwap: (type: SwapPairType) => void;
    parsePoolPairData: (tokenIn: string, tokenOut: string) => PoolPairBase;
    getNormalizedLiquidity: (poolPairData: PoolPairBase) => BigNumber;
    getLimitAmountSwap: (
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ) => BigNumber;
    updateTokenBalanceForPool: (token: string, newBalance: BigNumber) => void;
    _exactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber,
        exact: boolean
    ) => BigNumber;
    _tokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber,
        exact: boolean
    ) => BigNumber;
    _spotPriceAfterSwapExactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _spotPriceAfterSwapTokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut: (
        poolPairData: PoolPairBase,
        amount: BigNumber
    ) => BigNumber;
}

export interface WeightedPool extends PoolBase {
    totalWeight: string;
}
