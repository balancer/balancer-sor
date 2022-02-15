export type TokenState = {
    balance: bigint;
    scalingFactor?: bigint; // It includes the token priceRate
    weight?: bigint;
};

export type PoolState = {
    tokens: {
        [address: string]: TokenState;
    };
    swapFee: bigint;
    amp?: bigint;
    // Linear Pools
    mainIndex?: number;
    wrappedIndex?: number;
    bptIndex?: number;
    lowerTarget?: bigint;
    upperTarget?: bigint;
};

type SubgraphToken = {
    address: string;
    decimals: number;
};

export interface SubgraphPoolBase {
    id: string;
    address: string;
    poolType: string;
    tokens: SubgraphToken[];
    swapFee?: string;
}

export interface callData {
    target: string;
    callData: string;
}

export interface Prices {
    prices: bigint[];
    data: {
        poolId: string;
    };
}
