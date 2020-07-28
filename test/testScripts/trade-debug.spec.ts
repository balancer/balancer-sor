// Test multihop-eps trade using live subgraph
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../../src');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');
import { BONE } from '../../src/bmath';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(); // WETH
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(); // DAI
const ANT = '0x960b236A07cf122663c4303350609A66A7B288C0'.toLowerCase();
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();
const MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2'.toLowerCase();

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

describe('Test multihop-eps trade using live subgraph', () => {
    it('Test multihop-eps trade using live subgraph', async () => {
        //const amountIn = new BigNumber('1000000'); // 1 USDC
        const amountIn = new BigNumber('1000000000000000000'); // 1 WETH
        // const tokenIn = USDC;
        const tokenIn = WETH;
        const tokenOut = DAI;
        const swapType = 'swapExactIn';
        const noPools = 4;

        const allPoolsReturned = await sor.getAllPublicSwapPools();

        let allTokensSet, allPoolsNonZeroBalances;
        [allTokensSet, allPoolsNonZeroBalances] = sor.filterAllPools(
            allPoolsReturned
        );

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances,
            tokenIn,
            tokenOut
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

        let sorSwapsEps, totalReturnEps;
        const mhTimeEpsStart = process.hrtime.bigint();

        console.time('smartOrderRouterMultiHopEpsx100');
        // for (var i = 0; i < 100; i++) {
        [
            sorSwapsEps,
            totalReturnEps,
        ] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountIn,
            noPools,
            new BigNumber(0),
            epsOfInterest
        );
        // }
        let t = console.timeEnd('smartOrderRouterMultiHopEpsx100');
        let mhTimeEpsStop = process.hrtime.bigint();
        // console.log(`Old ${mhTimeStop - mhTimeStart} nanoseconds`);
        // console.log(`New ${mhTimeEpsStop - mhTimeEpsStart} nanoseconds`);

        console.log(`Total Return: ${totalReturnEps.toString()}`);
        console.log(`Total Return: ${totalReturnEps.div(BONE).toString()}`);
    }).timeout(30000);
});
