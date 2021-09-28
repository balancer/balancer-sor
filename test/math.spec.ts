import { assert } from 'chai';
import { PoolTypes } from '../src/types';
import BigNumber from 'bignumber.js';
import { bnum } from '../src/index';
import * as linearMath from '../src/pools/linearPool/linearMath';
import { LinearPoolPairData } from '../src/pools/linearPool/linearPool';

describe('linear math tests', () => {
    let target1 = bnum(1000);
    let target2 = bnum(2000);
    let rate = bnum(1.1);
    let swapFee = bnum(0.02);
    let mainBalance = bnum(10000);
    let bptSupply = bnum(10000);
    let wrappedBalance = bnum(100);
    let poolPairData = makeLinearPoolPairData(
        mainBalance,
        bptSupply,
        wrappedBalance,
        swapFee,
        rate,
        target1,
        target2
    );
    context('swap outcomes', () => {
        it('_exactTokenInForBPTOut', () => {
            // Balances:
            // main, bpt, wrapped
            // 10000, 10000, 100
            let ans1 = linearMath._exactTokenInForBPTOut(
                bnum(100),
                poolPairData
            );
            assert.approximately(
                ans1.toNumber(),
                98.307150862,
                0.000000001,
                'wrong result'
            );

            mainBalance = bnum(900);
            poolPairData = makeLinearPoolPairData(
                mainBalance,
                bptSupply,
                wrappedBalance,
                swapFee,
                rate,
                target1,
                target2
            );
            // 900, 10000, 100
            let ans2 = linearMath._exactTokenInForBPTOut(
                bnum(1300),
                poolPairData
            );
            assert.approximately(
                ans2.toNumber(),
                12615.3259478,
                0.0000001,
                'wrong result'
            );
        });

        it('_tokenInForExactBPTOut', () => {
            // 900, 10000, 100
            let ans1 = linearMath._tokenInForExactBPTOut(
                bnum(100),
                poolPairData
            );
            assert.approximately(
                ans1.toNumber(),
                10.078,
                0.000000001,
                'wrong result'
            );

            // 900, 10000, 100
            let ans2 = linearMath._tokenInForExactBPTOut(
                bnum(5000),
                poolPairData
            );
            assert.approximately(
                ans2.toNumber(),
                512.5510204,
                0.0000001,
                'wrong result'
            );
        });

        it('_BPTInForExactTokenOut', () => {
            poolPairData = makeLinearPoolPairData(
                bptSupply,
                mainBalance,
                wrappedBalance,
                swapFee,
                rate,
                target1,
                target2
            );
            // 900, 10000, 100
            let ans1 = linearMath._BPTInForExactTokenOut(
                bnum(200),
                poolPairData
            );
            assert.approximately(
                ans1.toNumber(),
                1984.520738,
                0.000001,
                'wrong result'
            );

            mainBalance = bnum(2500);
            poolPairData = makeLinearPoolPairData(
                bptSupply,
                mainBalance,
                wrappedBalance,
                swapFee,
                rate,
                target1,
                target2
            );
            // 2500, 10000, 100
            let ans2 = linearMath._BPTInForExactTokenOut(
                bnum(1600),
                poolPairData
            );
            assert.approximately(
                ans2.toNumber(),
                6074.64002,
                0.000001,
                'wrong result'
            );
            let ans3 = linearMath._BPTInForExactTokenOut(
                bnum(800),
                poolPairData
            );
            assert.approximately(
                ans3.toNumber(),
                3014.744405,
                0.000001,
                'wrong result'
            );
        });

        it('_exactBPTInForTokenOut', () => {
            // 2500, 10000, 100
            let ans1 = linearMath._exactBPTInForTokenOut(
                bnum(200),
                poolPairData
            );
            assert.approximately(
                ans1.toNumber(),
                53.444,
                0.000001,
                'wrong result'
            );

            let ans2 = linearMath._exactBPTInForTokenOut(
                bnum(5000),
                poolPairData
            );
            assert.approximately(
                ans2.toNumber(),
                1320.098039,
                0.000001,
                'wrong result'
            );
        });
    });

    context('spot price after swap', () => {
        it('_spotPriceAfterSwapExactTokenInForBPTOut', () => {
            // 500, 10000, 100
            mainBalance = bnum(500);
            poolPairData = makeLinearPoolPairData(
                mainBalance,
                bptSupply,
                wrappedBalance,
                swapFee,
                rate,
                target1,
                target2
            );

            let out1 = linearMath._exactTokenInForBPTOut(
                bnum(200),
                poolPairData
            );
            let out2 = linearMath._exactTokenInForBPTOut(
                bnum(200.001),
                poolPairData
            );
            let invIncrementalQuotient = bnum(0.001).div(out2.minus(out1));
            let ans = linearMath._spotPriceAfterSwapExactTokenInForBPTOut(
                bnum(200),
                poolPairData
            );
            assert.approximately(
                ans.div(invIncrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );

            out1 = linearMath._exactTokenInForBPTOut(bnum(500), poolPairData);
            out2 = linearMath._exactTokenInForBPTOut(
                bnum(500.001),
                poolPairData
            );
            invIncrementalQuotient = bnum(0.001).div(out2.minus(out1));
            ans = linearMath._spotPriceAfterSwapExactTokenInForBPTOut(
                bnum(500),
                poolPairData
            );
            assert.approximately(
                ans.div(invIncrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );

            out1 = linearMath._exactTokenInForBPTOut(bnum(1500), poolPairData);
            out2 = linearMath._exactTokenInForBPTOut(
                bnum(1500.001),
                poolPairData
            );
            invIncrementalQuotient = bnum(0.001).div(out2.minus(out1));
            ans = linearMath._spotPriceAfterSwapExactTokenInForBPTOut(
                bnum(1500),
                poolPairData
            );
            assert.approximately(
                ans.div(invIncrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );
        });

        it('_spotPriceAfterSwapTokenInForExactBPTOut', () => {
            // 500, 10000, 100
            let in1 = linearMath._tokenInForExactBPTOut(
                bnum(500),
                poolPairData
            );
            let in2 = linearMath._tokenInForExactBPTOut(
                bnum(500.001),
                poolPairData
            );
            let incrementalQuotient = in2.minus(in1).div(bnum(0.001));
            let ans = linearMath._spotPriceAfterSwapTokenInForExactBPTOut(
                bnum(500),
                poolPairData
            );
            assert.approximately(
                ans.div(incrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );

            in1 = linearMath._tokenInForExactBPTOut(bnum(10000), poolPairData);
            in2 = linearMath._tokenInForExactBPTOut(
                bnum(10000.001),
                poolPairData
            );
            incrementalQuotient = in2.minus(in1).div(bnum(0.001));
            ans = linearMath._spotPriceAfterSwapTokenInForExactBPTOut(
                bnum(10000),
                poolPairData
            );
            assert.approximately(
                ans.div(incrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );

            in1 = linearMath._tokenInForExactBPTOut(bnum(40000), poolPairData);
            in2 = linearMath._tokenInForExactBPTOut(
                bnum(40000.001),
                poolPairData
            );
            incrementalQuotient = in2.minus(in1).div(bnum(0.001));
            ans = linearMath._spotPriceAfterSwapTokenInForExactBPTOut(
                bnum(40000),
                poolPairData
            );
            assert.approximately(
                ans.div(incrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );
        });

        it('_spotPriceAfterSwapBPTInForExactTokenOut', () => {
            mainBalance = bnum(3500);
            // 3500, 10000, 100
            poolPairData = makeLinearPoolPairData(
                bptSupply,
                mainBalance,
                wrappedBalance,
                swapFee,
                rate,
                target1,
                target2
            );

            let in1 = linearMath._BPTInForExactTokenOut(
                bnum(200),
                poolPairData
            );
            let in2 = linearMath._BPTInForExactTokenOut(
                bnum(200.001),
                poolPairData
            );
            let incrementalQuotient = in2.minus(in1).div(bnum(0.001));
            let ans = linearMath._spotPriceAfterSwapBPTInForExactTokenOut(
                bnum(200),
                poolPairData
            );
            assert.approximately(
                ans.div(incrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );

            in1 = linearMath._BPTInForExactTokenOut(bnum(1600), poolPairData);
            in2 = linearMath._BPTInForExactTokenOut(
                bnum(1600.001),
                poolPairData
            );
            incrementalQuotient = in2.minus(in1).div(bnum(0.001));
            ans = linearMath._spotPriceAfterSwapBPTInForExactTokenOut(
                bnum(1600),
                poolPairData
            );
            assert.approximately(
                ans.div(incrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );

            in1 = linearMath._BPTInForExactTokenOut(bnum(3000), poolPairData);
            in2 = linearMath._BPTInForExactTokenOut(
                bnum(3000.001),
                poolPairData
            );
            incrementalQuotient = in2.minus(in1).div(bnum(0.001));
            ans = linearMath._spotPriceAfterSwapBPTInForExactTokenOut(
                bnum(3000),
                poolPairData
            );
            assert.approximately(
                ans.div(incrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );
        });

        it('_spotPriceAfterSwapExactBPTInForTokenOut', () => {
            mainBalance = bnum(3500);
            // 3500, 10000, 100
            poolPairData = makeLinearPoolPairData(
                bptSupply,
                mainBalance,
                wrappedBalance,
                swapFee,
                rate,
                target1,
                target2
            );

            let out1 = linearMath._exactBPTInForTokenOut(
                bnum(200),
                poolPairData
            );
            let out2 = linearMath._exactBPTInForTokenOut(
                bnum(200.001),
                poolPairData
            );
            let invIncrementalQuotient = bnum(0.001).div(out2.minus(out1));
            let ans = linearMath._spotPriceAfterSwapExactBPTInForTokenOut(
                bnum(200),
                poolPairData
            );
            assert.approximately(
                ans.div(invIncrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );

            out1 = linearMath._exactBPTInForTokenOut(bnum(5000), poolPairData);
            out2 = linearMath._exactBPTInForTokenOut(
                bnum(5000.001),
                poolPairData
            );
            invIncrementalQuotient = bnum(0.001).div(out2.minus(out1));
            ans = linearMath._spotPriceAfterSwapExactBPTInForTokenOut(
                bnum(5000),
                poolPairData
            );
            assert.approximately(
                ans.div(invIncrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );

            out1 = linearMath._exactBPTInForTokenOut(bnum(8000), poolPairData);
            out2 = linearMath._exactBPTInForTokenOut(
                bnum(8000.001),
                poolPairData
            );
            invIncrementalQuotient = bnum(0.001).div(out2.minus(out1));
            ans = linearMath._spotPriceAfterSwapExactBPTInForTokenOut(
                bnum(8000),
                poolPairData
            );
            assert.approximately(
                ans.div(invIncrementalQuotient).toNumber(),
                1,
                0.00000001,
                'wrong result'
            );
        });
    });
    context('derivatives of spot price after swap', () => {
        it('derivatives of spot price are zero', () => {
            let derivativeSpotPrice1 =
                linearMath._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                    bnum(100),
                    poolPairData
                );
            let derivativeSpotPrice2 =
                linearMath._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                    bnum(100),
                    poolPairData
                );
            let derivativeSpotPrice3 =
                linearMath._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                    bnum(100),
                    poolPairData
                );
            let derivativeSpotPrice4 =
                linearMath._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                    bnum(100),
                    poolPairData
                );
            assert.equal(derivativeSpotPrice1.toNumber(), 0, 'should be zero');
            assert.equal(derivativeSpotPrice2.toNumber(), 0, 'should be zero');
            assert.equal(derivativeSpotPrice3.toNumber(), 0, 'should be zero');
            assert.equal(derivativeSpotPrice4.toNumber(), 0, 'should be zero');
        });
    });
});

function makeLinearPoolPairData(
    balanceIn: BigNumber,
    balanceOut: BigNumber,
    wrappedBalance: BigNumber,
    swapFee: BigNumber,
    rate: BigNumber,
    target1: BigNumber,
    target2: BigNumber
): LinearPoolPairData {
    return {
        pairType: 0,
        balanceIn: balanceIn,
        balanceOut: balanceOut,
        wrappedBalance: wrappedBalance,
        wrappedDecimals: 0,
        rate: rate,
        target1: target1,
        target2: target2,
        swapFee: swapFee,
        id: 'ignored',
        address: 'ignored',
        poolType: PoolTypes.Linear,
        tokenIn: 'ignored',
        tokenOut: 'ignored',
        decimalsIn: 0,
        decimalsOut: 0,
    };
}
