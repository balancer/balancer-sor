import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { USDC, DAI } from './lib/constants';
// Add new PoolType
import { Gyro2Pool } from '../src/pools/gyro2Pool/gyro2Pool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/gyro2Pools/gyro2TestPool.json';
import {
    _calculateQuadratic,
    _calculateQuadraticTerms,
    _findVirtualParams,
} from '../src/pools/gyro2Pool/gyro2Math';
import {
    _addFee,
    _reduceFee,
    _normalizeBalances,
} from '../src/pools/gyroHelpers/helpers';
import { SubgraphPoolBase } from '../src';

describe('gyro2Math tests', () => {
    const testPool: SubgraphPoolBase = cloneDeep(testPools).pools[0];
    const pool = Gyro2Pool.fromPool(testPool);

    const poolPairData = pool.parsePoolPairData(USDC.address, DAI.address);

    context('add and remove swap fee', () => {
        const amountIn = parseFixed('28492.48453', 18);
        const swapFee = poolPairData.swapFee;
        it(`should correctly add swap fee`, async () => {
            expect(
                Number(formatFixed(_addFee(amountIn, swapFee), 18))
            ).to.be.approximately(28751.24575, 0.00001);
        });
        it(`should correctly reduce by swap fee`, async () => {
            expect(
                Number(formatFixed(_reduceFee(amountIn, swapFee), 18))
            ).to.be.approximately(28236.05217, 0.00001);
        });
    });

    context('invariant and virtual parameters', () => {
        it(`should correctly calculate invariant`, async () => {
            const normalizedBalances = _normalizeBalances(
                [poolPairData.balanceIn, poolPairData.balanceOut],
                [poolPairData.decimalsIn, poolPairData.decimalsOut]
            );
            const [a, mb, bSquare, mc] = _calculateQuadraticTerms(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );

            expect(formatFixed(a, 18)).to.equal('0.00099950047470021');
            expect(formatFixed(mb, 18)).to.equal('2230.884220626971757449');
            expect(formatFixed(bSquare, 18)).to.equal(
                '4976844.405842411200429555'
            );
            expect(formatFixed(mc, 18)).to.equal('1232000.0');

            const L = _calculateQuadratic(a, mb, mb.mul(mb).div(ONE), mc);

            expect(formatFixed(L, 18)).to.equal('2232551.271501112084098627');
        });

        it(`should correctly calculate virtual parameters`, async () => {
            const [a, b] = _findVirtualParams(
                parseFixed('2232551.215824107930236259', 18),
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );

            expect(formatFixed(a, 18)).to.equal('2231434.660924038777489798');
            expect(formatFixed(b, 18)).to.equal('2231435.776865147462654764');
        });
    });
});
