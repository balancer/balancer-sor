// npx mocha -r ts-node/register test/wrapper.spec.ts
require('dotenv').config();
import {  expect } from 'chai';

import { RouteProposer } from '../src/routeProposal';
import { BigNumber } from '../src/utils/bignumber';
import {

    SwapTypes,
    SubgraphPoolBase,
    SwapOptions,
} from '../src/types';


const gasPrice = new BigNumber('30000000000');
const maxPools = 4;

describe(`RouteProposer.`, () => {
    it(`should have no cached process data on creation`, () => {
        const routeProposer = new RouteProposer();
        expect(routeProposer.cache).to.deep.eq({});
    });

    it(`should save cached data correctly`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;

        const routeProposer = new RouteProposer();

        await routeProposer.getCandidatePaths(tokenIn, tokenOut, swapType, pools, { gasPrice, maxPools, timestamp: 0 } as SwapOptions)
        
        const cacheZero =
        routeProposer.cache[`${tokenIn}${tokenOut}${swapType}0`];
        expect(cacheZero.paths.length).to.be.gt(0);
        let cacheOne =
        routeProposer.cache[`${tokenIn}${tokenOut}${swapType}1`];
        expect(cacheOne).to.be.undefined;

        await routeProposer.getCandidatePaths(tokenIn, tokenOut, swapType, pools, { gasPrice, maxPools, timestamp: 1 } as SwapOptions)

        const cacheZeroRepeat =
        routeProposer.cache[`${tokenIn}${tokenOut}${swapType}0`];
        expect(cacheZero).to.deep.eq(cacheZeroRepeat);
        cacheOne = routeProposer.cache[`${tokenIn}${tokenOut}${swapType}1`];
        expect(cacheOne.paths.length).to.be.gt(0);
    });
});
