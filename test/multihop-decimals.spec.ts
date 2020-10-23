// Tests Multihop SOR for swaps with different decimals.
import * as sor from '../src';
import { assert, expect } from 'chai';
import { Swap } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';
import {
    formatAndFilterPools,
    filterPools,
    testSwapsExactIn,
    testSwapsExactOut,
    fullSwap,
    alterPools,
} from './utils';

const allPools = require('./allPoolsDecimals.json');
const disabledTokens = require('./disabled-tokens.json');
const WBTC = '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb'.toLowerCase();
const MKR = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'.toLowerCase();
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const yUSD = '0xb2fdd60ad80ca7ba89b9bab3b5336c2601c020b4';

let allPoolsCorrect;

describe('Tests Multihop SOR vs static allPoolsDecimals.json', () => {
    it('Saved pool check - without disabled filter', async () => {
        assert.equal(allPools.pools.length, 3, 'Should be 3 pools');
        let allTokensSet;
        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsCorrect] = formatAndFilterPools(
            JSON.parse(JSON.stringify(allPools))
        );

        assert.equal(
            allPoolsCorrect.pools.length,
            3,
            'Should be 3 pools with non-zero balance'
        );
    });

    it('Full Multihop SOR, WBTC>MKR, swapExactIn', async () => {
        const amountIn = new BigNumber(100000); // 0.00100000 WBTC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = WBTC;
        const tokenOut = MKR;

        let swapsCorrect: Swap[][], totalAmtOutCorrect: BigNumber;
        [swapsCorrect, totalAmtOutCorrect] = fullSwap(
            allPoolsCorrect,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountIn,
            disabledTokens
        );

        assert.equal(swapsCorrect.length, 1, 'Should have 1 multiswap.');

        testSwapsExactIn(
            swapsCorrect,
            tokenIn,
            tokenOut,
            amountIn,
            totalAmtOutCorrect,
            allPoolsCorrect
        );
    });

    it('Full Multihop SOR, WBTC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(10000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WBTC;
        const tokenOut = MKR;

        let swapsCorrect: Swap[][], totalAmtInCorrect: BigNumber;
        [swapsCorrect, totalAmtInCorrect] = fullSwap(
            allPoolsCorrect,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountOut,
            disabledTokens
        );

        assert.equal(swapsCorrect.length, 1, 'Should have 1 multiswap.');

        testSwapsExactOut(
            swapsCorrect,
            tokenIn,
            tokenOut,
            amountOut,
            totalAmtInCorrect,
            allPoolsCorrect
        );
    });

    it('Full Multihop SOR, USDC>yUSD, swapExactIn', async () => {
        const amountIn = new BigNumber(1000000);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = yUSD;

        let swapsCorrect: Swap[][], totalAmtOutCorrect: BigNumber;
        [swapsCorrect, totalAmtOutCorrect] = fullSwap(
            allPoolsCorrect,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountIn,
            disabledTokens
        );

        assert.equal(swapsCorrect.length, 1, 'Should have 1 multiswap.');

        testSwapsExactIn(
            swapsCorrect,
            tokenIn,
            tokenOut,
            amountIn,
            totalAmtOutCorrect,
            allPoolsCorrect
        );
        // console.log(totalAmtOut.toString());      // 962208534548386057
    });

    it('Full Multihop SOR, USDC>yUSD, swapExactOut', async () => {
        const amountOut = new BigNumber(10000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = yUSD;

        let swapsCorrect: Swap[][], totalAmtInCorrect: BigNumber;
        [swapsCorrect, totalAmtInCorrect] = fullSwap(
            allPoolsCorrect,
            tokenIn,
            tokenOut,
            swapType,
            noPools,
            amountOut,
            disabledTokens
        );

        assert.equal(swapsCorrect.length, 1, 'Should have 1 multiswap.');

        testSwapsExactOut(
            swapsCorrect,
            tokenIn,
            tokenOut,
            amountOut,
            totalAmtInCorrect,
            allPoolsCorrect
        );
    });
});
