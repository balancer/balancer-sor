// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/stableMath.spec.ts
import { assert } from 'chai';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { SubgraphPoolBase } from '../src/types';
import { BigNumber as OldBigNumber, bnum } from '../src/utils/bignumber';
import * as stableMath from '../src/pools/stablePool/stableMath';
import {
    StablePool,
    StablePoolPairData,
} from '../src/pools/stablePool/stablePool';
import {
    PhantomStablePool,
    PhantomStablePoolPairData,
} from '../src/pools/phantomStablePool/phantomStablePool';
import * as stableMathBigInt from '../src/pools/stablePool/stableMathBigInt';
import {
    bbaUSD,
    LINEAR_AUSDT,
    LINEAR_AUSDC,
    DAI,
    USDC,
    USDT,
} from './lib/constants';
import { MathSol } from '../src/utils/basicOperations';

import poolsFromFile from './testData/stablePools/stablePoolWithBPT.json';
import phantomStablePool from './testData/phantomStablePools/phantomStableStabal3WithPriceRates.json';

const oldBN_ONE = bnum(ONE.toString());

describe('Stable Math', () => {
    context('Non-preminted', () => {
        const pool = poolsFromFile.pools[0] as SubgraphPoolBase;
        const stableBptSwapPool = StablePool.fromPool(pool);
        // tokens: DAI, USDC, USDT in this order
        let poolPairData: StablePoolPairData;
        poolPairData = createPoolPairData(
            stableBptSwapPool,
            USDT.address,
            DAI.address
        );
        const amount = 5000000000000;
        const error = 0.00001;

        context('stable pools', () => {
            it('spotPriceTokenToken', () => {
                const delta = 0.01;
                const error = 0.00001;
                checkDerivative_TokToTok(
                    stableMathBigInt._calcOutGivenIn,
                    stableMathBigInt._spotPriceAfterSwapExactTokenInForTokenOut,
                    10,
                    [15000, 30000, 10000],
                    0,
                    1,
                    100,
                    0.01,
                    delta,
                    error,
                    true
                );
                checkDerivative_TokToTok(
                    stableMathBigInt._calcOutGivenIn,
                    stableMathBigInt._spotPriceAfterSwapExactTokenInForTokenOut,
                    10,
                    [15000, 30000, 10000],
                    0,
                    1,
                    100,
                    0.01,
                    delta,
                    error,
                    true
                );

                checkDerivative_TokToTok(
                    stableMathBigInt._calcInGivenOut,
                    stableMathBigInt._spotPriceAfterSwapTokenInForExactTokenOut,
                    10,
                    [10000, 10000, 10000],
                    0,
                    1,
                    10,
                    0.01,
                    delta,
                    error,
                    false
                );
            });

            it('spotPriceTokenBPT', () => {
                const delta = 0.01;
                const error = 0.00001;
                checkDerivative_ExactTokenBPT(
                    stableMathBigInt._calcBptOutGivenExactTokensIn,
                    stableMathBigInt._spotPriceAfterSwapExactTokenInForBPTOut,
                    10,
                    [15000, 30000, 10000],
                    10000,
                    1,
                    100,
                    delta,
                    error,
                    true
                );
                checkDerivative_ExactTokenBPT(
                    stableMathBigInt._calcBptInGivenExactTokensOut,
                    stableMathBigInt._spotPriceAfterSwapBPTInForExactTokenOut,
                    10,
                    [15000, 30000, 10000],
                    10000,
                    1,
                    100,
                    delta,
                    error,
                    false
                );
                checkDerivative_exactBPTToken(
                    stableMathBigInt._calcTokenInGivenExactBptOut,
                    stableMathBigInt._spotPriceAfterSwapTokenInForExactBPTOut,
                    10,
                    [2000, 1000, 1000],
                    0,
                    1,
                    10000,
                    0.0001,
                    0.0001,
                    false
                );
                checkDerivative_exactBPTToken(
                    stableMathBigInt._calcTokenOutGivenExactBptIn,
                    stableMathBigInt._spotPriceAfterSwapExactBPTInForTokenOut,
                    10,
                    [2000, 1000, 1000],
                    0,
                    1,
                    10000,
                    0.0001,
                    0.0001,
                    true
                );
            });
        });

        context('spot price after swap', () => {
            it('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
                poolPairData = createPoolPairData(
                    stableBptSwapPool,
                    USDT.address,
                    USDC.address
                );
                checkDerivative(
                    stableMath._exactTokenInForTokenOut,
                    stableMath._spotPriceAfterSwapExactTokenInForTokenOut,
                    poolPairData,
                    amount,
                    10000,
                    error,
                    true
                );
            });

            it('_spotPriceAfterSwapTokenInForExactTokenOut', () => {
                poolPairData = createPoolPairData(
                    stableBptSwapPool,
                    USDT.address,
                    USDC.address
                );
                checkDerivative(
                    stableMath._tokenInForExactTokenOut,
                    stableMath._spotPriceAfterSwapTokenInForExactTokenOut,
                    poolPairData,
                    amount,
                    10000,
                    error,
                    false
                );
            });
        });

        context('derivatives of spot price after swap', () => {
            it('_derivativeSpotPriceAfterSwapExactTokenInForTokenOut', () => {
                poolPairData = createPoolPairData(
                    stableBptSwapPool,
                    USDT.address,
                    USDC.address
                );
                checkDerivative(
                    stableMath._spotPriceAfterSwapExactTokenInForTokenOut,
                    stableMath._derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
                    poolPairData,
                    amount,
                    10000,
                    error,
                    false
                );
            });

            it('_derivativeSpotPriceAfterSwapTokenInForExactTokenOut', () => {
                poolPairData = createPoolPairData(
                    stableBptSwapPool,
                    USDT.address,
                    USDC.address
                );
                checkDerivative(
                    stableMath._spotPriceAfterSwapTokenInForExactTokenOut,
                    stableMath._derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
                    poolPairData,
                    amount,
                    100000,
                    error,
                    false
                );
            });
        });
    });
    context('Preminted', () => {
        const error = 0.00001;
        const pool = PhantomStablePool.fromPool(phantomStablePool.pools[0]);
        it('token -> token', () => {
            const poolPairData = pool.parsePoolPairData(
                LINEAR_AUSDC.address,
                LINEAR_AUSDT.address
            );
            const priceRateIn = bnum(
                formatFixed(poolPairData.tokenInPriceRate, 18)
            );
            const priceRateOut = bnum(
                formatFixed(poolPairData.tokenOutPriceRate, 18)
            );
            const { a1, a2 } = getSwapOutcomes(pool, poolPairData, 4000);
            const b1 = stableMath
                ._exactTokenInForTokenOut(
                    bnum(4000).times(priceRateIn),
                    poolPairData
                )
                .div(priceRateOut);
            const b2 = stableMath
                ._tokenInForExactTokenOut(
                    bnum(4000).times(priceRateOut),
                    poolPairData
                )
                .div(priceRateIn);
            assert.approximately(
                a1.div(b1).toNumber(),
                1,
                error,
                'wrong result'
            );
            assert.approximately(
                a2.div(b2).toNumber(),
                1,
                error,
                'wrong result'
            );
            // spot price
            checkSpotPrices(pool, poolPairData, 4000, error);
            checkDerivativeSpotPrices(pool, poolPairData, 4000, error);
        });

        it('BPT -> token', () => {
            const poolPairData = pool.parsePoolPairData(
                bbaUSD.address,
                LINEAR_AUSDC.address
            );
            // swap outcomes
            // compares phantomStableMath with stableMathBigInt
            const amount = 4000;
            const outMath = stableMath._exactBPTInForTokenOut(
                bnum(amount),
                poolPairData
            );
            const outBigInt = stableMathBigInt._calcTokenOutGivenExactBptIn(
                poolPairData.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                poolPairData.tokenIndexOut,
                ONE.mul(amount).toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                poolPairData.swapFee.toBigInt()
            );
            const bnumOutBigInt = bnum(outBigInt.toString()).div(oldBN_ONE);
            assert.approximately(
                outMath.div(bnumOutBigInt).toNumber(),
                1,
                error,
                'wrong result'
            );

            const inMath = stableMath._BPTInForExactTokenOut(
                bnum(amount),
                poolPairData
            );
            const amountsOutBigInt = Array(
                poolPairData.allBalancesScaled.length
            ).fill(BigInt(0));
            amountsOutBigInt[poolPairData.tokenIndexIn] = parseFixed(
                amount.toString(),
                18
            ).toBigInt();

            const inBigInt = stableMathBigInt._calcBptInGivenExactTokensOut(
                poolPairData.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                amountsOutBigInt,
                poolPairData.virtualBptSupply.toBigInt(),
                poolPairData.swapFee.toBigInt()
            );
            const bnumInBigInt = bnum(inBigInt.toString()).div(oldBN_ONE);
            assert.approximately(
                inMath.div(bnumInBigInt).toNumber(),
                1,
                error,
                'wrong result'
            );
            // spot prices
            poolPairData.swapFee = BigNumber.from(0);
            const spPhantom =
                stableMath._spotPriceAfterSwapExactBPTInForTokenOut(
                    bnum(0),
                    poolPairData
                );

            const balances = poolPairData.allBalancesScaled.map((balance) =>
                balance.toBigInt()
            );
            const spBigInt =
                stableMathBigInt._spotPriceAfterSwapExactBPTInForTokenOut(
                    poolPairData.amp.toBigInt(),
                    balances,
                    poolPairData.tokenIndexOut,
                    pool.totalShares.toBigInt(),
                    BigInt(0)
                );
            const bnumSpBigInt = bnum(spBigInt.toString()).div(oldBN_ONE);
            assert.approximately(
                spPhantom.div(bnumSpBigInt).toNumber(),
                1,
                error,
                'wrong result'
            );
            checkSpotPrices(pool, poolPairData, amount, error);
        });
        it('token -> BPT', () => {
            const poolPairData = pool.parsePoolPairData(
                LINEAR_AUSDC.address,
                bbaUSD.address
            );
            poolPairData.swapFee = BigNumber.from(0);

            // here we should compare phantomStableMath with stableMathBigInt
            // like in the previous case, BPT -> token.
            const { a1, a2 } = getSwapOutcomes(pool, poolPairData, 4000);
            const priceRateIn = bnum(
                formatFixed(poolPairData.tokenInPriceRate, 18)
            );
            const b1 = stableMath._exactTokenInForBPTOut(
                bnum(4000).times(priceRateIn),
                poolPairData
            );
            assert.approximately(
                a1.div(b1).toNumber(),
                1,
                error,
                'wrong result'
            );
            const b2 = stableMath
                ._tokenInForExactBPTOut(bnum(4000), poolPairData)
                .div(priceRateIn);
            assert.approximately(
                a2.div(b2).toNumber(),
                1,
                error,
                'wrong result'
            );
            // spot price:
            checkSpotPrices(pool, poolPairData, 4000, error);
        });
    });
});

function checkDerivative(
    fn: (
        amount: OldBigNumber,
        poolPairData: StablePoolPairData
    ) => OldBigNumber,
    der: (
        amount: OldBigNumber,
        poolPairData: StablePoolPairData
    ) => OldBigNumber,
    poolPairData: StablePoolPairData,
    amount: number,
    delta: number,
    error: number,
    inverse = false
) {
    const x = bnum(amount);
    let incrementalQuotient = fn(x.plus(delta), poolPairData)
        .minus(fn(x, poolPairData))
        .div(delta);
    if (inverse) incrementalQuotient = bnum(1).div(incrementalQuotient);
    const der_ans = der(x, poolPairData);
    const d = 10 ** -10;
    assert.approximately(
        // adding d to both numerator and denominator prevents large relative errors
        // when numbers are very small (even division by zero in some cases).
        incrementalQuotient.plus(d).div(der_ans.plus(d)).toNumber(),
        1,
        error,
        'wrong result'
    );
}

function createPoolPairData(
    pool: StablePool,
    tokenIn: string,
    tokenOut: string
): StablePoolPairData {
    const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);
    poolPairData.allBalances.splice(-1);
    poolPairData.allBalancesScaled.splice(-1);
    return poolPairData;
}

//////
function getSwapOutcomes(
    pool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number
): { a1: OldBigNumber; a2: OldBigNumber } {
    const a1 = pool._exactTokenInForTokenOut(poolPairData, bnum(amount));
    const a2 = pool._tokenInForExactTokenOut(poolPairData, bnum(amount));
    return { a1, a2 };
}

function checkSpotPrices(
    pool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    error: number
) {
    // exact token in
    let a = incrementalQuotientExactTokenInForTokenOut(
        pool,
        poolPairData,
        amount,
        0.01
    );
    let b = pool._spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData,
        bnum(amount)
    );
    assert.approximately(
        a.times(b).toNumber(),
        1,
        error,
        'wrong result, spot price exact token in'
    );
    // exact token out
    a = incrementalQuotientTokenInForExactTokenOut(
        pool,
        poolPairData,
        amount,
        0.01
    );
    b = pool._spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData,
        bnum(amount)
    );
    assert.approximately(
        a.div(b).toNumber(),
        1,
        error,
        'wrong result, spot price exact token out'
    );
}

function incrementalQuotientExactTokenInForTokenOut(
    pool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    delta: number
): OldBigNumber {
    const f1 = pool._exactTokenInForTokenOut(
        poolPairData,
        bnum(amount + delta)
    );
    const f0 = pool._exactTokenInForTokenOut(poolPairData, bnum(amount));
    const incrementalQuotient = f1.minus(f0).div(delta);
    return incrementalQuotient;
}

function incrementalQuotientTokenInForExactTokenOut(
    pool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    delta: number
): OldBigNumber {
    const f1 = pool._tokenInForExactTokenOut(
        poolPairData,
        bnum(amount + delta)
    );
    const f0 = pool._tokenInForExactTokenOut(poolPairData, bnum(amount));
    const incrementalQuotient = f1.minus(f0).div(delta);
    return incrementalQuotient;
}

function checkDerivativeSpotPrices(
    pool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    error: number
) {
    // exact token in
    let a = incrementalQuotientSpotPriceAfterSwapExactTokenInForTokenOut(
        pool,
        poolPairData,
        amount,
        0.01
    );
    let b = pool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData,
        bnum(amount)
    );
    assert.approximately(
        a.div(b).toNumber(),
        1,
        error,
        'wrong result, derivative spot price exact token in'
    );
    // exact token out
    a = incrementalQuotientSpotPriceAfterSwapTokenInForExactTokenOut(
        pool,
        poolPairData,
        amount,
        0.01
    );
    b = pool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData,
        bnum(amount)
    );
    assert.approximately(
        a.div(b).toNumber(),
        1,
        error,
        'wrong result, derivative spot price exact token out'
    );
}

function incrementalQuotientSpotPriceAfterSwapExactTokenInForTokenOut(
    pool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    delta: number
): OldBigNumber {
    const f1 = pool._spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData,
        bnum(amount + delta)
    );
    const f0 = pool._spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData,
        bnum(amount)
    );
    const incrementalQuotient = f1.minus(f0).div(delta);
    return incrementalQuotient;
}

function incrementalQuotientSpotPriceAfterSwapTokenInForExactTokenOut(
    pool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    delta: number
): OldBigNumber {
    const f1 = pool._spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData,
        bnum(amount + delta)
    );
    const f0 = pool._spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData,
        bnum(amount)
    );
    const incrementalQuotient = f1.minus(f0).div(delta);
    return incrementalQuotient;
}

function checkDerivative_TokToTok(
    fn: (
        amp: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        tokenIndexOut: number,
        amountIn: bigint,
        fee: bigint
    ) => bigint,
    der: (
        amp: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        tokenIndexOut: number,
        amountIn: bigint,
        fee: bigint
    ) => bigint,
    num_amp: number,
    num_balances: number[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    num_amount: number,
    num_fee: number,
    num_delta: number,
    num_error: number,
    inverse = false
) {
    const amp = BigInt(num_amp);
    const balances1 = num_balances.map((balance) => {
        return s(balance);
    });
    const balances2 = num_balances.map((balance) => {
        return s(balance);
    });
    const balances3 = num_balances.map((balance) => {
        return s(balance);
    });
    const amount = s(num_amount);
    const fee = s(num_fee);
    const delta = s(num_delta);
    const error = s(num_error);

    const val1 = fn(
        amp,
        balances1,
        tokenIndexIn,
        tokenIndexOut,
        amount + delta,
        fee
    );
    const val2 = fn(amp, balances2, tokenIndexIn, tokenIndexOut, amount, fee);
    let incrementalQuotient = MathSol.divUpFixed(
        MathSol.sub(val1, val2),
        delta
    );
    if (inverse)
        incrementalQuotient = MathSol.divUpFixed(
            MathSol.ONE,
            incrementalQuotient
        );
    const der_ans = der(
        amp,
        balances3,
        tokenIndexIn,
        tokenIndexOut,
        amount,
        fee
    );
    assert.approximately(
        Number(MathSol.divUpFixed(incrementalQuotient, der_ans)),
        Number(MathSol.ONE),
        Number(error),
        'wrong result'
    );
}

function checkDerivative_ExactTokenBPT(
    fn: (
        amp: bigint,
        balances: bigint[],
        amountsIn: bigint[],
        bptTotalSupply: bigint,
        swapFeePercentage: bigint
    ) => bigint,
    der: (
        amp: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        bptTotalSupply: bigint,
        amountIn: bigint
        // assuming zero fee
    ) => bigint,
    num_amp: number,
    num_balances: number[],
    num_bptSupply: number,
    tokenIndex: number,
    num_amount: number,
    num_delta: number,
    num_error: number,
    inverse = false
) {
    const amp = BigInt(num_amp);
    const balances1 = num_balances.map((balance) => {
        return s(balance);
    });
    const balances2 = num_balances.map((balance) => {
        return s(balance);
    });
    const balances3 = num_balances.map((balance) => {
        return s(balance);
    });
    const bptSupply = s(num_bptSupply);
    const amount = s(num_amount);
    const delta = s(num_delta);
    const error = s(num_error);

    const amounts = balances1.map((_value, index) =>
        index == tokenIndex ? amount : BigInt(0)
    );
    const amountsPlusDelta = balances1.map((_value, index) =>
        index == tokenIndex ? amount + delta : BigInt(0)
    );

    const val1 = fn(amp, balances1, amountsPlusDelta, bptSupply, BigInt(0));
    const val2 = fn(amp, balances2, amounts, bptSupply, BigInt(0));
    let incrementalQuotient = MathSol.divUpFixed(
        MathSol.sub(val1, val2),
        delta
    );
    if (inverse)
        incrementalQuotient = MathSol.divUpFixed(
            MathSol.ONE,
            incrementalQuotient
        );
    const der_ans = der(amp, balances3, tokenIndex, bptSupply, amount);
    assert.approximately(
        Number(MathSol.divUpFixed(incrementalQuotient, der_ans)),
        Number(MathSol.ONE),
        Number(error),
        'wrong result'
    );
}

function checkDerivative_exactBPTToken(
    fn: (
        amp: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        bptAmountOut: bigint,
        bptTotalSupply: bigint,
        fee: bigint
    ) => bigint,
    der: (
        amp: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        bptTotalSupply: bigint,
        amountOut: bigint
    ) => bigint,
    num_amp: number,
    num_balances: number[],
    tokenIndex: number,
    num_amount: number,
    num_bptSupply: number,
    num_delta: number,
    num_error: number,
    inverse = false
) {
    const amp = BigInt(num_amp);
    const balances1 = num_balances.map((balance) => {
        return s(balance);
    });
    const balances2 = num_balances.map((balance) => {
        return s(balance);
    });
    const balances3 = num_balances.map((balance) => {
        return s(balance);
    });
    const bptSupply = s(num_bptSupply);
    const amount = s(num_amount);
    const delta = s(num_delta);
    const error = s(num_error);

    const val1 = fn(
        amp,
        balances1,
        tokenIndex,
        amount + delta,
        bptSupply,
        BigInt(0)
    );
    const val2 = fn(amp, balances2, tokenIndex, amount, bptSupply, BigInt(0));
    let incrementalQuotient = MathSol.divUpFixed(
        MathSol.sub(val1, val2),
        delta
    );
    if (inverse)
        incrementalQuotient = MathSol.divUpFixed(
            MathSol.ONE,
            incrementalQuotient
        );
    const der_ans = der(amp, balances3, tokenIndex, bptSupply, amount);
    assert.approximately(
        Number(MathSol.divUpFixed(incrementalQuotient, der_ans)),
        Number(MathSol.ONE),
        Number(error),
        'wrong result'
    );
}

function s(a: number): bigint {
    return BigInt(a * 10 ** 18);
}
