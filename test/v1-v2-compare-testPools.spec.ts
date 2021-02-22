require('dotenv').config();
import { SOR, POOLS } from '@balancer-labs/sor';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert } from 'chai';
import {
    getV1Swap,
    getV2Swap,
    Tokens,
    listTestFiles,
    loadTestFile,
} from './testHelpers';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

let v1Swaps = [];
let v1SwapAmt;
let v2Swaps = [];
let v2SwapAmt;

describe('runTests', () => {
    let testFiles = [
        `0x2db088f092121c107a1bfe97984be190e5ab72fce044c9749c3611ce2365e4da`,
        `0xfab93b6aece1282a829e8bdcdf2a1aee193a10134279a0a16c989ca71644e85b`,
        `0x995a2d20a846226c7680fff641cee4397f81c6e1f0675d69c7d26d05a60b39f3`,
    ];
    const testDir = `${__dirname}/testPools/`;
    // let testFiles = await listTestFiles(testDir);

    testFiles.forEach(function(file) {
        it(`${file}`, async () => {
            const testData = loadTestFile(`${testDir}/${file}.json`);

            [v1Swaps, v1SwapAmt] = await getV1Swap(
                provider,
                testData.tradeInfo.GasPrice,
                testData.tradeInfo.NoPools,
                1,
                JSON.parse(JSON.stringify(testData)),
                testData.tradeInfo.SwapType,
                testData.tradeInfo.TokenIn,
                testData.tradeInfo.TokenOut,
                testData.tradeInfo.SwapAmount,
                { display: true, detailed: false, onChainBalances: false }
            );

            [v2Swaps, v2SwapAmt] = await getV2Swap(
                provider,
                testData.tradeInfo.GasPrice,
                testData.tradeInfo.NoPools,
                1,
                JSON.parse(JSON.stringify(testData)),
                testData.tradeInfo.SwapType,
                testData.tradeInfo.TokenIn,
                testData.tradeInfo.TokenOut,
                testData.tradeInfo.SwapAmount,
                { display: true, detailed: false, onChainBalances: false }
            );

            if (testData.tradeInfo.SwapType === `swapExactIn`)
                assert(
                    v2SwapAmt.gte(v1SwapAmt),
                    `${file}\n, V2<V1: \nIn: ${
                        testData.tradeInfo.TokenIn
                    } \nOut: ${
                        testData.tradeInfo.TokenOut
                    } \nSwap Amt: ${testData.tradeInfo.SwapAmount.toString()} \n${v1SwapAmt.toString()} \n${v2SwapAmt.toString()}`
                );
            else
                assert(
                    v2SwapAmt.lte(v1SwapAmt),
                    `${file}\n, V2<V1: \nIn: ${
                        testData.tradeInfo.TokenIn
                    } \nOut: ${
                        testData.tradeInfo.TokenOut
                    } \nSwap Amt: ${testData.tradeInfo.SwapAmount.toString()} \n${v1SwapAmt.toString()} \n${v2SwapAmt.toString()}`
                );
        }).timeout(100000);
    });
});
