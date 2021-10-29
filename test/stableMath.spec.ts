// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/math.spec.ts
import { assert } from 'chai';
import { SubgraphPoolBase } from '../src/types';
import { BigNumber as OldBigNumber, scale, bnum } from '../src/utils/bignumber';
import * as stableMath from '../src/pools/stablePool/stableMath';
import {
    StablePool,
    StablePoolPairData,
} from '../src/pools/stablePool/stablePool';
import { DAI, USDC, USDT } from './lib/constants';
import * as SDK from '@georgeroman/balancer-v2-pools';
import poolsFromFile from './testData/stablePools/stablePoolWithBPT.json';

const BPTaddress = '0xebfed10e11dc08fcda1af1fda146945e8710f22e';

describe('stable-math tests', () => {
    // Make a stable pool
    // const poolsFromFile: {
    //     pools: SubgraphPoolBase[];
    // } = require('./testData/stablePools/stablePoolWithBPT.json');
    const pool = poolsFromFile.pools[0] as SubgraphPoolBase;
    const stableBptSwapPool = StablePool.fromPool(pool);
    // tokens: DAI, USDC, USDT in this order
    let poolPairData: StablePoolPairData;
    poolPairData = createPoolPairData(
        stableBptSwapPool,
        USDT.address,
        DAI.address
    );
    const allBalancesScaled = poolPairData.allBalancesScaled.map((balance) =>
        bnum(balance.toString())
    );
    const amount = 5000000000000;
    const amtScaled = scale(bnum(amount), 18);
    const amp1000 = bnum(stableBptSwapPool.amp.toString()).times(1000);

    const error = 0.00005;

    context('swap outcomes', () => {
        it('_exactTokenInForTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                DAI.address
            );
            let sdkValue = SDK.StableMath._calcOutGivenIn(
                amp1000,
                allBalancesScaled,
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amtScaled,
                bnum(poolPairData.swapFee.toString())
            );
            sdkValue = scale(sdkValue, -18).dp(poolPairData.decimalsOut, 1);
            checkOutcome(
                stableMath._exactTokenInForTokenOut,
                poolPairData,
                amount,
                sdkValue.toNumber(),
                error
            );
        });

        it('_tokenInForExactTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                DAI.address
            );
            let sdkValue = SDK.StableMath._calcInGivenOut(
                amp1000,
                allBalancesScaled,
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amtScaled,
                bnum(poolPairData.swapFee.toString())
            );
            sdkValue = scale(sdkValue, -18).dp(poolPairData.decimalsIn, 1);
            checkOutcome(
                stableMath._tokenInForExactTokenOut,
                poolPairData,
                amount,
                sdkValue.toNumber(),
                error
            );
        });

        it('_exactTokenInForBPTOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                BPTaddress
            );
            let sdkValue = SDK.StableMath._calcBptOutGivenExactTokensIn(
                amp1000,
                allBalancesScaled,
                [bnum(0), bnum(0), amtScaled],
                bnum(stableBptSwapPool.totalShares.toString()),
                bnum(poolPairData.swapFee.toString())
            );
            sdkValue = scale(sdkValue, -18).dp(poolPairData.decimalsOut, 1);
            checkOutcome(
                stableMath._exactTokenInForBPTOut,
                poolPairData,
                amount,
                sdkValue.toNumber(),
                error
            );
        });

        it('_tokenInForExactBPTOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                BPTaddress
            );
            let sdkValue = SDK.StableMath._calcTokenInGivenExactBptOut(
                amp1000,
                allBalancesScaled,
                poolPairData.tokenIndexIn,
                amtScaled,
                bnum(stableBptSwapPool.totalShares.toString()),
                bnum(poolPairData.swapFee.toString())
            );
            sdkValue = scale(sdkValue, -18).dp(poolPairData.decimalsOut, 1);
            checkOutcome(
                stableMath._tokenInForExactBPTOut,
                poolPairData,
                amount,
                sdkValue.toNumber(),
                error
            );
        });

        it('_BPTInForExactTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                BPTaddress,
                USDT.address
            );
            let sdkValue = SDK.StableMath._calcBptInGivenExactTokensOut(
                amp1000,
                allBalancesScaled,
                [bnum(0), bnum(0), amtScaled],
                bnum(stableBptSwapPool.totalShares.toString()),
                bnum(poolPairData.swapFee.toString())
            );
            sdkValue = scale(sdkValue, -18).dp(poolPairData.decimalsIn, 1);
            checkOutcome(
                stableMath._BPTInForExactTokenOut,
                poolPairData,
                amount,
                sdkValue.toNumber(),
                error
            );
        });

        it('_exactBPTInForTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                BPTaddress,
                USDT.address
            );
            let sdkValue = SDK.StableMath._calcTokenOutGivenExactBptIn(
                amp1000,
                allBalancesScaled,
                poolPairData.tokenIndexOut,
                amtScaled,
                bnum(stableBptSwapPool.totalShares.toString()),
                bnum(poolPairData.swapFee.toString())
            );
            sdkValue = scale(sdkValue, -18).dp(poolPairData.decimalsOut, 1);
            checkOutcome(
                stableMath._exactBPTInForTokenOut,
                poolPairData,
                amount,
                sdkValue.toNumber(),
                error
            );
        });
    });

    context('spot price after swap', () => {
        it('_spotPriceAfterSwapExactTokenInForTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                USDC.address
            );
            checkDerivative(
                stableMath._exactTokenInForTokenOut,
                stableMath._spotPriceAfterSwapExactTokenInForTokenOut,
                poolPairData,
                amount,
                10000,
                error,
                true
            );
        });

        it('_spotPriceAfterSwapTokenInForExactTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                USDC.address
            );
            checkDerivative(
                stableMath._tokenInForExactTokenOut,
                stableMath._spotPriceAfterSwapTokenInForExactTokenOut,
                poolPairData,
                amount,
                10000,
                error,
                false
            );
        });

        it('_spotPriceAfterSwapExactTokenInForBPTOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                BPTaddress
            );
            checkDerivative(
                stableMath._exactTokenInForBPTOut,
                stableMath._spotPriceAfterSwapExactTokenInForBPTOut,
                poolPairData,
                amount,
                10000,
                error,
                true
            );
        });

        it('_spotPriceAfterSwapTokenInForExactBPTOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                BPTaddress
            );
            checkDerivative(
                stableMath._tokenInForExactBPTOut,
                stableMath._spotPriceAfterSwapTokenInForExactBPTOut,
                poolPairData,
                amount,
                10000,
                error,
                false
            );
        });

        it('_spotPriceAfterSwapBPTInForExactTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                BPTaddress,
                USDT.address
            );
            checkDerivative(
                stableMath._BPTInForExactTokenOut,
                stableMath._spotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                amount,
                10000,
                error,
                false
            );
        });

        it('_spotPriceAfterSwapExactBPTInForTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                BPTaddress,
                USDT.address
            );
            checkDerivative(
                stableMath._exactBPTInForTokenOut,
                stableMath._spotPriceAfterSwapExactBPTInForTokenOut,
                poolPairData,
                amount,
                10000,
                error,
                true
            );
        });
    });

    context('derivatives of spot price after swap', () => {
        it('_derivativeSpotPriceAfterSwapExactTokenInForTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                USDC.address
            );
            checkDerivative(
                stableMath._spotPriceAfterSwapExactTokenInForTokenOut,
                stableMath._derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
                poolPairData,
                amount,
                10000,
                error,
                false
            );
        });

        it('_derivativeSpotPriceAfterSwapTokenInForExactTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                USDC.address
            );
            checkDerivative(
                stableMath._spotPriceAfterSwapTokenInForExactTokenOut,
                stableMath._derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
                poolPairData,
                amount,
                100000,
                error,
                false
            );
        });

        it('_derivativeSpotPriceAfterSwapExactTokenInForBPTOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                BPTaddress
            );
            checkDerivative(
                stableMath._spotPriceAfterSwapExactTokenInForBPTOut,
                stableMath._derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
                poolPairData,
                amount,
                10000,
                error,
                false
            );
        });

        it('_derivativeSpotPriceAfterSwapTokenInForExactBPTOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                USDT.address,
                BPTaddress
            );
            checkDerivative(
                stableMath._spotPriceAfterSwapTokenInForExactBPTOut,
                stableMath._derivativeSpotPriceAfterSwapTokenInForExactBPTOut,
                poolPairData,
                amount,
                10000,
                error,
                false
            );
        });

        it('_derivativeSpotPriceAfterSwapBPTInForExactTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                BPTaddress,
                USDT.address
            );
            checkDerivative(
                stableMath._spotPriceAfterSwapBPTInForExactTokenOut,
                stableMath._derivativeSpotPriceAfterSwapBPTInForExactTokenOut,
                poolPairData,
                amount,
                10000,
                error,
                false
            );
        });

        it('_derivativeSpotPriceAfterSwapExactBPTInForTokenOut', () => {
            poolPairData = createPoolPairData(
                stableBptSwapPool,
                BPTaddress,
                USDT.address
            );
            checkDerivative(
                stableMath._spotPriceAfterSwapExactBPTInForTokenOut,
                stableMath._derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
                poolPairData,
                amount,
                10000,
                error,
                false
            );
        });
    });
});

function checkOutcome(
    fn: (
        amount: OldBigNumber,
        poolPairData: StablePoolPairData
    ) => OldBigNumber,
    poolPairData: StablePoolPairData,
    amount: number,
    expected: number,
    error: number
) {
    const fn_result = fn(bnum(amount), poolPairData).toNumber();
    assert.approximately(fn_result / expected, 1, error, 'wrong result');
}

function checkDerivative(
    fn: (
        amount: OldBigNumber,
        poolPairData: StablePoolPairData
    ) => OldBigNumber,
    der: (
        amount: OldBigNumber,
        poolPairData: StablePoolPairData
    ) => OldBigNumber,
    poolPairData: StablePoolPairData,
    amount: number,
    delta: number,
    error: number,
    inverse = false
) {
    const x = bnum(amount);
    let incrementalQuotient = fn(x.plus(delta), poolPairData)
        .minus(fn(x, poolPairData))
        .div(delta);
    if (inverse) incrementalQuotient = bnum(1).div(incrementalQuotient);
    const der_ans = der(x, poolPairData);
    const d = 10 ** -10;
    assert.approximately(
        // adding d to both numerator and denominator prevents large relative errors
        // when numbers are very small (even division by zero in some cases).
        incrementalQuotient.plus(d).div(der_ans.plus(d)).toNumber(),
        1,
        error,
        'wrong result'
    );
}

function createPoolPairData(
    pool: StablePool,
    tokenIn: string,
    tokenOut: string
): StablePoolPairData {
    const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);
    poolPairData.allBalances.splice(-1);
    poolPairData.allBalancesScaled.splice(-1);
    return poolPairData;
}
