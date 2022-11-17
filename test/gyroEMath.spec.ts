// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/gyroEMath.spec.ts

import { GyroEPoolPairData } from '../src/pools/gyroEPool/gyroEPool';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { parseFixed, formatFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { calculateInvariantWithError } from '../src/pools/gyroEPool/gyroEMath/gyroEMath';
import { calculateDerivedValues } from '../src/pools/gyroEPool/testingHelpers';
import {
    normalizeBalances,
    addFee,
    reduceFee,
    virtualOffset0,
    virtualOffset1,
    Vector2,
} from '../src/pools/gyroEPool/gyroEMath/gyroEMathHelpers';
import { GyroEPool } from '../src/pools/gyroEPool/gyroEPool';

const GYRO_E_PARAMS = {
    alpha: parseFixed('0.050000000000020290', 18),
    beta: parseFixed('0.397316269897841178', 18),
    c: parseFixed('0.9551573261744535', 18),
    s: parseFixed('0.29609877111408056', 18),
    lambda: parseFixed('748956.475000000000000000', 18),
};

const DERIVED_GYRO_E_PARAMS = calculateDerivedValues(GYRO_E_PARAMS);

const TEST_POOL_PAIR_DATA: GyroEPoolPairData = {
    id: '123',
    address: '123',
    poolType: 1,
    swapFee: ONE.mul(9).div(100),
    tokenIn: '123',
    tokenOut: '123',
    decimalsIn: 18,
    decimalsOut: 18,
    balanceIn: ONE.mul(100),
    balanceOut: ONE.mul(100),
    tokenInIsToken0: true,
};

describe('gyroEMath tests', () => {
    const poolPairData = TEST_POOL_PAIR_DATA;

    context('add and remove swap fee', () => {
        const amountIn = parseFixed('28492.48453', 18);
        const swapFee = poolPairData.swapFee;
        it(`should correctly add swap fee`, async () => {
            expect(
                Number(formatFixed(addFee(amountIn, swapFee), 18))
            ).to.be.approximately(31310.4225604, 0.00001);
        });
        it(`should correctly reduce by swap fee`, async () => {
            expect(
                Number(formatFixed(reduceFee(amountIn, swapFee), 18))
            ).to.be.approximately(25928.1609223, 0.00001);
        });
    });

    context('invariant', () => {
        it(`should correctly calculate invariant`, async () => {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(balances, [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
            ]);
            const [currentInvariant, invErr] = calculateInvariantWithError(
                normalizedBalances,
                GYRO_E_PARAMS,
                DERIVED_GYRO_E_PARAMS
            );

            expect(currentInvariant.toString()).to.equal('295358168772127');
            expect(invErr.toString()).to.equal('2');
        });
    });

    context('calculate virtual parameters', () => {
        it(`should correctly calculate virtual offset 0 (a)`, async () => {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(balances, [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
            ]);
            const [currentInvariant, invErr] = calculateInvariantWithError(
                normalizedBalances,
                GYRO_E_PARAMS,
                DERIVED_GYRO_E_PARAMS
            );

            const invariant: Vector2 = {
                x: currentInvariant.add(invErr.mul(2)),
                y: currentInvariant,
            };

            const a = virtualOffset0(
                GYRO_E_PARAMS,
                DERIVED_GYRO_E_PARAMS,
                invariant
            );
            expect(Number(formatFixed(a, 18))).to.be.approximately(
                211.290746521816255142,
                0.00001
            );
        });
    });

    context('calculate virtual parameters', () => {
        it(`should correctly calculate virtual offset 1 (b)`, async () => {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(balances, [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
            ]);
            const [currentInvariant, invErr] = calculateInvariantWithError(
                normalizedBalances,
                GYRO_E_PARAMS,
                DERIVED_GYRO_E_PARAMS
            );

            const invariant: Vector2 = {
                x: currentInvariant.add(invErr.mul(2)),
                y: currentInvariant,
            };

            const b = virtualOffset1(
                GYRO_E_PARAMS,
                DERIVED_GYRO_E_PARAMS,
                invariant
            );
            expect(Number(formatFixed(b, 18))).to.be.approximately(
                65.500131431538418723,
                0.00001
            );
        });
    });
});
