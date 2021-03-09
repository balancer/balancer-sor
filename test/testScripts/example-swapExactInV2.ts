// Example showing full swapExactIn - run using: $ ts-node ./test/testScripts/example-swapExactIn.ts
require('dotenv').config();
const sor = require('../../src');
const BigNumber = require('bignumber.js');
import { JsonRpcProvider } from '@ethersproject/providers';

const provider = new JsonRpcProvider(
    `https://kovan.infura.io/v3/${process.env.INFURA}` // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
);
// DIRECT:
const tokenIn = '0xB5399358Fa9744c604F8faE7043a547F74206D4C'; // WETH
const tokenOut = '0x16c6A736B28d92aae496bB30f937826798AfC63C'; // BAL
// MULTI:
//const tokenIn = "0x16c6A736B28d92aae496bB30f937826798AfC63C"; // BAL
//const tokenOut = "0x3994596aD2114BC369E3e542ABeE9bC3D2c071b1"; // WBTC
// const amountIn = new BigNumber('10000000'); // 1 USDC, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.
const amountIn = new BigNumber('1000000000000000000');
const swapType = 'swapExactIn';
const noPools = 6; // This determines how many pools the SOR will use to swap.
// const gasPrice = new BigNumber('30000000000'); // You can set gas price to whatever the current price is.
const gasPrice = new BigNumber('0'); // You can set gas price to whatever the current price is.
const swapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas
const multiAddress = '0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A';
const vaultAddress = '0x99EceD8Ba43D090CA4283539A31431108FD34438';

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

    const poolsV2 = { pools: require(`./v2Pools.json`) };

    console.log(`Retrieving Onchain Balances...`);
    const poolsV2OnChain = await sor.getAllPoolDataOnChainV2(
        poolsV2,
        multiAddress,
        vaultAddress,
        provider
    );

    console.log(`Processing Data...`);
    console.log(poolsV2OnChain.pools[0]);
    // 'directPools' are all pools that contain both tokenIn and tokenOut, i.e. pools that
    // can be used for direct swaps
    // 'hopTokens' are all tokens that can connect tokenIn and tokenOut in a multihop swap
    // with two legs. WETH is a hopToken if its possible to trade USDC to WETH then WETH to DAI
    // 'poolsTokenIn' are the pools that contain tokenIn and a hopToken
    // 'poolsTokenOut' are the pools that contain a hopToken and tokenOut
    let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
        poolsV2OnChain.pools,
        tokenIn.toLowerCase(), // The Subgraph returns tokens in lower case format so we must match this
        tokenOut.toLowerCase(),
        noPools
    );

    console.log(`directPools:`);
    console.log(directPools);
    console.log(`hopTokens`);
    console.log(hopTokens);
    console.log(`poolsTokenIn`);
    console.log(poolsTokenIn);
    console.log(`poolsTokenOut`);
    console.log(poolsTokenOut);

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

    console.time('SOR');

    // For each path find limitAmount (maximum that it can trade)
    // 'paths' are then ordered by descending limitAmount
    let paths = sor.processPaths(pathDataList, pools, swapType);

    console.log('Paths:');
    console.log(paths);
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
    console.log(`Total Return: ${totalReturnWei.toString()}`);
    console.log(`Swaps: `);
    console.log(swaps);
}

swapExactIn();
