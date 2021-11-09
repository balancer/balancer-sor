// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/math.spec.ts
import { assert } from 'chai';
import { BigNumber as OldBigNumber } from '../src/utils/bignumber';
import { bnum } from '../src/utils/bignumber';
import { BAL, WETH } from './lib/constants';
import singleWeightedPool from './testData/weightedPools/singlePoolWithSwapEnabled.json';
import { WeightedPool } from '../src/pools/weightedPool/weightedPool';

describe('weightedMath tests', () => {
    // TO DO: add items using checkOutcome function
    context('spot prices', () => {
        const weightedPool = WeightedPool.fromPool(singleWeightedPool.pools[0]);
        const weightedPoolPairData = weightedPool.parsePoolPairData(
            WETH.address,
            BAL.address
        );
        it('weighted _spotPriceAfterSwapExactTokenInForTokenOut', () => {
            checkDerivative(
                weightedPool._exactTokenInForTokenOut,
                weightedPool._spotPriceAfterSwapExactTokenInForTokenOut,
                weightedPoolPairData,
                1,
                0.001,
                0.00000001,
                true
            );
        });
        it('weighted _spotPriceAfterSwapTokenInForExactTokenOut', () => {
            checkDerivative(
                weightedPool._tokenInForExactTokenOut,
                weightedPool._spotPriceAfterSwapTokenInForExactTokenOut,
                weightedPoolPairData,
                10,
                0.01,
                0.00000001,
                false
            );
        });
        it('weighted _derivativeSpotPriceAfterSwapExactTokenInForTokenOut', () => {
            checkDerivative(
                weightedPool._spotPriceAfterSwapExactTokenInForTokenOut,
                weightedPool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
                weightedPoolPairData,
                1,
                0.001,
                0.0000001,
                false
            );
        });
    });
});

function checkDerivative(
    fn: (
        poolPairData: any,
        amount: OldBigNumber,
        exact: boolean
    ) => OldBigNumber,
    der: (poolPairData: any, amount: OldBigNumber) => OldBigNumber,
    poolPairData: any,
    amount: number,
    delta: number,
    error: number,
    inverse = false
) {
    const x = bnum(amount);
    let incrementalQuotient = fn(poolPairData, x.plus(delta), true)
        .minus(fn(poolPairData, x, true))
        .div(delta);
    if (inverse) incrementalQuotient = bnum(1).div(incrementalQuotient);
    const der_ans = der(poolPairData, x);
    assert.approximately(
        incrementalQuotient.div(der_ans).toNumber(),
        1,
        error,
        'wrong result'
    );
}
