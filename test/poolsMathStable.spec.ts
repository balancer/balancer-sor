import * as stable from '../src/poolsMath/stable';
import * as SDK from '@georgeroman/balancer-v2-pools';
import { BigNumber as OldBigNumber, bnum } from '../src/utils/bignumber';
import { assert } from 'chai';
import { MathSol } from '../src/poolsMath/basicOperations';
import { _poolDerivatives as _oldPoolDerivatives } from '../src/pools/stablePool/oldButUsefulStableMath';
import { _poolDerivatives as _currentPoolDerivatives } from '../src/pools/stablePool/stableMath';
import { _poolDerivatives } from '../src/poolsMath/stable';

describe('poolsMathStable: numeric functions using bigint', () => {
    context('stable pools', () => {
        it('_exactTokenInForTokenOut', () => {
            const { result, SDKResult } = getBothValuesStable(
                stable._exactTokenInForTokenOut,
                SDK.StableMath._calcOutGivenIn,
                1000,
                [1000, 3000, 2000],
                0,
                1,
                10,
                0.04
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        it('_tokenInForExactTokenOut', () => {
            const { result, SDKResult } = getBothValuesStable(
                stable._tokenInForExactTokenOut,
                SDK.StableMath._calcInGivenOut,
                1000,
                [3000, 1000, 1000],
                0,
                1,
                10,
                0.01
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        it('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
            const delta = 0.01;
            const error = 0.00001;
            checkDerivative_stable(
                stable._exactTokenInForTokenOut,
                stable._spotPriceAfterSwapExactTokenInForTokenOut,
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
            checkDerivative_stable(
                stable._exactTokenInForTokenOut,
                stable._spotPriceAfterSwapExactTokenInForTokenOut,
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

            checkDerivative_stable(
                stable._tokenInForExactTokenOut,
                stable._spotPriceAfterSwapTokenInForExactTokenOut,
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
    });
});

function getBothValuesStable(
    SORFunction: (
        amplificationParameter: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        tokenIndexOut: number,
        amount: bigint,
        fee: bigint
    ) => bigint,
    SDKFunction: (
        amplificationParameter: OldBigNumber,
        balances: OldBigNumber[],
        tokenIndexIn: number,
        tokenIndexOut: number,
        tokenAmount: OldBigNumber,
        swapFeePercentage?: OldBigNumber
    ) => OldBigNumber,
    amplificationParameter: number,
    balances: number[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    amount: number,
    fee: number
): { result: bigint; SDKResult: OldBigNumber } {
    const result = SORFunction(
        BigInt(amplificationParameter),
        balances.map((amount) => s(amount)),
        tokenIndexIn,
        tokenIndexOut,
        s(amount),
        s(fee)
    );
    const SDKResult = SDKFunction(
        bnum(amplificationParameter),
        balances.map((amount) => bnum(amount * 10 ** 18)),
        tokenIndexIn,
        tokenIndexOut,
        bnum(amount * 10 ** 18),
        bnum(fee * 10 ** 18)
    );
    return { result, SDKResult };
}

// To do: basic debug of components
function checkDerivative_stable(
    fn: any,
    der: any,
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
    const balances1 = num_balances.map((balance, i) => {
        return s(balance);
    });
    const balances2 = num_balances.map((balance, i) => {
        return s(balance);
    });
    const balances3 = num_balances.map((balance, i) => {
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
    console.log('(inverse) incremental quotient: ', incrementalQuotient);
    console.log('computed spot price:            ', der_ans);
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
