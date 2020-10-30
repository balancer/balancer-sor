// Example showing full swapExactIn - run using: $ ts-node ./test/testScripts/example-swapExactIn.ts
require('dotenv').config();
const sor = require('../../src');
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI Address
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Address
const uUSD = '0xD16c79c8A39D44B2F3eB45D2019cd6A42B03E2A9'; // uUSDwETH Synthetic Token

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
    const chainId = 1;

    const tokenIn = USDC;
    const tokenOut = DAI;
    const swapType = 'swapExactIn'; // Two different swap types are used: swapExactIn & swapExactOut
    let amountIn = new BigNumber('1000000'); // 1 USDC, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.

    let ipfs = new sor.IPFS();
    let filteredPools = await ipfs.getFilteredPools(
        tokenIn,
        tokenOut,
        'balancer-team-bucket.storage.fleek.co/balancer-exchange/pools',
        'ipns'
    );

    console.log(filteredPools.pools.length);

    let poolsCheck = await sor.getFilteredPools(tokenIn, tokenOut);
    console.log(poolsCheck.pools.length);

    filteredPools = await ipfs.getPoolsWithToken(
        tokenIn,
        'balancer-team-bucket.storage.fleek.co/balancer-exchange/pools',
        'ipns'
    );

    console.log(filteredPools.pools.length);

    poolsCheck = await sor.getPoolsWithToken(tokenIn);
    console.log(poolsCheck.pools.length);
    return;

    const SOR = new sor.SOR(provider, gasPrice, maxNoPools, chainId);

    // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await SOR.setCostOutputToken(tokenOut, manualPriceBn)
    await SOR.setCostOutputToken(tokenOut);

    console.log(`************** First Call - Without Cache`);
    // First call so any pool information for tokens must be retrieved so this call will take longer than cached in future.
    console.time('withOutCache');
    let [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.timeEnd('withOutCache');
    console.log(`Total DAI Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** With Cache`);
    // Cached pools & paths will now be used for processing making it much faster
    console.time('callWithCache');
    [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn,
        false
    );
    console.timeEnd('callWithCache');
    console.log(`Total DAI Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** With Pools Cache Purge`);
    // By default cache is purged and new pool data is loaded
    console.time('cachePurge');
    [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.timeEnd('cachePurge');
    console.log(`Total DAI Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** With Cache, Different Swap Type`);
    // Because token info is already cached this should be fast
    console.time('differentSwap');
    let amtIn;
    [swaps, amtIn] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        'swapExactOut',
        amountOut,
        false
    );
    console.timeEnd('differentSwap');
    console.log(`Total USDC In: ${amtIn.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** Updating Onchain Pool Balances`);
    // This updates all cached pool onchain balances
    console.time('balanceUpdate');
    await SOR.updateOnChainBalances();
    console.timeEnd('balanceUpdate');

    console.time('swapAfterBalanceUpdate');
    [swaps, amtIn] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        'swapExactOut',
        amountOut,
        false
    );
    console.timeEnd('swapAfterBalanceUpdate');
    console.log(`Total USDC In: ${amtIn.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** New token, Pool Already Cached`);
    // This token hasn't been cached but it only exists in a single pool that has already been cached.
    console.time('newToken');
    [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        uUSD,
        swapType,
        amountIn,
        false
    );
    console.timeEnd('newToken');
    console.log(`Total New Token Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);
}

simpleSwap();
