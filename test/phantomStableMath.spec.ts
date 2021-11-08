// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/math.spec.ts
import { assert } from 'chai';
import { formatFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber } from '../src/utils/bignumber';
import { bnum } from '../src/utils/bignumber';
import phantomStableStabal3WithPriceRates from './testData/phantomStablePools/phantomStableStabal3WithPriceRates.json';
import {
    PhantomStablePool,
    PhantomStablePoolPairData,
} from '../src/pools/phantomStablePool/phantomStablePool';
import * as phantomStableMath from '../src/pools/phantomStablePool/phantomStableMath';
import { STABAL3PHANTOM, LINEAR_AUSDT, LINEAR_AUSDC } from './lib/constants';

describe('phantomStable pools tests', () => {
    // For the moment we tolerate a moderate relative error until
    // more accurate formulas are developed for phantomStable.
    const error = 0.005;

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
                STABAL3PHANTOM.address,
                LINEAR_AUSDC.address
            );
            const priceRateOut = bnum(
                formatFixed(poolPairData.tokenOutPriceRate, 18)
            );
            // swap outcomes
            const { a1, a2 } = getSwapOutcomes(
                phantomStablePool,
                poolPairData,
                4000
            );
            const b1 = phantomStableMath
                ._exactBPTInForTokenOut(bnum(4000), poolPairData)
                .div(priceRateOut);
            const b2 = phantomStableMath._BPTInForExactTokenOut(
                bnum(4000).times(priceRateOut),
                poolPairData
            );
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
            // spot prices
            checkPhantomStableSpotPrices(
                phantomStablePool,
                poolPairData,
                4000,
                error
            );
        });
        it('phantomStable token -> BPT', () => {
            const poolPairData = phantomStablePool.parsePoolPairData(
                LINEAR_AUSDC.address,
                STABAL3PHANTOM.address
            );
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
        bnum(amount),
        true
    );
    const a2 = phantomStablePool._tokenInForExactTokenOut(
        poolPairData,
        bnum(amount),
        true
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
        bnum(amount + delta),
        true
    );
    const f0 = phantomStablePool._exactTokenInForTokenOut(
        poolPairData,
        bnum(amount),
        true
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
        bnum(amount + delta),
        true
    );
    const f0 = phantomStablePool._tokenInForExactTokenOut(
        poolPairData,
        bnum(amount),
        true
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
