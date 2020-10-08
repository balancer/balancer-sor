// Tests Multihop SOR vs static allPools.json file.
// Includes timing data.
import * as sor from '../src';
import { assert } from 'chai';
import { Swap } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';
import {
    formatAndFilterPools,
    filterPools,
    checkSwapsExactIn,
    checkSwapsExactOut,
} from './utils';
const { utils } = require('ethers');
const allPools = require('./allPools.json');
import { BONE, bnum } from '../src/bmath';
const disabledTokens = require('./disabled-tokens.json');
import { getAmountOut, getAmountIn, fullSwap } from './utils';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI lower case
const ANT = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT lower case
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC lower case
const MKR = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR lower case
const OCEAN = '0x985dd3d42de1e256d09e1c10f112bccb8015ad41';

let allPoolsNonZeroBalances;

describe('Tests Multihop SOR vs static allPools.json', () => {
    it('Saved pool check - without disabled filter', async () => {
        // Uses saved pools @25/05/20.
        assert.equal(allPools.pools.length, 64, 'Should be 64 pools');
        let allTokensSet;
        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsNonZeroBalances] = formatAndFilterPools(
            JSON.parse(JSON.stringify(allPools))
        );

        assert.equal(allTokensSet.size, 42, 'Should be 42 token sets'); // filter excludes duplicates
        assert.equal(
            allPoolsNonZeroBalances.pools.length,
            50,
            'Should be 50 pools with non-zero balance'
        );
    });

    it('Saved pool check - with disabled filter', async () => {
        // Uses saved pools @25/05/20.
        assert.equal(allPools.pools.length, 64, 'Should be 64 pools');
        let allTokensSet;
        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsNonZeroBalances] = formatAndFilterPools(
            JSON.parse(JSON.stringify(allPools)),
            disabledTokens.tokens
        );

        assert.equal(allTokensSet.size, 39, 'Should be 39 token sets'); // filter excludes duplicates
        assert.equal(
            allPoolsNonZeroBalances.pools.length,
            50,
            'Should be 48 pools with non-zero balance'
        );
    });

    it('getTokenPairsMultiHop - Should return direct & multihop partner tokens', async () => {
        let allTokensSet;
        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsNonZeroBalances] = formatAndFilterPools(
            JSON.parse(JSON.stringify(allPools)),
            disabledTokens.tokens
        );

        let [directTokenPairsSET, allTokenPairsSET] = sor.getTokenPairsMultiHop(
            DAI,
            allTokensSet
        );

        assert.equal(
            directTokenPairsSET.length,
            16,
            'Should have 16 direct tokens'
        );

        assert.equal(
            allTokenPairsSET.length,
            33,
            'Should be 33 multi-hop tokens'
        );
    });

    it('filterPoolsWithTokensDirect - DAI/ANT Pools with local disabled list', async () => {
        const directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            DAI,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should have 0 direct pools'
        );
    });

    it('filterPoolsWithTokensDirect - DAI/OCEAN Pools with no disabled list', async () => {
        const directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            DAI,
            OCEAN,
            { isOverRide: true, disabledTokens: [] }
        );

        assert.equal(
            Object.keys(directPools).length,
            1,
            'Should have 1 direct pools with no disabled'
        );
    });

    it('filterPoolsWithTokensDirect - DAI/OCEAN Pools with disabled list', async () => {
        const directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            DAI,
            OCEAN,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should have 0 direct pools'
        );
    });

    it('filterPoolsWithTokensDirect - WETH/ANT Pools', async () => {
        const directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );
        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should have 0 direct pools'
        );
    });

    it('filterPoolsWithTokensDirect - WETH/DAI Pools', async () => {
        let directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );
        assert.equal(
            Object.keys(directPools).length,
            10,
            'Should have 10 direct pools'
        );
        directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            DAI,
            WETH,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );
        assert.equal(
            Object.keys(directPools).length,
            10,
            'Should have 10 direct pools'
        );
    });

    it('Get multihop pools - WETH>DAI', async () => {
        let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
        [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
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

    it('Full Multihop SOR, WETH>DAI, swapExactIn', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = WETH;
        const tokenOut = DAI;

        let swaps: Swap[][], totalAmtOut: BigNumber;
        [swaps, totalAmtOut] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountIn,
            disabledTokens
        );

        assert.equal(swaps.length, 3, 'Should have 3 swaps.');
        checkSwapsExactIn(
            swaps,
            tokenIn,
            tokenOut,
            amountIn,
            totalAmtOut,
            allPoolsNonZeroBalances
        );
    });

    it('Full Multihop SOR, WETH>DAI, swapExactOut', async () => {
        const amountOut = new BigNumber(1000).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WETH;
        const tokenOut = DAI;

        let swaps: Swap[][], totalAmtIn: BigNumber;
        [swaps, totalAmtIn] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountOut,
            disabledTokens
        );

        assert.equal(swaps.length, 4, 'Should have 4 swaps.');
        checkSwapsExactOut(
            swaps,
            tokenIn,
            tokenOut,
            amountOut,
            totalAmtIn,
            allPoolsNonZeroBalances
        );
    });

    it('Full Multihop SOR, DAI>ANT, swapExactIn - No Disabled Tokens, should have swap', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = DAI;
        const tokenOut = ANT;

        let disabledTokens = { tokens: [] };
        let swaps: Swap[][], totalAmtOut: BigNumber;
        [swaps, totalAmtOut] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountIn,
            disabledTokens
        );

        assert.equal(swaps.length, 1, 'Should have 1 swaps.');
        checkSwapsExactIn(
            swaps,
            tokenIn,
            tokenOut,
            amountIn,
            totalAmtOut,
            allPoolsNonZeroBalances
        );
    });

    it('Full Multihop SOR, DAI>ANT, swapExactIn - Disabled Tokens, should not have swap', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = DAI;
        const tokenOut = ANT;

        let swaps: Swap[][], totalAmtOut: BigNumber;
        [swaps, totalAmtOut] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountIn,
            disabledTokens
        );

        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalAmtOut.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>ANT, swapExactIn', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = WETH;
        const tokenOut = ANT;

        let swaps: Swap[][], totalAmtOut: BigNumber;
        [swaps, totalAmtOut] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountIn,
            disabledTokens
        );

        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalAmtOut.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>ANT, swapExactOut', async () => {
        const amountOut = new BigNumber(1000).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WETH;
        const tokenOut = ANT;

        let swaps: Swap[][], totalAmtIn: BigNumber;
        [swaps, totalAmtIn] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountOut,
            disabledTokens
        );

        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalAmtIn.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, USDC>MKR, swapExactIn', async () => {
        const amountIn = new BigNumber('1000000'); // 1 USDC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = MKR;

        let swaps: Swap[][], totalAmtOut: BigNumber;
        [swaps, totalAmtOut] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountIn,
            disabledTokens
        );

        assert.equal(swaps.length, 2, 'Should have 2 swaps.');
        checkSwapsExactIn(
            swaps,
            tokenIn,
            tokenOut,
            amountIn,
            totalAmtOut,
            allPoolsNonZeroBalances
        );
    });

    it('Full Multihop SOR, USDC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(10).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = MKR;

        let swaps: Swap[][], totalAmtIn: BigNumber;
        [swaps, totalAmtIn] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountOut,
            disabledTokens
        );

        assert.equal(swaps.length, 2, 'Should have 2 swaps.');
        checkSwapsExactOut(
            swaps,
            tokenIn,
            tokenOut,
            amountOut,
            totalAmtIn,
            allPoolsNonZeroBalances
        );
    });

    it('Full Multihop SOR, Should still complete multihop with disabled token pool', async () => {
        const amountOut = new BigNumber(10).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a1';
        const tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a4';

        let swaps: Swap[][], totalAmtIn: BigNumber;
        [swaps, totalAmtIn] = fullSwap(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountOut,
            disabledTokens
        );

        assert.equal(swaps.length, 1, 'Should have 1 swaps.');
        checkSwapsExactOut(
            swaps,
            tokenIn,
            tokenOut,
            amountOut,
            totalAmtIn,
            allPoolsNonZeroBalances
        );
    });
});
