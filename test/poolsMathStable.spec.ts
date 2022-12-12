import * as stable from '../src/pools/stablePool/stableMathBigInt';
import * as SDK from '@georgeroman/balancer-v2-pools';
import { BigNumber as OldBigNumber, bnum } from '../src/utils/bignumber';
import { assert } from 'chai';
import { MathSol } from '../src/utils/basicOperations';

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
        it('bpt out given tokens in', () => {
            const { result, SDKResult } = getBothValuesBPTGivenExactTokens(
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
            const { result, SDKResult } = getBothValuesTokenGivenBPT(
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
        it('bpt in given tokens out', () => {
            const { result, SDKResult } = getBothValuesBPTGivenExactTokens(
                stable._calcBptInGivenExactTokensOut,
                SDK.StableMath._calcBptInGivenExactTokensOut,
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
        it('out given bpt in', () => {
            const { result, SDKResult } = getBothValuesTokenGivenBPT(
                stable._calcTokenOutGivenExactBptIn,
                SDK.StableMath._calcTokenOutGivenExactBptIn,
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
        it('tokens out given bpt in', () => {
            const { result, SDKResult } = getBothValuesTokensOutGivenBPTIn(
                stable._calcTokensOutGivenExactBptIn,
                SDK.StableMath._calcTokensOutGivenExactBptIn,
                [3000, 1000, 1000],
                60,
                1600
            );
            assert.equal(
                result.toString(),
                SDKResult.toString(),
                'wrong result'
            );
        });

        it('spotPriceTokenToken', () => {
            const delta = 0.01;
            const error = 0.00001;
            checkDerivative_TokToTok(
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
            checkDerivative_TokToTok(
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

            checkDerivative_TokToTok(
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

        it('spotPriceTokenBPT', () => {
            const delta = 0.01;
            const error = 0.00001;
            checkDerivative_ExactTokenBPT(
                stable._calcBptOutGivenExactTokensIn,
                stable._spotPriceAfterSwapExactTokenInForBPTOut,
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
                stable._calcBptInGivenExactTokensOut,
                stable._spotPriceAfterSwapBPTInForExactTokenOut,
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
                stable._calcTokenInGivenExactBptOut,
                stable._spotPriceAfterSwapTokenInForExactBPTOut,
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
                stable._calcTokenOutGivenExactBptIn,
                stable._spotPriceAfterSwapExactBPTInForTokenOut,
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

function getBothValuesBPTGivenExactTokens(
    SORFunction: (
        amp: bigint,
        balances: bigint[],
        amounts: bigint[],
        bptTotalSupply: bigint,
        swapFeePercentage: bigint
    ) => bigint,
    SDKFunction: (
        amp: OldBigNumber,
        balances: OldBigNumber[],
        amounts: OldBigNumber[],
        bptTotalSupply: OldBigNumber,
        swapFeePercentage: OldBigNumber
    ) => OldBigNumber,
    amp: number,
    balances: number[],
    amounts: number[],
    bptTotalSupply: number,
    fee: number
): { result: bigint; SDKResult: OldBigNumber } {
    const result = SORFunction(
        BigInt(amp),
        balances.map((amount) => s(amount)),
        amounts.map((amount) => s(amount)),
        s(bptTotalSupply),
        s(fee)
    );
    const SDKResult = SDKFunction(
        bnum(amp),
        balances.map((amount) => b(amount)),
        amounts.map((amount) => b(amount)),
        b(bptTotalSupply),
        b(fee)
    );
    return { result, SDKResult };
}

function getBothValuesTokenGivenBPT(
    SORFunction: (
        amp: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        bptAmount: bigint,
        bptTotalSupply: bigint,
        fee: bigint
    ) => bigint,
    SDKFunction: (
        amp: OldBigNumber,
        balances: OldBigNumber[],
        tokenIndexIn: number,
        bptAmount: OldBigNumber,
        bptTotalSupply: OldBigNumber,
        fee: OldBigNumber
    ) => OldBigNumber,
    amp: number,
    balances: number[],
    tokenIndexIn: number,
    bptAmount: number,
    bptTotalSupply: number,
    fee: number
): { result: bigint; SDKResult: OldBigNumber } {
    const result = SORFunction(
        BigInt(amp),
        balances.map((amount) => s(amount)),
        tokenIndexIn,
        s(bptAmount),
        s(bptTotalSupply),
        s(fee)
    );
    const SDKResult = SDKFunction(
        bnum(amp),
        balances.map((amount) => b(amount)),
        tokenIndexIn,
        b(bptAmount),
        b(bptTotalSupply),
        b(fee)
    );
    return { result, SDKResult };
}

function getBothValuesTokensOutGivenBPTIn(
    SORFunction: (
        balances: bigint[],
        bptAmountIn: bigint,
        bptTotalSupply: bigint
    ) => bigint[],
    SDKFunction: (
        balances: OldBigNumber[],
        bptAmountIn: OldBigNumber,
        bptTotalSupply: OldBigNumber
    ) => OldBigNumber[],
    balances: number[],
    bptAmountIn: number,
    bptTotalSupply: number
): { result: bigint[]; SDKResult: OldBigNumber[] } {
    const result = SORFunction(
        balances.map((amount) => s(amount)),
        s(bptAmountIn),
        s(bptTotalSupply)
    );
    const SDKResult = SDKFunction(
        balances.map((amount) => b(amount)),
        b(bptAmountIn),
        b(bptTotalSupply)
    );
    return { result, SDKResult };
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

function b(a: number): OldBigNumber {
    return bnum(a * 10 ** 18);
}
