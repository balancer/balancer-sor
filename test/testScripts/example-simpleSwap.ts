// Example showing full swapExactIn - run using: $ ts-node ./test/testScripts/example-swapExactIn.ts
require('dotenv').config();
const sor = require('../../src');
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
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

    const poolsUrl = `https://ipfs.io/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
    // const poolsUrl = `https://cloudflare-ipfs.com/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
    // const poolsUrl = `https://ipfs.io/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange-kovan/pools`;
    // const poolsUrl = `https://cloudflare-ipfs.com/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange-kovan/pools`;
    // const poolsUrl = `https://raw.githubusercontent.com/balancer-labs/balancer-exchange/8615273ca006dba50fd12051535a68ad058f0611/src/allPublicPools.json`;

    const SOR = new sor.SOR(provider, gasPrice, maxNoPools, chainId, poolsUrl);

    const tokenIn = USDC;
    const tokenOut = WETH;
    const swapType = 'swapExactIn'; // Two different swap types are used: swapExactIn & swapExactOut
    let amountIn = new BigNumber('1000000'); // 1 USDC, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.

    console.log(
        `\n************** First Call - Loading Useful Pools For Pair & First Swap`
    );

    // This can be used to check if all pools have been fetched
    SOR.isAllFetched;
    // Can be used to check if pair/pools been fetched
    SOR.hasDataForPair(tokenIn, tokenOut);

    console.time(`totalUsefulPairsMethod`);
    // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await SOR.setCostOutputToken(tokenOut, manualPriceBn)
    console.time(`setCostOutputToken`);
    await SOR.setCostOutputToken(tokenOut);
    console.timeEnd(`setCostOutputToken`);

    // This fetches a subset of pair pools onchain information - Must be called for each swapType
    console.time('fetchFilteredPairPools');
    await SOR.fetchFilteredPairPools(tokenIn, tokenOut);
    console.timeEnd('fetchFilteredPairPools');

    // First call so any paths must be processed so this call will take longer than cached in future.
    console.time('withOutPathsCache');
    let [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.timeEnd('withOutPathsCache');
    console.timeEnd(`totalUsefulPairsMethod`);

    console.log(
        `USDC>WETH, SwapExactIn, 1USDC, Total WETH Return: ${amountOut.toString()}`
    );
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`************** Fetch All Pools - IPFS & Onchain`);
    // This fetches all pools list from IPFS then onChain balances using Multicall
    let fetch = SOR.fetchPools();

    let isAllPoolsFetched = SOR.isAllFetched;
    console.log(`Are all pools fetched: ${isAllPoolsFetched}`);

    console.log(
        `\n**************  Loading All Pools In Background - Will use previously fetched useful pools`
    );

    console.time(`usefulPairsMethodPreviouslyLoaded`);
    [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        new BigNumber('2000000')
    );
    console.timeEnd(`usefulPairsMethodPreviouslyLoaded`);

    console.log(
        `USDC>WETH, SwapExactIn, 2USDC, Total WETH Return: ${amountOut.toString()}`
    );
    console.log(`Swaps: `);
    console.log(swaps);

    console.time(`usefulPairsMethodPreviouslyLoaded`);
    let usdcIn;
    [swaps, usdcIn] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        'swapExactOut',
        amountOut
    );
    console.timeEnd(`usefulPairsMethodPreviouslyLoaded`);

    console.log(`USDC>WETH, SwapExactOut, Total USDC In: ${usdcIn.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.time(`usefulPairsMethodPreviouslyLoaded`);
    [swaps, amountOut] = await SOR.getSwaps(
        tokenOut,
        tokenIn,
        swapType,
        new BigNumber(1e18)
    );
    console.timeEnd(`usefulPairsMethodPreviouslyLoaded`);

    console.log(
        `WETH>USDC, SwapExactIn, 1WETH, Total USDC Return: ${amountOut.toString()}`
    );
    console.log(`Swaps: `);
    console.log(swaps);

    isAllPoolsFetched = SOR.isAllFetched;
    console.log(`\n\nAre all pools fetched: ${isAllPoolsFetched}`);
    console.log(`Waiting for fetch to complete...`);
    await fetch;
    isAllPoolsFetched = SOR.isAllFetched;
    console.log(`Are all pools fetched: ${isAllPoolsFetched}`);

    console.log(`\n************** Using All Pools`);
    // First call so any paths must be processed so this call will take longer than cached in future.
    console.time('allPoolsWithOutPathsCache');
    [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.timeEnd('allPoolsWithOutPathsCache');
    console.log(`Total WETH Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** Second Call - With Paths Cache`);
    // Cached pools & paths will now be used for processing making it much faster
    console.time('callWithCache');
    [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );
    console.timeEnd('callWithCache');
    console.log(`Total WETH Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** Different Swap Type - No Paths Cache`);
    // The paths for this swap needs to be processed
    console.time('differentSwap');
    let amtIn;
    [swaps, amtIn] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        'swapExactOut',
        amountOut
    );
    console.timeEnd('differentSwap');
    console.log(`Total USDC In: ${amtIn.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** FetchPools again - updates onChain info`);
    // This updates all pool onchain balances
    console.time('balanceUpdate');
    await SOR.fetchPools();
    console.timeEnd('balanceUpdate');

    console.time('swapAfterBalanceUpdate');
    [swaps, amtIn] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        'swapExactOut',
        amountOut
    );
    console.timeEnd('swapAfterBalanceUpdate');
    console.log(`Total USDC In: ${amtIn.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.log(`\n************** New token`);
    // This token hasn't been cached
    console.time('newToken');
    [swaps, amountOut] = await SOR.getSwaps(tokenIn, uUSD, swapType, amountIn);
    console.timeEnd('newToken');
    console.log(`Total New Token Return: ${amountOut.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);
}

simpleSwap();
