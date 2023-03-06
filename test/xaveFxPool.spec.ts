// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

// yarn test:only test/xaveFxPool.spec.ts
import { assert, expect } from 'chai';
import { bnum, scale } from '../src/utils/bignumber';
import { PoolTypes, SwapTypes } from '../src';
// Add new PoolType
import { FxPool } from '../src/pools/xaveFxPool/fxPool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/fxPool/fxPool.json';
import testCases from './testData/fxPool/fxPoolTestCases.json';
import { formatFixed, parseFixed } from '@ethersproject/bignumber';
import {
    ALMOST_ZERO,
    CurveMathRevert,
    getBaseDecimals,
    poolBalancesToNumeraire,
    spotPriceBeforeSwap,
    viewRawAmount,
} from '../src/pools/xaveFxPool/fxPoolMath';

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

describe('Test for fxPools', () => {
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

            expect(poolPairData.alpha._hex).to.eq(
                parseFixed(poolData.alpha, 18)._hex
            );
            expect(poolPairData.beta._hex).to.eq(
                parseFixed(poolData.beta, 18)._hex
            );
            expect(poolPairData.lambda._hex).to.eq(
                parseFixed(poolData.lambda, 18)._hex
            );
            expect(poolPairData.delta._hex).to.eq(
                parseFixed(poolData.delta, 18)._hex
            );
            expect(poolPairData.epsilon._hex).to.eq(
                parseFixed(poolData.epsilon, 18)._hex
            );
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

            const reservesInNumeraire = poolBalancesToNumeraire(poolPairData);
            const alphaValue = Number(formatFixed(poolPairData.alpha, 18));
            const maxLimit =
                (1 + alphaValue) * reservesInNumeraire._oGLiq * 0.5;

            const maxLimitAmountForTokenIn =
                maxLimit - reservesInNumeraire.tokenInReservesInNumeraire;

            const maxLimitAmountForTokenOut =
                maxLimit - reservesInNumeraire.tokenOutReservesInNumeraire;

            const expectedLimitForTokenIn = bnum(
                formatFixed(
                    viewRawAmount(
                        maxLimitAmountForTokenIn,
                        poolPairData.tokenInRate.toNumber()
                    ).toString(),
                    poolPairData.decimalsIn
                )
            );

            const expectedLimitForTokenOut = bnum(
                formatFixed(
                    viewRawAmount(
                        maxLimitAmountForTokenOut,
                        poolPairData.tokenOutRate.toNumber()
                    ).toString(),
                    poolPairData.decimalsOut
                )
            );

            let amount = newPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.equals(
                expectedLimitForTokenIn.toString()
            );

            amount = newPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.equals(
                expectedLimitForTokenOut.toString()
            );
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
                newPool.getNormalizedLiquidity(poolPairData).toNumber()
            ).to.equals(1 / ALMOST_ZERO);
        });
    });

    context('Test Swaps', () => {
        context('FxPool Test Cases', () => {
            const testCasesArray: TestCaseType[] = testCases as TestCaseType[];

            for (const testCase of testCasesArray) {
                it(`Test Case No. ${testCase.testNo} - ${testCase.description}`, async () => {
                    const givenAmount = bnum(
                        parseFixed(testCase.givenAmount, 6).toString()
                    ); // decimal is 6 for xsfd and usdc

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
                        scale(bnum('1'), 6),
                        poolPairData
                    ).toNumber();

                    expect(spotPriceBeforeSwapValue.toFixed(9)).to.equals(
                        testCase.expectedSpotPriceBeforeSwap
                    );

                    if (testCase.swapType === 'OriginSwap') {
                        let amountOut;

                        if (testCase.testNo === '9') {
                            assert.throws(
                                () =>
                                    newPool._exactTokenInForTokenOut(
                                        poolPairData,
                                        givenAmount
                                    ),
                                Error,
                                CurveMathRevert.SwapConvergenceFailed
                            );
                        } else {
                            amountOut = newPool._exactTokenInForTokenOut(
                                poolPairData,
                                givenAmount
                            );
                            expect(
                                amountOut
                                    .div(
                                        getBaseDecimals(
                                            poolPairData.decimalsOut
                                        )
                                    )
                                    .toNumber()
                            ).to.be.closeTo(
                                viewRawAmount(
                                    Number(testCase.expectedSwapOutput),

                                    poolPairData.tokenOutRate.toNumber()
                                ).toNumber(),
                                10000
                            ); // rounded off

                            const _spotPriceAfterSwapExactTokenInForTokenOut =
                                newPool._spotPriceAfterSwapExactTokenInForTokenOut(
                                    poolPairData,
                                    givenAmount
                                );

                            expect(
                                Number(
                                    _spotPriceAfterSwapExactTokenInForTokenOut
                                        .toNumber()
                                        .toFixed(9)
                                )
                            ).to.be.closeTo(
                                Number(testCase.expectedSpotPriceAfterSwap),
                                0.01 // adjusted for test 11
                            );

                            const derivative = newPool
                                ._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                                    poolPairData,
                                    givenAmount
                                )
                                .toNumber();

                            expect(derivative).to.be.closeTo(
                                Number(
                                    testCase.expectedDerivativeSpotPriceAfterSwap
                                ),
                                0.001 // adjustment
                            );
                        }
                    } else {
                        let amountIn;

                        if (testCase.testNo === '12') {
                            assert.throws(
                                () =>
                                    newPool._tokenInForExactTokenOut(
                                        poolPairData,
                                        givenAmount
                                    ),
                                Error,
                                CurveMathRevert.LowerHalt
                            );
                        } else {
                            amountIn = newPool._tokenInForExactTokenOut(
                                poolPairData,
                                givenAmount
                            );

                            expect(
                                amountIn
                                    .div(
                                        getBaseDecimals(poolPairData.decimalsIn)
                                    )
                                    .toNumber()
                            ).to.be.closeTo(
                                viewRawAmount(
                                    Number(testCase.expectedSwapOutput),
                                    poolPairData.tokenInRate.toNumber()
                                ).toNumber(),
                                2000000
                            ); // rounded off, decimal adjustment

                            const _spotPriceAfterSwapTokenInForExactTokenOut =
                                newPool._spotPriceAfterSwapTokenInForExactTokenOut(
                                    poolPairData,
                                    givenAmount
                                );

                            expect(
                                Number(
                                    _spotPriceAfterSwapTokenInForExactTokenOut
                                        .toNumber()
                                        .toFixed(9)
                                )
                            ).to.be.closeTo(
                                Number(testCase.expectedSpotPriceAfterSwap),
                                0.00001 // adjusted for test number 11
                            );

                            const derivative = newPool
                                ._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                                    poolPairData,
                                    givenAmount
                                )
                                .toNumber();

                            expect(derivative).to.be.closeTo(
                                Number(
                                    testCase.expectedDerivativeSpotPriceAfterSwap
                                ),
                                0.001 // adjustment
                            );
                        }
                    }
                });
            }
        });
    });
});
