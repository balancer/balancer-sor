import { BigNumber } from './utils/bignumber';

// TODO: add poolType and pairType
// TODO: rename balanceIn -> Bi to easily use maths from python
export interface PoolPairData {
    id: string;
    poolType?: string; // Todo: make this a mandatory field
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn?: BigNumber; // Weights are only defined for weighted pools
    weightOut?: BigNumber; // Weights are only defined for weighted pools
    swapFee: BigNumber;
    allBalances: BigNumber[]; // Only for stable pools
    invariant?: BigNumber; // Only for stable pools
    amp?: BigNumber; // Only for stable pools
    tokenIndexIn?: number; // Only for stable pools
    tokenIndexOut?: number; // Only for stable pools
}

export interface Path {
    id: string; // pool address if direct path, contactenation of pool addresses if multihop
    swaps: Swap[];
    poolPairData?: PoolPairData[];
    limitAmount?: BigNumber;
    filterEffectivePrice?: BigNumber; // TODO: This is just used for filtering, maybe there is a better way to filter?
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

export type Swap = {
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
    amp?: BigNumber;
    totalWeight?: BigNumber;
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
    amp?: BigNumber;
    totalWeight: string;
    publicSwap: string;
    tokens: SubGraphToken[];
    tokensList: string[];
}

export interface SubGraphToken {
    address: string;
    balance: string;
    decimals: string;
    denormWeight?: string;
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
