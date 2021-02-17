// Example showing full swapExactIn - run using: $ ts-node ./test/testScripts/example-swapExactIn.ts
require('dotenv').config();
const sor = require('../../src');
const BigNumber = require('bignumber.js');
import { JsonRpcProvider } from '@ethersproject/providers';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}` // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
);
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI Address
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Address
const amountIn = new BigNumber('10000000'); // 1 USDC, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.
const tokenIn = USDC;
const tokenOut = DAI;
const swapType = 'swapExactIn';
// const WBTC = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'; // WBTC Address
// const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH Address
// // const amountIn = new BigNumber('5000000'); // 0.5 wbtc, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.
// const amountIn = new BigNumber('100000000000000000000'); // 100 weth, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.
// const tokenIn = WBTC;
// const tokenOut = WETH;
// const swapType = 'swapExactOut';
const noPools = 6; // This determines how many pools the SOR will use to swap.
// const gasPrice = new BigNumber('30000000000'); // You can set gas price to whatever the current price is.
const gasPrice = new BigNumber('0'); // You can set gas price to whatever the current price is.
const swapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas
// URL for pools data
const poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;

async function swapExactIn() {
    // This calculates the cost in output token (output token is tokenOut for swapExactIn and
    // tokenIn for a swapExactOut) for each additional pool added to the final SOR swap result.
    // This is used as an input to SOR to allow it to make gas efficient recommendations, i.e.
    // if it costs 5 DAI to add another pool to the SOR solution and that only generates 1 more DAI,
    // then SOR should not add that pool (if gas costs were zero that pool would be added)
    // Notice that outputToken is tokenOut if swapType == 'swapExactIn' and tokenIn if swapType == 'swapExactOut'
    const costOutputToken = await sor.getCostOutputToken(
        tokenOut,
        gasPrice,
        swapCost,
        provider
    );

    // Fetch all pools information
    const poolsHelper = new sor.POOLS();
    console.log('Fetching Pools...');
    let allPoolsNonZeroBalances = await poolsHelper.getAllPublicSwapPools(
        poolsUrl
    );

    console.log(`Retrieving Onchain Balances...`);
    allPoolsNonZeroBalances = await sor.getAllPoolDataOnChain(
        allPoolsNonZeroBalances,
        '0x514053acec7177e277b947b1ebb5c08ab4c4580e', // Address of Multicall contract
        provider
    );

    console.log(`Processing Data...`);
    // 'directPools' are all pools that contain both tokenIn and tokenOut, i.e. pools that
    // can be used for direct swaps
    // 'hopTokens' are all tokens that can connect tokenIn and tokenOut in a multihop swap
    // with two legs. WETH is a hopToken if its possible to trade USDC to WETH then WETH to DAI
    // 'poolsTokenIn' are the pools that contain tokenIn and a hopToken
    // 'poolsTokenOut' are the pools that contain a hopToken and tokenOut
    let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
        allPoolsNonZeroBalances.pools,
        tokenIn.toLowerCase(), // The Subgraph returns tokens in lower case format so we must match this
        tokenOut.toLowerCase(),
        noPools
    );

    // We are commenting this part as this first version only supports direct pairs

    // For each hopToken, find the most liquid pool for the first and the second hops
    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
    ] = sor.sortPoolsMostLiquid(
        tokenIn,
        tokenOut,
        hopTokens,
        poolsTokenIn,
        poolsTokenOut
    );

    // Finds the possible paths to make the swap, each path can be a direct swap
    // or a multihop composed of 2 swaps
    let pools, pathDataList;
    [pools, pathDataList] = sor.parsePoolData(
        directPools,
        tokenIn.toLowerCase(),
        tokenOut.toLowerCase(),
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    // // Finds the possible paths to make the swap, each path can be a direct swap
    // // or a multihop composed of 2 swaps
    // let pools, pathDataList;
    // [pools, pathDataList] = sor.parsePoolData(
    //     directPools,
    //     tokenIn.toLowerCase(),
    //     tokenOut.toLowerCase(),
    //     [],
    //     [],
    //     []
    // );

    // For each path find limitAmount (maximum that it can trade)
    // 'paths' are then ordered by descending limitAmount
    let [paths, maxLiquidityAvailable] = sor.processPaths(
        pathDataList,
        pools,
        swapType,
        noPools
    );

    console.time('Filter paths');
    let filteredPaths = sor.filterPaths(
        pools,
        paths,
        swapType,
        noPools,
        maxLiquidityAvailable,
        costOutputToken
    );
    console.timeEnd('Filter paths');

    console.time('SOR');
    // Returns 'swaps' which is the optimal list of swaps to make and
    // 'totalReturnWei' which is the total amount of tokenOut (eg. DAI) will be returned
    let swaps, totalReturnWei;
    [swaps, totalReturnWei] = sor.smartOrderRouter(
        pools,
        paths,
        swapType,
        amountIn,
        noPools,
        costOutputToken
    );
    console.timeEnd('SOR');
    console.log(`Total DAI Return: ${totalReturnWei.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);

    console.time('SOR_filteredPaths');
    // Returns 'swaps' which is the optimal list of swaps to make and
    // 'totalReturnWei' which is the total amount of tokenOut (eg. DAI) will be returned
    [swaps, totalReturnWei] = sor.smartOrderRouter(
        JSON.parse(JSON.stringify(pools)),
        filteredPaths,
        swapType,
        amountIn,
        noPools,
        costOutputToken
    );
    console.timeEnd('SOR_filteredPaths');
    console.log(
        `Total DAI Return Filtered Paths: ${totalReturnWei.toString()}`
    );
    console.log(`Swaps: `);
    console.log(swaps);
}

swapExactIn();
