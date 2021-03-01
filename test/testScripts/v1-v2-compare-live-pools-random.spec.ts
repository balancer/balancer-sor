require('dotenv').config();
import { POOLS } from '@balancer-labs/sor';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getV1Swap,
    getV2Swap,
    getV2SwapWithFilter,
    getRandomTradeData,
    saveTestFile,
    deleteTestFile,
    displayResults,
    assertResults,
} from '../testHelpers';

let tradeData;
let tokenIn;
let tokenOut;
let maxNoPools;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const gasPrice = new BigNumber('30000000000');
const chainId = 1;

// Retrieve live pools from IPFS list
const poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
let allPools;

const onChainBalances = true;
let v1SwapData;
let v2SwapData;
let v2WithFilterSwapData;
let tokenInDecimals, tokenOutDecimals;

// npx mocha -r ts-node/register test/testScripts/v1-v2-compare-live-pools-random.spec.ts
// This is using the live pools list from IPFS and on-chain balances so it’s non-deterministic.
// It’s taking a random pair from a list of 10 tokens along with random swap amounts and max pools.
// Compare V1 vs V2 and V2 vs V2 with filter.
describe('Comparing V1/V2 Using Live Pool Data', async () => {
    before(() => {
        tradeData = getRandomTradeData();
        tokenIn = tradeData.tokenIn;
        tokenOut = tradeData.tokenOut;
        tokenInDecimals = tradeData.tokenInDecimals;
        tokenOutDecimals = tradeData.tokenOutDecimals;
        maxNoPools = tradeData.maxPools;
    });

    it('swapExactIn - Small swap', async () => {
        const poolsHelper = new POOLS();
        allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

        const swapAmount = tradeData.smallSwapAmtIn;
        const swapType = 'swapExactIn';

        // We save the test file ahead of a failed test because there are times when the test hangs and we want to capture those
        const file = saveTestFile(
            allPools,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools,
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );

        v1SwapData = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );

        v2SwapData = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );
        /*
        v2WithFilterSwapData = await getV2SwapWithFilter(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );
        */

        const testData = {
            tradeInfo: {
                SwapType: swapType,
                TokenIn: tokenIn,
                TokenOut: tokenOut,
                SwapAmount: swapAmount,
            },
        };

        displayResults(
            `${file}.json`,
            testData.tradeInfo,
            [v1SwapData, v2SwapData /*, v2WithFilterSwapData*/],
            false
        );

        assertResults(
            file,
            testData,
            v1SwapData,
            v2SwapData
            // v2WithFilterSwapData
        );

        // All tests passed so no need to keep file
        deleteTestFile(
            allPools,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools,
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );
    }).timeout(100000);

    it('swapExactIn - Large swap', async () => {
        const poolsHelper = new POOLS();
        allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

        const swapAmount = tradeData.largeSwapAmtIn;
        const swapType = 'swapExactIn';

        // We save the test file ahead of a failed test because there are times when the test hangs and we want to capture those
        const file = saveTestFile(
            allPools,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools,
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );

        v1SwapData = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );

        v2SwapData = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );
        /*
        v2WithFilterSwapData = await getV2SwapWithFilter(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );
        */
        const testData = {
            tradeInfo: {
                SwapType: swapType,
                TokenIn: tokenIn,
                TokenOut: tokenOut,
                SwapAmount: swapAmount,
            },
        };

        displayResults(
            `${file}.json`,
            testData.tradeInfo,
            [v1SwapData, v2SwapData /*, v2WithFilterSwapData*/],
            false
        );

        assertResults(
            file,
            testData,
            v1SwapData,
            v2SwapData
            // v2WithFilterSwapData
        );

        // All tests passed so no need to keep file
        deleteTestFile(
            allPools,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools,
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );
    }).timeout(100000);

    it('swapExactOut - Small swap', async () => {
        const poolsHelper = new POOLS();
        allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

        const swapAmount = tradeData.smallSwapAmtOut;
        const swapType = 'swapExactOut';

        // We save the test file ahead of a failed test because there are times when the test hangs and we want to capture those
        const file = saveTestFile(
            allPools,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools,
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );

        v1SwapData = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );

        v2SwapData = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );
        /*
        v2WithFilterSwapData = await getV2SwapWithFilter(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );
        */

        const testData = {
            tradeInfo: {
                SwapType: swapType,
                TokenIn: tokenIn,
                TokenOut: tokenOut,
                SwapAmount: swapAmount,
            },
        };

        displayResults(
            `${file}.json`,
            testData.tradeInfo,
            [v1SwapData, v2SwapData /*, v2WithFilterSwapData*/],
            false
        );

        assertResults(
            file,
            testData,
            v1SwapData,
            v2SwapData
            // v2WithFilterSwapData
        );

        // All tests passed so no need to keep file
        deleteTestFile(
            allPools,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools,
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );
    }).timeout(100000);

    it('swapExactOut - Large swap', async () => {
        const poolsHelper = new POOLS();
        allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

        const swapAmount = tradeData.largeSwapAmtOut;
        const swapType = 'swapExactOut';

        // We save the test file ahead of a failed test because there are times when the test hangs and we want to capture those
        const file = saveTestFile(
            allPools,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools,
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );

        v1SwapData = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );

        v2SwapData = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );
        /*
        v2WithFilterSwapData = await getV2SwapWithFilter(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: onChainBalances }
        );
        */

        const testData = {
            tradeInfo: {
                SwapType: swapType,
                TokenIn: tokenIn,
                TokenOut: tokenOut,
                SwapAmount: swapAmount,
            },
        };

        displayResults(
            `${file}.json`,
            testData.tradeInfo,
            [v1SwapData, v2SwapData /*, v2WithFilterSwapData*/],
            false
        );

        assertResults(
            file,
            testData,
            v1SwapData,
            v2SwapData
            // v2WithFilterSwapData
        );

        // All tests passed so no need to keep file
        deleteTestFile(
            allPools,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools,
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );
    }).timeout(100000);
});
