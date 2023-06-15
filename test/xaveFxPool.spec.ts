// yarn test:only test/xaveFxPool.spec.ts
import { expect } from 'chai';
import { BigNumber } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';

import { OldBigNumber, PoolTypes, SwapTypes } from '../src';
// Add new PoolType
import { FxPool, FxPoolPairData } from '../src/pools/xaveFxPool/fxPool';
import {
    ALMOST_ZERO,
    spotPriceBeforeSwap,
    _spotPriceAfterSwapExactTokenInForTokenOut,
} from '../src/pools/xaveFxPool/fxPoolMath';

// Add new pool test data in Subgraph Schema format
import testPools from './testData/fxPool/fxPool.json';
import testCases from './testData/fxPool/fxPoolTestCases.json';

type TestCaseType = {
    testNo: string;
    description: string;
    swapType: string;
    givenAmount: string;
    tokenIn: string;
    tokenOut: string;
    expectedSpotPriceBeforeSwap: string;
    expectedSpotPriceAfterSwap: string;
    expectedSwapOutput: string;
    expectedDerivativeSpotPriceAfterSwap: string;
};

const ONE_NUMERAIRE = bnum(1);

describe('xaveFxPool: fxPools stub test', () => {
    context('parsePoolPairData', () => {
        it(`should correctly parse token > token`, async () => {
            // It's useful to use tokens with <18 decimals for some tests to make sure scaling is ok
            const poolData = testPools.pools[0];

            const newPool = FxPool.fromPool(poolData);

            const poolPairData = newPool.parsePoolPairData(
                newPool.tokens[0].address, // tokenIn, USDC
                newPool.tokens[1].address // tokenOut, XSGD
            );

            expect(poolPairData.id).to.eq(poolData.id);
            expect(poolPairData.poolType).to.eq(PoolTypes.Fx);

            expect(
                poolPairData.alpha
                    .div(bnum(10).pow(18))
                    .decimalPlaces(8)
                    .toString()
            ).to.eq(poolData.alpha);
            expect(
                poolPairData.beta
                    .div(bnum(10).pow(18))
                    .decimalPlaces(8)
                    .toString()
            ).to.eq(poolData.beta);
            expect(
                poolPairData.lambda
                    .div(bnum(10).pow(18))
                    .decimalPlaces(8)
                    .toString()
            ).to.eq(poolData.lambda);
            expect(
                poolPairData.delta
                    .div(bnum(10).pow(18))
                    .decimalPlaces(8)
                    .toString()
            ).to.eq(poolData.delta);
            expect(
                poolPairData.epsilon
                    .div(bnum(10).pow(18))
                    .decimalPlaces(8)
                    .toString()
            ).to.eq(poolData.epsilon);
        });
    });

    // All pools are weighted 50:50.
    // Max value to swap before halting is defined as
    // maxLimit  = [(1 + alpha) * oGLiq * 0.5] - token value in numeraire
    context('limit amounts', () => {
        it(`getLimitAmountSwap, token to token`, async () => {
            // Test limit amounts against expected values
            const poolData = testPools.pools[0];
            const newPool = FxPool.fromPool(poolData);
            const poolPairData = newPool.parsePoolPairData(
                newPool.tokens[0].address, // tokenIn
                newPool.tokens[1].address // tokenOut
            );

            const amount = newPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.equals('355216.345225');
        });
    });

    // copied from the other implementations of the other project
    context('class functions', () => {
        it('getNormalizedLiquidity', async () => {
            const poolData = testPools.pools[0];
            const newPool = FxPool.fromPool(poolData);
            const poolPairData = newPool.parsePoolPairData(
                newPool.tokens[0].address, // tokenIn, USDC
                newPool.tokens[1].address // tokenOut, XSGD
            );

            expect(
                newPool.getNormalizedLiquidity(poolPairData).toString()
            ).to.equals(bnum(1).div(ALMOST_ZERO).toString());
        });
    });

    context('Test Swaps', () => {
        context('FxPool Test Cases', () => {
            const testCasesArray: TestCaseType[] = testCases as TestCaseType[];

            for (const testCase of testCasesArray) {
                it(`Test Case No. ${testCase.testNo} - ${testCase.description}`, async () => {
                    const givenAmount = bnum(testCase.givenAmount); // decimal is 6 for xsgd and usdc

                    const poolData = testPools.pools[0];
                    const newPool = FxPool.fromPool(poolData);

                    const poolPairData = newPool.parsePoolPairData(
                        testCase.tokenIn === 'USDC'
                            ? newPool.tokens[0].address
                            : newPool.tokens[1].address, // tokenIn
                        testCase.tokenOut === 'USDC'
                            ? newPool.tokens[0].address
                            : newPool.tokens[1].address // tokenOut
                    );

                    const spotPriceBeforeSwapValue = spotPriceBeforeSwap(
                        ONE_NUMERAIRE,
                        poolPairData
                    );

                    expect(
                        spotPriceBeforeSwapValue
                            .decimalPlaces(9, OldBigNumber.ROUND_UP)
                            .toString()
                    ).to.equals(
                        testCase.expectedSpotPriceBeforeSwap,
                        'spotPriceBeforeSwapValue'
                    );

                    if (testCase.swapType === 'OriginSwap') {
                        let amountOut;

                        if (testCase.testNo === '9') {
                            // CurveMathRevert.SwapConvergenceFailed
                            const amountOut = newPool._exactTokenInForTokenOut(
                                poolPairData,
                                givenAmount
                            );
                            expect(amountOut.toString()).to.eq(
                                '0',
                                'amountOut'
                            );
                        } else {
                            amountOut = newPool._exactTokenInForTokenOut(
                                poolPairData,
                                givenAmount
                            );

                            expect(amountOut.toString()).to.be.equal(
                                testCase.expectedSwapOutput,
                                'amountOut vs. expectedSwapOutput'
                            );

                            // this doesn't make much sense now
                            // expect(amountOut.toString()).to.be.equal(
                            //     viewRawAmount(
                            //         bnum(testCase.expectedSwapOutput),
                            //         bnum(poolPairData.decimalsOut),
                            //         poolPairData.tokenOutLatestFXPrice,
                            //         poolPairData.tokenOutfxOracleDecimals
                            //     ).toString(),
                            //     '_exactTokenInForTokenOut vs rawAmount'
                            // );

                            const _spotPriceAfterSwapExactTokenInForTokenOut =
                                newPool._spotPriceAfterSwapExactTokenInForTokenOut(
                                    poolPairData,
                                    givenAmount
                                );

                            expect(
                                _spotPriceAfterSwapExactTokenInForTokenOut
                                    .decimalPlaces(9, OldBigNumber.ROUND_UP)
                                    .toString()
                            ).to.equals(
                                testCase.expectedSpotPriceAfterSwap,
                                'expectedSpotPriceAfterSwap'
                            );

                            const derivative =
                                newPool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                                    poolPairData,
                                    givenAmount
                                );

                            expect(derivative.toFixed(20)).to.be.equal(
                                testCase.expectedDerivativeSpotPriceAfterSwap,
                                'derivative'
                            );
                        }
                    } else {
                        let amountIn;

                        if (testCase.testNo === '12') {
                            // CurveMathRevert.LowerHalt
                            const amountIn = newPool._tokenInForExactTokenOut(
                                poolPairData,
                                givenAmount
                            );
                            expect(amountIn.toString()).to.eq('0');
                        } else {
                            amountIn = newPool._tokenInForExactTokenOut(
                                poolPairData,
                                givenAmount
                            );
                            expect(amountIn.toString()).to.be.equal(
                                testCase.expectedSwapOutput,
                                'amountIn vs. expectedSwapOutput'
                            );

                            // expect(amountIn.toString()).to.be.eq(
                            //     viewRawAmount(
                            //         bnum(testCase.expectedSwapOutput),
                            //         bnum(poolPairData.decimalsIn),
                            //         poolPairData.tokenInLatestFXPrice,
                            //         poolPairData.tokenInfxOracleDecimals
                            //     ).toString(),
                            //     '_tokenInForExactTokenOut vs rawAmount'
                            // );

                            const _spotPriceAfterSwapTokenInForExactTokenOut =
                                newPool._spotPriceAfterSwapTokenInForExactTokenOut(
                                    poolPairData,
                                    givenAmount
                                );

                            expect(
                                _spotPriceAfterSwapTokenInForExactTokenOut
                                    .decimalPlaces(9, OldBigNumber.ROUND_UP)
                                    .toString()
                            ).to.equal(
                                testCase.expectedSpotPriceAfterSwap,
                                'expectedSpotPriceAfterSwap'
                            );

                            const derivative =
                                newPool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                                    poolPairData,
                                    givenAmount
                                );

                            expect(derivative.toFixed(20)).to.be.equal(
                                testCase.expectedDerivativeSpotPriceAfterSwap,
                                'derivative'
                            );
                        }
                    }
                });
            }
        });
    });

    context('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
        it('should return sp for 0 amount', () => {
            const amount = bnum(0);
            const poolPairData: FxPoolPairData = {
                id: '0x726e324c29a1e49309672b244bdc4ff62a270407000200000000000000000702',
                address: '0x726e324c29a1e49309672b244bdc4ff62a270407',
                poolType: 8,
                tokenIn: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
                tokenOut: '0xdc3326e71d45186f113a2f448984ca0e8d201995',
                decimalsIn: 6,
                decimalsOut: 6,
                balanceIn: BigNumber.from('0xbf24ffac00'),
                balanceOut: BigNumber.from('0x59bbba58b6'),
                swapFee: BigNumber.from('0x25'),
                alpha: bnum('0x0b1a2bc2ec500000'),
                beta: bnum('0x06a94d74f4300000'),
                lambda: bnum('0x0429d069189e0000'),
                delta: bnum('0x03cb71f51fc55800'),
                epsilon: bnum('0x01c6bf52634000'),
                tokenInLatestFXPrice: bnum('99963085000000'),
                tokenOutLatestFXPrice: bnum('74200489000000'),
                tokenInfxOracleDecimals: bnum(8),
                tokenOutfxOracleDecimals: bnum(8),
            };
            const sp = _spotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                amount
            );

            expect(sp.isNaN()).to.be.false;
        });
    });
});
