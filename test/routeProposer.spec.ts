// npx mocha -r ts-node/register test/wrapper.spec.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';

import { RouteProposer } from '../src/routeProposal';
import { SwapTypes, SubgraphPoolBase, SwapOptions } from '../src/types';
import { DAI, sorConfigTest, WETH } from './lib/constants';

const gasPrice = parseFixed('30', 9);
const maxPools = 4;

describe(`RouteProposer.`, () => {
    it(`should have no cached process data on creation`, () => {
        const routeProposer = new RouteProposer(sorConfigTest);
        expect(routeProposer.cache).to.deep.eq({});
    });

    it(`should save cached data correctly`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;
        const tokenIn = WETH.address;
        const tokenOut = DAI.address;
        const swapType = SwapTypes.SwapExactIn;

        const routeProposer = new RouteProposer(sorConfigTest);

        await routeProposer.getCandidatePaths(
            tokenIn,
            tokenOut,
            swapType,
            pools,
            { gasPrice, maxPools, timestamp: 0 } as SwapOptions
        );

        const cacheZero =
            routeProposer.cache[`${tokenIn}${tokenOut}${swapType}0`];
        expect(cacheZero.paths.length).to.be.gt(0);
        let cacheOne = routeProposer.cache[`${tokenIn}${tokenOut}${swapType}1`];
        expect(cacheOne).to.be.undefined;

        await routeProposer.getCandidatePaths(
            tokenIn,
            tokenOut,
            swapType,
            pools,
            { gasPrice, maxPools, timestamp: 1 } as SwapOptions
        );

        const cacheZeroRepeat =
            routeProposer.cache[`${tokenIn}${tokenOut}${swapType}0`];
        expect(cacheZero).to.deep.eq(cacheZeroRepeat);
        cacheOne = routeProposer.cache[`${tokenIn}${tokenOut}${swapType}1`];
        expect(cacheOne.paths.length).to.be.gt(0);
    });
});
