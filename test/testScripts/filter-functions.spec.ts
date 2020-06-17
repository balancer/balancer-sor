// Tests multihop filter methods by comparing to old SOR getMultihopPoolsWithTokens function
// which was replaced as too slow - uses live Subgraph data.
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../../src');
const helpers = require('../../src/helpers');
const comparrisonHelper = require('./utils/comparrisonHelpers');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');
import { BONE } from '../../src/bmath';

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

describe('Test Filter Functions using full SOR Subgraph comparrions', () => {
    it('getPools timer check', async () => {
        console.time('getPools');
        await sor.getAllPublicSwapPools();
        console.timeEnd('getPools');
    });

    it('Get multihop pools - DAI>USDC (LIVE SUBGRAPH)', async () => {
        // THIS TESTS ON LIVE SUBGRAPH
        // Compare to old getMultihopPoolsWithTokens function
        console.time('getMultihopPoolsWithTokens');
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await comparrisonHelper.getMultihopPoolsWithTokens(DAI, USDC);
        console.timeEnd('getMultihopPoolsWithTokens');

        console.time('filterPoolsWithTokensMultihop');
        const allPoolsReturned = await sor.getAllPublicSwapPools();

        let mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            DAI,
            USDC
        );
        console.timeEnd('filterPoolsWithTokensMultihop');

        expect(mostLiquidPoolsFirstHop).to.eql(mostLiquidPoolsFirstHopFilter);
        expect(mostLiquidPoolsSecondHop).to.eql(mostLiquidPoolsSecondHopFilter);
        expect(hopTokens).to.eql(hopTokensFilter);
    }).timeout(10000);

    it('Get multihop pools - USDC>MKR (LIVE SUBGRAPH)', async () => {
        // THIS TESTS ON LIVE SUBGRAPH
        // Compare to old getMultihopPoolsWithTokens function
        console.time('getMultihopPoolsWithTokens');
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await comparrisonHelper.getMultihopPoolsWithTokens(USDC, MKR);
        console.timeEnd('getMultihopPoolsWithTokens');

        console.time('filterPoolsWithTokensMultihop');
        const allPoolsReturned = await sor.getAllPublicSwapPools();

        let mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            USDC,
            MKR
        );
        console.timeEnd('filterPoolsWithTokensMultihop');

        expect(mostLiquidPoolsFirstHop).to.eql(mostLiquidPoolsFirstHopFilter);
        expect(mostLiquidPoolsSecondHop).to.eql(mostLiquidPoolsSecondHopFilter);
        expect(hopTokens).to.eql(hopTokensFilter);
    }).timeout(10000);

    it('Full Multihop SOR - WETH>DAI (LIVE SUBGRAPH)', async () => {
        // THIS TESTS ON LIVE SUBGRAPH
        // Compares to old getMultihopPoolsWithTokens function
        console.time('getMultihopPoolsWithTokens');
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await comparrisonHelper.getMultihopPoolsWithTokens(WETH, DAI);
        console.timeEnd('getMultihopPoolsWithTokens');

        console.time('filterPoolsWithTokensMultihop');
        const allPoolsReturned = await sor.getAllPublicSwapPools();

        let mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsReturned,
            WETH,
            DAI
        );

        expect(mostLiquidPoolsFirstHop).to.eql(mostLiquidPoolsFirstHopFilter);
        expect(mostLiquidPoolsSecondHop).to.eql(mostLiquidPoolsSecondHopFilter);
        expect(hopTokens).to.eql(hopTokensFilter);

        console.timeEnd('filterPoolsWithTokensMultihop');

        const directPools = await sor.filterPoolsWithTokensDirect(
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

        let poolsFilter, pathDataFilter;
        [poolsFilter, pathDataFilter] = sor.parsePoolData(
            directPools,
            WETH.toLowerCase(), // TODO - Why is this required????
            DAI.toLowerCase(),
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter
        );

        expect(pools).to.eql(poolsFilter);
        expect(pathData).to.eql(pathDataFilter);

        const amountIn = new BigNumber(1).times(BONE);

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            JSON.parse(JSON.stringify(pools)),
            pathData,
            'swapExactIn',
            amountIn,
            4,
            new BigNumber(0)
        );

        const [
            sorSwapsFilter,
            totalReturnFilter,
        ] = sor.smartOrderRouterMultiHop(
            JSON.parse(JSON.stringify(poolsFilter)),
            pathDataFilter,
            'swapExactIn',
            amountIn,
            4,
            new BigNumber(0)
        );

        expect(sorSwaps).to.eql(sorSwapsFilter);
        assert.equal(
            utils.formatEther(totalReturn.toString()),
            utils.formatEther(totalReturnFilter.toString()),
            'Total Out Should Match'
        );
    }).timeout(10000);
});
