// Tests Multihop SOR vs static allPools.json file.
// Includes timing data.
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');
const allPools = require('./allPools.json');
import { Pool } from '../src/direct/types';
import { BONE, calcOutGivenIn, calcInGivenOut } from '../src/bmath';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
const ANT = '0x960b236A07cf122663c4303350609A66A7B288C0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2';

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

export function bnum(val: string | number): any {
    return new BigNumber(val.toString());
}

describe('Tests Multihop SOR vs static allPools.json', () => {
    it('getPools timer check', async () => {
        console.time('getPools');
        await sor.getAllPublicSwapPools();
        console.timeEnd('getPools');
    });

    it('Saved pool check', async () => {
        // Compares saved pools @25/05/20 to current Subgraph pools.
        //const sg = await sor.getAllPublicSwapPools();
        //expect(allPools).to.eql(sg)
        assert.equal(allPools.pools.length, 59, 'Should be 59 pools');
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

    it('Full Multihop SOR, WETH>DAI, swapExactOut', async () => {
        const amountOut = new BigNumber(1000).times(BONE);
        console.time('FullMultiHopExactOut');

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

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            JSON.parse(JSON.stringify(pools)),
            pathData,
            'swapExactOut',
            amountOut,
            4,
            new BigNumber(0)
        );
        console.timeEnd('FullMultiHopExactOut');

        assert.equal(sorSwaps.length, 4, 'Should have 4 swaps.');
        // ADD SWAP CHECK
        assert.equal(
            utils.formatEther(totalReturn.toString()),
            '4.978956703358553061',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>ANT, swapExactIn', async () => {
        const amountIn = new BigNumber(1).times(BONE);
        console.time('FullMultiHopExactIn');
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            WETH,
            ANT
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            WETH,
            ANT
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(sorSwaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalReturn.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, WETH>ANT, swapExactOut', async () => {
        const amountOut = new BigNumber(1000).times(BONE);

        console.time('FullMultiHopExactOut');
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            WETH,
            ANT
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            WETH,
            ANT
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

        console.time('smartOrderRouterMultiHop');
        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            JSON.parse(JSON.stringify(pools)),
            pathData,
            'swapExactOut',
            amountOut,
            4,
            new BigNumber(0)
        );
        console.timeEnd('smartOrderRouterMultiHop');

        console.timeEnd('FullMultiHopExactOut');

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(sorSwaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            utils.formatEther(totalReturn.toString()),
            '0.0',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, USDC>MKR, swapExactIn', async () => {
        const amountIn = new BigNumber('1000000'); // 1 USDC

        console.time('FullMultiHopExactIn');
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            USDC,
            MKR
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            USDC,
            MKR
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

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(sorSwaps.length, 2, 'Should have 2 swaps.');
        assert.equal(
            utils.formatEther(totalReturn.toString()),
            '0.002932410291658511',
            'Total Out Should Match'
        );
    });

    it('Full Multihop SOR, USDC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(10).times(BONE);

        console.time('FullMultiHopExactOut');
        const allPoolsReturned = allPools; // Replicated sor.getAllPublicSwapPools() call
        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsReturned,
            USDC,
            MKR
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            USDC,
            MKR
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

        console.time('smartOrderRouterMultiHop');
        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            JSON.parse(JSON.stringify(pools)),
            pathData,
            'swapExactOut',
            amountOut,
            4,
            new BigNumber(0)
        );
        console.timeEnd('smartOrderRouterMultiHop');
        console.timeEnd('FullMultiHopExactOut');

        assert.equal(
            Object.keys(directPools).length,
            0,
            'Should be no direct pools.'
        );
        assert.equal(sorSwaps.length, 2, 'Should have 2 swaps.');
        assert.equal(
            utils.formatEther(totalReturn.toString()),
            '0.000000003559698325',
            'Total Out Should Match'
        );
    });
});
