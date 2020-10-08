// Test multihop-eps trade using live subgraph
require('dotenv').config();
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../../src');
const BigNumber = require('bignumber.js');
const { utils } = require('ethers');
import { BONE } from '../../src/bmath';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as bmath from '../../src/bmath';

let WBTC = '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb'.toLowerCase();
let MKR = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'.toLowerCase();

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

describe('Test multihop-eps trade using live subgraph', () => {
    it('Test multihop-eps trade, WBTC->MKR, swapExactIn, using live subgraph', async () => {
        const amountIn = new BigNumber('10000');
        const tokenIn = WBTC;
        const tokenOut = MKR;
        const swapType = 'swapExactIn';
        const noPools = 4;

        let provider = new JsonRpcProvider(
            `https://kovan.infura.io/v3/${process.env.INFURA}`
        );
        /*
      const gasPrice = new BigNumber('30000000000');
      const swapCost = new BigNumber('100000');
      const costOutputToken = await sor.getCostOutputToken(
          DAI,
          gasPrice,
          swapCost,
          provider
      );
      */
        const costOutputToken = new BigNumber(0);

        console.log(`costOutputToken: ${costOutputToken.toString()}`);

        let allPoolsNonZeroBalances = await sor.getAllPublicSwapPools(); // Only returns pools with balance
        console.log(`Retrieving Onchain Balances...`);
        allPoolsNonZeroBalances = await sor.getAllPoolDataOnChain(
            allPoolsNonZeroBalances,
            '0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A',
            provider
        );

        let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
        [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
            allPoolsNonZeroBalances.pools,
            tokenIn,
            tokenOut,
            {
                isOverRide: true,
                disabledTokens: disabledTokens.tokens,
            }
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
        ] = sor.sortPoolsMostLiquid(
            tokenIn,
            tokenOut,
            hopTokens,
            poolsTokenIn,
            poolsTokenOut
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
        console.log(sorSwapsEps);
    }).timeout(30000);
});
