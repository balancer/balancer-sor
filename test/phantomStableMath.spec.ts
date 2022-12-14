// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/phantomStableMath.spec.ts
import { assert } from 'chai';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber } from '../src/utils/bignumber';
import { bnum } from '../src/utils/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import phantomStableStabal3WithPriceRates from './testData/phantomStablePools/phantomStableStabal3WithPriceRates.json';
import {
    PhantomStablePool,
    PhantomStablePoolPairData,
} from '../src/pools/phantomStablePool/phantomStablePool';
import * as phantomStableMath from '../src/pools/phantomStablePool/phantomStableMath';
import * as stableMathBigInt from '../src/pools/stablePool/stableMathBigInt';
import { bbaUSD, LINEAR_AUSDT, LINEAR_AUSDC } from './lib/constants';

const oldBN_ONE = bnum(ONE.toString());

describe('phantomStable pools tests', () => {
    const error = 0.00001;

    context('phantomStable pools', () => {
        const phantomStablePool = PhantomStablePool.fromPool(
            phantomStableStabal3WithPriceRates.pools[0]
        );
        it('phantomStable token -> token', () => {
            const poolPairData = phantomStablePool.parsePoolPairData(
                LINEAR_AUSDC.address,
                LINEAR_AUSDT.address
            );
            const priceRateIn = bnum(
                formatFixed(poolPairData.tokenInPriceRate, 18)
            );
            const priceRateOut = bnum(
                formatFixed(poolPairData.tokenOutPriceRate, 18)
            );
            const { a1, a2 } = getSwapOutcomes(
                phantomStablePool,
                poolPairData,
                4000
            );
            const b1 = phantomStableMath
                ._exactTokenInForTokenOut(
                    bnum(4000).times(priceRateIn),
                    poolPairData
                )
                .div(priceRateOut);
            const b2 = phantomStableMath
                ._tokenInForExactTokenOut(
                    bnum(4000).times(priceRateOut),
                    poolPairData
                )
                .div(priceRateIn);
            assert.approximately(
                a1.div(b1).toNumber(),
                1,
                error,
                'wrong result'
            );
            assert.approximately(
                a2.div(b2).toNumber(),
                1,
                error,
                'wrong result'
            );
            // spot price
            checkPhantomStableSpotPrices(
                phantomStablePool,
                poolPairData,
                4000,
                error
            );
            checkPhantomStableDerivativeSpotPrices(
                phantomStablePool,
                poolPairData,
                4000,
                error
            );
        });

        it('phantomStable BPT -> token', () => {
            const poolPairData = phantomStablePool.parsePoolPairData(
                bbaUSD.address,
                LINEAR_AUSDC.address
            );
            // swap outcomes
            // compares phantomStableMath with stableMathBigInt
            const amount = 4000;
            const outMath = phantomStableMath._exactBPTInForTokenOut(
                bnum(amount),
                poolPairData
            );
            const outBigInt = stableMathBigInt._calcTokenOutGivenExactBptIn(
                poolPairData.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                poolPairData.tokenIndexOut,
                ONE.mul(amount).toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                poolPairData.swapFee.toBigInt()
            );
            const bnumOutBigInt = bnum(outBigInt.toString()).div(oldBN_ONE);
            assert.approximately(
                outMath.div(bnumOutBigInt).toNumber(),
                1,
                error,
                'wrong result'
            );

            const inMath = phantomStableMath._BPTInForExactTokenOut(
                bnum(amount),
                poolPairData
            );
            const amountsOutBigInt = Array(
                poolPairData.allBalancesScaled.length
            ).fill(BigInt(0));
            amountsOutBigInt[poolPairData.tokenIndexIn] = parseFixed(
                amount.toString(),
                18
            ).toBigInt();

            const inBigInt = stableMathBigInt._calcBptInGivenExactTokensOut(
                poolPairData.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                amountsOutBigInt,
                poolPairData.virtualBptSupply.toBigInt(),
                poolPairData.swapFee.toBigInt()
            );
            const bnumInBigInt = bnum(inBigInt.toString()).div(oldBN_ONE);
            assert.approximately(
                inMath.div(bnumInBigInt).toNumber(),
                1,
                error,
                'wrong result'
            );
            // spot prices
            poolPairData.swapFee = BigNumber.from(0);
            const spPhantom =
                phantomStableMath._spotPriceAfterSwapExactBPTInForTokenOut(
                    bnum(0),
                    poolPairData
                );

            const balances = poolPairData.allBalancesScaled.map((balance) =>
                balance.toBigInt()
            );
            const spBigInt =
                stableMathBigInt._spotPriceAfterSwapExactBPTInForTokenOut(
                    poolPairData.amp.toBigInt(),
                    balances,
                    poolPairData.tokenIndexOut,
                    phantomStablePool.totalShares.toBigInt(),
                    BigInt(0)
                );
            const bnumSpBigInt = bnum(spBigInt.toString()).div(oldBN_ONE);
            assert.approximately(
                spPhantom.div(bnumSpBigInt).toNumber(),
                1,
                error,
                'wrong result'
            );
            checkPhantomStableSpotPrices(
                phantomStablePool,
                poolPairData,
                amount,
                error
            );
        });
        it('phantomStable token -> BPT', () => {
            const poolPairData = phantomStablePool.parsePoolPairData(
                LINEAR_AUSDC.address,
                bbaUSD.address
            );
            poolPairData.swapFee = BigNumber.from(0);

            // here we should compare phantomStableMath with stableMathBigInt
            // like in the previous case, BPT -> token.
            const { a1, a2 } = getSwapOutcomes(
                phantomStablePool,
                poolPairData,
                4000
            );
            const priceRateIn = bnum(
                formatFixed(poolPairData.tokenInPriceRate, 18)
            );
            const b1 = phantomStableMath._exactTokenInForBPTOut(
                bnum(4000).times(priceRateIn),
                poolPairData
            );
            assert.approximately(
                a1.div(b1).toNumber(),
                1,
                error,
                'wrong result'
            );
            const b2 = phantomStableMath
                ._tokenInForExactBPTOut(bnum(4000), poolPairData)
                .div(priceRateIn);
            assert.approximately(
                a2.div(b2).toNumber(),
                1,
                error,
                'wrong result'
            );
            // spot price:
            checkPhantomStableSpotPrices(
                phantomStablePool,
                poolPairData,
                4000,
                error
            );
        });
    });
});

function getSwapOutcomes(
    phantomStablePool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number
): { a1: OldBigNumber; a2: OldBigNumber } {
    const a1 = phantomStablePool._exactTokenInForTokenOut(
        poolPairData,
        bnum(amount)
    );
    const a2 = phantomStablePool._tokenInForExactTokenOut(
        poolPairData,
        bnum(amount)
    );
    return { a1, a2 };
}

function checkPhantomStableSpotPrices(
    phantomStablePool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    error: number
) {
    // exact token in
    let a = incrementalQuotientExactTokenInForTokenOut(
        phantomStablePool,
        poolPairData,
        amount,
        0.01
    );
    let b = phantomStablePool._spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData,
        bnum(amount)
    );
    assert.approximately(
        a.times(b).toNumber(),
        1,
        error,
        'wrong result, spot price exact token in'
    );
    // exact token out
    a = incrementalQuotientTokenInForExactTokenOut(
        phantomStablePool,
        poolPairData,
        amount,
        0.01
    );
    b = phantomStablePool._spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData,
        bnum(amount)
    );
    assert.approximately(
        a.div(b).toNumber(),
        1,
        error,
        'wrong result, spot price exact token out'
    );
}

function incrementalQuotientExactTokenInForTokenOut(
    phantomStablePool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    delta: number
): OldBigNumber {
    const f1 = phantomStablePool._exactTokenInForTokenOut(
        poolPairData,
        bnum(amount + delta)
    );
    const f0 = phantomStablePool._exactTokenInForTokenOut(
        poolPairData,
        bnum(amount)
    );
    const incrementalQuotient = f1.minus(f0).div(delta);
    return incrementalQuotient;
}

function incrementalQuotientTokenInForExactTokenOut(
    phantomStablePool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    delta: number
): OldBigNumber {
    const f1 = phantomStablePool._tokenInForExactTokenOut(
        poolPairData,
        bnum(amount + delta)
    );
    const f0 = phantomStablePool._tokenInForExactTokenOut(
        poolPairData,
        bnum(amount)
    );
    const incrementalQuotient = f1.minus(f0).div(delta);
    return incrementalQuotient;
}

function checkPhantomStableDerivativeSpotPrices(
    phantomStablePool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    error: number
) {
    // exact token in
    let a = incrementalQuotientSpotPriceAfterSwapExactTokenInForTokenOut(
        phantomStablePool,
        poolPairData,
        amount,
        0.01
    );
    let b =
        phantomStablePool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            poolPairData,
            bnum(amount)
        );
    assert.approximately(
        a.div(b).toNumber(),
        1,
        error,
        'wrong result, derivative spot price exact token in'
    );
    // exact token out
    a = incrementalQuotientSpotPriceAfterSwapTokenInForExactTokenOut(
        phantomStablePool,
        poolPairData,
        amount,
        0.01
    );
    b = phantomStablePool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData,
        bnum(amount)
    );
    assert.approximately(
        a.div(b).toNumber(),
        1,
        error,
        'wrong result, derivative spot price exact token out'
    );
}

function incrementalQuotientSpotPriceAfterSwapExactTokenInForTokenOut(
    phantomStablePool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    delta: number
): OldBigNumber {
    const f1 = phantomStablePool._spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData,
        bnum(amount + delta)
    );
    const f0 = phantomStablePool._spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData,
        bnum(amount)
    );
    const incrementalQuotient = f1.minus(f0).div(delta);
    return incrementalQuotient;
}

function incrementalQuotientSpotPriceAfterSwapTokenInForExactTokenOut(
    phantomStablePool: PhantomStablePool,
    poolPairData: PhantomStablePoolPairData,
    amount: number,
    delta: number
): OldBigNumber {
    const f1 = phantomStablePool._spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData,
        bnum(amount + delta)
    );
    const f0 = phantomStablePool._spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData,
        bnum(amount)
    );
    const incrementalQuotient = f1.minus(f0).div(delta);
    return incrementalQuotient;
}
