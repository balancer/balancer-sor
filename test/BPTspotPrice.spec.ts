// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/phantomStableMath.spec.ts
import { assert } from 'chai';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber } from '../src/utils/bignumber';
import { bnum } from '../src/utils/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import phantomStableStabal3WithPriceRates from './testData/phantomStablePools/phantomStableStabal3WithPriceRates.json';
import {
    PhantomStablePool,
    PhantomStablePoolPairData,
} from '../src/pools/phantomStablePool/phantomStablePool';
import * as phantomStableMath from '../src/pools/phantomStablePool/phantomStableMath';
import * as stableMath from '../src/pools/stablePool/stableMath';
import * as stableMathBigInt from '../src/pools/stablePool/stableMathBigInt';
import { bbaUSD, LINEAR_AUSDT, LINEAR_AUSDC } from './lib/constants';

const oldBN_ONE = bnum(ONE.toString());

describe('BPT spot price - phantomStable', () => {
    /*const sError = 0.00001;
    const mError = 0.0035;*/

    context('phantomStable pools', () => {
        const phantomStablePool = PhantomStablePool.fromPool(
            phantomStableStabal3WithPriceRates.pools[0]
        );
        it('debug phantomStable BPT -> token', () => {
            const poolPairData = phantomStablePool.parsePoolPairData(
                bbaUSD.address,
                LINEAR_AUSDC.address
            );
            // spot prices
            poolPairData.swapFee = BigNumber.from(0);
            const spPhantom =
                phantomStableMath._spotPriceAfterSwapExactBPTInForTokenOut(
                    bnum(0),
                    poolPairData
                );

            const balances = poolPairData.allBalancesScaled.map((balance) =>
                balance.toBigInt()
            );
            const spBigInt =
                stableMathBigInt._spotPriceAfterSwapExactBPTInForTokenOut(
                    poolPairData.amp.toBigInt(),
                    balances,
                    poolPairData.tokenIndexOut,
                    phantomStablePool.totalShares.toBigInt(),
                    BigInt(0) // BigInt(amount)
                );
            console.log('spPhantom: ', spPhantom.toString());
            console.log('spBigInt: ', spBigInt.toString());
        });
    });
});
