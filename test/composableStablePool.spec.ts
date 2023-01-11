// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/composableStablePool.spec.ts
import { assert } from 'chai';
import { BigNumber } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import composableStable from './testData/phantomStablePools/composableStable.json';
import { PhantomStablePool } from '../src/pools/phantomStablePool/phantomStablePool';
import * as phantomStableMath from '../src/pools/phantomStablePool/phantomStableMath';
import * as stableMathBigInt from '../src/pools/stablePool/stableMathBigInt';
import { ADDRESSES, Network } from './testScripts/constants';

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
});
