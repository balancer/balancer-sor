// Tests Multihop SOR vs static allPools.json file.
// Includes timing data.
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');
const allPools = require('./allPools.json');
import { BONE } from '../src/bmath';

// const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case

// const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI lower case
const ANT = '0x960b236A07cf122663c4303350609A66A7B288C0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2';

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

// Added by Fernando
var Set2 = require('jsclass/src/set').Set;
var allPoolsSET = new Set2();
var allPoolsNonZeroBalances = [];

describe('Tests Multihop SOR vs static allPools.json', () => {
    it('Saved pool check', async () => {
        // Uses saved pools @25/05/20.
        assert.equal(allPools.pools.length, 59, 'Should be 59 pools');

        for (var i = allPools.pools.length - 1; i >= 0; i--) {
            var poolSet = new Set2(allPools.pools[i].tokensList);

            // console.log(allPools.pools[i].tokensList)
            // console.log(poolSet)
            allPoolsSET.add(poolSet);

            // Build list of non-zero balance pools
            // Only check first balance since AFAIK either all balances are zero or none are:

            // if(allPools.pools[i]["tokens"][0]["balance"] != "0")
            // console.log("allPools.pools[i].tokens[0].balance")
            // console.log(allPools.pools[i].tokens[0].balance)
            if (allPools.pools[i].tokens.length != 0)
                if (allPools.pools[i].tokens[0].balance != '0')
                    allPoolsNonZeroBalances.push(allPools.pools[i]);
        }
        // console.log(allPoolsSET)
    });

    it('getTokenPairsMultiHop - Should return direct & multihop partner tokens', async () => {
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call

        console.time('getTokenPairsMultiHop');
        let [directTokenPairs, allTokenPairs] = sor.getTokenPairsMultiHop(
            DAI,
            allPoolsReturned.pools
        );
        console.timeEnd('getTokenPairsMultiHop');

        assert.equal(
            directTokenPairs.length,
            18,
            'Should have 18 direct tokens'
        );
        assert.equal(allTokenPairs.length, 39, 'Should be 39 multi-hop tokens');
    });

    it('SET - getTokenPairsMultiHopSET - Should return direct & multihop partner tokens', async () => {
        console.time('getTokenPairsMultiHopSET');
        let [
            directTokenPairsSET,
            allTokenPairsSET,
        ] = sor.getTokenPairsMultiHopSET(DAI, allPoolsSET);
        console.timeEnd('getTokenPairsMultiHopSET');

        assert.equal(
            directTokenPairsSET.length,
            18,
            'Should have 18 direct tokens'
        );
        assert.equal(
            allTokenPairsSET.length,
            39,
            'Should be 39 multi-hop tokens'
        );
    });

    it('filterPoolsWithTokensDirect - WETH/ANT Pools', async () => {
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        console.time('filterPoolsWithTokensDirect');
        const directPools = sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            WETH,
            ANT
        );
        console.timeEnd('filterPoolsWithTokensDirect');
        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should have 0 direct pools'
        );
    });

    it('SET - filterPoolsWithTokensDirectSET - WETH/ANT Pools', async () => {
        console.time('filterPoolsWithTokensDirectSET');
        const directPools = sor.filterPoolsWithTokensDirectSET(
            allPoolsNonZeroBalances,
            WETH,
            ANT
        );
        console.timeEnd('filterPoolsWithTokensDirectSET');
        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should have 0 direct pools'
        );
    });

    it('filterPoolsWithTokensDirect - WETH/DAI Pools', async () => {
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        console.time('filterPoolsWithTokensDirect');
        let directPools = sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            WETH,
            DAI
        );
        console.timeEnd('filterPoolsWithTokensDirect');
        assert.equal(
            Object.keys(directPools).length,
            10,
            'Should have 10 direct pools'
        );
        directPools = sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            DAI,
            WETH
        );
        assert.equal(
            Object.keys(directPools).length,
            10,
            'Should have 10 direct pools'
        );
    });

    it('SET - filterPoolsWithTokensDirectSET - WETH/DAI Pools', async () => {
        console.time('filterPoolsWithTokensDirectSET');
        let directPools = sor.filterPoolsWithTokensDirectSET(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );
        console.timeEnd('filterPoolsWithTokensDirectSET');
        assert.equal(
            Object.keys(directPools).length,
            10,
            'Should have 10 direct pools'
        );
        directPools = sor.filterPoolsWithTokensDirectSET(
            allPoolsNonZeroBalances,
            DAI,
            WETH
        );
        assert.equal(
            Object.keys(directPools).length,
            10,
            'Should have 10 direct pools'
        );
    });

    it('Get multihop pools - WETH>DAI', async () => {
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call

        console.time('filterPoolsWithTokensMultihop');
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            WETH,
            DAI
        );
        console.timeEnd('filterPoolsWithTokensMultihop');

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            WETH,
            DAI
        );

        console.time('parsePoolData');
        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH,
            DAI,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );
        console.timeEnd('parsePoolData');

        // console.log("poolsOLD")
        // console.log(pools)

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

    it('SET - Get multihop pools - WETH>DAI', async () => {
        console.time('filterPoolsWithTokensMultihopSET');
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihopSET(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );
        console.timeEnd('filterPoolsWithTokensMultihopSET');

        const directPools = await sor.filterPoolsWithTokensDirectSET(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );

        console.time('parsePoolData');
        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            WETH,
            DAI,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );
        console.timeEnd('parsePoolData');

        // console.log("poolsSET")
        // console.log(pools)

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
        console.time('FullMultiHopExactIn');
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            WETH,
            DAI
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            WETH,
            DAI
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

        console.time('smartOrderRouterMultiHop');
        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            JSON.parse(JSON.stringify(pools)),
            pathData,
            'swapExactIn',
            amountIn,
            4,
            new BigNumber(0)
        );
        console.timeEnd('smartOrderRouterMultiHop');

        console.timeEnd('FullMultiHopExactIn');

        assert.equal(sorSwaps.length, 3, 'Should have 3 swaps.');
        // ADD SWAP CHECK
        assert.equal(
            utils.formatEther(totalReturn.toString()),
            '202.860557251722913901',
            'Total Out Should Match'
        );
    });

    it('SET - Full Multihop SOR, WETH>DAI, swapExactIn', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        console.time('FullMultiHopExactInSET');
        // const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirectSET(
            allPoolsNonZeroBalances,
            WETH,
            DAI
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihopSET(
            allPoolsNonZeroBalances,
            WETH,
            DAI
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

        console.time('smartOrderRouterMultiHopSET');
        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            JSON.parse(JSON.stringify(pools)),
            pathData,
            'swapExactIn',
            amountIn,
            4,
            new BigNumber(0)
        );
        console.timeEnd('smartOrderRouterMultiHopSET');

        console.timeEnd('FullMultiHopExactInSET');

        assert.equal(sorSwaps.length, 3, 'Should have 3 swaps.');
        // ADD SWAP CHECK
        assert.equal(
            utils.formatEther(totalReturn.toString()),
            '202.860557251722913901',
            'Total Out Should Match'
        );
    });

    // it('Full Multihop SOR, WETH>DAI, swapExactOut', async () => {
    //     const amountOut = new BigNumber(1000).times(BONE);
    //     console.time('FullMultiHopExactOut');

    //     const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
    //     const directPools = await sor.filterPoolsWithTokensDirect(
    //         allPoolsReturned,
    //         WETH,
    //         DAI
    //     );

    //     let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    //     [
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens,
    //     ] = await sor.filterPoolsWithTokensMultihop(
    //         allPoolsReturned,
    //         WETH,
    //         DAI
    //     );

    //     let pools, pathData;
    //     [pools, pathData] = sor.parsePoolData(
    //         directPools,
    //         WETH.toLowerCase(), // TODO - Why is this required????
    //         DAI.toLowerCase(),
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens
    //     );

    //     const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
    //         JSON.parse(JSON.stringify(pools)),
    //         pathData,
    //         'swapExactOut',
    //         amountOut,
    //         4,
    //         new BigNumber(0)
    //     );
    //     console.timeEnd('FullMultiHopExactOut');

    //     assert.equal(sorSwaps.length, 4, 'Should have 4 swaps.');
    //     // ADD SWAP CHECK
    //     assert.equal(
    //         utils.formatEther(totalReturn.toString()),
    //         '4.978956703358553061',
    //         'Total Out Should Match'
    //     );
    // });

    // it('Full Multihop SOR, WETH>ANT, swapExactIn', async () => {
    //     const amountIn = new BigNumber(1).times(BONE);
    //     console.time('FullMultiHopExactIn');
    //     const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
    //     const directPools = await sor.filterPoolsWithTokensDirect(
    //         allPoolsReturned,
    //         WETH,
    //         ANT
    //     );

    //     let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    //     [
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens,
    //     ] = await sor.filterPoolsWithTokensMultihop(
    //         allPoolsReturned,
    //         WETH,
    //         ANT
    //     );

    //     let pools, pathData;
    //     [pools, pathData] = sor.parsePoolData(
    //         directPools,
    //         WETH.toLowerCase(), // TODO - Why is this required????
    //         ANT.toLowerCase(),
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens
    //     );

    //     console.time('smartOrderRouterMultiHop');
    //     const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
    //         JSON.parse(JSON.stringify(pools)),
    //         pathData,
    //         'swapExactIn',
    //         amountIn,
    //         4,
    //         new BigNumber(0)
    //     );
    //     console.timeEnd('smartOrderRouterMultiHop');

    //     console.timeEnd('FullMultiHopExactIn');

    //     assert.equal(
    //         Object.keys(directPools).length,
    //         0,
    //         'Should be no direct pools.'
    //     );
    //     assert.equal(sorSwaps.length, 0, 'Should have 0 swaps.');
    //     assert.equal(
    //         utils.formatEther(totalReturn.toString()),
    //         '0.0',
    //         'Total Out Should Match'
    //     );
    // });

    // it('Full Multihop SOR, WETH>ANT, swapExactOut', async () => {
    //     const amountOut = new BigNumber(1000).times(BONE);

    //     console.time('FullMultiHopExactOut');
    //     const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
    //     const directPools = await sor.filterPoolsWithTokensDirect(
    //         allPoolsReturned,
    //         WETH,
    //         ANT
    //     );

    //     let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    //     [
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens,
    //     ] = await sor.filterPoolsWithTokensMultihop(
    //         allPoolsReturned,
    //         WETH,
    //         ANT
    //     );

    //     let pools, pathData;
    //     [pools, pathData] = sor.parsePoolData(
    //         directPools,
    //         WETH.toLowerCase(), // TODO - Why is this required????
    //         ANT.toLowerCase(),
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens
    //     );

    //     console.time('smartOrderRouterMultiHop');
    //     const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
    //         JSON.parse(JSON.stringify(pools)),
    //         pathData,
    //         'swapExactOut',
    //         amountOut,
    //         4,
    //         new BigNumber(0)
    //     );
    //     console.timeEnd('smartOrderRouterMultiHop');

    //     console.timeEnd('FullMultiHopExactOut');

    //     assert.equal(
    //         Object.keys(directPools).length,
    //         0,
    //         'Should be no direct pools.'
    //     );
    //     assert.equal(sorSwaps.length, 0, 'Should have 0 swaps.');
    //     assert.equal(
    //         utils.formatEther(totalReturn.toString()),
    //         '0.0',
    //         'Total Out Should Match'
    //     );
    // });

    // it('Full Multihop SOR, USDC>MKR, swapExactIn', async () => {
    //     const amountIn = new BigNumber('1000000'); // 1 USDC

    //     console.time('FullMultiHopExactIn');
    //     const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
    //     const directPools = await sor.filterPoolsWithTokensDirect(
    //         allPoolsReturned,
    //         USDC,
    //         MKR
    //     );

    //     let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    //     [
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens,
    //     ] = await sor.filterPoolsWithTokensMultihop(
    //         allPoolsReturned,
    //         USDC,
    //         MKR
    //     );

    //     let pools, pathData;
    //     [pools, pathData] = sor.parsePoolData(
    //         directPools,
    //         USDC.toLowerCase(), // TODO - Why is this required????
    //         MKR.toLowerCase(),
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens
    //     );

    //     console.time('smartOrderRouterMultiHop');
    //     const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
    //         JSON.parse(JSON.stringify(pools)),
    //         pathData,
    //         'swapExactIn',
    //         amountIn,
    //         4,
    //         new BigNumber(0)
    //     );
    //     console.timeEnd('smartOrderRouterMultiHop');
    //     console.timeEnd('FullMultiHopExactIn');

    //     assert.equal(
    //         Object.keys(directPools).length,
    //         0,
    //         'Should be no direct pools.'
    //     );
    //     assert.equal(sorSwaps.length, 2, 'Should have 2 swaps.');
    //     assert.equal(
    //         utils.formatEther(totalReturn.toString()),
    //         '0.002932410291658511',
    //         'Total Out Should Match'
    //     );
    // });

    // it('Full Multihop SOR, USDC>MKR, swapExactOut', async () => {
    //     const amountOut = new BigNumber(10).times(BONE);

    //     console.time('FullMultiHopExactOut');
    //     const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
    //     const directPools = await sor.filterPoolsWithTokensDirect(
    //         allPoolsReturned,
    //         USDC,
    //         MKR
    //     );

    //     let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    //     [
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens,
    //     ] = await sor.filterPoolsWithTokensMultihop(
    //         allPoolsReturned,
    //         USDC,
    //         MKR
    //     );

    //     let pools, pathData;
    //     [pools, pathData] = sor.parsePoolData(
    //         directPools,
    //         USDC.toLowerCase(), // TODO - Why is this required????
    //         MKR.toLowerCase(),
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens
    //     );

    //     console.time('smartOrderRouterMultiHop');
    //     const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
    //         JSON.parse(JSON.stringify(pools)),
    //         pathData,
    //         'swapExactOut',
    //         amountOut,
    //         4,
    //         new BigNumber(0)
    //     );
    //     console.timeEnd('smartOrderRouterMultiHop');
    //     console.timeEnd('FullMultiHopExactOut');

    //     assert.equal(
    //         Object.keys(directPools).length,
    //         0,
    //         'Should be no direct pools.'
    //     );
    //     assert.equal(sorSwaps.length, 2, 'Should have 2 swaps.');
    //     assert.equal(
    //         utils.formatEther(totalReturn.toString()),
    //         '0.000000003559698325',
    //         'Total Out Should Match'
    //     );
    // });

    // it('Full Multihop SOR, USDC>MKR, swapExactIn, EPS of interest version should be quicker', async () => {
    //     const amountIn = new BigNumber('1000000'); // 1 USDC

    //     const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
    //     const directPools = await sor.filterPoolsWithTokensDirect(
    //         allPoolsReturned,
    //         USDC,
    //         MKR
    //     );

    //     let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    //     [
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens,
    //     ] = await sor.filterPoolsWithTokensMultihop(
    //         allPoolsReturned,
    //         USDC,
    //         MKR
    //     );

    //     let pools, pathData;
    //     [pools, pathData] = sor.parsePoolData(
    //         directPools,
    //         USDC.toLowerCase(), // TODO - Why is this required????
    //         MKR.toLowerCase(),
    //         mostLiquidPoolsFirstHop,
    //         mostLiquidPoolsSecondHop,
    //         hopTokens
    //     );

    //     let sorSwaps, totalReturn;
    //     console.time('smartOrderRouterMultiHopx100');
    //     const mhTimeStart = process.hrtime.bigint();
    //     for (var i = 0; i < 100; i++) {
    //         [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
    //             JSON.parse(JSON.stringify(pools)),
    //             pathData,
    //             'swapExactIn',
    //             amountIn,
    //             4,
    //             new BigNumber(0)
    //         );
    //     }
    //     const mhTimeStop = process.hrtime.bigint();
    //     console.timeEnd('smartOrderRouterMultiHopx100');

    //     assert.equal(
    //         Object.keys(directPools).length,
    //         0,
    //         'Should be no direct pools.'
    //     );
    //     assert.equal(sorSwaps.length, 2, 'Should have 2 swaps.');
    //     assert.equal(
    //         utils.formatEther(totalReturn.toString()),
    //         '0.002932410291658511',
    //         'Total Out Should Match'
    //     );

    //     let paths = sor.processPaths(pathData, pools, 'swapExactIn');
    //     let epsOfInterest = sor.processEpsOfInterestMultiHop(
    //         paths,
    //         'swapExactIn'
    //     );

    //     let sorSwapsEps, totalReturnEps;
    //     const mhTimeEpsStart = process.hrtime.bigint();
    //     console.time('smartOrderRouterMultiHopEpsx100');
    //     for (var i = 0; i < 100; i++) {
    //         [
    //             sorSwapsEps,
    //             totalReturnEps,
    //         ] = sor.smartOrderRouterMultiHopEpsOfInterest(
    //             JSON.parse(JSON.stringify(pools)),
    //             paths,
    //             'swapExactIn',
    //             amountIn,
    //             4,
    //             new BigNumber(0),
    //             epsOfInterest
    //         );
    //     }
    //     let t = console.timeEnd('smartOrderRouterMultiHopEpsx100');
    //     let mhTimeEpsStop = process.hrtime.bigint();
    //     console.log(`Old ${mhTimeStop - mhTimeStart} nanoseconds`);
    //     console.log(`New ${mhTimeEpsStop - mhTimeEpsStart} nanoseconds`);

    //     assert.equal(
    //         totalReturnEps.toString(),
    //         totalReturn.toString(),
    //         'Returns should be same.'
    //     );
    //     expect(sorSwapsEps).to.eql(sorSwaps);
    //     assert(
    //         mhTimeStop - mhTimeStart > mhTimeEpsStop - mhTimeEpsStart,
    //         'New method should be faster'
    //     );
    // }).timeout(30000);
});
