// Tests Multihop SOR with token filtering vs static subgraphPoolsLarge.json file.
// npx mocha -r ts-node/register test/disabledTokens.spec.ts
require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert } from 'chai';
import { DisabledOptions } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';
import { filterPoolsAndTokens } from './lib/testHelpers';
import { compareTest } from './lib/compareHelper';
import allPools from './testData/testPools/subgraphPoolsLarge.json';
import disabledTokens from './testData/disabled-tokens.json';

const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI lower case
const ANT = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT lower case

let allPoolsCorrect;

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

const gasPrice = new BigNumber('30000000000');

describe('Tests Multihop SOR with token filtering vs static subgraphPoolsLarge.json', () => {
    it('Saved pool check - without disabled filter', async () => {
        // Uses saved pools @25/05/20.
        assert.equal(allPools.pools.length, 64, 'Should be 64 pools');
        let allTokensSet;
        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsCorrect] = filterPoolsAndTokens(
            JSON.parse(JSON.stringify(allPools))
        );

        assert.equal(allTokensSet.size, 42, 'Should be 42 token sets'); // filter excludes duplicates
        assert.equal(
            allPoolsCorrect.pools.length,
            50,
            'Should be 50 pools with non-zero balance'
        );
    });

    it('Saved pool check - with disabled filter', async () => {
        // Uses saved pools @25/05/20.
        assert.equal(allPools.pools.length, 64, 'Should be 64 pools');
        let allTokensSet;
        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsCorrect] = filterPoolsAndTokens(
            JSON.parse(JSON.stringify(allPools)),
            disabledTokens.tokens
        );

        assert.equal(allTokensSet.size, 39, 'Should be 39 token sets'); // filter excludes duplicates
        assert.equal(
            allPoolsCorrect.pools.length,
            50,
            'Should be 48 pools with non-zero balance'
        );
    });

    it('Full Multihop SOR, DAI>ANT, swapExactIn - With no disabled tokens it should have swap', async () => {
        const name = 'DAI>ANT, swapExactIn, No Disabled Tokens';
        const amountIn = new BigNumber(1000000000000000000);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = DAI;
        const tokenOut = ANT;

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: [],
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountIn,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: allPools.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions
        );

        assert.equal(
            v1SwapData.returnAmount.toString(),
            '0.976143999926789198',
            'V1 Sanity check.'
        );
        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 swaps.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.9761455840438362',
            'Amount should match previous result.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, DAI>ANT, swapExactIn - With disabled tokens it should not have swap', async () => {
        const name = 'DAI>ANT, swapExactIn, Disabled Tokens';
        const amountIn = new BigNumber(1);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = DAI;
        const tokenOut = ANT;

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountIn,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: allPools.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions
        );

        assert.equal(
            v1SwapData.returnAmount.toString(),
            '0',
            'V1 Sanity check.'
        );
        assert.equal(v2SwapData.swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0',
            'Should have 0 amount.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, Should still complete multihop with disabled token pool', async () => {
        const name = 'Test Tokens';
        const amountOut = new BigNumber(10000000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a1';
        const tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a4';
        // OCEAN/TOKENIN/TEST2
        // OCEAN/TEST2/TOKENOUT
        // Still a route without disabled token: TOKENIN > TEST2 > TOKENOUT

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountOut,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: allPools.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions
        );

        assert.equal(
            v1SwapData.returnAmount.toString(),
            '10.24439019279202427',
            'V1 Sanity check.'
        );
        assert.isAtLeast(v2SwapData.swaps.length, 1);
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '10.244390929959717',
            'Amount should match previous result.'
        );
    }).timeout(10000);
});
