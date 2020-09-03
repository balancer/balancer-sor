// Test multihop-eps trade using live subgraph
require('dotenv').config();
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../../src');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');
import { BONE } from '../../src/bmath';
import { JsonRpcProvider } from 'ethers/providers';
import * as bmath from '../../src/bmath';

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
    it('Test multihop-eps trade, USDC->DAI, swapExactIn, using live subgraph', async () => {
        const amountIn = new BigNumber('1000000'); // 1 USDC
        // const amountIn = new BigNumber('1000000000000000000'); // 1 WETH
        const tokenIn = USDC;
        // const tokenIn = DAI;
        const tokenOut = DAI;
        const swapType = 'swapExactIn';
        const noPools = 3;
        // const costOutputToken = new BigNumber(0);
        let provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        const gasPrice = new BigNumber('30000000000');
        const swapCost = new BigNumber('100000');
        const costOutputToken = await sor.getCostOutputToken(
            DAI,
            18,
            gasPrice,
            swapCost,
            provider
        );
        console.log(`costOutputToken: ${costOutputToken.toString()}`);

        //const costScaled = bmath.scale(costOutputToken, 6);
        //console.log(costScaled.toString());

        const allPoolsNonZeroBalances = await sor.getAllPublicSwapPools(); // Only returns pools with balance

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
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
        // for (let i = 0; i < 100; i++) {
        [
            sorSwapsEps,
            totalReturnEps,
        ] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountIn,
            noPools,
            costOutputToken,
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

    it('Test multihop-eps trade, USDC->DAI, swapExactOut, using live subgraph', async () => {
        // const amountIn = new BigNumber('1000000'); // 1 USDC
        const amountOut = new BigNumber('1000000000000000000'); // 1 DAI
        const tokenIn = USDC;
        const tokenOut = DAI;
        const swapType = 'swapExactOut';
        const noPools = 3;
        let provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        const gasPrice = new BigNumber('30000000000');
        const swapCost = new BigNumber('100000');
        // const costOutputToken = new BigNumber(0);

        let costOutputToken = await sor.getCostOutputToken(
            USDC,
            6,
            gasPrice,
            swapCost,
            provider
        );
        console.log(`costOutputToken: ${costOutputToken.toString()}`);

        /*
        costOutputToken = bmath.scale(costOutputToken, -6);
        console.log(costOutputToken.toString());
        */

        const allPoolsNonZeroBalances = await sor.getAllPublicSwapPools(); // Only returns pools with balance

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
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
        // for (let i = 0; i < 100; i++) {
        [
            sorSwapsEps,
            totalReturnEps,
        ] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountOut,
            noPools,
            costOutputToken,
            epsOfInterest
        );
        // }
        let t = console.timeEnd('smartOrderRouterMultiHopEpsx100');
        let mhTimeEpsStop = process.hrtime.bigint();
        // console.log(`Old ${mhTimeStop - mhTimeStart} nanoseconds`);
        // console.log(`New ${mhTimeEpsStop - mhTimeEpsStart} nanoseconds`);

        console.log(`Total Return: ${totalReturnEps.toString()}`);
        let scaledReturn = bmath.scale(totalReturnEps, -6);
        console.log(`Total Return: ${scaledReturn.toString()}`);
    }).timeout(30000);

    it('Test multihop-eps trade, USDC->WETH, swapExactIn, using live subgraph', async () => {
        const amountIn = new BigNumber('400000000'); // 400 USDC
        const tokenIn = USDC;
        const tokenOut = WETH;
        const swapType = 'swapExactIn';
        const noPools = 3;
        // const costOutputToken = new BigNumber(0);
        let provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        const gasPrice = new BigNumber('30000000000');
        const swapCost = new BigNumber('100000');
        const costOutputToken = await sor.getCostOutputToken(
            WETH,
            18,
            gasPrice,
            swapCost,
            provider
        );
        console.log(`costOutputToken: ${costOutputToken.toString()}`);

        const allPoolsNonZeroBalances = await sor.getAllPublicSwapPools(); // Only returns pools with balance

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
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
        // for (let i = 0; i < 100; i++) {
        [
            sorSwapsEps,
            totalReturnEps,
        ] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountIn,
            noPools,
            costOutputToken,
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

    it('Test multihop-eps trade, USDC->WETH, swapExactOut, using live subgraph', async () => {
        const amountOut = new BigNumber('1000000000000000000'); // 1 WETH
        const tokenIn = USDC;
        const tokenOut = WETH;
        const swapType = 'swapExactOut';
        const noPools = 3;
        // const costOutputToken = new BigNumber(0);
        let provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        const gasPrice = new BigNumber('30000000000');
        const swapCost = new BigNumber('100000');
        const costOutputToken = await sor.getCostOutputToken(
            USDC,
            6,
            gasPrice,
            swapCost,
            provider
        );
        console.log(`costOutputToken: ${costOutputToken.toString()}`);

        const allPoolsNonZeroBalances = await sor.getAllPublicSwapPools(); // Only returns pools with balance

        const directPools = await sor.filterPoolsWithTokensDirect(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
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
        // for (let i = 0; i < 100; i++) {
        [
            sorSwapsEps,
            totalReturnEps,
        ] = sor.smartOrderRouterMultiHopEpsOfInterest(
            JSON.parse(JSON.stringify(pools)),
            paths,
            swapType,
            amountOut,
            noPools,
            costOutputToken,
            epsOfInterest
        );
        // }
        let t = console.timeEnd('smartOrderRouterMultiHopEpsx100');
        let mhTimeEpsStop = process.hrtime.bigint();
        // console.log(`Old ${mhTimeStop - mhTimeStart} nanoseconds`);
        // console.log(`New ${mhTimeEpsStop - mhTimeEpsStart} nanoseconds`);

        console.log(`Total Return: ${totalReturnEps.toString()}`);
        let scaledReturn = bmath.scale(totalReturnEps, -6);
        console.log(`Total Return: ${scaledReturn.toString()}`);
    }).timeout(30000);
});
