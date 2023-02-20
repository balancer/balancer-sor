import * as weighted from '../src/pools/weightedPool/weightedMath';
import { assert } from 'chai';
import { MathSol } from '../src/utils/basicOperations';

describe('weighted pools - weightedMath.ts - numeric functions using bigint', () => {
    context('spot prices', () => {
        it('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
            checkDerivative_weighted(
                weighted._calcOutGivenIn,
                weighted._spotPriceAfterSwapExactTokenInForTokenOutBigInt,
                1000,
                1,
                7000,
                2,
                30,
                0.003,
                0.01,
                0.00001,
                true
            );
        });
        it('_spotPriceAfterSwapTokenInForExactTokenOut', () => {
            checkDerivative_weighted(
                weighted._calcInGivenOut,
                weighted._spotPriceAfterSwapTokenInForExactTokenOutBigInt,
                1000,
                1,
                7000,
                2,
                30,
                0.003,
                0.01,
                0.00001,
                false
            );
        });
        // token-BPT
        // exact in
        it('_spotPriceAfterSwapBptOutGivenExactTokenIn', () => {
            checkDerivative_weighted_bpt(
                _calcBptOutGivenExactTokenIn,
                weighted._spotPriceAfterSwapBptOutGivenExactTokenInBigInt,
                7000,
                0.6,
                100,
                2000,
                0.003,
                0.01,
                0.00001,
                true
            );
        });
    });
});

function _calcBptOutGivenExactTokenIn(
    balance: bigint,
    normalizedWeight: bigint,
    amountIn: bigint,
    bptTotalSupply: bigint,
    swapFeePercentage: bigint
) {
    return weighted._calcBptOutGivenExactTokensIn(
        [balance, BigInt(1)],
        [normalizedWeight, s(1) - normalizedWeight],
        [amountIn, BigInt(0)],
        bptTotalSupply,
        swapFeePercentage
    );
}

function checkDerivative_weighted(
    fn: (
        balanceIn: bigint,
        weightIn: bigint,
        balanceOut: bigint,
        weightOut: bigint,
        amountIn: bigint,
        fee: bigint
    ) => bigint,
    der: (
        balanceIn: bigint,
        weightIn: bigint,
        balanceOut: bigint,
        weightOut: bigint,
        amountIn: bigint,
        fee: bigint
    ) => bigint,
    num_balanceIn: number,
    num_weightIn: number,
    num_balanceOut: number,
    num_weightOut: number,
    num_amount: number,
    num_fee: number,
    num_delta: number,
    num_error: number,
    inverse = false
) {
    const balanceIn = s(num_balanceIn);
    const weightIn = s(num_weightIn);
    const balanceOut = s(num_balanceOut);
    const weightOut = s(num_weightOut);
    const amount = s(num_amount);
    const fee = s(num_fee);
    const delta = s(num_delta);
    const error = s(num_error);

    let incrementalQuotient = MathSol.divUpFixed(
        MathSol.sub(
            fn(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                MathSol.add(amount, delta),
                fee
            ),
            fn(balanceIn, weightIn, balanceOut, weightOut, amount, fee)
        ),
        delta
    );
    if (inverse)
        incrementalQuotient = MathSol.divUpFixed(
            MathSol.ONE,
            incrementalQuotient
        );
    const der_ans = der(
        balanceIn,
        weightIn,
        balanceOut,
        weightOut,
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

function checkDerivative_weighted_bpt(
    fn: (
        balance: bigint,
        normalizedWeight: bigint,
        amountIn: bigint,
        bptTotalSupply: bigint,
        swapFeePercentage: bigint
    ) => bigint,
    der: (
        balanceIn: bigint,
        balanceOut: bigint,
        weightIn: bigint,
        amountIn: bigint,
        swapFeeRatio: bigint
    ) => bigint,
    num_balance: number,
    num_weight: number,
    num_amount: number,
    num_bptSupply: number,
    num_fee: number,
    num_delta: number,
    num_error: number,
    inverse = false
) {
    const balance = s(num_balance);
    const weight = s(num_weight);
    const amount = s(num_amount);
    const bptSupply = s(num_bptSupply);
    const fee = s(num_fee);
    const delta = s(num_delta);
    const error = s(num_error);

    let incrementalQuotient = MathSol.divUpFixed(
        MathSol.sub(
            fn(balance, weight, MathSol.add(amount, delta), bptSupply, fee),
            fn(balance, weight, amount, bptSupply, fee)
        ),
        delta
    );
    if (inverse)
        incrementalQuotient = MathSol.divUpFixed(
            MathSol.ONE,
            incrementalQuotient
        );
    const der_ans = der(balance, bptSupply, weight, amount, fee);
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
