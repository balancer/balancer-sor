// yarn test:only test/xaveFxPool.spec.ts
import { expect } from 'chai';
import { formatFixed, parseFixed, BigNumber } from '@ethersproject/bignumber';
import { bnum, ZERO } from '../src/utils/bignumber';
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
const debug = require('debug')('xave');

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
            const alphaValue = bnum(formatFixed(poolPairData.alpha, 18));
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
                poolPairData.tokenInLatestFXPrice
            );

            const expectedLimitForTokenOut = viewRawAmount(
                maxLimitAmountForTokenOut,
                poolPairData.tokenOutLatestFXPrice
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
                                    poolPairData.tokenOutLatestFXPrice
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
                                    poolPairData.tokenInLatestFXPrice
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
                alpha: BigNumber.from('0x0b1a2bc2ec500000'),
                beta: BigNumber.from('0x06a94d74f4300000'),
                lambda: BigNumber.from('0x0429d069189e0000'),
                delta: BigNumber.from('0x03cb71f51fc55800'),
                epsilon: BigNumber.from('0x01c6bf52634000'),
                tokenInLatestFXPrice: bnum('99963085000000'),
                tokenOutLatestFXPrice: bnum('74200489000000'),
            };
            const sp = _spotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                amount
            );

            expect(sp.isNaN()).to.be.false;
        });
    });
});
