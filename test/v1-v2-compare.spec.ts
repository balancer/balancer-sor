require('dotenv').config();
import { SOR, POOLS } from '@balancer-labs/sor';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert } from 'chai';
import { getV1Swap, getV2Swap, Tokens } from './testHelpers';

// npx mocha -r ts-node/register test/compareTest.spec.ts
describe('Comparing V1/V2 Using Static Pool Data', () => {
    it('swapExactIn', async () => {
        const tokenIn = Tokens.WETH;
        const tokenOut = Tokens.DAI;
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
        const tokenIn = Tokens.WETH;
        const tokenOut = Tokens.DAI;
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
            v2SwapAmt.lte(v1SwapAmt),
            `ExactOut, V2>V1: In: ${tokenIn} Out: ${tokenOut} Amt: ${swapAmount.toString()}`
        );
    }).timeout(100000);
});
