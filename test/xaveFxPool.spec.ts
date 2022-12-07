// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/xaveFxPool.spec.ts
import { assert, expect } from 'chai';
import { bnum, scale } from '../src/utils/bignumber';
import { PoolTypes, SwapTypes } from '../src';
// Add new PoolType
import { FxPool } from '../src/pools/xaveFxPool/fxPool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/fxPool/fxPool.json';
import testCases from './testData/fxPool/fxPoolTestCases.json';
import { parseFixed } from '@ethersproject/bignumber';
import {
    CurveMathRevert,
    getBaseDecimals,
    rateToNumber,
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

            console.log(
                `1 - ${newPool.tokens[0].address}, 2 - ${newPool.tokens[1].address}`
            );
            console.log(poolPairData);

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

    // copied from the other implementations of the other project
    context('limit amounts', () => {
        it(`getLimitAmountSwap, token to token`, async () => {
            // Test limit amounts against expected values

            const poolData = testPools.pools[0];
            const newPool = FxPool.fromPool(poolData);
            const poolPairData = newPool.parsePoolPairData(
                newPool.tokens[0].address, // tokenIn
                newPool.tokens[1].address // tokenOut
            );

            let amount = newPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            // expect(amount.toString()).to.eq('KNOWN_LIMIT');
            console.log('getLimitAmountSwap: SwapExactIn');

            console.log(amount.toString());

            amount = newPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            console.log(amount);

            console.log('getLimitAmountSwap: SwapExactOut');
            // @todo add expected amount
        });
    });

    context('Test Swaps', () => {
        // copied from the other implementations of the other project
        context('class functions', () => {
            // @todo check with khidir
            it('getNormalizedLiquidity', async () => {
                const poolData = testPools.pools[0];
                const newPool = FxPool.fromPool(poolData);
                const poolPairData = newPool.parsePoolPairData(
                    newPool.tokens[0].address, // tokenIn, USDC
                    newPool.tokens[1].address // tokenOut, XSGD
                );

                console.log(newPool.getNormalizedLiquidity(poolPairData));
            });
        });

        context('FxPool Test Cases', () => {
            const testCasesArray: TestCaseType[] = testCases as TestCaseType[];

            for (const testCase of testCasesArray) {
                it(`Test Case No. ${testCase.testNo} - ${testCase.description}`, async () => {
                    console.log(`Starting Test Case # ${testCase.testNo}`);
                    const givenAmount = bnum(
                        parseFixed(testCase.givenAmount, 6).toString()
                    ); // decimal is 6 for xsfd and usdc

                    console.log('givenAmount: ', givenAmount.toNumber());

                    console.log(
                        `testCase.tokenIn === 'USDC' is ${
                            testCase.tokenIn === 'USDC'
                        },testCase.tokenOut === 'USDC' is ${
                            testCase.tokenOut === 'USDC'
                        } `
                    );

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
                        console.log('origin swap');
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
                            expect(amountOut.toNumber()).to.be.closeTo(
                                viewRawAmount(
                                    Number(testCase.expectedSwapOutput),
                                    rateToNumber(
                                        poolPairData.tokenOutRate.toNumber()
                                    ),
                                    getBaseDecimals(poolPairData.decimalsOut)
                                ).toNumber(),
                                10000
                            ); // rounded off

                            const _spotPriceAfterSwapExactTokenInForTokenOut =
                                newPool._spotPriceAfterSwapExactTokenInForTokenOut(
                                    poolPairData,
                                    givenAmount
                                );

                            console.log(
                                '_spotPriceAfterSwapExactTokenInForTokenOut: ',
                                _spotPriceAfterSwapExactTokenInForTokenOut
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

                            console.log('Derivative: ', derivative);
                            console.log(
                                'testCase.expectedDerivativeSpotPriceAfterSwap: ',
                                testCase.expectedDerivativeSpotPriceAfterSwap
                            );

                            expect(derivative).to.be.closeTo(
                                Number(
                                    testCase.expectedDerivativeSpotPriceAfterSwap
                                ),
                                0.001 // adjustment
                            );
                        }
                    } else {
                        console.log('target swap');
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

                            expect(amountIn.toNumber()).to.be.closeTo(
                                viewRawAmount(
                                    Number(testCase.expectedSwapOutput),
                                    rateToNumber(
                                        poolPairData.tokenInRate.toNumber()
                                    ),
                                    getBaseDecimals(poolPairData.decimalsIn)
                                ).toNumber(),
                                2000000
                            ); // rounded off, decimal adjustment

                            const _spotPriceAfterSwapTokenInForExactTokenOut =
                                newPool._spotPriceAfterSwapTokenInForExactTokenOut(
                                    poolPairData,
                                    givenAmount
                                );

                            console.log(
                                '_spotPriceAfterSwapTokenInForExactTokenOut: ',
                                _spotPriceAfterSwapTokenInForExactTokenOut
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

                            console.log('Derivative: ', derivative);
                            console.log(
                                'testCase.expectedDerivativeSpotPriceAfterSwap: ',
                                testCase.expectedDerivativeSpotPriceAfterSwap
                            );

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

        // context.skip('_exactTokenInForTokenOut', () => {
        //     it('OriginSwap/_exactTokenInForTokenOut USDC > ? XSGD', async () => {
        //         const amountIn = bnum(parseFixed('200000', 6).toString());

        //         console.log('AMOUNT IN :', amountIn);
        //         const poolData = testPools.pools[0];
        //         const newPool = FxPool.fromPool(poolData);

        //         const poolPairData = newPool.parsePoolPairData(
        //             newPool.tokens[0].address, // tokenIn, USDC
        //             newPool.tokens[1].address // tokenOut, XSGD
        //         );

        //         console.log(
        //             'spotPriceBeforeSwap: ',
        //             spotPriceBeforeSwap(
        //                 scale(bnum('1'), 6),
        //                 poolPairData
        //             ).toNumber()
        //         );

        //         const amountOut = newPool._exactTokenInForTokenOut(
        //             poolPairData,
        //             amountIn
        //         );
        //         console.log(
        //             `_exactTokenInForTokenOut Amount out: ${amountOut}`
        //         );

        //         console.log(
        //             `_spotPriceAfterSwapExactTokenInForTokenOut: ${newPool._spotPriceAfterSwapExactTokenInForTokenOut(
        //                 poolPairData,
        //                 amountIn
        //             )}`
        //         );
        //         console.log(
        //             `_derivativeSpotPriceAfterSwapExactTokenInForTokenOut: ${newPool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        //                 poolPairData,
        //                 amountIn
        //             )}`
        //         );

        //         // @todo add expected for amountOut
        //     });

        //     it.skip('OriginSwap/_exactTokenInForTokenOut XSGD > ? USDC', async () => {
        //         const amountIn = bnum(parseFixed('200000', 6).toString());

        //         console.log('AMOUNT IN :', amountIn);
        //         const poolData = testPools.pools[0];
        //         const newPool = FxPool.fromPool(poolData);

        //         const poolPairData = newPool.parsePoolPairData(
        //             newPool.tokens[1].address, // tokenIn, XSGD
        //             newPool.tokens[0].address // tokenOut, USDC
        //         );

        //         console.log(
        //             'spotPriceBeforeSwap: ',
        //             spotPriceBeforeSwap(
        //                 scale(bnum('1'), 6),
        //                 poolPairData
        //             ).toNumber()
        //         );

        //         const amountOut = newPool._exactTokenInForTokenOut(
        //             poolPairData,
        //             amountIn
        //         );
        //         console.log(
        //             `_exactTokenInForTokenOut Amount out: ${amountOut}`
        //         );

        //         console.log(
        //             `_spotPriceAfterSwapExactTokenInForTokenOut: ${newPool._spotPriceAfterSwapExactTokenInForTokenOut(
        //                 poolPairData,
        //                 amountIn
        //             )}`
        //         );
        //         console.log(
        //             `_derivativeSpotPriceAfterSwapExactTokenInForTokenOut: ${newPool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        //                 poolPairData,
        //                 amountIn
        //             )}`
        //         );

        //         // @todo add expected for amountOut
        //     });
        // });

        // context('_tokenInForExactTokenOut', () => {
        //     it('TargetSwap / tokenInForExactTokenOut ? USDC > XSGD', async () => {
        //         const amountOut = bnum(parseFixed('200000', 6).toString());
        //         const poolData = testPools.pools[0];
        //         const newPool = FxPool.fromPool(poolData);
        //         const poolPairData = newPool.parsePoolPairData(
        //             newPool.tokens[0].address, // tokenIn, USDC
        //             newPool.tokens[1].address // tokenOut, XSGD
        //         );

        //         //@todo add expected amountIn
        //         // expect(amountIn).to.eq(KNOWN_AMOUNT);
        //         console.log(
        //             '=================================spotPriceBeforeSwap================================='
        //         );
        //         console.log(
        //             'spotPriceBeforeSwap: ',
        //             spotPriceBeforeSwap(
        //                 scale(bnum('1'), 6),
        //                 poolPairData
        //             ).toNumber()
        //         );
        //         console.log(
        //             '=================================TARGET SWAP================================='
        //         );

        //         const amountIn = newPool._tokenInForExactTokenOut(
        //             poolPairData,
        //             amountOut
        //         );

        //         console.log(
        //             `TargetSwap Results in Raw Amount: ${formatFixed(
        //                 amountIn.toNumber(),
        //                 poolPairData.decimalsIn
        //             )}`
        //         );
        //         console.log(
        //             '=================================_spotPriceAfterSwapTokenInForExactTokenOut================================='
        //         );
        //         console.log(
        //             `_spotPriceAfterSwapTokenInForExactTokenOut: ${newPool._spotPriceAfterSwapTokenInForExactTokenOut(
        //                 poolPairData,
        //                 amountOut
        //             )}`
        //         );
        //         console.log(
        //             '=================================_derivativeSpotPriceAfterSwapTokenInForExactTokenOut================================='
        //         );
        //         console.log(
        //             `_derivativeSpotPriceAfterSwapTokenInForExactTokenOut: ${newPool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        //                 poolPairData,
        //                 amountOut
        //             )}`
        //         );
        //     });

        //     it('TargetSwap / tokenInForExactTokenOut ? XSGD > USDC', async () => {
        //         const amountOut = bnum(parseFixed('200000', 6).toString());
        //         const poolData = testPools.pools[0];
        //         const newPool = FxPool.fromPool(poolData);
        //         const poolPairData = newPool.parsePoolPairData(
        //             newPool.tokens[1].address, // tokenIn, XSGD
        //             newPool.tokens[0].address // tokenOut, USDC
        //         );

        //         //@todo add expected amountIn
        //         // expect(amountIn).to.eq(KNOWN_AMOUNT);
        //         console.log(
        //             '=================================spotPriceBeforeSwap================================='
        //         );
        //         console.log(
        //             'spotPriceBeforeSwap: ',
        //             spotPriceBeforeSwap(
        //                 scale(bnum('1'), 6),
        //                 poolPairData
        //             ).toNumber()
        //         );

        //         console.log(
        //             '=================================TARGET SWAP================================='
        //         );

        //         const amountIn = newPool._tokenInForExactTokenOut(
        //             poolPairData,
        //             amountOut
        //         );

        //         console.log(
        //             `TargetSwap Results in Raw Amount: ${formatFixed(
        //                 amountIn.toNumber(),
        //                 poolPairData.decimalsIn
        //             )}`
        //         );
        //         console.log(
        //             '=================================_spotPriceAfterSwapExactTokenInForTokenOut================================='
        //         );
        //         console.log(
        //             `_spotPriceAfterSwapExactTokenInForTokenOut: ${newPool._spotPriceAfterSwapTokenInForExactTokenOut(
        //                 poolPairData,
        //                 amountOut
        //             )}`
        //         );
        //         console.log(
        //             '=================================_derivativeSpotPriceAfterSwapExactTokenInForTokenOut================================='
        //         );
        //         console.log(
        //             `_derivativeSpotPriceAfterSwapExactTokenInForTokenOut: ${newPool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        //                 poolPairData,
        //                 amountOut
        //             )}`
        //         );
        //     });
        // });
    });
});
