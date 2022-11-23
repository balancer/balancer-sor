// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/xaveFxPool.spec.ts
import { expect } from 'chai';
import { bnum, scale } from '../src/utils/bignumber';
import { PoolTypes, SwapTypes } from '../src';
// Add new PoolType
import { FxPool } from '../src/pools/xaveFxPool/fxPool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/fxPool/fxPool.json';
import { parseFixed } from '@ethersproject/bignumber';
import { spotPriceBeforeSwap } from '../src/pools/xaveFxPool/fxPoolMath';

// @todo add tests for within beta
// @todo add tests for outside beta
// @todo add tests on the other function
// @todo ask khidir about maxOut limit
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

    // @todo check with khidir
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
        // @todo check with khidir
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

        context('_exactTokenInForTokenOut', () => {
            it('OriginSwap/_exactTokenInForTokenOut USDC > ? SGD', async () => {
                const amountIn = bnum(parseFixed('100000', 6).toString());

                console.log('AMOUNT IN :', amountIn);
                const poolData = testPools.pools[0];
                const newPool = FxPool.fromPool(poolData);

                const poolPairData = newPool.parsePoolPairData(
                    newPool.tokens[0].address, // tokenIn, USDC
                    newPool.tokens[1].address // tokenOut, XSGD
                );

                console.log(
                    'spotPriceBeforeSwap: ',
                    spotPriceBeforeSwap(
                        scale(bnum('1'), 6),
                        poolPairData
                    ).toNumber()
                );

                const amountOut = newPool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                console.log(
                    `_exactTokenInForTokenOut Amount out: ${amountOut}`
                );

                console.log(
                    `_spotPriceAfterSwapExactTokenInForTokenOut: ${newPool._spotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                    )}`
                );
                console.log(
                    `_derivativeSpotPriceAfterSwapExactTokenInForTokenOut: ${newPool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                    )}`
                );

                // @todo add expected for amountOut
            });
        });

        context('_tokenInForExactTokenOut', () => {
            it('TargetSwap / tokenInForExactTokenOut ? USDC > XSGD', async () => {
                const amountOut = bnum(parseFixed('10000', 6).toString());
                const poolData = testPools.pools[0];
                const newPool = FxPool.fromPool(poolData);
                const poolPairData = newPool.parsePoolPairData(
                    newPool.tokens[0].address, // tokenIn, USDC
                    newPool.tokens[1].address // tokenOut, XSGD
                );
                const amountIn = newPool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );

                //@todo add expected amountIn
                // expect(amountIn).to.eq(KNOWN_AMOUNT);

                console.log(
                    'spotPriceBeforeSwap: ',
                    spotPriceBeforeSwap(
                        scale(bnum('1'), 6),
                        poolPairData
                    ).toNumber()
                );

                console.log(`Amount in: ${amountIn}`);

                console.log(
                    `_spotPriceAfterSwapExactTokenInForTokenOut: ${newPool._spotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountOut
                    )}`
                );
                console.log(
                    `_derivativeSpotPriceAfterSwapExactTokenInForTokenOut: ${newPool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountOut
                    )}`
                );
            });
        });
    });
});
