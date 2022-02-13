import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { formatFixed, parseFixed } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import { USDC, USDT } from './lib/constants';
import { SwapTypes } from '../src';
// Add new PoolType
import { Gyro3Pool } from '../src/pools/gyro3Pool/gyro3Pool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/gyro3Pools/gyro3TestPool.json';

describe('Gyro3Pool tests USDC > DAI', () => {
    const testPool = cloneDeep(testPools).pools[0];
    const pool = Gyro3Pool.fromPool(testPool);

    const poolPairData = pool.parsePoolPairData(USDT.address, USDC.address);

    context('parsePoolPairData', () => {
        it(`should correctly parse USDT > USDC`, async () => {
            // Tests that compare poolPairData to known results with correct number scaling, etc, i.e.:
            expect(poolPairData.swapFee.toString()).to.eq(
                parseFixed(testPool.swapFee, 18).toString()
            );
            expect(poolPairData.id).to.eq(testPool.id);
        });

        it(`should correctly calculate symmetric price bound parameter (cube root alpha)`, async () => {
            expect(
                Number(formatFixed(pool.root3Alpha, 18))
            ).to.be.approximately(0.995647752, 0.0000001);
        });
    });

    context('limit amounts', () => {
        it(`should correctly calculate limit amounts, USDT > USDC`, async () => {
            let amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.eq('24935.7');

            amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq('24445.5');
        });
    });

    context('normalized liquidity', () => {
        it(`should correctly calculate normalized liquidity, USDT > USDC`, async () => {
            const normalizedLiquidity =
                pool.getNormalizedLiquidity(poolPairData);

            expect(normalizedLiquidity.toString()).to.equal(
                '19016283.981512596845077192'
            );
        });
    });

    context('Test Swaps', () => {
        context('SwapExactIn', () => {
            const amountIn = bnum('234.3543');

            it('should correctly calculate amountOut given amountIn', async () => {
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('233.62822068392501182');
            });
            it('should correctly calculate newSpotPrice', async () => {
                const newSpotPrice =
                    pool._spotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                    );
                expect(newSpotPrice.toString()).to.eq('1.003120202974438177');
            });
            it('should correctly calculate derivative of spot price function at newSpotPrice', async () => {
                const derivative =
                    pool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                        poolPairData,
                        amountIn
                    );
                expect(derivative.toString()).to.eq('0.000000105499880184');
            });
        });

        context('SwapExactOut', () => {
            const amountOut = bnum('4523.5334368');

            it('should correctly calculate amountIn given amountOut', async () => {
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('4538.618912825809655998');
            });

            it('should correctly calculate newSpotPrice', async () => {
                const newSpotPrice =
                    pool._spotPriceAfterSwapTokenInForExactTokenOut(
                        poolPairData,
                        amountOut
                    );
                expect(newSpotPrice.toString()).to.eq('1.003574353766587852');
            });

            it('should correctly calculate derivative of spot price function at newSpotPrice', async () => {
                const derivative =
                    pool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                        poolPairData,
                        amountOut
                    );
                expect(derivative.toString()).to.eq('0.000000105900938637');
            });
        });
    });
});
