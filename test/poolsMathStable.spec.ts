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
        it('out given in', () => {
            const { result, SDKResult } = getBothValuesStable(
                stable._calcOutGivenIn,
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
        it('in given out', () => {
            const { result, SDKResult } = getBothValuesStable(
                stable._calcInGivenOut,
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
        it('bpt out given in', () => {
            const { result, SDKResult } = getBothValuesStableBPTOutGivenIn(
                stable._calcBptOutGivenExactTokensIn,
                SDK.StableMath._calcBptOutGivenExactTokensIn,
                1000,
                [3000, 1000, 1000],
                [10, 20, 5],
                1600,
                0.01
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        it('in given bpt out', () => {
            const { result, SDKResult } = getBothValuesStableInGivenBPTOut(
                stable._calcTokenInGivenExactBptOut,
                SDK.StableMath._calcTokenInGivenExactBptOut,
                1000,
                [3000, 1000, 1000],
                0,
                60,
                1600,
                0.01
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });
        // TO DO:
        // _calcBptInGivenExactTokensOut
        // _calcTokenOutGivenExactBptIn
        // _calcTokensOutGivenExactBptIn
        it('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
            const delta = 0.01;
            const error = 0.00001;
            checkDerivative_stable(
                stable._calcOutGivenIn,
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
                stable._calcOutGivenIn,
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
                stable._calcInGivenOut,
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

function getBothValuesStableBPTOutGivenIn(
    SORFunction: (
        amp: bigint,
        balances: bigint[],
        amountsIn: bigint[],
        bptTotalSupply: bigint,
        swapFeePercentage: bigint
    ) => bigint,
    SDKFunction: (
        amp: OldBigNumber,
        balances: OldBigNumber[],
        amountsIn: OldBigNumber[],
        bptTotalSupply: OldBigNumber,
        swapFeePercentage: OldBigNumber
    ) => OldBigNumber,
    amp: number,
    balances: number[],
    amountsIn: number[],
    bptTotalSupply: number,
    fee: number
): { result: any; SDKResult: any } {
    const result = SORFunction(
        BigInt(amp),
        balances.map((amount) => s(amount)),
        amountsIn.map((amount) => s(amount)),
        s(bptTotalSupply),
        s(fee)
    );
    const SDKResult = SDKFunction(
        bnum(amp),
        balances.map((amount) => b(amount)),
        amountsIn.map((amount) => b(amount)),
        b(bptTotalSupply),
        b(fee)
    );
    return { result, SDKResult };
}

function getBothValuesStableInGivenBPTOut(
    SORFunction: (
        amp: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        bptAmountOut: bigint,
        bptTotalSupply: bigint,
        fee: bigint
    ) => bigint,
    SDKFunction: (
        amp: OldBigNumber,
        balances: OldBigNumber[],
        tokenIndexIn: number,
        bptAmountOut: OldBigNumber,
        bptTotalSupply: OldBigNumber,
        fee: OldBigNumber
    ) => OldBigNumber,
    amp: number,
    balances: number[],
    tokenIndexIn: number,
    bptAmountOut: number,
    bptTotalSupply: number,
    fee: number
): { result: any; SDKResult: any } {
    const result = SORFunction(
        BigInt(amp),
        balances.map((amount) => s(amount)),
        tokenIndexIn,
        s(bptAmountOut),
        s(bptTotalSupply),
        s(fee)
    );
    const SDKResult = SDKFunction(
        bnum(amp),
        balances.map((amount) => b(amount)),
        tokenIndexIn,
        b(bptAmountOut),
        b(bptTotalSupply),
        b(fee)
    );
    return { result, SDKResult };
}

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
