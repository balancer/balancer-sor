import { expect, assert } from 'chai';
import 'mocha';
import { Pool } from '../src/types';
import {
    smartOrderRouter,
    smartOrderRouterEpsOfInterest,
    processBalancers,
    processEpsOfInterest,
} from '../src/sor';
import { BigNumber } from '../src/utils/bignumber';
import { getSpotPrice } from '../src/helpers';
import { BONE } from '../src/bmath';

const errorDelta = 10 ** -8;

function calcRelativeDiff(expected: BigNumber, actual: BigNumber): BigNumber {
    return expected
        .minus(actual)
        .div(expected)
        .abs();
}

// These example pools are taken from python-SOR SOR_method_comparison.py
let balancers: Pool[] = [
    {
        id: '0x165021F95EFB42643E9c3d8677c3430795a29806',
        balanceIn: new BigNumber(1.341648768830377422).times(BONE),
        balanceOut: new BigNumber(84.610322835523687996).times(BONE),
        weightIn: new BigNumber(0.6666666666666666),
        weightOut: new BigNumber(0.3333333333333333),
        swapFee: new BigNumber(0.005).times(BONE),
    },
    {
        id: '0x31670617b85451E5E3813E50442Eed3ce3B68d19',
        balanceIn: new BigNumber(14.305796722007608821).times(BONE),
        balanceOut: new BigNumber(376.662367824920653194).times(BONE),
        weightIn: new BigNumber(0.6666666666666666),
        weightOut: new BigNumber(0.3333333333333333),
        swapFee: new BigNumber(0.000001).times(BONE),
    },
];

describe('Two Pool Tests', () => {
    it('should test spot price', () => {
        var sp1 = getSpotPrice(balancers[0]);
        var sp2 = getSpotPrice(balancers[1]);

        // Taken form python-SOR, SOR_method_comparison.py
        var sp1Expected = new BigNumber(7968240028251420);
        var sp2Expected = new BigNumber(18990231371439040);

        var relDif = calcRelativeDiff(sp1Expected, sp1);
        assert.isAtMost(
            relDif.toNumber(),
            errorDelta,
            'Spot Price Balancer 1 Incorrect'
        );

        relDif = calcRelativeDiff(sp2Expected, sp2);
        assert.isAtMost(
            relDif.toNumber(),
            errorDelta,
            'Spot Price Balancer 2 Incorrect'
        );
    });

    it('should test two pool SOR swap amounts', () => {
        var amountIn = new BigNumber(0.7).times(BONE);
        var swaps = smartOrderRouter(
            balancers,
            'swapExactIn',
            amountIn,
            10,
            new BigNumber(0)
        );

        //console.log(swaps[0].amount.div(BONE).toString())
        //console.log(swaps[1].amount.div(BONE).toString())
        assert.equal(swaps.length, 2, 'Should be two swaps for this example.');

        // Taken form python-SOR, SOR_method_comparison.py
        var expectedSwap1 = new BigNumber(635206783664651400);
        var relDif = calcRelativeDiff(expectedSwap1, swaps[0].amount);
        assert.isAtMost(relDif.toNumber(), errorDelta, 'First swap incorrect.');

        var expectedSwap2 = new BigNumber(64793216335348570);
        relDif = calcRelativeDiff(expectedSwap2, swaps[1].amount);
        assert.isAtMost(
            relDif.toNumber(),
            errorDelta,
            'Second swap incorrect.'
        );
    });

    it('should test two pool SOR swap amounts smallest pool reached limit.', () => {
        var amountIn = new BigNumber(7.8).times(BONE);
        var swaps = smartOrderRouter(
            balancers,
            'swapExactIn',
            amountIn,
            10,
            new BigNumber(0)
        );

        //console.log(swaps[0].amount.div(BONE).toString())
        //console.log(swaps[1].amount.div(BONE).toString())
        assert.equal(swaps.length, 2, 'Should be two swaps for this example.');
        assert.equal(
            swaps[0].pool,
            '0x31670617b85451E5E3813E50442Eed3ce3B68d19',
            'First pool.'
        );
        assert.equal(
            swaps[1].pool,
            '0x165021F95EFB42643E9c3d8677c3430795a29806',
            'Second pool.'
        );

        // Taken form python-SOR, SOR_method_comparison.py with input changed to 400
        var expectedSwap1 = new BigNumber(7.12917562).times(BONE);
        var relDif = calcRelativeDiff(expectedSwap1, swaps[0].amount);
        assert.isAtMost(relDif.toNumber(), errorDelta, 'First swap incorrect.');

        var expectedSwap2 = new BigNumber(0.67082438).times(BONE);
        relDif = calcRelativeDiff(expectedSwap2, swaps[1].amount);
        assert.isAtMost(
            relDif.toNumber(),
            errorDelta,
            'Second swap incorrect.'
        );
    });

    it('should test exact limit for both pools.', () => {
        var amountIn = new BigNumber(7.823722745418976).times(BONE);
        var swaps = smartOrderRouter(
            balancers,
            'swapExactIn',
            amountIn,
            10,
            new BigNumber(0)
        );

        //console.log(swaps[0].amount.div(BONE).toString());
        //console.log(swaps[1].amount.div(BONE).toString());
        assert.equal(swaps.length, 2, 'Should be two swaps for this example.');
        assert.equal(
            swaps[0].pool,
            '0x31670617b85451E5E3813E50442Eed3ce3B68d19',
            'First pool.'
        );
        assert.equal(
            swaps[1].pool,
            '0x165021F95EFB42643E9c3d8677c3430795a29806',
            'Second pool.'
        );

        // Taken form python-SOR, SOR_method_comparison.py with input changed to 400
        var expectedSwap1 = new BigNumber(7.15289836100379).times(BONE);
        var relDif = calcRelativeDiff(expectedSwap1, swaps[0].amount);
        assert.isAtMost(relDif.toNumber(), errorDelta, 'First swap incorrect.');

        var expectedSwap2 = new BigNumber(0.6708243844151873).times(BONE);
        relDif = calcRelativeDiff(expectedSwap2, swaps[1].amount);
        assert.isAtMost(
            relDif.toNumber(),
            errorDelta,
            'Second swap incorrect.'
        );
    });

    it('should test two pool SOR swap not possible (over limit).', () => {
        var amountIn = new BigNumber(8).times(BONE);
        var swaps = smartOrderRouter(
            balancers,
            'swapExactIn',
            amountIn,
            10,
            new BigNumber(0)
        );

        //console.log(swaps)
        assert.equal(swaps.length, 0, 'Swap should not be possible.');
    });

    it('smartOrderRouter loop should take a while to compute.', () => {
        console.time('Legacy smartOrderRouter');
        var amountIn = new BigNumber(7.823722745418976).times(BONE);

        let swaps;
        for (var i = 0; i < 1000; i++) {
            swaps = smartOrderRouter(
                balancers,
                'swapExactIn',
                amountIn,
                10,
                new BigNumber(0)
            );
        }
        console.log(swaps);
        console.timeEnd('Legacy smartOrderRouter');
    });

    it('smartOrderRouterEpsOfInterest loop should be fast to compute.', () => {
        console.time('smartOrderRouterEpsOfInterest');
        var amountIn = new BigNumber(7.823722745418976).times(BONE);
        balancers = processBalancers(balancers, 'swapExactIn');
        var epsOfInterest = processEpsOfInterest(balancers, 'swapExactIn');

        let swaps;
        for (var i = 0; i < 1000; i++) {
            swaps = smartOrderRouterEpsOfInterest(
                balancers,
                'swapExactIn',
                amountIn,
                10,
                new BigNumber(0),
                epsOfInterest
            );
        }
        console.log(swaps);
        console.timeEnd('smartOrderRouterEpsOfInterest');
    });

    // Check case mentioned in Discord
});
