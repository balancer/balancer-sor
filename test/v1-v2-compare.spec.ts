require('dotenv').config();
import { SOR, POOLS } from '@balancer-labs/sor';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert } from 'chai';
import { getV1Swap, getV2Swap, Tokens } from './testHelpers';

// npx mocha -r ts-node/register test/compare.spec.ts
// This compare V1 vs V2 swaps and V2 vs V2 with pool from a specified IPFS.
// Compare V1 vs V2.
// !!! Note - this can be deleted if compare-testPools ends up being used.
describe('Comparing V1/V2 Using Static Pool Data', () => {
    it('swapExactIn', async () => {
        const tokenIn = Tokens.WETH.address;
        const tokenOut = Tokens.DAI.address;
        const swapAmount = new BigNumber('1000000000000000000');
        const swapType = 'swapExactIn';
        const provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        const chainId = 1;
        const gasPrice = new BigNumber('30000000000');
        const maxNoPools = 4;

        const allPools = require(`./allPools.json`);

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
            { display: true, detailed: false, onChainBalances: false }
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
            { display: true, detailed: false, onChainBalances: false }
        );

        assert(
            v2SwapAmt.gte(v1SwapAmt),
            `ExactIn, V2<V1: In: ${tokenIn} Out: ${tokenOut} Amt: ${swapAmount.toString()}`
        );
    }).timeout(100000);

    it('swapExactOut', async () => {
        const tokenIn = Tokens.WETH.address;
        const tokenOut = Tokens.DAI.address;
        const swapAmount = new BigNumber('1000000000000000000');
        const swapType = 'swapExactOut';
        const provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        const chainId = 1;
        const gasPrice = new BigNumber('30000000000');
        const maxNoPools = 4;

        const allPools = require(`./allPools.json`);

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
            { display: false, detailed: false, onChainBalances: false }
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
            { display: false, detailed: false, onChainBalances: false }
        );

        assert(
            v2SwapAmt.lte(v1SwapAmt),
            `ExactOut, V2>V1: In: ${tokenIn} Out: ${tokenOut} Amt: ${swapAmount.toString()}`
        );
    }).timeout(100000);

    it('1-2020-02-19 swapExactIn', async () => {
        /*
        1-2020-02-19
        V1 Swap Amount: 1923027943962396194701
        V2 Swap Amount: 643655996271926685340 // Live
        V2 Swap Amount: 1332239105722954534706 // Static
        ExactIn, V2<V1: In: 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2 Out: 0x6b175474e89094c44da98b954eedeac495271d0f Amt: 1000000000000000000
        */
        const tokenIn = Tokens.WETH.address;
        const tokenOut = Tokens.DAI.address;
        const swapAmount = new BigNumber('1000000000000000000');
        const swapType = 'swapExactIn';
        const provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        const chainId = 1;
        const gasPrice = new BigNumber('30000000000');
        const maxNoPools = 4;

        // Retrieve live pools from IPFS list
        const poolsUrl = `https://balancer-bucket.storage.fleek.co/balancer-sor-tests/1-2020-02-19.json`;
        const poolsHelper = new POOLS();
        let allPools = await poolsHelper.getAllPublicSwapPools(poolsUrl);

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
            { display: true, detailed: false, onChainBalances: false }
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
            { display: true, detailed: false, onChainBalances: false }
        );

        assert(
            v2SwapAmt.gte(v1SwapAmt),
            `ExactIn, V2<V1: In: ${tokenIn} Out: ${tokenOut} Amt: ${swapAmount.toString()}`
        );
    }).timeout(100000);
});
