// Tests multihop filter methods by comparing to old SOR getMultihopPoolsWithTokens function
// which was replaced as too slow - uses subgraphPoolsSmall.json for pool data.
// npx mocha -r ts-node/register test/filterTemp.spec.ts
import * as sor from '../src';
import { assert } from 'chai';
import 'mocha';
import {
    filterPoolsWithBalance,
    countPoolSwapPairTypes,
} from './lib/testHelpers';
import BigNumber from 'bignumber.js';
let allPools = require('./testData/filterTestPools.json');
import { filterPoolsOfInterest, filterHopPools } from '../src/pools';
import { calculatePathLimits, smartOrderRouter } from '../src/sorClass';
import { PoolDictionary, NewPath, SwapTypes } from '../src/types';
import {
    SwapV2,
    SwapInfo,
    SubGraphPools,
    SubGraphPool,
    Path,
    SubGraphPoolDictionary,
    DisabledOptions,
    Swap,
} from '../src/types';

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(); // DAI
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();

let allPoolsNonZeroBalances;

describe('Test Filter Functions using subgraphPoolsSmall.json & full SOR comparrions', () => {
    it('Failing Case, swapExactOut', async () => {
        const testPools = JSON.parse(JSON.stringify(allPools)).weightedOnly;
        let swapAmt = new BigNumber(0.1);
        let tokenIn = DAI;
        let tokenOut = USDC;
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            4
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        // assert.equal(hopTokens.length, 2);
        // assert.equal(Object.keys(poolsOfInterestDictionary).length, 2); // 4 paths using two pools.
        // assert.equal(noDirect, 0);
        // assert.equal(noHopIn, 1);
        // assert.equal(noHopOut, 1);

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            poolsOfInterestDictionary
        );

        // assert.equal(pathData.length, 2);
        // assert.equal(Object.keys(poolsOfInterestDictionary).length, 2);
        // assert.equal(pathData[0].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
        // assert.equal(pathData[1].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');

        let paths: NewPath[];
        let maxLiquidityAvailable: BigNumber;
        [paths, maxLiquidityAvailable] = calculatePathLimits(
            pathData,
            SwapTypes.SwapExactOut
        );

        assert.equal(
            maxLiquidityAvailable.toString(),
            '1406.590114333331926743219'
        );
        assert.equal(paths.length, 4);
        assert.equal(
            paths[0].limitAmount.toString(),
            '1237.30607666666542936059'
        );
        assert.equal(
            paths[1].limitAmount.toString(),
            '158.752237333333174581096'
        );

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = smartOrderRouter(
            JSON.parse(JSON.stringify(poolsOfInterestDictionary)), // Need to keep original pools for cache
            paths,
            SwapTypes.SwapExactOut,
            swapAmt,
            4,
            new BigNumber(0)
        );

        assert.equal(total.toString(), '0.099251606996353501');
        // assert.equal(swaps.length, 2);
        // assert.equal(swaps[0][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
        // assert.equal(swaps[0][0].swapAmount, '0.505303156638908081');
        // assert.equal(swaps[0][0].tokenIn, tokenIn);
        // assert.equal(swaps[0][0].tokenOut, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
        // assert.equal(swaps[0][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
        // assert.equal(swaps[0][1].swapAmount, '0.499999999999981612');
        // assert.equal(swaps[0][1].tokenIn, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
        // assert.equal(swaps[0][1].tokenOut, tokenOut);
        // assert.equal(swaps[1][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
        // assert.equal(swaps[1][0].swapAmount, '0.505303156638945455');
        // assert.equal(swaps[1][0].tokenIn, tokenIn);
        // assert.equal(swaps[1][0].tokenOut, '0x0000000000085d4780b73119b644ae5ecd22b376');
        // assert.equal(swaps[1][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
        // assert.equal(swaps[1][1].swapAmount, '0.500000000000018388');
        // assert.equal(swaps[1][1].tokenIn, '0x0000000000085d4780b73119b644ae5ecd22b376');
        // assert.equal(swaps[1][1].tokenOut, tokenOut);
    });

    // it('Test pool that has direct & multihop paths', async () => {
    //     const testPools = JSON.parse(JSON.stringify(allPools)).pathTestDirectAndMulti;
    //     let tokenIn = USDC;
    //     let tokenOut = DAI;

    //     let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
    //     [
    //         directPools,
    //         hopTokensFilter,
    //         poolsTokenIn,
    //         poolsTokenOut,
    //     ] = sor.filterPools(testPools, tokenIn, tokenOut, 4);

    //     assert.equal(hopTokensFilter, 0);
    //     assert.equal(Object.keys(poolsTokenIn).length, 0);
    //     assert.equal(Object.keys(poolsTokenOut).length, 1);
    //     assert.equal(Object.keys(directPools).length, 1);
    //     assert.equal(directPools['0x0481d726c3d25250a8963221945ed93b8a5315a9'].id, '0x0481d726c3d25250a8963221945ed93b8a5315a9');

    //     let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
    //     [
    //         mostLiquidPoolsFirstHopFilter,
    //         mostLiquidPoolsSecondHopFilter,
    //     ] = sor.sortPoolsMostLiquid(
    //         DAI,
    //         USDC,
    //         hopTokensFilter,
    //         poolsTokenIn,
    //         poolsTokenOut
    //     );

    //     assert.equal(mostLiquidPoolsFirstHopFilter.length, 0);
    //     assert.equal(mostLiquidPoolsSecondHopFilter.length, 0);
    // });

    // it('Test pool class that has direct & multihop paths', async () => {
    //     const testPools = JSON.parse(JSON.stringify(allPools)).pathTestDirectAndMulti;
    //     let tokenIn = USDC;
    //     let tokenOut = DAI;
    //     let hopTokens: string[];
    //     let poolsOfInterestDictionary: PoolDictionary;
    //     let pathData: NewPath[];

    //     [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
    //         testPools,
    //         tokenIn,
    //         tokenOut,
    //         4
    //     );
    //     /*
    //     [poolsOfInterestDictionary, pathData] = filterHopPools(
    //         tokenIn,
    //         tokenOut,
    //         hopTokens,
    //         poolsOfInterestDictionary
    //     );
    //     */

    //     const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(poolsOfInterestDictionary);

    //     assert.equal(hopTokens.length, 0);
    //     assert.equal(
    //         Object.keys(poolsOfInterestDictionary).length,
    //         2
    //     );

    //     assert.equal(noDirect, 1);
    //     assert.equal(
    //         noHopIn,
    //         0
    //     );
    //     assert.equal(
    //         noHopOut,
    //         1,
    //     );
    // });

    // it('Test pool that has two multhop paths, swapExactIn', async () => {
    //     const testPools = JSON.parse(JSON.stringify(allPools)).pathTestPoolTwoMultiHops;
    //     let tokenIn = USDC;
    //     let tokenOut = DAI;

    //     let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
    //     [
    //         directPools,
    //         hopTokensFilter,
    //         poolsTokenIn,
    //         poolsTokenOut,
    //     ] = sor.filterPools(testPools, tokenIn, tokenOut, 4);

    //     assert.equal(Object.keys(poolsTokenIn).length, 1, 'PoolsTokenIn');
    //     assert.equal(Object.keys(poolsTokenOut).length, 1, 'PoolsTokenOut');
    //     assert.equal(Object.keys(directPools).length, 0, 'Direct');

    //     let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
    //     [
    //         mostLiquidPoolsFirstHopFilter,
    //         mostLiquidPoolsSecondHopFilter,
    //     ] = sor.sortPoolsMostLiquid(
    //         tokenIn,
    //         tokenOut,
    //         hopTokensFilter,
    //         poolsTokenIn,
    //         poolsTokenOut
    //     );

    //     assert.equal(hopTokensFilter.length, 2, 'Should have 2 hop tokens.');
    //     assert.equal(
    //         mostLiquidPoolsFirstHopFilter.length,
    //         2,
    //         'Should have 2 first hop pools.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsSecondHopFilter.length,
    //         2,
    //         'Should have 2 second hop pools.'
    //     );
    //     assert.equal(
    //         hopTokensFilter[0],
    //         '0x0000000000085d4780b73119b644ae5ecd22b376',
    //         'Token Addresses should match.'
    //     );
    //     assert.equal(
    //         hopTokensFilter[1],
    //         '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //         'Token Addresses should match.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsFirstHopFilter[0].id,
    //         '0x0481d726c3d25250a8963221945ed93b8a5315a9',
    //         'Pool Addresses should match.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsFirstHopFilter[1].id,
    //         '0x0481d726c3d25250a8963221945ed93b8a5315a9',
    //         'Pool Addresses should match.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsSecondHopFilter[0].id,
    //         '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e',
    //         'Pool Addresses should match.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsSecondHopFilter[1].id,
    //         '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e',
    //         'Pool Addresses should match.'
    //     );

    //     // Finds the possible paths to make the swap
    //     let pathArray: Path[];
    //     let pools: SubGraphPoolDictionary;
    //     [pools, pathArray] = sor.parsePoolData(
    //         directPools,
    //         tokenIn,
    //         tokenOut,
    //         mostLiquidPoolsFirstHopFilter,
    //         mostLiquidPoolsSecondHopFilter,
    //         hopTokensFilter
    //     );

    //     assert.equal(pathArray.length, 2);
    //     assert.equal(Object.keys(pools).length, 2);
    //     assert.equal(pathArray[0].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(pathArray[1].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');

    //     let paths: Path[];
    //     let maxLiquidityAvailable: BigNumber;

    //     [paths, maxLiquidityAvailable] = sor.processPaths(
    //         pathArray,
    //         pools,
    //         'swapExactIn'
    //     );

    //     assert.equal(maxLiquidityAvailable.toString(), '999.999999999998');
    //     assert.equal(paths.length, 2);
    //     assert.equal(paths[0].limitAmount.toString(), '499.999999999999');
    //     assert.equal(paths[1].limitAmount.toString(), '499.999999999999');

    //     let swapAmount = new BigNumber('1');
    //     let swaps: Swap[][], returnAmount: BigNumber;
    //     [swaps, returnAmount] = sor.smartOrderRouter(
    //         JSON.parse(JSON.stringify(pools)),
    //         paths,
    //         'swapExactIn',
    //         swapAmount,
    //         4,
    //         new BigNumber(0)
    //     );

    //     assert.equal(returnAmount.toString(), '0.979134514480936');
    //     assert.equal(swaps.length, 2);
    //     assert.equal(swaps[0][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
    //     assert.equal(swaps[0][0].swapAmount, '0.500000000000022424');
    //     assert.equal(swaps[0][0].tokenIn, tokenIn);
    //     assert.equal(swaps[0][0].tokenOut, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    //     assert.equal(swaps[0][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(swaps[0][1].swapAmount, '0.49475509621737');
    //     assert.equal(swaps[0][1].tokenIn, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    //     assert.equal(swaps[0][1].tokenOut, tokenOut);
    //     assert.equal(swaps[1][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
    //     assert.equal(swaps[1][0].swapAmount, '0.499999999999977576');
    //     assert.equal(swaps[1][0].tokenIn, tokenIn);
    //     assert.equal(swaps[1][0].tokenOut, '0x0000000000085d4780b73119b644ae5ecd22b376');
    //     assert.equal(swaps[1][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(swaps[1][1].swapAmount, '0.494754097206633');
    //     assert.equal(swaps[1][1].tokenIn, '0x0000000000085d4780b73119b644ae5ecd22b376');
    //     assert.equal(swaps[1][1].tokenOut, tokenOut);
    // });

    // it('Test pool class that has two multihop paths, swapExactIn', async () => {
    //     const testPools = JSON.parse(JSON.stringify(allPools)).pathTestPoolTwoMultiHops;
    //     let tokenIn = USDC;
    //     let tokenOut = DAI;
    //     let hopTokens: string[];
    //     let poolsOfInterestDictionary: PoolDictionary;
    //     let pathData: NewPath[];

    //     [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
    //         testPools,
    //         tokenIn,
    //         tokenOut,
    //         4
    //     );

    //     const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(poolsOfInterestDictionary);

    //     assert.equal(hopTokens.length, 2);
    //     assert.equal(Object.keys(poolsOfInterestDictionary).length, 2); // 4 paths using two pools.
    //     assert.equal(noDirect, 0);
    //     assert.equal(noHopIn, 1);
    //     assert.equal(noHopOut, 1);

    //     [poolsOfInterestDictionary, pathData] = filterHopPools(
    //         tokenIn,
    //         tokenOut,
    //         hopTokens,
    //         poolsOfInterestDictionary
    //     );

    //     assert.equal(pathData.length, 2);
    //     assert.equal(Object.keys(poolsOfInterestDictionary).length, 2);
    //     assert.equal(pathData[0].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(pathData[1].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');

    //     let paths: NewPath[];
    //     let maxLiquidityAvailable: BigNumber;
    //     [paths, maxLiquidityAvailable] = calculatePathLimits(pathData, SwapTypes.SwapExactIn);

    //     assert.equal(maxLiquidityAvailable.toString(), '999.999999999998');
    //     assert.equal(paths.length, 2);
    //     assert.equal(paths[0].limitAmount.toString(), '499.999999999999');
    //     assert.equal(paths[1].limitAmount.toString(), '499.999999999999');

    //     let swaps: any, total: BigNumber, marketSp: BigNumber;
    //     [swaps, total, marketSp] = smartOrderRouter(
    //         JSON.parse(JSON.stringify(poolsOfInterestDictionary)), // Need to keep original pools for cache
    //         paths,
    //         SwapTypes.SwapExactIn,
    //         new BigNumber(1),
    //         4,
    //         new BigNumber(0)
    //     );

    //     assert.equal(total.toString(), '0.979134514480936');
    //     assert.equal(swaps.length, 2);
    //     assert.equal(swaps[0][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
    //     assert.equal(swaps[0][0].swapAmount, '0.500000000000022424');
    //     assert.equal(swaps[0][0].tokenIn, tokenIn);
    //     assert.equal(swaps[0][0].tokenOut, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    //     assert.equal(swaps[0][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(swaps[0][1].swapAmount, '0.49475509621737');
    //     assert.equal(swaps[0][1].tokenIn, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    //     assert.equal(swaps[0][1].tokenOut, tokenOut);
    //     assert.equal(swaps[1][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
    //     assert.equal(swaps[1][0].swapAmount, '0.499999999999977576');
    //     assert.equal(swaps[1][0].tokenIn, tokenIn);
    //     assert.equal(swaps[1][0].tokenOut, '0x0000000000085d4780b73119b644ae5ecd22b376');
    //     assert.equal(swaps[1][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(swaps[1][1].swapAmount, '0.494754097206633');
    //     assert.equal(swaps[1][1].tokenIn, '0x0000000000085d4780b73119b644ae5ecd22b376');
    //     assert.equal(swaps[1][1].tokenOut, tokenOut);
    // });

    // it('Test pool that has two multhop paths, swapExactOut', async () => {
    //     const testPools = JSON.parse(JSON.stringify(allPools)).pathTestPoolTwoMultiHops;
    //     let tokenIn = USDC;
    //     let tokenOut = DAI;

    //     let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
    //     [
    //         directPools,
    //         hopTokensFilter,
    //         poolsTokenIn,
    //         poolsTokenOut,
    //     ] = sor.filterPools(testPools, tokenIn, tokenOut, 4);

    //     assert.equal(Object.keys(poolsTokenIn).length, 1, 'PoolsTokenIn');
    //     assert.equal(Object.keys(poolsTokenOut).length, 1, 'PoolsTokenOut');
    //     assert.equal(Object.keys(directPools).length, 0, 'Direct');

    //     let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
    //     [
    //         mostLiquidPoolsFirstHopFilter,
    //         mostLiquidPoolsSecondHopFilter,
    //     ] = sor.sortPoolsMostLiquid(
    //         tokenIn,
    //         tokenOut,
    //         hopTokensFilter,
    //         poolsTokenIn,
    //         poolsTokenOut
    //     );

    //     assert.equal(hopTokensFilter.length, 2, 'Should have 2 hop tokens.');
    //     assert.equal(
    //         mostLiquidPoolsFirstHopFilter.length,
    //         2,
    //         'Should have 2 first hop pools.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsSecondHopFilter.length,
    //         2,
    //         'Should have 2 second hop pools.'
    //     );
    //     assert.equal(
    //         hopTokensFilter[0],
    //         '0x0000000000085d4780b73119b644ae5ecd22b376',
    //         'Token Addresses should match.'
    //     );
    //     assert.equal(
    //         hopTokensFilter[1],
    //         '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //         'Token Addresses should match.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsFirstHopFilter[0].id,
    //         '0x0481d726c3d25250a8963221945ed93b8a5315a9',
    //         'Pool Addresses should match.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsFirstHopFilter[1].id,
    //         '0x0481d726c3d25250a8963221945ed93b8a5315a9',
    //         'Pool Addresses should match.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsSecondHopFilter[0].id,
    //         '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e',
    //         'Pool Addresses should match.'
    //     );
    //     assert.equal(
    //         mostLiquidPoolsSecondHopFilter[1].id,
    //         '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e',
    //         'Pool Addresses should match.'
    //     );

    //     // Finds the possible paths to make the swap
    //     let pathArray: Path[];
    //     let pools: SubGraphPoolDictionary;
    //     [pools, pathArray] = sor.parsePoolData(
    //         directPools,
    //         tokenIn,
    //         tokenOut,
    //         mostLiquidPoolsFirstHopFilter,
    //         mostLiquidPoolsSecondHopFilter,
    //         hopTokensFilter
    //     );

    //     assert.equal(pathArray.length, 2);
    //     assert.equal(Object.keys(pools).length, 2);
    //     assert.equal(pathArray[0].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(pathArray[1].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');

    //     let paths: Path[];
    //     let maxLiquidityAvailable: BigNumber;

    //     [paths, maxLiquidityAvailable] = sor.processPaths(
    //         pathArray,
    //         pools,
    //         'swapExactOut'
    //     );

    //     assert.equal(maxLiquidityAvailable.toString(), '496.2406015037588');
    //     assert.equal(paths.length, 2);
    //     assert.equal(paths[0].limitAmount.toString(), '248.1203007518794');
    //     assert.equal(paths[1].limitAmount.toString(), '248.1203007518794');

    //     let swapAmount = new BigNumber('1');
    //     let swaps: Swap[][], returnAmount: BigNumber;
    //     [swaps, returnAmount] = sor.smartOrderRouter(
    //         JSON.parse(JSON.stringify(pools)),
    //         paths,
    //         'swapExactOut',
    //         swapAmount,
    //         4,
    //         new BigNumber(0)
    //     );

    //     assert.equal(returnAmount.toString(), '1.021332');
    //     assert.equal(swaps.length, 2);
    //     assert.equal(swaps[0][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
    //     assert.equal(swaps[0][0].swapAmount, '0.505303156638908081');
    //     assert.equal(swaps[0][0].tokenIn, tokenIn);
    //     assert.equal(swaps[0][0].tokenOut, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    //     assert.equal(swaps[0][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(swaps[0][1].swapAmount, '0.499999999999981612');
    //     assert.equal(swaps[0][1].tokenIn, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    //     assert.equal(swaps[0][1].tokenOut, tokenOut);
    //     assert.equal(swaps[1][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
    //     assert.equal(swaps[1][0].swapAmount, '0.505303156638945455');
    //     assert.equal(swaps[1][0].tokenIn, tokenIn);
    //     assert.equal(swaps[1][0].tokenOut, '0x0000000000085d4780b73119b644ae5ecd22b376');
    //     assert.equal(swaps[1][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(swaps[1][1].swapAmount, '0.500000000000018388');
    //     assert.equal(swaps[1][1].tokenIn, '0x0000000000085d4780b73119b644ae5ecd22b376');
    //     assert.equal(swaps[1][1].tokenOut, tokenOut);
    // });

    // it('Test pool class that has two multihop paths, swapExactOut', async () => {
    //     const testPools = JSON.parse(JSON.stringify(allPools)).pathTestPoolTwoMultiHops;
    //     let tokenIn = USDC;
    //     let tokenOut = DAI;
    //     let hopTokens: string[];
    //     let poolsOfInterestDictionary: PoolDictionary;
    //     let pathData: NewPath[];

    //     [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
    //         testPools,
    //         tokenIn,
    //         tokenOut,
    //         4
    //     );

    //     const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(poolsOfInterestDictionary);

    //     assert.equal(hopTokens.length, 2);
    //     assert.equal(Object.keys(poolsOfInterestDictionary).length, 2); // 4 paths using two pools.
    //     assert.equal(noDirect, 0);
    //     assert.equal(noHopIn, 1);
    //     assert.equal(noHopOut, 1);

    //     [poolsOfInterestDictionary, pathData] = filterHopPools(
    //         tokenIn,
    //         tokenOut,
    //         hopTokens,
    //         poolsOfInterestDictionary
    //     );

    //     assert.equal(pathData.length, 2);
    //     assert.equal(Object.keys(poolsOfInterestDictionary).length, 2);
    //     assert.equal(pathData[0].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(pathData[1].id, '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');

    //     let paths: NewPath[];
    //     let maxLiquidityAvailable: BigNumber;
    //     [paths, maxLiquidityAvailable] = calculatePathLimits(pathData, SwapTypes.SwapExactOut);

    //     assert.equal(maxLiquidityAvailable.toString(), '496.2406015037588');
    //     assert.equal(paths.length, 2);
    //     assert.equal(paths[0].limitAmount.toString(), '248.1203007518794');
    //     assert.equal(paths[1].limitAmount.toString(), '248.1203007518794');

    //     let swaps: any, total: BigNumber, marketSp: BigNumber;
    //     [swaps, total, marketSp] = smartOrderRouter(
    //         JSON.parse(JSON.stringify(poolsOfInterestDictionary)), // Need to keep original pools for cache
    //         paths,
    //         SwapTypes.SwapExactOut,
    //         new BigNumber(1),
    //         4,
    //         new BigNumber(0)
    //     );

    //     assert.equal(total.toString(), '1.021332');
    //     assert.equal(swaps.length, 2);
    //     assert.equal(swaps[0][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
    //     assert.equal(swaps[0][0].swapAmount, '0.505303156638908081');
    //     assert.equal(swaps[0][0].tokenIn, tokenIn);
    //     assert.equal(swaps[0][0].tokenOut, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    //     assert.equal(swaps[0][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(swaps[0][1].swapAmount, '0.499999999999981612');
    //     assert.equal(swaps[0][1].tokenIn, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2');
    //     assert.equal(swaps[0][1].tokenOut, tokenOut);
    //     assert.equal(swaps[1][0].pool, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
    //     assert.equal(swaps[1][0].swapAmount, '0.505303156638945455');
    //     assert.equal(swaps[1][0].tokenIn, tokenIn);
    //     assert.equal(swaps[1][0].tokenOut, '0x0000000000085d4780b73119b644ae5ecd22b376');
    //     assert.equal(swaps[1][1].pool, '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e');
    //     assert.equal(swaps[1][1].swapAmount, '0.500000000000018388');
    //     assert.equal(swaps[1][1].tokenIn, '0x0000000000085d4780b73119b644ae5ecd22b376');
    //     assert.equal(swaps[1][1].tokenOut, tokenOut);
    // });
});
