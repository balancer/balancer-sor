// Example showing full swapExactIn - run using: $ ts-node ./test/testScripts/example-swapExactIn.ts
require('dotenv').config();
const sor = require('../../src');
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI Address
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Address

async function simpleSwap() {
    // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
    const provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );

    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    // Can be changed in future using SOR.gasPrice = newPrice
    const gasPrice = new BigNumber('30000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxNoPools = 4;

    const SOR = new sor.SOR(provider, gasPrice, maxNoPools);

    console.log(`Fetching Subgraph...`);
    // SOR must have a list of available pools. This function fetches from Subgraph.
    // This can be called as often as needed to keep pools list up to date.
    await SOR.fetchSubgraphPools();

    const tokenIn = USDC;
    const tokenOut = DAI;
    const swapType = 'swapExactIn'; // Two different swap types are used: swapExactIn & swapExactOut
    let amountIn = new BigNumber('1000000'); // 1 USDC, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.

    // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await SOR.setCostOutputToken(tokenOut, manualPriceBn)
    await SOR.setCostOutputToken(tokenOut);

    // If getSwaps is called after fetchSubgraphPools() but before fetchOnChainPools() then Subgraph balances are used.
    // These can potentially be innacurate. By default getSwaps will do a final check of swaps using on-chain info.
    let [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.log(`Total DAI Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    // Here the on-chain check is cancelled by setting last parameter to false. Be aware this could lead to invalid swaps if Subgraph out of sync.
    let amtIn;
    [swaps, amtIn] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        'swapExactOut',
        amountOut,
        false
    );
    console.log(`Total USDC In: ${amtIn.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`Fetching onchain pool information...`);
    // This function will retrieve on-chain balances, weights and fees for all pools from fetchSubgraphPools()
    // This can take >5s to run but results in most accurate and optimal swap information
    await SOR.fetchOnChainPools();

    // Now SOR will automatically use the on-chain pool information
    [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.log(`Total DAI Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log('Refreshing Subgraph pools...');
    // Refreshing subgraph pools
    // - if new pools are different from previous onChain pools previously fetched will be ignored until also refreshed
    await SOR.fetchSubgraphPools();

    [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.log(`Total DAI Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);
}

simpleSwap();
