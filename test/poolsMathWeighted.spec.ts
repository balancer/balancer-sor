import * as weighted from '../src/pools/weightedPool/weightedMath';
import * as SDK from '@georgeroman/balancer-v2-pools';
import { BigNumber as OldBigNumber, bnum } from '../src/utils/bignumber';
import { assert } from 'chai';
import { MathSol } from '../src/utils/basicOperations';

describe('weighted pools - weightedMath.ts - numeric functions using bigint', () => {
    context('swap outcomes', () => {
        it('_calcOutGivenIn', () => {
            const { result, SDKResult } = getBothValuesWeighted(
                weighted._calcOutGivenIn,
                SDK.WeightedMath._calcOutGivenIn,
                1000,
                1,
                3000,
                2,
                30,
                0.003
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        it('_calcInGivenOut', () => {
            const { result, SDKResult } = getBothValuesWeighted(
                weighted._calcInGivenOut,
                SDK.WeightedMath._calcInGivenOut,
                1000,
                1,
                2000,
                2,
                30,
                0.003
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        // token-BPT
        // exact in
        it('_calcTokenOutGivenExactBptIn', () => {
            const { result, SDKResult } = getBothValuesWeighted(
                weighted._calcTokenOutGivenExactBptIn,
                SDK.WeightedMath._calcTokenOutGivenExactBptIn,
                1000,
                0.7,
                30,
                2000,
                0.003,
                -1 // this is not used
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        it('_calcBptOutGivenExactTokenIn', () => {
            const { result, SDKResult } = getBothValuesWeighted(
                _calcBptOutGivenExactTokenIn,
                _SDKcalcBptOutGivenExactTokenIn,
                1000,
                0.7,
                30,
                2000,
                0.003,
                -1 // this is not used
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        // exact out
        it('_calcTokenInGivenExactBptOut', () => {
            const { result, SDKResult } = getBothValuesWeighted(
                weighted._calcTokenInGivenExactBptOut,
                SDK.WeightedMath._calcTokenInGivenExactBptOut,
                1000,
                0.7,
                30,
                2000,
                0.003,
                -1 // this is not used
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        it('_calcBptInGivenExactTokenOut', () => {
            const { result, SDKResult } = getBothValuesWeighted(
                _calcBptInGivenExactTokenOut,
                _SDKcalcBptInGivenExactTokenOut,
                1000,
                0.7,
                30,
                2000,
                0.003,
                -1 // this is not used
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
    });
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

function _calcBptInGivenExactTokenOut(
    balance: bigint,
    normalizedWeight: bigint,
    amountOut: bigint,
    bptTotalSupply: bigint,
    swapFeePercentage: bigint
) {
    return weighted._calcBptInGivenExactTokensOut(
        [balance, BigInt(1)],
        [normalizedWeight, s(1) - normalizedWeight],
        [amountOut, BigInt(0)],
        bptTotalSupply,
        swapFeePercentage
    );
}

function _SDKcalcBptInGivenExactTokenOut(
    balance: OldBigNumber,
    normalizedWeight: OldBigNumber,
    amountOut: OldBigNumber,
    bptTotalSupply: OldBigNumber,
    swapFeePercentage: OldBigNumber
) {
    return SDK.WeightedMath._calcBptInGivenExactTokensOut(
        [balance, bnum(1)],
        [normalizedWeight, b(1).minus(normalizedWeight)],
        [amountOut, bnum(0)],
        bptTotalSupply,
        swapFeePercentage
    );
}

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

function _SDKcalcBptOutGivenExactTokenIn(
    balance: OldBigNumber,
    normalizedWeight: OldBigNumber,
    amountIn: OldBigNumber,
    bptTotalSupply: OldBigNumber,
    swapFeePercentage: OldBigNumber
) {
    return SDK.WeightedMath._calcBptOutGivenExactTokensIn(
        [balance, bnum(1)],
        [normalizedWeight, b(1).minus(normalizedWeight)],
        [amountIn, bnum(0)],
        bptTotalSupply,
        swapFeePercentage
    );
}

function getBothValuesWeighted(
    SORFunction: (
        balanceIn: bigint,
        weightIn: bigint,
        balanceOut: bigint,
        weightOut: bigint,
        amount: bigint,
        fee: bigint
    ) => bigint,
    SDKFunction: (
        balanceIn: OldBigNumber,
        weightIn: OldBigNumber,
        balanceOut: OldBigNumber,
        weightOut: OldBigNumber,
        amount: OldBigNumber,
        swapFeePercentage?: OldBigNumber
    ) => OldBigNumber,
    balanceIn: number,
    weightIn: number,
    balanceOut: number,
    weightOut: number,
    amount: number,
    fee: number
): { result: bigint; SDKResult: OldBigNumber } {
    const result = SORFunction(
        s(balanceIn),
        s(weightIn),
        s(balanceOut),
        s(weightOut),
        s(amount),
        s(fee)
    );
    const SDKResult = SDKFunction(
        b(balanceIn),
        b(weightIn),
        b(balanceOut),
        b(weightOut),
        b(amount),
        b(fee)
    );
    return { result, SDKResult };
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

function b(a: number): OldBigNumber {
    return bnum(a * 10 ** 18);
}
