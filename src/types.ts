import { BigNumber } from './utils/bignumber';

export enum SwapTypes {
    SwapExactIn,
    SwapExactOut,
}

export enum PoolTypes {
    Weighted,
    Stable,
    Element,
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

    // Weighted & Element field
    totalWeight?: string;

    // Stable specific fields
    amp?: string;

    // Element specific fields
    lpShares?: BigNumber;
    expiryTime?: BigNumber;
    unitSeconds?: BigNumber;
    principalToken?: string;
    baseToken?: string;
}

export interface SubGraphToken {
    address: string;
    balance: string;
    decimals: string | number;
    // Stable & Element field
    weight?: string;
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
