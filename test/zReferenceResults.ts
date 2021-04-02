// Tests multihop filter methods by comparing to old SOR getMultihopPoolsWithTokens function
// which was replaced as too slow - uses subgraphPoolsSmall.json for pool data.
// npx mocha -r ts-node/register test/zReferenceResults.ts
import * as sor from '../src';
import { assert } from 'chai';
import 'mocha';
import { filterPoolsWithBalance } from './lib/testHelpers';
import BigNumber from 'bignumber.js';
// Following has:
// Both DAI&USDC: 4 pools
// DAI, No USDC: 3
// No DAI, USDC: 2
// Neither: 3
let allPools = require('./testData/filterTestPools.json');
allPools = { pools: allPools.weightedOnly };

import {
    SwapV2,
    SwapInfo,
    SubGraphPools,
    SubGraphPool,
    Path,
    SubGraphPoolDictionary,
    DisabledOptions,
} from '../src/types';

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(); // DAI
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();

let allPoolsNonZeroBalances;

describe('Test Filter Functions using subgraphPoolsSmall.json & full SOR comparrions', () => {
    it('Saved pool check', async () => {
        assert.equal(allPools.pools.length, 12, 'Should be 12 pools');

        allPoolsNonZeroBalances = filterPoolsWithBalance(allPools);
        assert.equal(
            allPoolsNonZeroBalances.pools.length,
            8,
            'Should be 8 pools with non-zero balance'
        );
    });
    /*
    it('Get multihop pools - DAI>USDC', async () => {
        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPoolsNonZeroBalances.pools, DAI, USDC, 4);

        assert.equal(Object.keys(poolsTokenIn).length, 2, 'PoolsTokenIn');

        assert.equal(Object.keys(poolsTokenOut).length, 1, 'PoolsTokenIn');

        assert.equal(Object.keys(directPools).length, 3, 'Direct');

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

        assert.equal(
            mostLiquidPoolsFirstHopFilter.length,
            1,
            'Should have 1 first hop pools.'
        );
        assert.equal(
            mostLiquidPoolsSecondHopFilter.length,
            1,
            'Should have 1 second hop pools.'
        );
        assert.equal(hopTokensFilter.length, 1, 'Should have 5 hop tokens.');
        assert.equal(
            hopTokensFilter[0],
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            'Token Addresses should match.'
        );
        assert.equal(
            mostLiquidPoolsFirstHopFilter[0].id,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee',
            'Pool Addresses should match.'
        );
        assert.equal(
            mostLiquidPoolsSecondHopFilter[0].id,
            '0x12d6b6e24fdd9849abd42afd8f5775d36084a828',
            'Pool Addresses should match.'
        );
    });

    it(`runs full`, () => {
        let tokenIn = DAI;
        let tokenOut = USDC;

        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPoolsNonZeroBalances.pools, DAI, USDC, 4);

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

        // Finds the possible paths to make the swap
        let pathArray: Path[];
        let pools: SubGraphPoolDictionary;
        [pools, pathArray] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter
        );

        let paths: Path[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = sor.processPaths(pathArray, pools, 'swapExactIn');

        // console.log(maxAmt.toString());
        // paths.forEach(path => {
        //     console.log(path.id);
        //     console.log(path.limitAmount.toString());
        // });
    });

    it(`runs full weighted`, () => {
        let allPools = require('./testData/filterTestPools.json');
        allPools = { pools: allPools.weightedOnly };
        let tokenIn = DAI;
        let tokenOut = USDC;

        // console.log(allPools);

        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPools.pools, DAI, USDC, 4);

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

        // Finds the possible paths to make the swap
        let pathArray: Path[];
        let pools: SubGraphPoolDictionary;
        [pools, pathArray] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter
        );

        let paths: Path[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = sor.processPaths(pathArray, pools, 'swapExactIn');

        //console.log(maxAmt.toString());
        //paths.forEach(path => {
        //    console.log(path.id);
        //    console.log(path.limitAmount.toString());
        //});

        let swapType = 'swapExactIn';
        let swapAmt = new BigNumber(0.1);

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = sor.smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmt,
            4,
            new BigNumber(0)
        );

        // console.log(marketSp.toString());
        // console.log(total.toString());
        // console.log(swaps);
    });
    */
    it(`runs full weighted exactOut`, () => {
        let allPools = require('./testData/filterTestPools.json');
        allPools = { pools: allPools.weightedOnly };
        let tokenIn = DAI;
        let tokenOut = USDC;
        let swapType = 'swapExactOut';
        let swapAmt = new BigNumber(0.1);

        // console.log(allPools);

        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPools.pools, DAI, USDC, 4);

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

        // Finds the possible paths to make the swap
        let pathArray: Path[];
        let pools: SubGraphPoolDictionary;
        [pools, pathArray] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter
        );

        let paths: Path[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = sor.processPaths(pathArray, pools, 'swapExactOut');

        console.log(maxAmt.toString());
        paths.forEach(path => {
            console.log(path.id);
            console.log(path.limitAmount.toString());
        });

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = sor.smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmt,
            4,
            new BigNumber(0)
        );

        console.log(marketSp.toString());
        console.log(total.toString());
        console.log(swaps);
    });
    /*
    it(`runs full stable`, () => {
        let allPools = require('./testData/filterTestPools.json');
        allPools = { pools: allPools.stableOnly };
        let tokenIn = DAI;
        let tokenOut = USDC;

        // console.log(allPools);

        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPools.pools, DAI, USDC, 4);

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

        // Finds the possible paths to make the swap
        let pathArray: Path[];
        let pools: SubGraphPoolDictionary;
        [pools, pathArray] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter
        );

        let paths: Path[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = sor.processPaths(pathArray, pools, 'swapExactIn');

        //console.log(maxAmt.toString());
        //paths.forEach(path => {
        //    console.log(path.id);
        //    console.log(path.limitAmount.toString());
        //});

        let swapType = 'swapExactIn';
        let swapAmt = new BigNumber(0.1);

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = sor.smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmt,
            4,
            new BigNumber(0)
        );

        // console.log(marketSp.toString());
        // console.log(total.toString());
        // console.log(swaps);
    });

    it(`runs full stable, exactOut`, () => {
        let allPools = require('./testData/filterTestPools.json');
        allPools = { pools: allPools.stableOnly };
        let tokenIn = DAI;
        let tokenOut = USDC;

        // console.log(allPools);

        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPools.pools, DAI, USDC, 4);

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

        // Finds the possible paths to make the swap
        let pathArray: Path[];
        let pools: SubGraphPoolDictionary;
        [pools, pathArray] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter
        );

        let paths: Path[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = sor.processPaths(pathArray, pools, 'swapExactOut');

        //console.log(maxAmt.toString());
        //paths.forEach(path => {
        //    console.log(path.id);
        //    console.log(path.limitAmount.toString());
        //});

        let swapType = 'swapExactOut';
        let swapAmt = new BigNumber(0.1);

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = sor.smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmt,
            4,
            new BigNumber(0)
        );

        // console.log(marketSp.toString());
        // console.log(total.toString());
        // console.log(swaps);
    });

    it(`runs full swapExactIn`, () => {
        let testPools = require('./testData/filterTestPools.json');
        let weighted: any = testPools.weightedOnly;
        let allPools: any = testPools.stableOnly.concat(weighted);
        allPools = { pools: allPools };
        let tokenIn = DAI;
        let tokenOut = USDC;

        // console.log(allPools);

        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPools.pools, DAI, USDC, 4);

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

        // Finds the possible paths to make the swap
        let pathArray: Path[];
        let pools: SubGraphPoolDictionary;
        [pools, pathArray] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter
        );

        let paths: Path[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = sor.processPaths(pathArray, pools, 'swapExactIn');

        //console.log(maxAmt.toString());
        //paths.forEach(path => {
        //    console.log(path.id);
        //    console.log(path.limitAmount.toString());
        //});

        let swapType = 'swapExactIn';
        let swapAmt = new BigNumber(0.77);

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = sor.smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmt,
            4,
            new BigNumber(0)
        );

        // console.log(marketSp.toString());
        // console.log(total.toString());
        // console.log(swaps);
    });

    it(`runs full swapExactOut`, () => {
        let testPools = require('./testData/filterTestPools.json');
        let weighted: any = testPools.weightedOnly;
        let allPools: any = testPools.stableOnly.concat(weighted);
        allPools = { pools: allPools };
        let tokenIn = DAI;
        let tokenOut = USDC;

        // console.log(allPools);

        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPools.pools, DAI, USDC, 4);

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

        // Finds the possible paths to make the swap
        let pathArray: Path[];
        let pools: SubGraphPoolDictionary;
        [pools, pathArray] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter
        );

        let paths: Path[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = sor.processPaths(pathArray, pools, 'swapExactOut');

        console.log(maxAmt.toString());
        paths.forEach(path => {
           console.log(path.id);
           console.log(path.limitAmount.toString());
        });

        let swapType = 'swapExactOut';
        let swapAmt = new BigNumber(100.7321);

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = sor.smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmt,
            4,
            new BigNumber(0)
        );

        // console.log(marketSp.toString());
        // console.log(total.toString());
        // console.log(swaps);
    });
    */
});
