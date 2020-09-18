// Tests Multihop SOR vs static allPools.json file.
// Includes timing data.
import { assert } from 'chai';
import 'mocha';
import {
    formatAndFilterPools,
    filterPools,
} from './testScripts/utils/subgraph';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');
const allPools = require('./allPools.json');
import { BONE, scale } from '../src/bmath';
const disabledTokens = require('./disabled-tokens.json');

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI lower case
const ANT = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT lower case
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC lower case
const MKR = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR lower case
const OCEAN = '0x985dd3d42de1e256d09e1c10f112bccb8015ad41';

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

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
        console.time('filterPoolsWithTokensDirect');
        const directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );
        console.timeEnd('filterPoolsWithTokensDirect');
        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should have 0 direct pools'
        );
    });

    it('filterPoolsWithTokensDirect - WETH/DAI Pools', async () => {
        console.time('filterPoolsWithTokensDirect');
        let directPools = sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );
        console.timeEnd('filterPoolsWithTokensDirect');
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
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
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

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            DAI.toLowerCase(),
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

        assert.equal(swaps.length, 3, 'Should have 3 swaps.');
        assert.equal(
            swaps[0][0].pool,
            '0x1b09173a0ffbad1cb7670b1a640013c0facfb71f',
            'First swap pool should match'
        );
        assert.equal(
            swaps[2][0].swapAmount,
            '234006959988124',
            'Swap Amount Should Match'
        );

        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '202.860557251722913901',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>DAI, swapExactOut', async () => {
        const amountOut = new BigNumber(1000).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            WETH,
            DAI,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            DAI.toLowerCase(),
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

        assert.equal(swaps.length, 4, 'Should have 4 swaps.');
        // ADD SWAP CHECK
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '4.978956703358553061',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, DAI>ANT, swapExactIn - No Disabled Tokens, should have swap', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            DAI,
            ANT,
            { isOverRide: true, disabledTokens: [] }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            DAI,
            ANT,
            { isOverRide: true, disabledTokens: [] }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            DAI.toLowerCase(), // TODO - Why is this required????
            ANT.toLowerCase(),
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 1, 'Should have 1 swaps.');
        assert.equal(
            swaps[0][0].pool,
            '0xf218fe414c6b1c6b42e79b7690f1509a634baad6'
        );
        assert.equal(swaps[0][0].tokenIn, DAI);
        assert.equal(swaps[0][0].tokenOut, OCEAN);
        assert.equal(
            swaps[0][1].pool,
            '0xf218fe414c6b1c6b42e79b7690f1509a634baad7'
        );
        assert.equal(swaps[0][1].tokenIn, OCEAN);
        assert.equal(swaps[0][1].tokenOut, ANT);
    });

    it('Full Multihop SOR, DAI>ANT, swapExactIn - Disabled Tokens, should not have swap', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            DAI,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            DAI,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            DAI.toLowerCase(), // TODO - Why is this required????
            ANT.toLowerCase(),
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>ANT, swapExactIn', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        const swapType = 'swapExactIn';
        const noPools = 4;

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            WETH,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            ANT.toLowerCase(),
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>ANT, swapExactOut', async () => {
        const amountOut = new BigNumber(1000).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;

        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            WETH,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            WETH,
            ANT,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            ANT.toLowerCase(),
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, USDC>MKR, swapExactIn', async () => {
        const amountIn = new BigNumber('1000000'); // 1 USDC
        const swapType = 'swapExactIn';
        const noPools = 4;

        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            USDC,
            MKR,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            USDC,
            MKR,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            USDC.toLowerCase(), // TODO - Why is this required????
            MKR.toLowerCase(),
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );

        assert.equal(swaps.length, 2, 'Should have 2 swaps.');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.002932410291658511',
            'Total Out Should Match'
        );
        assert.equal(swaps[0][0].swapAmount, '798830');
        assert.equal(swaps[0][1].swapAmount, '207514052940821332');
        assert.equal(swaps[1][0].swapAmount, '201170');
        assert.equal(swaps[1][1].swapAmount, '990925483230944');
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.002932410291658511',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, USDC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(10).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;

        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            USDC,
            MKR,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            USDC,
            MKR,
            { isOverRide: true, disabledTokens: disabledTokens.tokens }
        );

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            USDC.toLowerCase(), // TODO - Why is this required????
            MKR.toLowerCase(),
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 2, 'Should have 2 swaps.');
        assert.equal(swaps[0][0].swapAmount, '12780750179338124102');
        assert.equal(swaps[0][1].swapAmount, '7539149984464375031');
        assert.equal(swaps[1][0].swapAmount, '855409191664291961834');
        assert.equal(swaps[1][1].swapAmount, '2460850015535624969');
        assert.equal(
            swaps[0][0].limitReturnAmount,
            '115792089237316195423570985008687907853269984665640564039457584007913129639935'
        );
        assert.equal(
            swaps[1][1].maxPrice,
            '115792089237316195423570985008687907853269984665640564039457584007913129639935'
        );
        assert.equal(
            utils.formatEther(totalReturnWei.toString()),
            '0.000000003559698325',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, Should still complete multihop with disabled token pool', async () => {
        const amountOut = new BigNumber(10).times(BONE);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a1';
        const tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a4';

        const allPoolsReturned = allPools;
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
            tokenIn,
            tokenOut,
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(swaps.length, 1, 'Should have 1 swaps.');
        assert.equal(
            swaps[0][0].pool,
            '0xf218fe414c6b1c6b42e79b7690f1509a634baad9'
        );
        assert.equal(swaps[0][0].tokenIn, tokenIn);
        assert.equal(
            swaps[0][0].tokenOut,
            '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a3'
        );
        assert.equal(
            swaps[0][1].pool,
            '0xf218fe414c6b1c6b42e79b7690f1509a634baad0'
        );
        assert.equal(
            swaps[0][1].tokenIn,
            '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a3'
        );
        assert.equal(swaps[0][1].tokenOut, tokenOut);
    });
});
