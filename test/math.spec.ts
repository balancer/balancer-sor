// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/math.spec.ts
import { assert } from 'chai';
import { PoolTypes } from '../src/types';
import { BigNumber, parseFixed, formatFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, scale } from '../src/utils/bignumber';
import { bnum } from '../src/index';
import * as linearMath from '../src/pools/linearPool/linearMath';
import { LinearPoolPairData } from '../src/pools/linearPool/linearPool';

describe('linear math tests', () => {
    let poolPairData = makeLinearPoolPairData(0, 0);
    context('swap outcomes', () => {
        it('_exactTokenInForBPTOut', () => {
            poolPairData = makeLinearPoolPairData(10000, 10000);
            checkOutcome(
                linearMath._exactTokenInForBPTOut,
                poolPairData,
                100,
                98.307150862,
                0.000000001
            );
            poolPairData = makeLinearPoolPairData(900, 10000);
            checkOutcome(
                linearMath._exactTokenInForBPTOut,
                poolPairData,
                1300,
                12615.3259478,
                0.0000001
            );
        });

        it('_tokenInForExactBPTOut', () => {
            poolPairData = makeLinearPoolPairData(900, 10000);
            checkOutcome(
                linearMath._tokenInForExactBPTOut,
                poolPairData,
                100,
                10.078,
                0.000000001
            );
            checkOutcome(
                linearMath._tokenInForExactBPTOut,
                poolPairData,
                5000,
                512.5510204,
                0.0000001
            );
        });

        it('_BPTInForExactTokenOut', () => {
            poolPairData = makeLinearPoolPairData(10000, 900);
            checkOutcome(
                linearMath._BPTInForExactTokenOut,
                poolPairData,
                200,
                1984.520738,
                0.000001
            );
            poolPairData = makeLinearPoolPairData(10000, 2500);
            checkOutcome(
                linearMath._BPTInForExactTokenOut,
                poolPairData,
                1600,
                6074.64002,
                0.000001
            );
            checkOutcome(
                linearMath._BPTInForExactTokenOut,
                poolPairData,
                800,
                3014.744405,
                0.000001
            );
        });

        it('_exactBPTInForTokenOut', () => {
            poolPairData = makeLinearPoolPairData(10000, 2500);
            checkOutcome(
                linearMath._exactBPTInForTokenOut,
                poolPairData,
                200,
                53.444,
                0.000001
            );
            checkOutcome(
                linearMath._exactBPTInForTokenOut,
                poolPairData,
                5000,
                1320.098039,
                0.000001
            );
        });
    });

    context('spot price after swap', () => {
        it('_spotPriceAfterSwapExactTokenInForBPTOut', () => {
            poolPairData = makeLinearPoolPairData(500, 10000);
            checkDerivative(
                linearMath._exactTokenInForBPTOut,
                linearMath._spotPriceAfterSwapExactTokenInForBPTOut,
                poolPairData,
                200,
                0.001,
                0.00000001,
                true
            );
            checkDerivative(
                linearMath._exactTokenInForBPTOut,
                linearMath._spotPriceAfterSwapExactTokenInForBPTOut,
                poolPairData,
                1500,
                0.001,
                0.00000001,
                true
            );
        });

        it('_spotPriceAfterSwapTokenInForExactBPTOut', () => {
            checkDerivative(
                linearMath._tokenInForExactBPTOut,
                linearMath._spotPriceAfterSwapTokenInForExactBPTOut,
                poolPairData,
                500,
                0.001,
                0.00000001,
                false
            );
            checkDerivative(
                linearMath._tokenInForExactBPTOut,
                linearMath._spotPriceAfterSwapTokenInForExactBPTOut,
                poolPairData,
                40000,
                0.001,
                0.00000001,
                false
            );
        });

        it('_spotPriceAfterSwapBPTInForExactTokenOut', () => {
            poolPairData = makeLinearPoolPairData(10000, 3500);
            checkDerivative(
                linearMath._BPTInForExactTokenOut,
                linearMath._spotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                200,
                0.001,
                0.00000001,
                false
            );
            checkDerivative(
                linearMath._BPTInForExactTokenOut,
                linearMath._spotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                1600,
                0.001,
                0.00000001,
                false
            );
            checkDerivative(
                linearMath._BPTInForExactTokenOut,
                linearMath._spotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                3000,
                0.001,
                0.00000001,
                false
            );
        });

        it('_spotPriceAfterSwapExactBPTInForTokenOut', () => {
            poolPairData = makeLinearPoolPairData(10000, 3500);
            checkDerivative(
                linearMath._exactBPTInForTokenOut,
                linearMath._spotPriceAfterSwapExactBPTInForTokenOut,
                poolPairData,
                200,
                0.001,
                0.00000001,
                true
            );
            checkDerivative(
                linearMath._exactBPTInForTokenOut,
                linearMath._spotPriceAfterSwapExactBPTInForTokenOut,
                poolPairData,
                5000,
                0.001,
                0.00000001,
                true
            );
            checkDerivative(
                linearMath._exactBPTInForTokenOut,
                linearMath._spotPriceAfterSwapExactBPTInForTokenOut,
                poolPairData,
                8000,
                0.001,
                0.00000001,
                true
            );
        });
    });

    context('derivatives of spot price after swap', () => {
        it('derivatives of spot price are zero', () => {
            checkOutcome(
                linearMath._derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
                poolPairData,
                100,
                0,
                0
            );
            checkOutcome(
                linearMath._derivativeSpotPriceAfterSwapTokenInForExactBPTOut,
                poolPairData,
                100,
                0,
                0
            );
            checkOutcome(
                linearMath._derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
                poolPairData,
                100,
                0,
                0
            );
            checkOutcome(
                linearMath._derivativeSpotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                100,
                0,
                0
            );
        });
    });
});

function makeLinearPoolPairData(
    balanceIn: number,
    balanceOut: number,
    wrappedBalance: OldBigNumber = scale(bnum('100'), 18),
    swapFee: BigNumber = parseFixed('0.02', 18),
    rate: OldBigNumber = scale(bnum('1.1'), 18),
    target1: BigNumber = parseFixed('1000', 18),
    target2: BigNumber = parseFixed('2000', 18),
    pairType = 0
): LinearPoolPairData {
    return {
        pairType: pairType,
        balanceIn: parseFixed(balanceIn.toString(), 18),
        balanceOut: parseFixed(balanceOut.toString(), 18),
        wrappedBalance: wrappedBalance,
        wrappedDecimals: 18,
        rate: rate,
        target1: target1,
        target2: target2,
        swapFee,
        id: 'ignored',
        address: 'ignored',
        poolType: PoolTypes.Linear,
        tokenIn: 'ignored',
        tokenOut: 'ignored',
        decimalsIn: 18,
        decimalsOut: 18,
    };
}

function checkOutcome(
    fn: (
        amount: OldBigNumber,
        poolPairData: LinearPoolPairData
    ) => OldBigNumber,
    poolPairData: LinearPoolPairData,
    amount: number,
    expected: number,
    error: number
) {
    // const amt = scale(bnum(amount), 18);
    assert.approximately(
        fn(bnum(amount), poolPairData).toNumber(),
        expected,
        error,
        'wrong result'
    );
}

function checkDerivative(
    fn: (
        amount: OldBigNumber,
        poolPairData: LinearPoolPairData
    ) => OldBigNumber,
    der: (
        amount: OldBigNumber,
        poolPairData: LinearPoolPairData
    ) => OldBigNumber,
    poolPairData: LinearPoolPairData,
    amount: number,
    delta: number,
    error: number,
    inverse: boolean = false
) {
    let x = bnum(amount);
    let incrementalQuotient = fn(x.plus(delta), poolPairData)
        .minus(fn(x, poolPairData))
        .div(delta);
    if (inverse) incrementalQuotient = bnum(1).div(incrementalQuotient);
    const der_ans = der(x, poolPairData);
    assert.approximately(
        incrementalQuotient.div(der_ans).toNumber(),
        1,
        error,
        'wrong result'
    );
}
