require('dotenv').config();
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getRandomTradeData,
    saveTestFile,
    deleteTestFile,
    loadTestFile,
} from '../lib/testHelpers';
import { compareTest } from '../lib/compareHelper';
import { bnum } from '../../src/bmath';

// Each pool will have 4 tests. Total number will be MIN_TESTS * 4 * NoPools. Will always test each pool at least once.
const MIN_TESTS = 50;

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const gasPrice = new BigNumber('30000000000');
const chainId = 1;

enum SwapAmt {
    Small,
    Large,
    Inter1,
    Inter2,
    Single,
}

// npx mocha -r ts-node/register test/testScripts/v1-v2-compareRandomStableOnly.spec.ts // This is using pools list from selected list. Should have stable tokens available.
// It’s taking a random pair from a list of stable tokens along with random swap amounts and max pools.
// Compare V1 vs V2 and V2 vs Wrapper.
// Assumes script running from root (see testDir if not).
// Will do a large amount of tests and save any that fail. Change MIN_TESTS for number of tests to be run.
describe('Run Large Amount Of Tests Using Saved Pools Data', async () => {
    // This must be updated with pools of interest (see ./test/testData/testPools)
    let testFiles = [
        'stable-and-weighted-token-btp-test',
        'stable-pools-only-wbtc-to-sbtc-exactIn',
        'stable-pools-only-wbtc-to-sbtc-exactOut',
        'stable-and-weighted',
        'stable-and-weighted-gas-price-zero',
    ];

    // Assumes script running from root
    const testDir = `${process.cwd()}/test/testData/testPools/`;

    let testsPerPool = MIN_TESTS / testFiles.length;
    if (testsPerPool < 1) testsPerPool = 1;

    console.log(
        `Total Number of tests: ${testsPerPool * testFiles.length * 10}`
    );

    testFiles.forEach(async function(file) {
        for (let i = 0; i < testsPerPool; i++) {
            await testSwap(
                `swapExactIn`,
                SwapAmt.Small,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactIn`,
                SwapAmt.Large,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactIn`,
                SwapAmt.Inter1,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactIn`,
                SwapAmt.Inter2,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactOut`,
                SwapAmt.Small,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactOut`,
                SwapAmt.Large,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactOut`,
                SwapAmt.Inter1,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactOut`,
                SwapAmt.Inter2,
                `${testDir}/${file}.json`
            );

            await testSwap(
                `swapExactIn`,
                SwapAmt.Single,
                `${testDir}/${file}.json`
            );

            await testSwap(
                `swapExactOut`,
                SwapAmt.Single,
                `${testDir}/${file}.json`
            );
        }
    });
});

async function testSwap(swapType: string, swapAmtType: SwapAmt, file: string) {
    it(`${swapType} - ${swapAmtType} swap`, async () => {
        const testData = loadTestFile(file);
        const tradeData = getRandomTradeData(true); // true for stable tokens only
        const tokenIn = tradeData.tokenIn.toLowerCase();
        const tokenOut = tradeData.tokenOut.toLowerCase();
        const tokenInDecimals = tradeData.tokenInDecimals;
        const tokenOutDecimals = tradeData.tokenOutDecimals;
        const maxNoPools = tradeData.maxPools;

        let swapAmount: BigNumber;
        if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Small)
            swapAmount = tradeData.smallSwapAmtIn;
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Large)
            swapAmount = tradeData.largeSwapAmtIn;
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Inter1)
            swapAmount = tradeData.inter1SwapAmtIn;
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Inter2)
            swapAmount = tradeData.inter2SwapAmtIn;
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Small)
            swapAmount = tradeData.smallSwapAmtOut;
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Large)
            swapAmount = tradeData.largeSwapAmtOut;
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Inter1)
            swapAmount = tradeData.inter1SwapAmtOut;
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Single)
            swapAmount = bnum(1).times(bnum(10 ** tokenInDecimals));
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Single)
            swapAmount = bnum(1).times(bnum(10 ** tokenOutDecimals));
        else swapAmount = tradeData.inter2SwapAmtOut;

        let swapAmountDecimals = tradeData.tokenInDecimals.toString();
        let returnAmountDecimals = tradeData.tokenOutDecimals.toString();

        if (swapType === 'swapExactOut') {
            swapAmountDecimals = tradeData.tokenOutDecimals.toString();
            returnAmountDecimals = tradeData.tokenInDecimals.toString();
        }

        // We save the test file ahead of a failed test because there are times when the test hangs and we want to capture those
        const newFile = saveTestFile(
            testData,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools.toString(),
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );

        // Pools are loaded from the test file but all other trade info is new
        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: maxNoPools,
            SwapAmount: swapAmount,
            GasPrice: gasPrice,
            SwapAmountDecimals: swapAmountDecimals,
            ReturnAmountDecimals: returnAmountDecimals,
        };

        const newTestData = {
            pools: testData.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            file,
            provider,
            newTestData
        );

        // All tests passed so no need to keep file
        deleteTestFile(
            testData,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools.toString(),
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );
    }).timeout(100000);
}
