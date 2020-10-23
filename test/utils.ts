import * as sor from '../src';
import { BigNumber } from '../src/utils/bignumber';
import { PoolPairData, Swap, SubGraphPools, DisabledToken } from '../src/types';
import { parsePoolPairData } from '../src/helpers';
import {
    calcOutGivenIn,
    calcInGivenOut,
    bnum,
    scale,
    bmul,
    BONE,
} from '../src/bmath';
import { expect, assert } from 'chai';
import { ethers } from 'ethers';

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

export function testSwapsExactIn(
    swaps: Swap[][],
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    totalAmtOut: BigNumber,
    allPoolsNonZeroBalances
) {
    let totalOut = bnum(0);
    let totalIn = bnum(0);

    for (let i = 0; i < swaps.length; i++) {
        if (swaps[i].length === 1) {
            assert.equal(swaps[i][0].tokenIn, tokenIn);
            assert.equal(swaps[i][0].tokenOut, tokenOut);
            totalIn = totalIn.plus(swaps[i][0].swapAmount);
            let amtOutFirstSequence = getAmountOut(
                allPoolsNonZeroBalances,
                swaps[i][0].pool,
                swaps[i][0].tokenIn,
                swaps[i][0].tokenOut,
                bnum(swaps[i][0].swapAmount)
            );
            totalOut = totalOut.plus(amtOutFirstSequence);
        } else {
            assert.equal(swaps[i][0].tokenIn, tokenIn);
            assert.equal(swaps[i][1].tokenIn, swaps[i][0].tokenOut);
            assert.equal(swaps[i][1].tokenOut, tokenOut);
            totalIn = totalIn.plus(swaps[i][0].swapAmount);

            let amtOutFirstSequence = getAmountOut(
                allPoolsNonZeroBalances,
                swaps[i][0].pool,
                swaps[i][0].tokenIn,
                swaps[i][0].tokenOut,
                bnum(swaps[i][0].swapAmount)
            );
            assert.equal(
                swaps[i][1].swapAmount,
                amtOutFirstSequence.toString()
            );

            let amtOutSecondSequence = getAmountOut(
                allPoolsNonZeroBalances,
                swaps[i][1].pool,
                swaps[i][1].tokenIn,
                swaps[i][1].tokenOut,
                bnum(swaps[i][1].swapAmount)
            );
            totalOut = totalOut.plus(amtOutSecondSequence);
        }
    }

    assert.equal(totalIn.toString(), amountIn.toString());
    assert.equal(totalOut.toString(), totalAmtOut.toString());
}

export function testSwapsExactOut(
    swaps: Swap[][],
    tokenIn: string,
    tokenOut: string,
    amountOut: BigNumber,
    totalAmtIn: BigNumber,
    allPoolsNonZeroBalances
) {
    let totalOut = bnum(0);
    let totalIn = bnum(0);

    for (let i = 0; i < swaps.length; i++) {
        if (swaps[i].length === 1) {
            assert.equal(swaps[i][0].tokenIn, tokenIn);
            assert.equal(swaps[i][0].tokenOut, tokenOut);
            totalOut = totalOut.plus(swaps[i][0].swapAmount);
            let amtInFirstSequence = getAmountIn(
                allPoolsNonZeroBalances,
                swaps[i][0].pool,
                swaps[i][0].tokenIn,
                swaps[i][0].tokenOut,
                bnum(swaps[i][0].swapAmount)
            );
            totalIn = totalIn.plus(amtInFirstSequence);
        } else {
            assert.equal(swaps[i][0].tokenIn, tokenIn);

            let amtInSecondSequence = getAmountIn(
                allPoolsNonZeroBalances,
                swaps[i][1].pool,
                swaps[i][1].tokenIn,
                swaps[i][1].tokenOut,
                swaps[i][1].swapAmount
            );
            assert.equal(
                swaps[i][0].swapAmount,
                amtInSecondSequence.toString()
            ); // Amount out of first swap which is input to second swap
            assert.equal(swaps[i][1].tokenIn, swaps[i][0].tokenOut);
            assert.equal(swaps[i][1].tokenOut, tokenOut);
            totalOut = totalOut.plus(swaps[i][1].swapAmount);

            let amtInFirstSequence = getAmountIn(
                allPoolsNonZeroBalances,
                swaps[i][0].pool,
                swaps[i][0].tokenIn,
                swaps[i][0].tokenOut,
                bnum(swaps[i][0].swapAmount)
            ); // Swap amount is amount out

            totalIn = totalIn.plus(amtInFirstSequence);
        }
    }

    expect(totalOut.toString()).to.eql(amountOut.toString());
    // expect(totalAmtIn.toString()).to.eql(totalIn.toString());
}

// Filters for only pools with balance and converts to wei/bnum format.
export function formatAndFilterPools(
    allPools: SubGraphPools,
    disabledTokens: DisabledToken[] = []
) {
    let allTokens = [];
    let allTokensSet = new Set();
    let allPoolsNonZeroBalances = { pools: [] };

    for (let pool of allPools.pools) {
        // Build list of non-zero balance pools
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0) {
            if (pool.tokens[0].balance != '0') {
                let tokens = [];
                pool.tokensList.forEach(token => {
                    if (
                        !disabledTokens.find(
                            t =>
                                ethers.utils.getAddress(t.address) ===
                                ethers.utils.getAddress(token)
                        )
                    ) {
                        tokens.push(token);
                    }
                });

                if (tokens.length > 1) {
                    allTokens.push(tokens.sort()); // Will add without duplicate
                }

                allPoolsNonZeroBalances.pools.push(pool);
            }
        }
    }

    allTokensSet = new Set(
        Array.from(new Set(allTokens.map(a => JSON.stringify(a))), json =>
            JSON.parse(json)
        )
    );

    // Formats Subgraph to wei/bnum format
    sor.formatSubgraphPools(allPoolsNonZeroBalances);

    return [allTokensSet, allPoolsNonZeroBalances];
}

export function filterPools(allPools: any) {
    let allTokens = [];
    let allTokensSet = new Set();
    let allPoolsNonZeroBalances = [];

    let i = 0;

    for (let pool of allPools.pools) {
        // Build list of non-zero balance pools
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0) {
            if (pool.tokens[0].balance != '0') {
                allTokens.push(pool.tokensList.sort()); // Will add without duplicate
                allPoolsNonZeroBalances.push(pool);
                i++;
            }
        }
    }

    allTokensSet = new Set(
        Array.from(new Set(allTokens.map(a => JSON.stringify(a))), json =>
            JSON.parse(json)
        )
    );

    return [allTokensSet, allPoolsNonZeroBalances];
}

export function fullSwap(
    allPoolsNonZeroBalances,
    tokenIn,
    tokenOut,
    swapType,
    noPools,
    amount,
    disabledTokens
): [Swap[][], BigNumber] {
    let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
        allPoolsNonZeroBalances.pools,
        tokenIn,
        tokenOut,
        {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        }
    );

    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
    ] = sor.sortPoolsMostLiquid(
        tokenIn,
        tokenOut,
        hopTokens,
        poolsTokenIn,
        poolsTokenOut
    );

    let pools, pathData;
    [pools, pathData] = sor.parsePoolData(
        directPools,
        tokenIn,
        tokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    let paths = sor.processPaths(pathData, pools, swapType);

    let epsOfInterest = sor.processEpsOfInterestMultiHop(
        paths,
        swapType,
        noPools
    );

    let swaps: Swap[][], total: BigNumber;
    [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
        JSON.parse(JSON.stringify(pools)),
        paths,
        swapType,
        amount,
        noPools,
        new BigNumber(0),
        epsOfInterest
    );

    return [swaps, total];
}

export function alterPools(allPools: any) {
    for (let pool of allPools.pools) {
        if (pool.tokens.length != 0) {
            pool.tokens.forEach(token => {
                // let change = Math.random() * (1.4 - 0.6) + 0.6;
                let change = Math.random() * (1.1 - 0.9) + 0.9;
                // change = 1.0001;
                let changeBn = scale(bnum(change), 18);
                // let change = bnum(1100000000000000000) // 1.1
                let balanceBn = scale(bnum(token.balance), token.decimals);
                let newBalanceBn = bmul(balanceBn, changeBn);
                newBalanceBn = scale(newBalanceBn, -token.decimals);
                token.balance = newBalanceBn.toString();
            });
        }
    }

    return allPools;
}

// Returns two arrays
// First array contains all tokens in direct pools containing tokenIn
// Second array contains all tokens in multi-hop pools containing tokenIn
export function getTokenPairsMultiHop(token: string, poolsTokensListSet: any) {
    let poolsWithToken = [];
    let poolsWithoutToken = [];

    let directTokenPairsSet = new Set();

    // If pool contains token add all its tokens to direct list
    poolsTokensListSet.forEach((poolTokenList, index) => {
        if (poolTokenList.includes(token)) {
            poolsWithToken.push(poolTokenList);
        } else {
            poolsWithoutToken.push(poolTokenList);
        }
    });

    directTokenPairsSet = new Set([].concat(...poolsWithToken));

    let multihopTokenPools = [];
    let multihopTokenPairsSet = new Set();

    poolsWithoutToken.forEach((pool, index) => {
        let intersection = [...pool].filter(x =>
            [...directTokenPairsSet].includes(x)
        );
        if (intersection.length != 0) {
            multihopTokenPools.push(pool);
        }
    });

    multihopTokenPairsSet = new Set([].concat(...multihopTokenPools));
    let allTokenPairsSet = new Set();
    allTokenPairsSet = new Set([
        ...directTokenPairsSet,
        ...multihopTokenPairsSet,
    ]);

    let directTokenPairs = [...directTokenPairsSet];
    let allTokenPairs = [...allTokenPairsSet];
    return [directTokenPairs, allTokenPairs];
}
