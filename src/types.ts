import { BigNumber } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber } from './utils/bignumber';

export interface SorConfig {
    chainId: number;
    vault: string;
    weth: string;
    connectingTokens?: { symbol: string; address: string }[];
    staBal3Pool?: { id: string; address: string };
    usdcConnectingPool?: { id: string; usdc: string };
    wETHwstETH?: { id: string; address: string };
    lbpRaisingTokens?: string[];
}

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
    Linear,
    Gyro2,
    Gyro3,
    GyroE,
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
    returnAmount?: string;
}

export interface SubgraphPoolBase {
    id: string;
    address: string;
    poolType: string;
    swapFee: string;
    swapEnabled: boolean;
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

    // Linear specific fields
    mainIndex?: number;
    wrappedIndex?: number;
    lowerTarget?: string;
    upperTarget?: string;

    // Gyro2 specific fields
    sqrtAlpha?: string;
    sqrtBeta?: string;

    // Gyro3 specific field
    root3Alpha?: string;

    // GyroE specific fields
    alpha?: string;
    beta?: string;
    c?: string;
    s?: string;
    lambda?: string;
    tauAlphaX?: string;
    tauAlphaY?: string;
    tauBetaX?: string;
    tauBetaY?: string;
    u?: string;
    v?: string;
    w?: string;
    z?: string;
    dSq?: string;
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
    returnAmount?: string;
}

export interface SwapInfo {
    tokenAddresses: string[];
    swaps: SwapV2[];
    swapAmount: BigNumber;
    swapAmountForSwaps: BigNumber; // Used with stETH/wstETH
    returnAmount: BigNumber;
    returnAmountFromSwaps: BigNumber; // Used with stETH/wstETH
    returnAmountConsideringFees: BigNumber;
    tokenIn: string;
    tokenInForSwaps?: string; // Used with stETH/wstETH
    tokenOut: string;
    tokenOutFromSwaps?: string; // Used with stETH/wstETH
    marketSp: string;
}

export interface PoolDictionary {
    [poolId: string]: PoolBase;
}

export interface PoolPairDictionary {
    [tokenInOut: string]: PoolPairBase;
}

export interface hopDictionary {
    [hopToken: string]: Set<string>; // the set of pool ids
}

export interface NewPath {
    id: string; // pool address if direct path, contactenation of pool addresses if multihop
    swaps: Swap[];
    poolPairData: PoolPairBase[];
    limitAmount: BigNumber;
    pools: PoolBase[];
    filterEffectivePrice?: OldBigNumber; // TODO: This is just used for filtering, maybe there is a better way to filter?
}

export enum PoolFilter {
    All = 'All',
    Weighted = 'Weighted',
    Stable = 'Stable',
    MetaStable = 'MetaStable',
    LBP = 'LiquidityBootstrapping',
    Investment = 'Investment',
    Element = 'Element',
    StablePhantom = 'StablePhantom',
    ComposableStable = 'ComposableStable',
    Gyro2 = 'Gyro2',
    Gyro3 = 'Gyro3',
    GyroE = 'GyroE',
    // Linear Pools defined below all operate the same mathematically but have different factories and names in Subgraph
    AaveLinear = 'AaveLinear',
    Linear = 'Linear',
    EulerLinear = 'EulerLinear',
    ERC4626Linear = 'ERC4626Linear',
    BeefyLinear = 'BeefyLinear',
    GearboxLinear = 'GearboxLinear',
    MidasLinear = 'MidasLinear',
    ReaperLinear = 'ReaperLinear',
    SiloLinear = 'SiloLinear',
    TetuLinear = 'TetuLinear',
    YearnLinear = 'YearnLinear',
}

export interface PoolBase<D extends PoolPairBase = PoolPairBase> {
    poolType: PoolTypes;
    id: string;
    address: string;
    tokensList: string[];
    tokens: { address: string; balance: string; decimals: number }[];
    totalShares: BigNumber;
    mainIndex?: number;
    isLBP?: boolean;
    parsePoolPairData: (tokenIn: string, tokenOut: string) => D;
    getNormalizedLiquidity: (poolPairData: D) => OldBigNumber;
    getLimitAmountSwap: (poolPairData: D, swapType: SwapTypes) => OldBigNumber;
    /**
     * @param {string} token - Address of token.
     * @param {BigNumber} newBalance - New balance of token. EVM scaled.
     */
    updateTokenBalanceForPool: (token: string, newBalance: BigNumber) => void;
    updateTotalShares: (newTotalShares: BigNumber) => void;
    _exactTokenInForTokenOut: (
        poolPairData: D,
        amount: OldBigNumber
    ) => OldBigNumber;
    _tokenInForExactTokenOut: (
        poolPairData: D,
        amount: OldBigNumber
    ) => OldBigNumber;
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[];
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber;
    _spotPriceAfterSwapExactTokenInForTokenOut: (
        poolPairData: D,
        amount: OldBigNumber
    ) => OldBigNumber;
    _spotPriceAfterSwapTokenInForExactTokenOut: (
        poolPairData: D,
        amount: OldBigNumber
    ) => OldBigNumber;
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut: (
        poolPairData: D,
        amount: OldBigNumber
    ) => OldBigNumber;
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut: (
        poolPairData: D,
        amount: OldBigNumber
    ) => OldBigNumber;
}

export interface WeightedPool<D extends PoolPairBase> extends PoolBase<D> {
    totalWeight: string;
}

export interface TokenPriceService {
    /**
     * This should return the price of the native asset (ETH) in the token defined by tokenAddress.
     * Example: BAL = $20 USD, ETH = $4,000 USD, then 1 ETH = 200 BAL. This function would return 200.
     * @param tokenAddress
     */
    getNativeAssetPriceInToken(tokenAddress: string): Promise<string>;
}

export interface PoolDataService {
    getPools(): Promise<SubgraphPoolBase[]>;
}

export type FundManagement = {
    sender: string;
    recipient: string;
    fromInternalBalance: boolean;
    toInternalBalance: boolean;
};
