require('dotenv').config();
import { POOLS } from '@balancer-labs/sor';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert } from 'chai';
import { getV1Swap, getV2Swap, Tokens } from './testHelpers';

// npx mocha -r ts-node/register test/compare-livepools.spec.ts
// This is using the live pools list from IPFS and on-chain balances so it’s non-deterministic.
// Uses hardcoded trade data - useful for manually checking specific trades.
// Compare V1 vs V2.
describe('Comparing V1/V2 Using Live Pool Data', () => {
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

        // Retrieve live pools from IPFS list
        const poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
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
            { onChainBalances: true }
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
            { display: true, detailed: true, onChainBalances: true }
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

        // Retrieve live pools from IPFS list
        const poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
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
            { onChainBalances: true }
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
            { display: true, detailed: true, onChainBalances: true }
        );

        assert(
            v2SwapAmt.lte(v1SwapAmt),
            `ExactOut, V2>V1: In: ${tokenIn} Out: ${tokenOut} Amt: ${swapAmount.toString()}`
        );
    }).timeout(100000);
});
