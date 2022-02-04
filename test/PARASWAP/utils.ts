import { parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';

import { BZERO } from '../../src/utils/basicOperations';
import { SubgraphPoolBase } from '../../src';

export type Token = {
    address: string;
    balance: bigint;
    decimals: number;
    priceRate: bigint;
    // WeightedPool field
    weight: bigint;
};

export interface PoolBase {
    id: string;
    address: string;
    poolType: string;
    swapFee: bigint;
    swapEnabled: boolean;
    tokens: Token[];
    tokensList: string[];

    // Weighted & Element field
    totalWeight: bigint;

    // Stable specific fields
    amp: bigint;

    // Linear specific fields
    mainIndex: number;
    wrappedIndex: number;
    lowerTarget: bigint;
    upperTarget: bigint;
}

export function poolToEvm(pool: SubgraphPoolBase): PoolBase {
    const AMP_DECIMALS = 3;
    const totalWeight = pool.totalWeight
        ? parseFixed(pool.totalWeight, 18).toBigInt()
        : BZERO;
    const amp = pool.amp
        ? parseFixed(pool.amp, AMP_DECIMALS).toBigInt()
        : BZERO;
    const mainIndex = pool.mainIndex ? pool.mainIndex : 0;
    const wrappedIndex = pool.wrappedIndex ? pool.wrappedIndex : 0;
    const lowerTarget = pool.lowerTarget
        ? parseFixed(pool.lowerTarget, 18).toBigInt()
        : BZERO;
    const upperTarget = pool.upperTarget
        ? parseFixed(pool.upperTarget, 18).toBigInt()
        : BZERO;

    const tokens: Token[] = [];
    pool.tokens.forEach((token) => {
        const weight = token.weight
            ? parseFixed(token.weight, 18).mul(ONE).div(totalWeight).toBigInt()
            : BZERO;
        tokens.push({
            address: token.address,
            weight,
            balance: parseFixed(token.balance, token.decimals).toBigInt(),
            decimals: token.decimals,
            priceRate: parseFixed(token.priceRate, 18).toBigInt(),
        });
    });

    return {
        id: pool.id,
        address: pool.address,
        poolType: pool.poolType,
        swapFee: parseFixed(pool.swapFee, 18).toBigInt(),
        swapEnabled: pool.swapEnabled,
        tokens,
        tokensList: pool.tokensList,
        // Weighted & Element field
        totalWeight,
        // Stable specific fields
        amp,
        // Linear specific fields
        mainIndex,
        wrappedIndex,
        lowerTarget,
        upperTarget,
    };
}
