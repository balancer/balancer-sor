// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/testTemplate.spec.ts
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { parseFixed } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import { USDC, BAL } from './lib/constants';
import { SwapTypes } from '../src';
// Add new PoolType
import { NewPool } from '../src/pools/newPoolType/NewPool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/newPoolType/pools.json';

describe('new pool tests', () => {
    context('parsePoolPairData', () => {
        it(`should correctly parse token > token`, async () => {
            // It's useful to use tokens with <18 decimals for some tests to make sure scaling is ok
            const tokenIn = USDC;
            const tokenOut = BAL;
            const poolSG = cloneDeep(testPools).pools[0];
            const pool = NewPool.fromPool(poolSG);
            const poolPairData = pool.parsePoolPairData(
                tokenIn.address,
                tokenOut.address
            );

            // Tests that compare poolPairData to known results with correct number scaling, etc, i.e.:
            expect(poolPairData.swapFee.toString()).to.eq(
                parseFixed(poolSG.swapFee, 18).toString()
            );
            expect(poolPairData.id).to.eq(poolSG.id);
        });

        // Add tests for any relevant token pairs, i.e. token<>BPT if available
    });

    context('limit amounts', () => {
        it(`getLimitAmountSwap, token to token`, async () => {
            // Test limit amounts against expected values
            const tokenIn = USDC;
            const tokenOut = BAL;
            const poolSG = cloneDeep(testPools);
            const pool = NewPool.fromPool(poolSG.pools[0]);
            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            let amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );

            expect(amount.toString()).to.eq('KNOWN_LIMIT');

            amount = pool.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(amount.toString()).to.eq('KNOWN_LIMIT');
        });
    });

    context('Test Swaps', () => {
        context('_exactTokenInForTokenOut', () => {
            it('token>token', async () => {
                const tokenIn = USDC;
                const tokenOut = BAL;
                const amountIn = bnum('HUMAN_AMT_IN');
                const poolSG = cloneDeep(testPools);
                const pool = NewPool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);
                const amountOut = pool._exactTokenInForTokenOut(
                    poolPairData,
                    amountIn
                );
                expect(amountOut).to.eq(KNOWN_AMOUNT);
            });
        });
        context('_tokenInForExactTokenOut', () => {
            it('token>token', async () => {
                const tokenIn = USDC;
                const tokenOut = BAL;
                const amountOut = bnum('HUMAN_AMT_OUT');
                const poolSG = cloneDeep(testPools);
                const pool = NewPool.fromPool(poolSG.pools[0]);
                const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);
                const amountIn = pool._tokenInForExactTokenOut(
                    poolPairData,
                    amountOut
                );
                expect(amountIn).to.eq(KNOWN_AMOUNT);
            });
        });
    });
});
