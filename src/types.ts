import { BigNumber } from './utils/bignumber';

export interface Pool {
    id: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber;
    weightOut: BigNumber;
    swapFee: BigNumber;
}

export interface Path {
    id: string;
    pools: Pool[];
    spotPrice?: BigNumber;
    slippage?: BigNumber;
    limitAmount?: BigNumber;
}

export interface SwapAmount {
    pool: string;
    amount: BigNumber;
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
    tokenInParam: string;
    tokenOutParam: string;
    maxPrice: string;
};
