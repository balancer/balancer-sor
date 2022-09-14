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

describe('fails if token balances are not updated after a swap', () => {
    const poolsAll = parseToPoolsDict(cloneDeep(boostedPools.pools), 0);
    const pool = poolsAll['weightedBalWeth'];
    const path = createPath([WETH.address, BAL.address], [pool]);
    it('updateTokenBalance - WETH-BAL', () => {
        const [, returnDouble] = formatSwaps(
            [path, path],
            SwapTypes.SwapExactIn,
            bnum(100),
            [bnum(50), bnum(50)]
        );
        const [, returnSingle] = formatSwaps(
            [path],
            SwapTypes.SwapExactIn,
            bnum(50),
            [bnum(50)]
        );
        const difference = returnDouble.minus(returnSingle.times(2));
        assert.isNotTrue(
            difference.toNumber() == 0,
            'balances were not updated'
        );
    });
});
