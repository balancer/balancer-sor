// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/gyro2Pool.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { formatFixed, parseFixed } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import { USDC, DAI } from './lib/constants';
import { SwapTypes } from '../src';
// Add new PoolType
import { Gyro2Pool } from '../src/pools/gyro2Pool/gyro2Pool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/gyro2Pools/gyro2TestPool.json';

describe('Gyro2Pool tests USDC > DAI', () => {
    const testPool = cloneDeep(testPools).pools[0];
    const pool = Gyro2Pool.fromPool(testPool);

    const poolPairData = pool.parsePoolPairData(USDC.address, DAI.address);

    const poolPairData2 = pool.parsePoolPairData(DAI.address, USDC.address);

    context('parsePoolPairData', () => {
        it(`should correctly parse USDC > DAI`, async () => {
            // Tests that compare poolPairData to known results with correct number scaling, etc, i.e.:
            expect(poolPairData.swapFee.toString()).to.eq(
                parseFixed(testPool.swapFee, 18).toString()
            );
            expect(poolPairData.id).to.eq(testPool.id);
        });

        it(`should correctly calculate price bounds USDC > DAI`, async () => {
            expect(
                Number(formatFixed(poolPairData.sqrtAlpha, 18))
            ).to.be.approximately(0.9995003747, 0.00000001);

            expect(
                Number(formatFixed(poolPairData.sqrtBeta, 18))
            ).to.be.approximately(1.000500375, 0.00000001);
        });

        it(`should correctly calculate price bounds DAI > USDC`, async () => {
            expect(
                Number(formatFixed(poolPairData2.sqrtAlpha, 18))
            ).to.be.approximately(0.9994998749, 0.00000001);

            expect(
                Number(formatFixed(poolPairData2.sqrtBeta, 18))
            ).to.be.approximately(1.000499875, 0.00000001);
        });
    });

    context('limit amounts', () => {
        it(`should correctly calculate limit amounts, USDC > DAI`, async () => {
            let amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.eq('300');

            amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq('369.6');
        });
    });

    context('normalized liquidity', () => {
        it(`should correctly calculate normalized liquidity, USDC > DAI`, async () => {
            const normalizedLiquidity =
                pool.getNormalizedLiquidity(poolPairData);

            expect(Number(normalizedLiquidity.toString())).to.be.approximately(
                2252709.0423891,
                0.00001
            );
        });

        it(`should correctly calculate normalized liquidity, DAI > USDC`, async () => {
            const normalizedLiquidity =
                pool.getNormalizedLiquidity(poolPairData2);

            expect(Number(normalizedLiquidity.toString())).to.be.approximately(
                2252944.2752,
                0.00001
            );
        });
    });

    context('Test Swaps', () => {
        context('SwapExactIn', () => {
            const amountIn = bnum('13.5');

            it('should correctly calculate amountOut given amountIn', async () => {
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('13.379816829921106482');
            });
            it('should correctly calculate newSpotPrice', async () => {
                const newSpotPrice =
                    pool._spotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                    );
                expect(newSpotPrice.toString()).to.eq('1.008988469289267733');
            });
            it('should correctly calculate derivative of spot price function at newSpotPrice', async () => {
                const derivative =
                    pool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                    );
                expect(derivative.toString()).to.eq('0.000000895794710891');
            });
        });

        context('SwapExactOut', () => {
            const amountOut = bnum('45.568');

            it('should correctly calculate amountIn given amountOut', async () => {
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('45.977973900999006919');
            });
            it('should correctly calculate newSpotPrice', async () => {
                const newSpotPrice =
                    pool._spotPriceAfterSwapTokenInForExactTokenOut(
                        poolPairData,
                        amountOut
                    );
                expect(newSpotPrice.toString()).to.eq('1.009017563096232974');
            });
            it('should correctly calculate derivative of spot price function at newSpotPrice', async () => {
                const derivative =
                    pool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                        poolPairData,
                        amountOut
                    );
                expect(derivative.toString()).to.eq('0.000000903885627537');
            });
        });
    });
});
