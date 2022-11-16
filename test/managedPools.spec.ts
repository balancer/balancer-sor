// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/managedPools.spec.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { formatFixed } from '@ethersproject/bignumber';
import { assert } from 'chai';
import { SwapTypes, ManagedPool, bnum, OldBigNumber } from '../src';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import singlePool from './testData/managedPools/singleManagedPool.json';
import cloneDeep from 'lodash.clonedeep';

describe(`debug Tests for Managed Pools.`, () => {
    context('limit amounts', () => {
        // BPT index = 1
        it(`tokenToToken`, async () => {
            const pool = ManagedPool.fromPool(singlePool.pools[0]);
            const tokenIn = pool.tokens[0].address;
            const tokenOut = pool.tokens[2].address;
            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            // swapExactIn
            let swapType = SwapTypes.SwapExactIn;
            let limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            const limitAmtOut = pool._exactTokenInForTokenOut(
                poolPairData,
                limitAmt
            );
            const bptDelta = bnum(0);
            let balancesDeltas = [limitAmt, limitAmtOut.negated(), bnum(0)];
            let isAdmissible = verifyPrices(pool, bptDelta, balancesDeltas);
            assert.isTrue(isAdmissible, 'invalid operation');

            // swapExactOut
            swapType = SwapTypes.SwapExactOut;
            limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            const limitAmtIn = pool._tokenInForExactTokenOut(
                poolPairData,
                limitAmt
            );
            balancesDeltas = [limitAmtIn, limitAmt.negated(), bnum(0)];
            isAdmissible = verifyPrices(pool, bptDelta, balancesDeltas);
            assert.isTrue(isAdmissible, 'invalid operation');
        });
        it(`bptToToken - exitSwap`, async () => {
            const pool = ManagedPool.fromPool(singlePool.pools[0]);
            const tokenIn = pool.tokens[1].address;
            const tokenOut = pool.tokens[0].address;
            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            // swapExactIn
            let swapType = SwapTypes.SwapExactIn;
            let limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            const limitAmtOut = pool._exactTokenInForTokenOut(
                poolPairData,
                limitAmt
            );
            let bptDelta = limitAmt.negated();
            let balancesDelta = [limitAmtOut.negated(), bnum(0), bnum(0)];
            let isAdmissible = verifyPrices(pool, bptDelta, balancesDelta);
            assert.isTrue(isAdmissible, 'invalid operation');

            // swapExactOut
            swapType = SwapTypes.SwapExactOut;
            limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            bptDelta = pool
                ._tokenInForExactTokenOut(poolPairData, limitAmt)
                .negated();
            balancesDelta = [limitAmt.negated(), bnum(0), bnum(0)];
            isAdmissible = verifyPrices(pool, bptDelta, balancesDelta);
            assert.isTrue(isAdmissible, 'invalid operation');
        });
        it(`tokenToBpt - joinSwap`, async () => {
            const pool = ManagedPool.fromPool(singlePool.pools[0]);
            const tokenIn = pool.tokens[2].address;
            const tokenOut = pool.tokens[1].address;
            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            // swapExactIn
            let swapType = SwapTypes.SwapExactIn;
            let limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            const limitAmtOut = pool._exactTokenInForTokenOut(
                poolPairData,
                limitAmt
            );
            let balancesDelta = [limitAmt, bnum(0), bnum(0)];
            let bptDelta = limitAmtOut;
            let isAdmissible = verifyPrices(pool, bptDelta, balancesDelta);
            assert.isTrue(isAdmissible, 'invalid operation');

            // swapExactOut
            swapType = SwapTypes.SwapExactOut;
            limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            const limitAmtIn = pool._tokenInForExactTokenOut(
                poolPairData,
                limitAmt
            );
            balancesDelta = [limitAmtIn, bnum(0), bnum(0)];
            bptDelta = limitAmt;
            isAdmissible = verifyPrices(pool, bptDelta, balancesDelta);
            assert.isTrue(isAdmissible, 'invalid operation');
        });
    });
});

function verifyPrices(
    pool: ManagedPool,
    bptDelta: OldBigNumber,
    balancesDeltas: OldBigNumber[]
): boolean {
    let answer = true;
    const S = bnum(formatFixed(pool.totalShares, 18)).plus(bptDelta);
    const totalWeight = pool.totalWeight.div(ONE).toNumber();
    const tokens = cloneDeep(pool.tokens);
    const bptIndex = tokens.findIndex((token) => token.address == pool.address);
    tokens.splice(bptIndex, 1);
    for (let i = 0; i < tokens.length; i++) {
        const w = Number(tokens[i].weight) / totalWeight;
        const B = bnum(tokens[i].balance).plus(balancesDeltas[i]);
        const price = S.div(B).times(w);
        const bptPrice = tokens[i].circuitBreaker?.bptPrice as number;
        const lowerBreakerRatio = tokens[i].circuitBreaker
            ?.lowerBoundPercentage as number;
        const upperBreakerRatio = tokens[i].circuitBreaker
            ?.upperBoundPercentage as number;
        const lowerLimit = bptPrice * lowerBreakerRatio ** (1 - w);
        const upperLimit = bptPrice * upperBreakerRatio ** (1 - w);
        const priceNumber = price.toNumber();
        if (priceNumber < lowerLimit || priceNumber > upperLimit) {
            answer = false;
        }
    }
    return answer;
}
