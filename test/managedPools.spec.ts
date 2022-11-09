// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/managedPools.spec.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { formatFixed } from '@ethersproject/bignumber';
import BigNumber from 'bignumber.js';
import { assert } from 'chai';
import { SwapTypes, ManagedPool, bnum, OldBigNumber } from '../src';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import singlePool from './testData/managedPools/singlePool.json';

describe(`Tests for Managed Pools.`, () => {
    context('limit amounts', () => {
        it(`tokenToToken`, async () => {
            const pool = ManagedPool.fromPool(singlePool.pools[0]);
            const tokenIn = pool.tokens[1].address;
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
            const tokenIn = pool.tokens[0].address;
            const tokenOut = pool.tokens[1].address;
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
            const tokenOut = pool.tokens[0].address;
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

// is it possible that there is no restriction at one or both sides?
// what are the values for lowerBreakerRatio or upperBreakerRatio in that case?
function verifyPrices(
    pool: ManagedPool,
    bptDelta: OldBigNumber,
    balancesDeltas: OldBigNumber[]
): boolean {
    let answer = true;
    const S = bnum(formatFixed(pool.totalShares, 18)).plus(bptDelta);
    const totalWeight = pool.totalWeight.div(ONE).toNumber();
    balancesDeltas.unshift(bnum(0));
    const balances = pool.tokens.map((token, i) =>
        bnum(token.balance).plus(balancesDeltas[i])
    );
    balances.splice(0, 1);
    for (let i = 0; i < balances.length; i++) {
        const w = Number(pool.tokens[i + 1].weight) / totalWeight;
        const B = balances[i];
        const price = S.div(B).times(w);
        const lowerLimit =
            pool.referenceBptPrices[i] * pool.lowerBreakerRatio ** (1 - w);
        const upperLimit =
            pool.referenceBptPrices[i] * pool.upperBreakerRatio ** (1 - w);
        const priceNumber = price.toNumber();
        if (priceNumber < lowerLimit || priceNumber > upperLimit) {
            answer = false;
        }
    }
    return answer;
}
