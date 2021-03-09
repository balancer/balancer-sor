// Tests Multihop SOR vs static sungraphPoolsLarge.json file.
// Includes timing data.
// npx mocha -r ts-node/register test/multihop-sor.spec.ts
require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import * as sor from '../src';
import { assert } from 'chai';
import { DisabledOptions, Swap } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';
import {
    getV1Swap,
    getV2Swap,
    displayResults,
    assertResults,
    filterPoolsAndTokens,
} from './lib/testHelpers';
import { bnum } from '../src/bmath';

const allPools = require('./testData/testPools/subgraphPoolsLarge.json');
const disabledTokens = require('./testData/disabled-tokens.json');

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI lower case
const ANT = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT lower case
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC lower case
const MKR = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR lower case
const OCEAN = '0x985dd3d42de1e256d09e1c10f112bccb8015ad41';

let allPoolsCorrect;

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

const gasPrice = new BigNumber('30000000000');

describe('Tests Multihop SOR vs static subgraphPoolsLarge.json', () => {
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

    it('Get multihop pools - WETH>DAI', async () => {
        let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
        [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
            allPoolsCorrect.pools,
            WETH,
            DAI,
            4,
            {
                isOverRide: true,
                disabledTokens: disabledTokens.tokens,
            }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
        ] = sor.sortPoolsMostLiquid(
            WETH,
            DAI,
            hopTokens,
            poolsTokenIn,
            poolsTokenOut
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH,
            DAI,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        assert.equal(
            mostLiquidPoolsFirstHop.length,
            4,
            'Should have 4 mostLiquidPoolsFirstHop'
        );
        assert.equal(
            mostLiquidPoolsSecondHop.length,
            4,
            'Should have 4 mostLiquidPoolsSecondHop'
        );
        assert.equal(hopTokens.length, 4, 'Should have 4 hopTokens');
        assert.equal(
            Object.keys(pools).length,
            16,
            'Should have 16 multi-hop pools'
        );
    });

    it('Full Multihop SOR, DAI>ANT, swapExactIn - No Disabled Tokens, should have swap', async () => {
        const name = 'DAI>ANT, swapExactIn, No Disabled Tokens';
        const amountIn = new BigNumber(1);
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
            // pools: allPoolsCorrect.pools,
            pools: allPools.pools,
            tradeInfo,
        };

        // V2 first to debug faster
        let v2SwapData = await getV2Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount,
            { onChainBalances: false },
            testData.tradeInfo.ReturnAmountDecimals,
            disabledOptions
        );

        let v1SwapData = await getV1Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount.times(
                bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
            ),
            { onChainBalances: false },
            disabledOptions
        );
        // Normalize returnAmount
        v1SwapData.returnAmount = v1SwapData.returnAmount.div(
            bnum(10 ** testData.tradeInfo.ReturnAmountDecimals)
        );

        displayResults(
            name,
            testData.tradeInfo,
            [v1SwapData, v2SwapData],
            false
        );

        assertResults(name, testData, v1SwapData, v2SwapData);

        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 swaps.');
    }).timeout(10000);

    it('Full Multihop SOR, DAI>ANT, swapExactIn - Disabled Tokens, should not have swap', async () => {
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

        // V2 first to debug faster
        let v2SwapData = await getV2Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount,
            { onChainBalances: false },
            testData.tradeInfo.ReturnAmountDecimals,
            disabledOptions
        );

        let v1SwapData = await getV1Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount.times(
                bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
            ),
            { onChainBalances: false },
            disabledOptions
        );
        // Normalize returnAmount
        v1SwapData.returnAmount = v1SwapData.returnAmount.div(
            bnum(10 ** testData.tradeInfo.ReturnAmountDecimals)
        );

        displayResults(
            name,
            testData.tradeInfo,
            [v1SwapData, v2SwapData],
            false
        );

        assertResults(name, testData, v1SwapData, v2SwapData);

        assert.equal(v2SwapData.swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0',
            'Should have 0 amount.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, WETH>ANT, swapExactIn', async () => {
        const name = 'WETH>ANT, swapExactIn';
        const amountIn = new BigNumber(1);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = WETH;
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

        // V2 first to debug faster
        let v2SwapData = await getV2Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount,
            { onChainBalances: false },
            testData.tradeInfo.ReturnAmountDecimals,
            disabledOptions
        );

        let v1SwapData = await getV1Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount.times(
                bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
            ),
            { onChainBalances: false },
            disabledOptions
        );
        // Normalize returnAmount
        v1SwapData.returnAmount = v1SwapData.returnAmount.div(
            bnum(10 ** testData.tradeInfo.ReturnAmountDecimals)
        );

        displayResults(
            name,
            testData.tradeInfo,
            [v1SwapData, v2SwapData],
            false
        );

        assertResults(name, testData, v1SwapData, v2SwapData);

        assert.equal(v2SwapData.swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0',
            'Should have 0 amount.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, WETH>ANT, swapExactOut', async () => {
        const name = 'WETH>ANT, swapExactOut';
        const amount = new BigNumber(1000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WETH;
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
            SwapAmount: amount,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: allPools.pools,
            tradeInfo,
        };

        // V2 first to debug faster
        let v2SwapData = await getV2Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount,
            { onChainBalances: false },
            testData.tradeInfo.ReturnAmountDecimals,
            disabledOptions
        );

        let v1SwapData = await getV1Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount.times(
                bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
            ),
            { onChainBalances: false },
            disabledOptions
        );
        // Normalize returnAmount
        v1SwapData.returnAmount = v1SwapData.returnAmount.div(
            bnum(10 ** testData.tradeInfo.ReturnAmountDecimals)
        );

        displayResults(
            name,
            testData.tradeInfo,
            [v1SwapData, v2SwapData],
            false
        );

        assertResults(name, testData, v1SwapData, v2SwapData);

        assert.equal(v2SwapData.swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0',
            'Should have 0 amount.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, USDC>MKR, swapExactIn', async () => {
        const name = 'USDC>MKR, swapExactIn';
        const amountIn = new BigNumber('1'); // 1 USDC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = MKR;

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
            SwapAmountDecimals: 6,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: allPools.pools,
            tradeInfo,
        };

        // V2 first to debug faster
        let v2SwapData = await getV2Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount,
            { onChainBalances: false },
            testData.tradeInfo.ReturnAmountDecimals,
            disabledOptions
        );

        let v1SwapData = await getV1Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount.times(
                bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
            ),
            { onChainBalances: false },
            disabledOptions
        );
        // Normalize returnAmount
        v1SwapData.returnAmount = v1SwapData.returnAmount.div(
            bnum(10 ** testData.tradeInfo.ReturnAmountDecimals)
        );

        displayResults(
            name,
            testData.tradeInfo,
            [v1SwapData, v2SwapData],
            false
        );

        assertResults(name, testData, v1SwapData, v2SwapData);
    }).timeout(10000);

    it('Full Multihop SOR, Should still complete multihop with disabled token pool', async () => {
        const name = 'Test Tokens';
        const amountOut = new BigNumber(10);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a1';
        const tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a4';

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

        // V2 first to debug faster
        let v2SwapData = await getV2Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount,
            { onChainBalances: false },
            testData.tradeInfo.ReturnAmountDecimals,
            disabledOptions
        );

        let v1SwapData = await getV1Swap(
            provider,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.NoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.SwapType,
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.SwapAmount.times(
                bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
            ),
            { onChainBalances: false },
            disabledOptions
        );
        // Normalize returnAmount
        v1SwapData.returnAmount = v1SwapData.returnAmount.div(
            bnum(10 ** testData.tradeInfo.ReturnAmountDecimals)
        );

        displayResults(
            name,
            testData.tradeInfo,
            [v1SwapData, v2SwapData],
            false
        );

        assertResults(name, testData, v1SwapData, v2SwapData);

        assert.isAtLeast(v2SwapData.swaps.length, 1);
    }).timeout(10000);
});
