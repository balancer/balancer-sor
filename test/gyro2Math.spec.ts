import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { formatFixed, parseFixed } from '@ethersproject/bignumber';
import { USDC, DAI } from './lib/constants';
// Add new PoolType
import { Gyro2Pool } from '../src/pools/gyro2Pool/gyro2Pool';
// Add new pool test data in Subgraph Schema format
import testPools from './testData/gyro2Pools/gyro2TestPool.json';
import {
    _addFee,
    _calculateInvariant,
    _reduceFee,
    _calculateQuadratic,
    _calculateQuadraticTerms,
    _findVirtualParams,
    _normalizeBalances,
} from '../src/pools/gyro2Pool/gyro2Math';

describe('gyro2Math tests', () => {
    const testPool = cloneDeep(testPools).pools[0];
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
                poolPairData.decimalsIn,
                poolPairData.decimalsOut
            );
            const [a, mb, mc] = _calculateQuadraticTerms(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );

            expect(formatFixed(a, 18)).to.equal('0.000999500499625375');
            expect(formatFixed(mb, 18)).to.equal('2230.884220610725033295');
            expect(formatFixed(mc, 18)).to.equal('1232000.0');

            const L = _calculateQuadratic(a, mb, mc);

            expect(formatFixed(L, 18)).to.equal('2232551.215824107930236259');
        });

        it(`should correctly calculate virtual parameters`, async () => {
            const [a, b] = _findVirtualParams(
                parseFixed('2232551.215824107930236259', 18),
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );

            expect(formatFixed(a, 18)).to.equal('2231434.661007672178972479');
            expect(formatFixed(b, 18)).to.equal('2231435.776725839468265783');
        });
    });
});
