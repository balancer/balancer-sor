// Tests Multihop SOR for swaps with different decimals.
// npx mocha -r ts-node/register test/multihop-decimals.spec.ts
require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert } from 'chai';
import { BigNumber } from '../src/utils/bignumber';
import { filterPoolsWithBalance } from './lib/testHelpers';
import { compareTest } from './lib/compareHelper';

const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
const WBTC = '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb'.toLowerCase();
const MKR = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'.toLowerCase();
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const yUSD = '0xb2fdd60ad80ca7ba89b9bab3b5336c2601c020b4';

let allPoolsCorrect;

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

const gasPrice = new BigNumber('30000000000');

describe('Tests Multihop SOR vs static allPoolsDecimals.json', () => {
    it('Saved pool check - without disabled filter', async () => {
        assert.equal(allPools.pools.length, 3, 'Should be 3 pools');
        // Converts Subgraph string format to Wei/Bnum format
        allPoolsCorrect = filterPoolsWithBalance(
            JSON.parse(JSON.stringify(allPools))
        );

        assert.equal(
            allPoolsCorrect.pools.length,
            3,
            'Should be 3 pools with non-zero balance'
        );
    });

    it('Full Multihop SOR, WBTC>MKR, swapExactIn', async () => {
        const amountIn = new BigNumber(100000); // 0.00100000 WBTC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = WBTC;
        const tokenOut = MKR;

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountIn,
            GasPrice: gasPrice,
            SwapAmountDecimals: 8,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: allPoolsCorrect.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            testData
        );

        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 multiswap.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.094899465593600104',
            'Amount should match previous result.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, WBTC>MKR, swapExactOut', async () => {
        const amountOut = new BigNumber(1000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WBTC;
        const tokenOut = MKR;

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountOut,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 8,
        };

        const testData = {
            pools: allPoolsCorrect.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            testData
        );

        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 multiswap.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.0000070196233350782296',
            'Amount should match previous result.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, USDC>yUSD, swapExactIn', async () => {
        const amountIn = new BigNumber(1000000);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = yUSD;

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountIn,
            GasPrice: gasPrice,
            SwapAmountDecimals: 6,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: allPoolsCorrect.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            testData
        );

        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 multiswap.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.962208461003483771',
            'Amount should match previous result.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, USDC>yUSD, swapExactOut', async () => {
        const amountOut = new BigNumber(10000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = yUSD;

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountOut,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 6,
        };

        const testData = {
            pools: allPoolsCorrect.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            testData
        );

        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 multiswap.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.010392755926718752',
            'Amount should match previous result.'
        );
    }).timeout(10000);
});
