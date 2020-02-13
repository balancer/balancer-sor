import { BigNumber } from './utils/bignumber';

export interface Pool {
    id: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber;
    weightOut: BigNumber;
    swapFee: BigNumber;
    spotPrice: BigNumber;
    slippage: BigNumber;
}

export interface SwapAmount {
    pool: string;
    amount: BigNumber;
}

export interface EffectivePrice {
    price?: BigNumber;
    id?: string;
    swap?: string[];
    amounts?: BigNumber[];
    bestPools?: string[];
}

export interface Solution {
    swaps: SwapAmount[];
    totalOutput: BigNumber;
}
