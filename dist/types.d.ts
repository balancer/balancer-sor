import { BigNumber } from './utils/bignumber';
export interface PoolPairData {
    id: string;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber;
    weightOut: BigNumber;
    swapFee: BigNumber;
}
export interface Path {
    id: string;
    swaps: Swap[];
    spotPrice?: BigNumber;
    slippage?: BigNumber;
    limitAmount?: BigNumber;
    slippagePriceFactor?: BigNumber;
}
export interface EffectivePrice {
    price?: BigNumber;
    id?: string;
    maxAmount?: string;
    swap?: string[];
    amounts?: BigNumber[];
    bestPools?: string[];
}
export interface Price {
    price?: BigNumber;
    id?: string;
    maxAmount?: string;
    swap?: string[];
    amounts?: BigNumber[];
    bestPathsIds?: string[];
}
export declare type Swap = {
    pool: string;
    tokenIn: string;
    tokenOut: string;
    swapAmount?: string;
    limitReturnAmount?: string;
    maxPrice?: string;
};
export interface Pools {
    pools: Pool[];
}
export interface Pool {
    id: string;
    swapFee: BigNumber;
    totalWeight: BigNumber;
    tokens: Token[];
    tokensList: string[];
}
export interface Token {
    address: string;
    balance: BigNumber;
    decimals: number;
    denormWeight: BigNumber;
}
export interface SubGraphPools {
    pools: SubGraphPool[];
}
export interface SubGraphPool {
    id: string;
    swapFee: string;
    totalWeight: string;
    publicSwap: string;
    tokens: SubGraphToken[];
    tokensList: string[];
}
export interface SubGraphToken {
    address: string;
    balance: string;
    decimals: string;
    denormWeight: string;
}
export interface PoolDictionary {
    [poolId: string]: Pool;
}
export interface DisabledOptions {
    isOverRide: boolean;
    disabledTokens: DisabledToken[];
}
export interface DisabledToken {
    address: string;
    symbol: string;
}
