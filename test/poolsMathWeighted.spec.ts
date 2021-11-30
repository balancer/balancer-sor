import * as weighted from '../src/poolsMath/weighted';
import * as SDK from '@georgeroman/balancer-v2-pools';
import { BigNumber as OldBigNumber, bnum } from '../src/utils/bignumber';
import { assert } from 'chai';
import { MathSol } from '../src/poolsMath/basicOperations';

describe('poolsMath: numeric functions using bigint', () => {
    context('weighted pools', () => {
        it('_exactTokenInForTokenOut', () => {
            const { result, SDKResult } = getBothValuesWeighted(
                weighted._exactTokenInForTokenOut,
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

        it('_tokenInForExactTokenOut', () => {
            const { result, SDKResult } = getBothValuesWeighted(
                weighted._tokenInForExactTokenOut,
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

        it('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
            checkDerivative_weighted(
                weighted._exactTokenInForTokenOut,
                weighted._spotPriceAfterSwapExactTokenInForTokenOut,
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
                weighted._tokenInForExactTokenOut,
                weighted._spotPriceAfterSwapTokenInForExactTokenOut,
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
    });
});

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
        bnum(balanceIn * 10 ** 18),
        bnum(weightIn * 10 ** 18),
        bnum(balanceOut * 10 ** 18),
        bnum(weightOut * 10 ** 18),
        bnum(amount * 10 ** 18),
        bnum(fee * 10 ** 18)
    );
    return { result, SDKResult };
}

function checkDerivative_weighted(
    fn: any,
    der: any,
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

function s(a: number): bigint {
    return BigInt(a * 10 ** 18);
}
