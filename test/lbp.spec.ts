// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { mockTokenPriceService } from './lib/mockTokenPriceService';
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import { SwapInfo, SwapTypes } from '../src/types';
import { parseFixed } from '@ethersproject/bignumber';
import poolsFromFile from './testData/lbpPools/singlePool.json';
import { DAI, sorConfigEth, USDC } from './lib/constants';
import { MockPoolDataService } from './lib/mockPoolDataService';

const gasPrice = parseFixed('30', 9);
const maxPools = 4;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// npx mocha -r ts-node/register test/lbp.spec.ts
describe(`Tests for LBP Pools.`, () => {
    /*
    LBP pools have same maths, etc as WeightedPools and should be covered by those tests for main functions.
    These tests cover the main difference which is disabled swaps. 
    Changing weights should be handle by SG/Multicall so no difference as SOR sees.
    */
    context('lbp pool', () => {
        it(`Full Swap - swapExactIn, Swaps not paused so should have route`, async () => {
            const pools = poolsFromFile.pools;
            const tokenIn = DAI.address;
            const tokenOut = USDC.address;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(poolsFromFile.pools[0].swapEnabled).to.be.true;
            expect(swapInfo.returnAmount.toString()).eq('998181');
            expect(swapInfo.swaps.length).eq(1);
        });

        it(`Full Swap - swapExactIn, Swaps paused so should have no route`, async () => {
            const pools = poolsFromFile.pools;
            // Set paused to true
            pools[0].swapEnabled = false;
            const tokenIn = DAI.address;
            const tokenOut = USDC.address;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(poolsFromFile.pools[0].swapEnabled).to.be.false;
            expect(swapInfo.returnAmount.toString()).eq('0');
            expect(swapInfo.swaps.length).eq(0);
        });
    });
});
