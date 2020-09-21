// Tests Multihop SOR for swaps with different decimals.
import * as sor from '../src';
import { assert } from 'chai';
import { Swap } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';
import {
    formatAndFilterPools,
    filterPools,
    checkSwapsExactIn,
    checkSwapsExactOut,
    fullSwap,
} from './utils';

const allPools = require('./allPoolsDecimals.json');
const disabledTokens = require('./disabled-tokens.json');
const WBTC = '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb'.toLowerCase();
const MKR = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'.toLowerCase();

let allPoolsNonZeroBalances;

describe('Tests Multihop SOR vs static allPools.json', () => {
    it('Saved pool check - without disabled filter', async () => {
        assert.equal(allPools.pools.length, 2, 'Should be 2 pools');
        let allTokensSet;
        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsNonZeroBalances] = formatAndFilterPools(
            JSON.parse(JSON.stringify(allPools))
        );

        assert.equal(
            allPoolsNonZeroBalances.pools.length,
            2,
            'Should be 2 pools with non-zero balance'
        );
    });

    it('Full Multihop SOR, WBTC>MKR, swapExactIn', async () => {
        const amountIn = new BigNumber(100000); // 0.00100000 WBTC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = WBTC;
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

        assert.equal(swaps.length, 1, 'Should have 1 multiswap.');
        checkSwapsExactIn(
            swaps,
            tokenIn,
            tokenOut,
            amountIn,
            totalAmtOut,
            allPoolsNonZeroBalances
        );
    });

    it('Full Multihop SOR, WBTC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(10000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WBTC;
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

        assert.equal(swaps.length, 1, 'Should have 1 multiswap.');
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
