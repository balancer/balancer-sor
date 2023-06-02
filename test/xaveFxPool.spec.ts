// yarn test:only test/xaveFxPool.spec.ts
import { expect } from 'chai';
import { formatFixed, parseFixed, BigNumber } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, ZERO, bnum } from '../src/utils/bignumber';

import { PoolTypes, SwapTypes } from '../src';
// Add new PoolType
import { FxPool, FxPoolPairData } from '../src/pools/xaveFxPool/fxPool';
import {
    ALMOST_ZERO,
    poolBalancesToNumeraire,
    spotPriceBeforeSwap,
    viewRawAmount,
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

            expect(poolPairData.alpha.toString()).to.eq(
               poolData.alpha
            );
            expect(poolPairData.beta.toString()).to.eq(
               poolData.beta
            );
            expect(poolPairData.lambda.toString()).to.eq(
               poolData.lambda
            );
            expect(poolPairData.delta.toString()).to.eq(
               poolData.delta
            );
            expect(poolPairData.epsilon.toString()).to.eq(
               poolData.epsilon
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
            const alphaValue = poolPairData.alpha.div(bnum(10).pow(18));
            const maxLimit = alphaValue
                .plus(1)
                .times(reservesInNumeraire._oGLiq)
                .times(0.5);

            const maxLimitAmountForTokenIn = maxLimit.minus(
                reservesInNumeraire.tokenInReservesInNumeraire
            );

            const maxLimitAmountForTokenOut = maxLimit.minus(
                reservesInNumeraire.tokenOutReservesInNumeraire
            );

            const expectedLimitForTokenIn = viewRawAmount(
                maxLimitAmountForTokenIn,
                bnum(poolPairData.decimalsIn),
                poolPairData.tokenInLatestFXPrice,
                poolPairData.tokenInfxOracleDecimals
            );

            const expectedLimitForTokenOut = viewRawAmount(
                maxLimitAmountForTokenOut,
                bnum(poolPairData.decimalsOut),
                poolPairData.tokenOutLatestFXPrice,
                poolPairData.tokenOutfxOracleDecimals
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
                    ).toNumber();

                    expect(spotPriceBeforeSwapValue.toFixed(9)).to.equals(
                        testCase.expectedSpotPriceBeforeSwap
                    );

                    if (testCase.swapType === 'OriginSwap') {
                        let amountOut;

                        if (testCase.testNo === '9') {
                            // CurveMathRevert.SwapConvergenceFailed
                            const amountOut = newPool._exactTokenInForTokenOut(
                                poolPairData,
                                givenAmount
                            );
                            expect(amountOut).to.eq(ZERO);
                        } else {
                            amountOut = newPool._exactTokenInForTokenOut(
                                poolPairData,
                                givenAmount
                            );
                            expect(amountOut.toNumber()).to.be.closeTo(
                                viewRawAmount(
                                    bnum(testCase.expectedSwapOutput),
                                    bnum(poolPairData.decimalsOut),
                                    poolPairData.tokenOutLatestFXPrice,
                                    poolPairData.tokenOutfxOracleDecimals
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
                            // CurveMathRevert.LowerHalt
                            const amountIn = newPool._tokenInForExactTokenOut(
                                poolPairData,
                                givenAmount
                            );
                            expect(amountIn).to.eq(ZERO);
                        } else {
                            amountIn = newPool._tokenInForExactTokenOut(
                                poolPairData,
                                givenAmount
                            );

                            expect(amountIn.toNumber()).to.be.closeTo(
                                viewRawAmount(
                                    bnum(testCase.expectedSwapOutput),
                                    bnum(poolPairData.decimalsIn),
                                    poolPairData.tokenInLatestFXPrice,
                                    poolPairData.tokenInfxOracleDecimals
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
