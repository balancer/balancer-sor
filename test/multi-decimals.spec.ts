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
const { utils } = require('ethers');
const allPools = require('./allPoolsDecimals.json');
import { BONE, scale } from '../src/bmath';
const disabledTokens = require('./disabled-tokens.json');

const WBTC = '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb'.toLowerCase();
const MKR = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'.toLowerCase();

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

let allPoolsNonZeroBalances;
let inPools, inPath, outPools, outPaths;

describe('Tests Multihop SOR vs static allPools.json', () => {
    it('Saved pool check - without disabled filter', async () => {
        assert.equal(allPools.pools.length, 2, 'Should be 2 pools');
        let allTokensSet;
        // Converts Subgraph string format to Wei/Bnum format
        [allTokensSet, allPoolsNonZeroBalances] = formatAndFilterPools(
            JSON.parse(JSON.stringify(allPools))
        );

        // console.log(allPoolsNonZeroBalances.pools[0].tokens[0].balance.toString());

        assert.equal(
            allPoolsNonZeroBalances.pools.length,
            2,
            'Should be 2 pools with non-zero balance'
        );
    });

    it('Full Multihop SOR, WBTC>MKR, swapExactIn', async () => {
        const amountIn = new BigNumber(100000);
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

        inPools = pools;
        inPath = JSON.parse(JSON.stringify(pathData));

        let paths = sor.processPaths(pathData, pools, swapType);

        console.log(paths[0].spotPrice.toString());
        console.log(paths[0].slippage.toString());
        console.log(paths[0].limitAmount.toString());

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        // console.log(epsOfInterest);

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

        console.log(`Total Return: ${totalReturnWei.toString()}`);
        console.log(swaps);
    });

    it('Full Multihop SOR, WBTC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(100000000000000000);
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

        expect(inPath).to.eql(pathData);

        let paths = sor.processPaths(pathData, pools, swapType);

        console.log(paths[0].spotPrice.toString());
        console.log(paths[0].slippage.toString());
        console.log(paths[0].limitAmount.toString());

        let epsOfInterest = sor.processEpsOfInterestMultiHop(
            paths,
            swapType,
            noPools
        );

        console.log(epsOfInterest);

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

        console.log(`Total Return: ${totalReturnWei}`);
        console.log(swaps);

        expect(inPools).to.eql(pools);
    });
});
