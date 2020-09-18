const BigNumber = require('bignumber.js');
import { PoolPairData } from '../src/types';
import { parsePoolPairData } from '../src/helpers';
import { calcOutGivenIn, calcInGivenOut } from '../src/bmath';

export function getAmountOut(
    Pools,
    PoolAddr: string,
    TokenIn: string,
    TokenOut: string,
    AmtIn
) {
    const swapPool = Pools.pools.find(p => p.id === PoolAddr);

    let pool: PoolPairData = parsePoolPairData(swapPool, TokenIn, TokenOut);

    const amtOut = calcOutGivenIn(
        pool.balanceIn,
        pool.weightIn,
        pool.balanceOut,
        pool.weightOut,
        AmtIn,
        pool.swapFee
    );

    return amtOut;
}

export function getAmountIn(
    Pools,
    PoolAddr: string,
    TokenIn: string,
    TokenOut: string,
    AmtIn
) {
    const swapPool = Pools.pools.find(p => p.id === PoolAddr);

    let pool: PoolPairData = parsePoolPairData(swapPool, TokenIn, TokenOut);

    const amtOut = calcInGivenOut(
        pool.balanceIn,
        pool.weightIn,
        pool.balanceOut,
        pool.weightOut,
        AmtIn,
        pool.swapFee
    );

    return amtOut;
}
