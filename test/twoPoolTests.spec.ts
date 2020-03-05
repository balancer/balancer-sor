import { expect, assert } from 'chai';
import 'mocha';
import { Pool, SwapAmount, EffectivePrice } from '../src/types';
import { smartOrderRouter } from '../src/sor';
import { BigNumber } from '../src/utils/bignumber';
import { getSpotPrice, BONE } from '../src/helpers';

// These example pools are taken from python-SOR SOR_method_comparison.py
let balancers: Pool[] = [
    {
        id: '0x165021F95EFB42643E9c3d8677c3430795a29806',
        balanceIn: new BigNumber(1.341648768830377422).times(BONE),
        balanceOut: new BigNumber(84.610322835523687996).times(BONE),
        weightIn: new BigNumber(0.6666666666666666).times(BONE),
        weightOut: new BigNumber(0.3333333333333333).times(BONE),
        swapFee: new BigNumber(0.005).times(BONE),
    },
    {
        id: '0x31670617b85451E5E3813E50442Eed3ce3B68d19',
        balanceIn: new BigNumber(14.305796722007608821).times(BONE),
        balanceOut: new BigNumber(376.662367824920653194).times(BONE),
        weightIn: new BigNumber(0.6666666666666666).times(BONE),
        weightOut: new BigNumber(0.3333333333333333).times(BONE),
        swapFee: new BigNumber(0.000001).times(BONE),
    },
];

describe('Two Pool Tests', () => {
    it('should test spot price', () => {
        var sp1 = getSpotPrice(balancers[0]);
        var sp2 = getSpotPrice(balancers[1]);

        assert.equal(
            sp1.toString(),
            '7968240028251420',
            'Spot Price Balancer 1 Incorrect'
        );
        assert.equal(
            sp2.toString(),
            '18990231371439037',
            'Spot Price Balancer 2 Incorrect'
        );
        // !! 18990231371439040 IS THE RESULT FROM PYTHON SOR_method_comparison.py
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

        // console.log(swaps[0].amount.div(BONE).toString())
        // console.log(swaps[1].amount.div(BONE).toString())
        assert.equal(swaps.length, 2, 'Should be two swaps.');
        assert.equal(
            swaps[0].amount.toString(),
            '635206783664651357',
            'First swap incorrect.'
        );
        // !! 635206783664651400 IS THE RESULT FROM PYTHON SOR_method_comparison.py
        assert.equal(
            swaps[1].amount.toString(),
            '64793216335348642',
            'First swap incorrect.'
        );
        // !! 64793216335348570 IS THE RESULT FROM PYTHON SOR_method_comparison.py
    });
});
