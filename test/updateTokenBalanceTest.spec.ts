// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/updateTokenBalanceTest.spec.ts
import { formatSwaps } from '../src/router/sorClass';
import { createPath } from '../src/routeProposal/filtering';
import { assert } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { SwapTypes } from '../src';
import { parseToPoolsDict } from '../src/routeProposal/filtering';
import boostedPools from './testData/boostedPools/multipleBoosted.json';
import { WETH, BAL, LINEAR_AUSDC, LINEAR_ADAI } from './lib/constants';
import { bnum } from '../src/utils/bignumber';
import { formatFixed } from '@ethersproject/bignumber';

describe('debug fails if token balances are not updated after a swap', () => {
    context('Weighted pool', () => {
        const poolsAll = parseToPoolsDict(cloneDeep(boostedPools.pools), 0);
        const pool = poolsAll['weightedBalWeth'];
        const path1 = createPath([WETH.address, BAL.address], [pool]);
        const path2 = createPath([WETH.address, BAL.address], [pool]);
        const path3 = createPath([WETH.address, BAL.address], [pool]);
        assert.isNotTrue(path1 == path2);
        assert.isTrue(path1.pools[0] == path2.pools[0]);
        it('updateTokenBalance - WETH-BAL', () => {
            const initialWethBalance =
                pool.tokens[0].balance.toString() as string;
            const [, returnDouble] = formatSwaps(
                [path1, path2],
                SwapTypes.SwapExactIn,
                bnum(100),
                [bnum(50), bnum(50)]
            );
            const [, returnSingle] = formatSwaps(
                [path3],
                SwapTypes.SwapExactIn,
                bnum(50),
                [bnum(50)]
            );
            const difference = returnDouble.minus(returnSingle.times(2));
            const finalWethBalance =
                pool.tokens[0].balance.toString() as string;
            assert.isNotTrue(
                difference.toNumber() == 0,
                'balances were not updated'
            );
            assert.isTrue(
                initialWethBalance.substring(0, 6) === '100000',
                'it should be 100000'
            );
            assert.isTrue(
                finalWethBalance.substring(0, 6) === '100150',
                'it should be 100150'
            );
        });
    });
    context('StablePhantom pool', () => {
        const poolsAll = parseToPoolsDict(cloneDeep(boostedPools.pools), 0);
        const pool = poolsAll['bbaUSD-Pool'];
        console.log(pool.tokensList);
        const path1 = createPath(
            [LINEAR_AUSDC.address, LINEAR_ADAI.address],
            [pool]
        );
        const path2 = createPath(
            [LINEAR_AUSDC.address, LINEAR_ADAI.address],
            [pool]
        );
        const path3 = createPath(
            [LINEAR_AUSDC.address, LINEAR_ADAI.address],
            [pool]
        );
        const path4 = createPath([LINEAR_ADAI.address, pool.address], [pool]);
        assert.isNotTrue(path1 == path2);
        assert.isTrue(path1.pools[0] == path2.pools[0]);
        it('updateTokenBalance - bbaUSD-Pool', () => {
            const initialUsdcBalance =
                pool.tokens[1].balance.toString() as string;
            const [, returnDouble] = formatSwaps(
                [path1, path2],
                SwapTypes.SwapExactIn,
                bnum(100),
                [bnum(50), bnum(50)]
            );
            const [, returnSingle] = formatSwaps(
                [path3],
                SwapTypes.SwapExactIn,
                bnum(50),
                [bnum(50)]
            );
            const difference = returnDouble.minus(returnSingle.times(2));
            const finalUsdcBalance =
                pool.tokens[1].balance.toString() as string;
            assert.isNotTrue(
                difference.toNumber() == 0,
                'balances were not updated'
            );
            assert.isTrue(
                initialUsdcBalance.substring(0, 4) === '4817',
                'it should be 100000'
            );
            assert.isTrue(
                finalUsdcBalance.substring(0, 4) === '4967',
                'it should be 4967'
            );
        });
        it('update totalShares - bbaUSD-Pool', () => {
            const initialTotalShares = formatFixed(pool.totalShares, 18);
            formatSwaps([path4], SwapTypes.SwapExactIn, bnum(50), [bnum(50)]);
            const finalTotalShares = formatFixed(pool.totalShares, 18);
            assert.isTrue(
                initialTotalShares.substring(0, 5) === '14473',
                'it should be 14473'
            );
            assert.isTrue(
                finalTotalShares.substring(0, 5) === '14522',
                'it should be 14522'
            );
        });
    });
});
