// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/composableStablePool.spec.ts
import { assert } from 'chai';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import composableStable from './testData/phantomStablePools/composableStable.json';
import { PhantomStablePool } from '../src/pools/phantomStablePool/phantomStablePool';
import * as phantomStableMath from '../src/pools/phantomStablePool/phantomStableMath';
import * as stableMathBigInt from '../src/pools/stablePool/stableMathBigInt';
import { ADDRESSES, Network } from './testScripts/constants';
import pools_15840286 from './testData/phantomStablePools/pools_15840286.json';
import { SubgraphPoolBase } from '../src';

const bbausd = pools_15840286.find(
    (pool) =>
        pool.id ==
        '0xa13a9247ea42d743238089903570127dda72fe4400000000000000000000035d' // bbausd
) as unknown as SubgraphPoolBase;

describe('composable stable pool', () => {
    const oldBN_ONE = bnum(ONE.toString());
    const error = 0.00001;
    context('out given in, several consistencies', () => {
        const composableStablePool = PhantomStablePool.fromPool(
            composableStable.pools[0]
        );
        // parsePoolPairData contains pool's allBalances and allBalancesScaled
        // both already multiplied by the price rates.
        const poolPairData = composableStablePool.parsePoolPairData(
            ADDRESSES[Network.MAINNET].bbausdt2.address,
            ADDRESSES[Network.MAINNET].bbausd2.address
        );
        it('token -> BPT spot price with no rate', () => {
            // spot prices
            poolPairData.swapFee = BigNumber.from(0);
            const spPhantom =
                phantomStableMath._spotPriceAfterSwapExactTokenInForBPTOut(
                    bnum(0),
                    poolPairData
                );

            const balances = poolPairData.allBalancesScaled.map((balance) =>
                balance.toBigInt()
            );
            const spBigInt =
                stableMathBigInt._spotPriceAfterSwapExactTokenInForBPTOut(
                    poolPairData.amp.toBigInt(),
                    balances,
                    poolPairData.tokenIndexIn,
                    composableStablePool.totalShares.toBigInt(),
                    BigInt(0)
                );
            const bnumSpBigInt = bnum(spBigInt.toString()).div(oldBN_ONE);
            assert.approximately(
                spPhantom.div(bnumSpBigInt).toNumber(),
                1,
                error,
                'wrong result'
            );
        });
        it('composableStablePool token -> BPT', () => {
            const bptOut = composableStablePool._exactTokenInForTokenOut(
                poolPairData,
                bnum(1)
            );
            const poolSP =
                composableStablePool._spotPriceAfterSwapExactTokenInForTokenOut(
                    poolPairData,
                    bnum(0)
                );
            assert.approximately(
                poolSP.times(bptOut).toNumber(),
                1,
                error,
                'wrong result'
            );
        });
    });
    context('join - exact tokens in', () => {
        const composableStablePool = PhantomStablePool.fromPool(bbausd);
        it('should calculate expected BPT out', () => {
            const amountsIn = [
                parseFixed('1.23', 18),
                parseFixed('10.7', 18),
                parseFixed('1099.5432', 18),
            ];
            const bptOut =
                composableStablePool._calcBptOutGivenExactTokensIn(amountsIn);
            const expectedBptOut = BigNumber.from('1111327432434158659003');
            const inaccuracy = bptOut
                .sub(expectedBptOut)
                .mul(ONE)
                .div(expectedBptOut)
                .abs();
            const inaccuracyLimit = ONE.div(1e6); // inaccuracy should not be over 1e-6
            assert(inaccuracy.lte(inaccuracyLimit));
        });
    });
});
