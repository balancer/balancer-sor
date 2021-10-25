// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/math.spec.ts
import { assert } from 'chai';
import { PoolTypes, SubgraphPoolBase } from '../src/types';
import { BigNumber, parseFixed, formatFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, scale, bnum } from '../src/utils/bignumber';
import * as stableMath from '../src/pools/stablePool/stableMath';
import {
    StablePool,
    StablePoolPairData,
} from '../src/pools/stablePool/stablePool';
import { Zero } from '@ethersproject/constants';
import { DAI, USDC, USDT } from './lib/constants';
import * as SDK from '@georgeroman/balancer-v2-pools';

const BPTaddress: string = '0xebfed10e11dc08fcda1af1fda146945e8710f22e';

describe('stable-math tests', () => {
    // Make a stable pool
    const poolsFromFile: {
        pools: SubgraphPoolBase[];
    } = require('./testData/stablePools/stablePoolWithBPT.json');
    const pool = poolsFromFile.pools[0];
    const newPool = StablePool.fromPool(pool);
    // tokens: DAI, USDC, USDT in this order
    let poolPairData: StablePoolPairData;
    const amount = 500000000000000;
    const amtScaled = scale(bnum(amount), 18);

    console.log('amtScaled: ', amtScaled.toString());

    let error = 0.000001;

    context('swap outcomes', () => {
        it('_exactTokenInForTokenOut', () => {
            poolPairData = createPoolPairData(newPool, USDT, DAI);
            let sdkValue = SDK.StableMath._calcOutGivenIn(
                bnum(newPool.amp.toString()).times(100),
                poolPairData.allBalancesScaled.map((balance) =>
                    bnum(balance.toString())
                ),
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
            poolPairData = createPoolPairData(newPool, USDT, DAI);
            let sdkValue = SDK.StableMath._calcInGivenOut(
                bnum(newPool.amp.toString()),
                poolPairData.allBalancesScaled.map((balance) =>
                    bnum(balance.toString())
                ),
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
            poolPairData = createPoolPairData(newPool, USDT, BPTaddress);
            let sdkValue = SDK.StableMath._calcBptOutGivenExactTokensIn(
                bnum(newPool.amp.toString()),
                poolPairData.allBalancesScaled.map((balance) =>
                    bnum(balance.toString())
                ),
                [bnum(0), bnum(0), amtScaled],
                bnum(newPool.totalShares.toString()),
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
            poolPairData = createPoolPairData(newPool, USDT, BPTaddress);
            let sdkValue = SDK.StableMath._calcTokenInGivenExactBptOut(
                bnum(newPool.amp.toString()),
                poolPairData.allBalancesScaled.map((balance) =>
                    bnum(balance.toString())
                ),
                poolPairData.tokenIndexIn,
                amtScaled,
                bnum(newPool.totalShares.toString()),
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
            poolPairData = createPoolPairData(newPool, BPTaddress, USDT);
            let sdkValue = SDK.StableMath._calcBptInGivenExactTokensOut(
                bnum(newPool.amp.toString()),
                poolPairData.allBalancesScaled.map((balance) =>
                    bnum(balance.toString())
                ),
                [bnum(0), bnum(0), amtScaled],
                bnum(newPool.totalShares.toString()),
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
            poolPairData = createPoolPairData(newPool, BPTaddress, USDT);
            let sdkValue = SDK.StableMath._calcTokenOutGivenExactBptIn(
                bnum(newPool.amp.toString()),
                poolPairData.allBalancesScaled.map((balance) =>
                    bnum(balance.toString())
                ),
                poolPairData.tokenIndexOut,
                amtScaled,
                bnum(newPool.totalShares.toString()),
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
            poolPairData = createPoolPairData(newPool, USDT, USDC);
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
            poolPairData = createPoolPairData(newPool, USDT, USDC);
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
            poolPairData = createPoolPairData(newPool, USDT, BPTaddress);
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
            poolPairData = createPoolPairData(newPool, USDT, BPTaddress);
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
            poolPairData = createPoolPairData(newPool, BPTaddress, USDT);
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
            poolPairData = createPoolPairData(newPool, BPTaddress, USDT);
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
            poolPairData = createPoolPairData(newPool, USDT, USDC);
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
            poolPairData = createPoolPairData(newPool, USDT, USDC);
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
            poolPairData = createPoolPairData(newPool, USDT, BPTaddress);
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
            poolPairData = createPoolPairData(newPool, USDT, BPTaddress);
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
            poolPairData = createPoolPairData(newPool, BPTaddress, USDT);
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
            poolPairData = createPoolPairData(newPool, BPTaddress, USDT);
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
    assert.approximately(
        fn(bnum(amount), poolPairData).toNumber() / expected,
        1,
        error,
        'wrong result'
    );
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
    inverse: boolean = false
) {
    let x = bnum(amount);
    let incrementalQuotient = fn(x.plus(delta), poolPairData)
        .minus(fn(x, poolPairData))
        .div(delta);
    if (inverse) incrementalQuotient = bnum(1).div(incrementalQuotient);
    const der_ans = der(x, poolPairData);
    let d = 10 ** -10;
    console.log(der_ans.toString());
    console.log(incrementalQuotient.toString());
    assert.approximately(
        incrementalQuotient.plus(d).div(der_ans.plus(d)).toNumber(),
        //      incrementalQuotient.div(der_ans).toNumber(),
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
    let poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);
    poolPairData.allBalances.splice(-1);
    poolPairData.allBalancesScaled.splice(-1);
    return poolPairData;
}
