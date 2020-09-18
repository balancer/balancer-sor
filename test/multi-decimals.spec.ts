// Tests Multihop SOR vs static allPools.json file.
// Includes timing data.
import { expect, assert } from 'chai';
import 'mocha';
import {
    formatAndFilterPools,
    filterPools,
} from './testScripts/utils/subgraph';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const allPools = require('./allPoolsDecimals.json');
const disabledTokens = require('./disabled-tokens.json');
import { bnum } from '../src/bmath';
import { getAmountOut, getAmountIn } from './utils';

const WBTC = '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb'.toLowerCase();
const MKR = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'.toLowerCase();

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

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

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            tokenIn.toLowerCase(),
            tokenOut.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        let paths = sor.processPaths(pathData, pools, swapType);

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        let swaps, totalReturnWei;
        [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountIn,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );

        assert.equal(swaps.length, 1, 'Should have 1 swap.');
        assert.equal(swaps[0][0].tokenIn, tokenIn);
        assert.equal(swaps[0][0].swapAmount, amountIn);
        assert.equal(swaps[0][1].tokenIn, swaps[0][0].tokenOut);
        assert.equal(swaps[0][1].tokenOut, tokenOut);
        let amtOut = getAmountOut(
            allPoolsNonZeroBalances,
            swaps[0][0].pool,
            swaps[0][0].tokenIn,
            swaps[0][0].tokenOut,
            amountIn
        );
        assert.equal(swaps[0][1].swapAmount, amtOut);
        amtOut = getAmountOut(
            allPoolsNonZeroBalances,
            swaps[0][1].pool,
            swaps[0][1].tokenIn,
            swaps[0][1].tokenOut,
            bnum(swaps[0][1].swapAmount)
        );
        assert.equal(totalReturnWei.toString(), amtOut.toString());
        console.log(totalReturnWei.toString());
    });

    it('Full Multihop SOR, WBTC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(10000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WBTC;
        const tokenOut = MKR;

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            tokenIn.toLowerCase(),
            tokenOut.toLowerCase(),
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        let paths = sor.processPaths(pathData, pools, swapType);

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        let swaps, totalReturnWei;
        [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountOut,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );

        assert.equal(swaps.length, 1, 'Should have 1 swap.');
        assert.equal(swaps[0][0].tokenIn, tokenIn);
        let amtIn = getAmountIn(
            allPoolsNonZeroBalances,
            swaps[0][1].pool,
            swaps[0][1].tokenIn,
            swaps[0][1].tokenOut,
            amountOut
        );
        assert.equal(swaps[0][0].swapAmount, amtIn.toString());
        assert.equal(swaps[0][1].tokenIn, swaps[0][0].tokenOut);
        assert.equal(swaps[0][1].tokenOut, tokenOut);
        assert.equal(swaps[0][1].swapAmount, amountOut);
        amtIn = amtIn.plus(
            getAmountIn(
                allPoolsNonZeroBalances,
                swaps[0][0].pool,
                swaps[0][0].tokenIn,
                swaps[0][0].tokenOut,
                bnum(swaps[0][1].swapAmount)
            )
        );
        console.log(swaps[0][0].swapAmount);
        console.log(totalReturnWei.toString());
        expect(totalReturnWei.toString()).to.eql(swaps[0][0].swapAmount);
    });
});
