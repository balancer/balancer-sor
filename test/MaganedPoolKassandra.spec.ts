import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { parseFixed } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import { SwapTypes } from '../src';
import { MaganedPoolKassandra } from '../src/pools/managedPools/MaganedPoolKassandra';
import managedPools from './testData/managedPools/kassandraManagedPoolsTest.json';

const MAX_RATIO = bnum(0.3);

describe('MaganedPoolKassandra', () => {
    context('parsePoolPairData', () => {
        it(`should correctly parse USDC > BAL`, async () => {
            const pool = cloneDeep(managedPools).pools[0];
            const tokenIn = pool.tokens[0];
            const tokenOut = pool.tokens[1];
            const managedPool = MaganedPoolKassandra.fromPool(pool);
            const poolPairData = managedPool.parsePoolPairData(
                tokenIn.address,
                tokenOut.address
            );

            expect(poolPairData.swapFee.toString()).to.eq(
                parseFixed(pool.swapFee, 18).toString()
            );
            expect(poolPairData.id).to.eq(pool.id);
            expect(poolPairData.tokenIn).to.eq(tokenIn.address);
            expect(poolPairData.tokenOut).to.eq(tokenOut.address);
            expect(poolPairData.balanceIn.toString()).to.eq(
                parseFixed(tokenIn.balance, tokenIn.decimals).toString()
            );
            expect(poolPairData.balanceOut.toString()).to.eq(
                parseFixed(tokenOut.balance, tokenOut.decimals).toString()
            );
            expect(poolPairData.weightIn.toString()).to.eq(
                parseFixed(tokenIn.weight, 18).toString()
            );
            expect(poolPairData.weightOut.toString()).to.eq(
                parseFixed(tokenOut.weight, 18).toString()
            );
        });
    });

    context('limit amounts', () => {
        it(`getLimitAmountSwap, BAL to USDC`, async () => {
            const pool = cloneDeep(managedPools).pools[0];
            const tokenIn = pool.tokens[0];
            const tokenOut = pool.tokens[1];
            const managedPool = MaganedPoolKassandra.fromPool(pool);
            const poolPairData = managedPool.parsePoolPairData(
                tokenIn.address,
                tokenOut.address
            );

            let amount = managedPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.eq(
                bnum(tokenIn.balance).times(MAX_RATIO).toString()
            );

            amount = managedPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq(
                bnum(tokenOut.balance).times(MAX_RATIO).toString()
            );
        });

        it(`getLimitAmountSwap, USDC to BAL`, async () => {
            const pool = cloneDeep(managedPools).pools[0];
            const tokenIn = pool.tokens[1];
            const tokenOut = pool.tokens[0];
            const managedPool = MaganedPoolKassandra.fromPool(pool);
            const poolPairData = managedPool.parsePoolPairData(
                tokenIn.address,
                tokenOut.address
            );

            let amount = managedPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.eq(
                bnum(tokenIn.balance).times(MAX_RATIO).toString()
            );

            amount = managedPool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq(
                bnum(tokenOut.balance).times(MAX_RATIO).toString()
            );
        });
    });

    context('Test Swaps', () => {
        context('_exactTokenInForTokenOut', () => {
            it('BAL>USDC', async () => {
                const pool = cloneDeep(managedPools).pools[0];
                const tokenIn = pool.tokens[0];
                const tokenOut = pool.tokens[1];
                const amountIn = bnum('1.5');
                const managedPool = MaganedPoolKassandra.fromPool(pool);
                const poolPairData = managedPool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                const amountOut = managedPool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('5.61881163893890533');
            });
            it('USDC>BAL', async () => {
                const pool = cloneDeep(managedPools).pools[0];
                const tokenIn = pool.tokens[1];
                const tokenOut = pool.tokens[0];
                const amountIn = bnum('5.61881163893890533');
                const managedPool = MaganedPoolKassandra.fromPool(pool);
                const poolPairData = managedPool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                const amountOut = managedPool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut.toString()).to.eq('1.489550744765116');
            });
        });
        context('_tokenInForExactTokenOut', () => {
            it('BAL>DAI', async () => {
                const pool = cloneDeep(managedPools).pools[0];
                const tokenIn = pool.tokens[0];
                const tokenOut = pool.tokens[1];
                const amountOut = bnum('5.5');
                const managedPool = MaganedPoolKassandra.fromPool(pool);
                const poolPairData = managedPool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                const amountIn = managedPool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('1.468235525276634269');
            });
            it('DAI>BAL', async () => {
                const pool = cloneDeep(managedPools).pools[0];
                const tokenIn = pool.tokens[1];
                const tokenOut = pool.tokens[0];
                const amountOut = bnum('1.5');
                const managedPool = MaganedPoolKassandra.fromPool(pool);
                const poolPairData = managedPool.parsePoolPairData(
                    tokenIn.address,
                    tokenOut.address
                );
                const amountIn = managedPool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn.toString()).to.eq('5.658287029780740079');
            });
        });
    });
});
