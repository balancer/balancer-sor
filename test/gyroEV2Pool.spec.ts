// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/gyroEV2Pool.spec.ts

import { GyroEPoolPairData } from '../src/pools/gyroEV2Pool/gyroEV2Pool';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { GyroEV2Pool } from '../src/pools/gyroEV2Pool/gyroEV2Pool';
import { SwapTypes } from '../src/types';
import { bnum } from '../src/utils/bignumber';
import { reduceFee } from '../src/pools/gyroEPool/gyroEMath/gyroEMathHelpers';

const TEST_POOL_PAIR_DATA: GyroEPoolPairData = {
    id: '123',
    address: '123',
    poolType: 1,
    swapFee: ONE.mul(9).div(100),
    tokenIn: '123',
    tokenOut: '123',
    decimalsIn: 18,
    decimalsOut: 18,
    balanceIn: BigNumber.from('66666666666666672128'), // ~ 100/1.5 so that the rate-scaled balances are about the same
    balanceOut: ONE.mul(100),
    tokenInIsToken0: true,
};

const POOL = GyroEV2Pool.fromPool({
    id: '1',
    address: '1',
    poolType: 'GyroE',
    swapFee: '0.09',
    swapEnabled: true,
    totalShares: '100',
    tokens: [
        {
            address: '1',
            balance: '66.66666666666667', // ~ 100/1.5 so that the rate-scaled balances are about the same
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '2',
            balance: '100',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
    ],
    tokensList: ['1', '2'],
    tokenRates: ['1.5', '1'],
    // GYRO E-CLP PARAMS
    alpha: '0.050000000000020290',
    beta: '0.397316269897841178',
    c: '0.9551573261744535',
    s: '0.29609877111408056',
    lambda: '748956.475000000000000000',
    // GYRO E-CLP DERIVED PARAMS
    tauAlphaX: '-0.99999999998640216827321822090250869512',
    tauAlphaY: '0.00000521494821273352387635736307999088',
    tauBetaX: '0.99999999985251225321221463296419833612',
    tauBetaY: '0.00001717485123551095031292618834391386',
    u: '0.56564182095617502122541689600223111041',
    v: '0.00000626352651807875756896296543790835',
    w: '0.00000338251066240397957902003753652350',
    z: '0.82465103535609803284538786438983276111',
    dSq: '1.00000000000000002140811391783216360000',
});

describe('gyroEPool tests', () => {
    const poolPairData = TEST_POOL_PAIR_DATA;

    context('normalized liquidity', () => {
        it(`should correctly calculate normalized liquidity`, async () => {
            const normalizedLiquidity =
                POOL.getNormalizedLiquidity(poolPairData);

            expect(Number(normalizedLiquidity)).to.be.approximately(
                8521784.473067058,
                0.00001
            );
        });
    });

    context('limit amount swap', () => {
        it(`should correctly calculate limit amount for swap exact in`, async () => {
            const limitAmount = POOL.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactIn
            );
            const delta = limitAmount.minus('236.323201823051507893').abs();
            expect(delta.toNumber()).to.be.lessThan(0.00001);
        });

        it(`should correctly calculate limit amount for swap exact out`, async () => {
            const limitAmount = POOL.getLimitAmountSwap(
                poolPairData,
                SwapTypes.SwapExactOut
            );

            expect(Number(limitAmount)).to.be.approximately(99.9999, 0.00001);
        });
    });

    context('swap amounts', () => {
        it(`should correctly calculate swap amount for swap exact in`, async () => {
            const swapAmount = POOL._exactTokenInForTokenOut(
                poolPairData,
                bnum('10')
            );
            const delta = swapAmount.minus('4.231511373250766852').abs();
            expect(delta.toNumber()).to.be.lessThan(0.00001);
        });

        it(`should correctly calculate swap amount for swap exact out`, async () => {
            const swapAmount = POOL._tokenInForExactTokenOut(
                poolPairData,
                bnum('10')
            );

            const reduced = formatFixed(
                reduceFee(
                    parseFixed(swapAmount.toString(), 18),
                    poolPairData.swapFee
                ),
                18
            );
            const delta = bnum(reduced).minus('21.505324893272912024').abs();
            expect(delta.toNumber()).to.be.lessThan(0.00001);
        });
    });

    context('prices', () => {
        it(`should correctly calculate price after swap exact in`, async () => {
            const priceAfterSwap =
                POOL._spotPriceAfterSwapExactTokenInForTokenOut(
                    poolPairData,
                    bnum('10')
                );
            const delta = priceAfterSwap.minus('2.363222355995745212').abs();
            expect(delta.toNumber()).to.be.lessThan(0.00001);
        });

        it(`should correctly calculate price after swap exact out`, async () => {
            const priceAfterSwap =
                POOL._spotPriceAfterSwapTokenInForExactTokenOut(
                    poolPairData,
                    bnum('10')
                );
            const delta = priceAfterSwap.minus('2.363223669898799537').abs();
            expect(delta.toNumber()).to.be.lessThan(0.00001);
        });
    });

    context('derivative of price', () => {
        it(`should correctly calculate derivative of price after swap exact in`, async () => {
            const priceDerivative =
                POOL._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    poolPairData,
                    bnum('10')
                );

            expect(Number(priceDerivative)).to.be.approximately(
                1.03343127137e-7,
                1e-12
            );
        });

        it(`should correctly calculate derivative of price after swap exact in at 0`, async () => {
            const priceDerivative =
                POOL._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    poolPairData,
                    bnum('0')
                );

            expect(Number(priceDerivative)).to.be.approximately(
                1.17346314397e-7,
                1e-12
            );
        });

        it(`should correctly calculate derivative of price after swap exact out`, async () => {
            const priceDerivative =
                POOL._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                    poolPairData,
                    bnum('10')
                );

            expect(Number(priceDerivative)).to.be.approximately(
                2.1353951134e-7,
                1e-12
            );
        });
    });
});
