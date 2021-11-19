import * as weighted from '../src/poolsMath/weighted';
import * as stable from '../src/poolsMath/stable';
import * as SDK from '@georgeroman/balancer-v2-pools';
import {
    BigNumber as OldBigNumber,
    bnum,
    scale,
    ZERO,
} from '../src/utils/bignumber';
import { assert } from 'chai';

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
    });

    context('stable pools', () => {
        it('_exactTokenInForTokenOut', () => {
            const { result, SDKResult } = getBothValuesStable(
                stable._exactTokenInForTokenOut,
                SDK.StableMath._calcOutGivenIn,
                1000,
                [1000, 1000, 1000],
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
                [1000, 1000, 1000],
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
    let result = SORFunction(
        BigInt(balanceIn * 10 ** 18),
        BigInt(weightIn * 10 ** 18),
        BigInt(balanceOut * 10 ** 18),
        BigInt(weightOut * 10 ** 18),
        BigInt(amount * 10 ** 18),
        BigInt(fee * 10 ** 18)
    );
    let SDKResult = SDKFunction(
        bnum(balanceIn * 10 ** 18),
        bnum(weightIn * 10 ** 18),
        bnum(balanceOut * 10 ** 18),
        bnum(weightOut * 10 ** 18),
        bnum(amount * 10 ** 18),
        bnum(fee * 10 ** 18)
    );
    return { result, SDKResult };
}

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
    let result = SORFunction(
        BigInt(amplificationParameter),
        balances.map((amount) => BigInt(amount * 10 ** 18)),
        tokenIndexIn,
        tokenIndexOut,
        BigInt(amount * 10 ** 18),
        BigInt(fee * 10 ** 18)
    );
    let SDKResult = SDKFunction(
        bnum(amplificationParameter),
        balances.map((amount) => bnum(amount * 10 ** 18)),
        tokenIndexIn,
        tokenIndexOut,
        bnum(amount * 10 ** 18),
        bnum(fee * 10 ** 18)
    );
    return { result, SDKResult };
}
