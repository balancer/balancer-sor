// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/math.spec.ts
import { assert } from 'chai';
import { PoolTypes } from '../src/types';
import { BigNumber, parseFixed, formatFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, scale } from '../src/utils/bignumber';
import { bnum } from '../src/index';
import * as linearMath from '../src/pools/linearPool/linearMath';
import { LinearPoolPairData } from '../src/pools/linearPool/linearPool';

describe('linear math tests', () => {
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
                linearMath._exactTokenInForBPTOut,
                poolPairData,
                100,
                98.307150862,
                0.000000001
            );
            poolPairData = makeLinearPoolPairData(
                parseFixed('900', 18), // balanceIn
                parseFixed('10000', 18), // balanceOut
                parseFixed('900', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkOutcome(
                linearMath._exactTokenInForBPTOut,
                poolPairData,
                1300,
                12615.3259478,
                0.0000001
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
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('900', 18), // balanceOut
                parseFixed('900', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
            checkOutcome(
                linearMath._BPTInForExactTokenOut,
                poolPairData,
                200,
                1984.520738,
                0.000001
            );
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('2500', 18), // balanceOut
                parseFixed('2500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
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
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('2500', 18), // balanceOut
                parseFixed('2500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
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
            poolPairData = makeLinearPoolPairData(
                parseFixed('500', 18), // balanceIn
                parseFixed('10000', 18), // balanceOut
                parseFixed('500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
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
            poolPairData = makeLinearPoolPairData(
                parseFixed('1000', 18), // balanceIn
                parseFixed('3500', 18), // balanceOut
                parseFixed('3500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
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
            poolPairData = makeLinearPoolPairData(
                parseFixed('10000', 18), // balanceIn
                parseFixed('3500', 18), // balanceOut
                parseFixed('3500', 18), // mainBalance
                parseFixed('100', 18), // wrappedBalance
                parseFixed('10000', 0) // virtualBptSupply
            );
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
