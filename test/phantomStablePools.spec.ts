import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { parseFixed } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import { PhantomStablePool } from '../src/pools/phantomStablePool/phantomStablePool';
import { WETH, MKR, stETH } from './lib/constants';
import poolsFromFile from './testData/phantomStablePools/phantomStablePool.json';
import { SubgraphPoolBase } from '../src';

const pool = poolsFromFile.phantomStablePool[0] as SubgraphPoolBase;

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/phantomStablePools.spec.ts
describe(`Tests for PhantomStable Pools.`, () => {
    /**
     PhantomStablePools use the same underlying maths, etc as normal Stable Pools.
    **/
    it('Test removeBPT', () => {
        const metaStableBptSwapPool = PhantomStablePool.fromPool(
            cloneDeep(pool)
        );
        const poolPairData = metaStableBptSwapPool.parsePoolPairData(
            MKR.address,
            stETH.address
        );

        const poolPairDataNoBPT = PhantomStablePool.removeBPT(poolPairData);
        expect(poolPairDataNoBPT.tokenIndexIn).to.eq(2);
        expect(poolPairDataNoBPT.tokenIndexOut).to.eq(1);
        expect(poolPairDataNoBPT.allBalances).to.deep.eq([
            bnum(10),
            bnum(1000),
            bnum(300),
        ]);

        const balances = poolPairDataNoBPT.allBalances;
        const expectedallBalancesScaled = balances.map((balance) =>
            parseFixed(balance.toString(), 18)
        );
        expect(poolPairDataNoBPT.allBalancesScaled).to.deep.eq(
            expectedallBalancesScaled
        );
    });

    it('Test removeBPT', () => {
        const metaStableBptSwapPool = PhantomStablePool.fromPool(
            cloneDeep(pool)
        );
        const poolPairData = metaStableBptSwapPool.parsePoolPairData(
            MKR.address,
            WETH.address
        );

        const poolPairDataNoBPT = PhantomStablePool.removeBPT(poolPairData);
        expect(poolPairDataNoBPT.tokenIndexIn).to.eq(2);
        expect(poolPairDataNoBPT.tokenIndexOut).to.eq(0);
        expect(poolPairDataNoBPT.allBalances).to.deep.eq([
            bnum(10),
            bnum(1000),
            bnum(300),
        ]);

        const balances = poolPairDataNoBPT.allBalances;
        const expectedallBalancesScaled = balances.map((balance) =>
            parseFixed(balance.toString(), 18)
        );
        expect(poolPairDataNoBPT.allBalancesScaled).to.deep.eq(
            expectedallBalancesScaled
        );
    });
});
