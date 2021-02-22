require('dotenv').config();
import { POOLS } from '@balancer-labs/sor';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert } from 'chai';
import {
    getV1Swap,
    getV2Swap,
    Tokens,
    getRandomTradeData,
    saveTestFile,
} from './testHelpers';

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

// npx mocha -r ts-node/register test/compare-livepools.spec.ts
describe('Comparing V1/V2 Using Live Pool Data', async () => {
    before(() => {
        tradeData = getRandomTradeData();
        tokenIn = tradeData.tokenIn;
        tokenOut = tradeData.tokenOut;
        maxNoPools = tradeData.maxPools;
    });

    it('swapExactIn - Small swap', async () => {
        const poolsHelper = new POOLS();
        allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

        const swapAmount = tradeData.smallSwapAmtIn;
        const swapType = 'swapExactIn';

        let v1Swaps = [];
        let v1SwapAmt;
        let v2Swaps = [];
        let v2SwapAmt;

        [v1Swaps, v1SwapAmt] = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { display: true, detailed: false, onChainBalances: onChainBalances }
        );

        [v2Swaps, v2SwapAmt] = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { display: true, detailed: true, onChainBalances: onChainBalances }
        );

        // If the test fails save it for future
        if (!v2SwapAmt.gte(v1SwapAmt))
            saveTestFile(
                allPools,
                swapType,
                tokenIn,
                tokenOut,
                maxNoPools,
                swapAmount.toString(),
                gasPrice.toString(),
                './test/testPools/'
            );

        assert(
            v2SwapAmt.gte(v1SwapAmt),
            `ExactIn, V2<V1: \nIn: ${tokenIn} \nOut: ${tokenOut} \nSwap Amt: ${swapAmount.toString()} \n${v1SwapAmt.toString()} \n${v2SwapAmt.toString()}`
        );
    }).timeout(100000);

    it('swapExactIn - Large swap', async () => {
        const poolsHelper = new POOLS();
        allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

        const swapAmount = tradeData.largeSwapAmtIn;
        const swapType = 'swapExactIn';

        let v1Swaps = [];
        let v1SwapAmt;
        let v2Swaps = [];
        let v2SwapAmt;

        [v1Swaps, v1SwapAmt] = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { display: true, detailed: false, onChainBalances: onChainBalances }
        );

        [v2Swaps, v2SwapAmt] = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { display: true, detailed: true, onChainBalances: onChainBalances }
        );

        // If the test fails save it for future
        if (!v2SwapAmt.gte(v1SwapAmt))
            saveTestFile(
                allPools,
                swapType,
                tokenIn,
                tokenOut,
                maxNoPools,
                swapAmount.toString(),
                gasPrice.toString(),
                './test/testPools/'
            );

        assert(
            v2SwapAmt.gte(v1SwapAmt),
            `ExactIn, V2<V1: \nIn: ${tokenIn} \nOut: ${tokenOut} \nSwap Amt: ${swapAmount.toString()} \n${v1SwapAmt.toString()} \n${v2SwapAmt.toString()}`
        );
    }).timeout(100000);

    it('swapExactOut - Small swap', async () => {
        const poolsHelper = new POOLS();
        allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

        const swapAmount = tradeData.smallSwapAmtOut;
        const swapType = 'swapExactOut';

        let v1Swaps = [];
        let v1SwapAmt;
        let v2Swaps = [];
        let v2SwapAmt;

        [v1Swaps, v1SwapAmt] = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { display: true, detailed: false, onChainBalances: onChainBalances }
        );

        [v2Swaps, v2SwapAmt] = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { display: true, detailed: true, onChainBalances: onChainBalances }
        );

        // If the test fails save it for future
        if (!v2SwapAmt.lte(v1SwapAmt))
            saveTestFile(
                allPools,
                swapType,
                tokenIn,
                tokenOut,
                maxNoPools,
                swapAmount.toString(),
                gasPrice.toString(),
                './test/testPools/'
            );

        assert(
            v2SwapAmt.lte(v1SwapAmt),
            `ExactOut, V2<V1: \nIn: ${tokenIn} \nOut: ${tokenOut} \nSwap Amt: ${swapAmount.toString()} \n${v1SwapAmt.toString()} \n${v2SwapAmt.toString()}`
        );
    }).timeout(100000);

    it('swapExactOut - Large swap', async () => {
        const poolsHelper = new POOLS();
        allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

        const swapAmount = tradeData.largeSwapAmtOut;
        const swapType = 'swapExactOut';

        let v1Swaps = [];
        let v1SwapAmt;
        let v2Swaps = [];
        let v2SwapAmt;

        [v1Swaps, v1SwapAmt] = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { display: true, detailed: false, onChainBalances: onChainBalances }
        );

        [v2Swaps, v2SwapAmt] = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            chainId,
            JSON.parse(JSON.stringify(allPools)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { display: true, detailed: true, onChainBalances: onChainBalances }
        );

        // If the test fails save it for future
        if (!v2SwapAmt.lte(v1SwapAmt))
            saveTestFile(
                allPools,
                swapType,
                tokenIn,
                tokenOut,
                maxNoPools,
                swapAmount.toString(),
                gasPrice.toString(),
                './test/testPools/'
            );

        assert(
            v2SwapAmt.lte(v1SwapAmt),
            `ExactOut, V2<V1: \nIn: ${tokenIn} \nOut: ${tokenOut} \nSwap Amt: ${swapAmount.toString()} \n${v1SwapAmt.toString()} \n${v2SwapAmt.toString()}`
        );
    }).timeout(100000);
});
