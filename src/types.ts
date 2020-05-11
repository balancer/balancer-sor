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
    poolPairDataList: PoolPairData[];
    spotPrice?: BigNumber;
    slippage?: BigNumber;
    limitAmount?: BigNumber;
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
    swapAmount: string;
    limitReturnAmount: string;
    maxPrice: string;
};
