import { expect, assert } from 'chai';
import 'mocha';
import { Pool } from '../src/direct/types';
import { smartOrderRouter } from '../src';
import { BigNumber } from '../src/utils/bignumber';
import { BONE } from '../src/bmath';
import { getSpotPrice } from '../src/direct/helpers';
import balancersJson from './multi-pools.json';

const errorDelta = 10 ** -8;

function calcRelativeDiff(expected: BigNumber, actual: BigNumber): BigNumber {
    return expected
        .minus(actual)
        .div(expected)
        .abs();
}

function loadMultiPools(): Pool[] {
    let balancers: Pool[] = [];
    balancersJson.balancers.forEach((balancer, i) => {
        let pool: Pool = {
            id: balancer.id,
            balanceIn: new BigNumber(balancer.balanceIn).times(BONE),
            balanceOut: new BigNumber(balancer.balanceOut).times(BONE),
            weightIn: new BigNumber(balancer.weightIn),
            weightOut: new BigNumber(balancer.weightOut),
            swapFee: new BigNumber(balancer.fee).times(BONE),
            spotPrice: new BigNumber(balancer.spotPrice),
            slippage: new BigNumber(balancer.slippage),
        };
        balancers.push(pool);
    });

    return balancers;
}

describe('Multi-Pool Tests', () => {
    it('should test multi pool SOR', () => {
        var balancers = loadMultiPools();
        var amountIn = new BigNumber(0.7).times(BONE);
        var swaps = smartOrderRouter(
            balancers,
            'swapExactIn',
            amountIn,
            10,
            new BigNumber(0)
        );

        assert.equal(swaps.length, 4, 'Should be four swaps for this example.');
        assert.equal(swaps[0].pool, '12', 'First pool.');
        assert.equal(swaps[1].pool, '2', 'Second pool.');
        assert.equal(swaps[2].pool, '9', 'Third pool.');
        assert.equal(swaps[3].pool, '5', 'Fourth pool.');

        // Taken form python-SOR, SOR_method_comparison.py
        var expectedSwap1 = new BigNumber(0.4047892856401362).times(BONE);
        var relDif = calcRelativeDiff(expectedSwap1, swaps[0].amount);
        assert.isAtMost(relDif.toNumber(), errorDelta, 'First swap incorrect.');

        var expectedSwap1 = new BigNumber(0.18627809162495904).times(BONE);
        relDif = calcRelativeDiff(expectedSwap1, swaps[1].amount);
        assert.isAtMost(
            relDif.toNumber(),
            errorDelta,
            'Second swap incorrect.'
        );

        var expectedSwap1 = new BigNumber(0.09598365577328219).times(BONE);
        relDif = calcRelativeDiff(expectedSwap1, swaps[2].amount);
        assert.isAtMost(relDif.toNumber(), errorDelta, 'Third swap incorrect.');

        var expectedSwap1 = new BigNumber(0.012948966961622496).times(BONE);
        relDif = calcRelativeDiff(expectedSwap1, swaps[3].amount);
        assert.isAtMost(
            relDif.toNumber(),
            errorDelta,
            'Fourth swap incorrect.'
        );
    });
});
