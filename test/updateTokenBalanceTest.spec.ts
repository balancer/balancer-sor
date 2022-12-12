// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/linear.spec.ts
import { formatSwaps } from '../src/router/sorClass';
import { createPath } from '../src/routeProposal/filtering';
import { assert } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { SwapTypes } from '../src';
import { parseToPoolsDict } from '../src/routeProposal/filtering';
import boostedPools from './testData/boostedPools/multipleBoosted.json';
import { WETH, BAL } from './lib/constants';
import { bnum } from '../src/utils/bignumber';

describe('debug fails if token balances are not updated after a swap', () => {
    const poolsAll = parseToPoolsDict(cloneDeep(boostedPools.pools), 0);
    const pool = poolsAll['weightedBalWeth'];
    const path1 = createPath([WETH.address, BAL.address], [pool]);
    const path2 = createPath([WETH.address, BAL.address], [pool]);
    const path3 = createPath([WETH.address, BAL.address], [pool]);
    assert.isNotTrue(path1 == path2);
    assert.isTrue(path1.pools[0] == path2.pools[0]);
    it('updateTokenBalance - WETH-BAL', () => {
        const initialWethBalance = pool.tokens[0].balance.toString() as string;
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
        const finalWethBalance = pool.tokens[0].balance.toString() as string;
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
