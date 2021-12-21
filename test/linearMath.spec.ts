// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/linearMath.spec.ts
import { assert } from 'chai';
import { PoolTypes } from '../src/types';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, scale } from '../src/utils/bignumber';
import { bnum } from '../src/utils/bignumber';
import * as linearMath from '../src/pools/linearPool/linearMath';
import { LinearPoolPairData } from '../src/pools/linearPool/linearPool';
import {
    _calcBptOutPerMainIn,
    _calcMainOutPerBptIn,
    _calcMainInPerBptOut,
    _calcBptInPerMainOut,
} from '../src/pools/linearPool/exactMaths';

describe('linearMath', () => {
    const params = {
        fee: b(0.02),
        lowerTarget: b(1000),
        upperTarget: b(2000),
    };

    let poolPairData; //  = makeLinearPoolPairData(0, 0);
    context('swap outcomes', () => {
        it('_exactTokenInForBPTOut', () => {
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('10000', 18), // balanceOut
                parseFixed('10000', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkOutcome(
                linearMath._exactMainTokenInForBPTOut,
                poolPairData,
                100,
                _calcBptOutPerMainIn(
                    b(100),
                    b(10000),
                    b(110), // this includes the rate
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
            poolPairData = makeLinearPoolPairData(
                parseFixed('900', 18), // balanceIn
                parseFixed('10000', 18), // balanceOut
                parseFixed('900', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkOutcome(
                linearMath._exactMainTokenInForBPTOut,
                poolPairData,
                1300,
                _calcBptOutPerMainIn(
                    b(1300),
                    b(900),
                    b(110),
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
        });

        it('_tokenInForExactBPTOut', () => {
            poolPairData = makeLinearPoolPairData(
                parseFixed('900', 18), // balanceIn
                parseFixed('10000', 18), // balanceOut
                parseFixed('900', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkOutcome(
                linearMath._mainTokenInForExactBPTOut,
                poolPairData,
                100,
                _calcMainInPerBptOut(
                    b(100),
                    b(900),
                    b(110),
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
            checkOutcome(
                linearMath._mainTokenInForExactBPTOut,
                poolPairData,
                5000,
                _calcMainInPerBptOut(
                    b(5000),
                    b(900),
                    b(110),
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
        });

        it('_BPTInForExactTokenOut', () => {
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('900', 18), // balanceOut
                parseFixed('900', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkOutcome(
                linearMath._BPTInForExactMainTokenOut,
                poolPairData,
                200,
                _calcBptInPerMainOut(
                    b(200),
                    b(900),
                    b(110),
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('2500', 18), // balanceOut
                parseFixed('2500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkOutcome(
                linearMath._BPTInForExactMainTokenOut,
                poolPairData,
                1600,
                _calcBptInPerMainOut(
                    b(1600),
                    b(2500),
                    b(110),
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
            checkOutcome(
                linearMath._BPTInForExactMainTokenOut,
                poolPairData,
                800,
                _calcBptInPerMainOut(
                    b(800),
                    b(2500),
                    b(110),
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
        });

        it('_exactBPTInForTokenOut', () => {
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('2500', 18), // balanceOut
                parseFixed('2500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkOutcome(
                linearMath._exactBPTInForMainTokenOut,
                poolPairData,
                200,
                _calcMainOutPerBptIn(
                    b(200),
                    b(2500),
                    b(110),
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
            checkOutcome(
                linearMath._exactBPTInForMainTokenOut,
                poolPairData,
                5000,
                _calcMainOutPerBptIn(
                    b(5000),
                    b(2500),
                    b(110),
                    b(10000),
                    params
                ).toNumber() /
                    10 ** 18,
                0
            );
        });
    });

    context('spot price after swap', () => {
        it('_spotPriceAfterSwapExactTokenInForBPTOut', () => {
            poolPairData = makeLinearPoolPairData(
                parseFixed('500', 18), // balanceIn
                parseFixed('10000', 18), // balanceOut
                parseFixed('500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkDerivative(
                linearMath._exactMainTokenInForBPTOut,
                linearMath._spotPriceAfterSwapExactTokenInForBPTOut,
                poolPairData,
                200,
                0.001,
                0.00000001,
                true
            );
            checkDerivative(
                linearMath._exactMainTokenInForBPTOut,
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
                linearMath._mainTokenInForExactBPTOut,
                linearMath._spotPriceAfterSwapTokenInForExactBPTOut,
                poolPairData,
                500,
                0.001,
                0.00000001,
                false
            );
            checkDerivative(
                linearMath._mainTokenInForExactBPTOut,
                linearMath._spotPriceAfterSwapTokenInForExactBPTOut,
                poolPairData,
                40000,
                0.001,
                0.00000001,
                false
            );
        });

        it('_spotPriceAfterSwapBPTInForExactTokenOut', () => {
            poolPairData = makeLinearPoolPairData(
                parseFixed('1000', 18), // balanceIn
                parseFixed('3500', 18), // balanceOut
                parseFixed('3500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkDerivative(
                linearMath._BPTInForExactMainTokenOut,
                linearMath._spotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                200,
                0.001,
                0.00000001,
                false
            );
            checkDerivative(
                linearMath._BPTInForExactMainTokenOut,
                linearMath._spotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                1600,
                0.001,
                0.00000001,
                false
            );
            checkDerivative(
                linearMath._BPTInForExactMainTokenOut,
                linearMath._spotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                3000,
                0.001,
                0.00000001,
                false
            );
        });

        it('_spotPriceAfterSwapExactBPTInForTokenOut', () => {
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('3500', 18), // balanceOut
                parseFixed('3500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkDerivative(
                linearMath._exactBPTInForMainTokenOut,
                linearMath._spotPriceAfterSwapExactBPTInForTokenOut,
                poolPairData,
                200,
                0.001,
                0.00000001,
                true
            );
            checkDerivative(
                linearMath._exactBPTInForMainTokenOut,
                linearMath._spotPriceAfterSwapExactBPTInForTokenOut,
                poolPairData,
                5000,
                0.001,
                0.00000001,
                true
            );
            checkDerivative(
                linearMath._exactBPTInForMainTokenOut,
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
    balanceIn: BigNumber,
    balanceOut: BigNumber,
    mainBalance: BigNumber,
    wrappedBalance: BigNumber,
    virtualBptSupply: BigNumber,
    swapFee: BigNumber = parseFixed('0.02', 18),
    rate: OldBigNumber = scale(bnum('1.1'), 18),
    lowerTarget: BigNumber = parseFixed('1000', 18),
    upperTarget: BigNumber = parseFixed('2000', 18),
    pairType = 0
): LinearPoolPairData {
    return {
        pairType: pairType,
        balanceIn,
        balanceOut,
        wrappedBalance: bnum(wrappedBalance.toString()),
        wrappedDecimals: 18,
        rate: rate,
        lowerTarget: lowerTarget,
        upperTarget: upperTarget,
        swapFee,
        id: 'ignored',
        address: 'ignored',
        poolType: PoolTypes.Linear,
        tokenIn: 'ignored',
        tokenOut: 'ignored',
        decimalsIn: 18,
        decimalsOut: 18,
        mainBalanceScaled: parseFixed(mainBalance.toString(), 18),
        wrappedBalanceScaled: parseFixed(wrappedBalance.toString(), 18),
        bptBalanceScaled: parseFixed('0', 18),
        virtualBptSupply: parseFixed(virtualBptSupply.toString(), 18),
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
    inverse = false
) {
    const x = bnum(amount);
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

function b(arg: number): OldBigNumber {
    return bnum(arg * 10 ** 18);
}
