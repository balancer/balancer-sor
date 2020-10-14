// Example showing full swapExactOut with Subgraph data & onchain check - run using: $ ts-node ./test/testScripts/example-swapExactOutWithCheck.ts
require('dotenv').config();
const sor = require('../../src');
import { BigNumber } from '../../src/utils/bignumber';
import { BONE, bnum, calcOutGivenIn, calcInGivenOut } from '../../src/bmath';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SubGraphPools, Swap, PoolPairData } from '../../src/types';
import { parsePoolPairData } from '../../src/helpers';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}` // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
);
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI Address
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Address
const amountIn = new BigNumber('1000000000000000000'); // 1 DAI, Always pay attention to Token Decimals. i.e. In this case DAI has 18 decimals.
const tokenIn = USDC;
const tokenOut = DAI;
const swapType = 'swapExactOut';
const noPools = 4; // This determines how many pools the SOR will use to swap.
const gasPrice = new BigNumber('30000000000'); // You can set gas price to whatever the current price is.
const swapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas

async function swapExactIn() {
    // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations
    const costOutputToken = await sor.getCostOutputToken(
        DAI,
        gasPrice,
        swapCost,
        provider
    );

    // Uses the Subgraph to retrieve all public Balancer pools that have a positive token balance.
    console.log(`Retrieving SubGraph Pools...`);
    let subGraphPools = await sor.getAllPublicSwapPools();

    // Format pools into wei format. Use copy of original Subgraph pools as its used later for on-chain check.
    let allPoolsNonZeroBalances = JSON.parse(JSON.stringify(subGraphPools));
    sor.formatSubgraphPools(allPoolsNonZeroBalances);

    // Retrieves all pools that contain both DAI & USDC, i.e. pools that can be used for direct swaps
    // Retrieves intermediate pools along with tokens that are contained in these.
    let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
        allPoolsNonZeroBalances.pools,
        tokenIn.toLowerCase(), // The Subgraph returns tokens in lower case format so we must match this
        tokenOut.toLowerCase()
    );

    // Sort intermediate pools by order of liquidity
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

    // Finds the possible paths to make the swap
    let pools, pathData;
    [pools, pathData] = sor.parsePoolData(
        directPools,
        tokenIn.toLowerCase(),
        tokenOut.toLowerCase(),
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    // Finds sorted price & slippage information for paths
    let paths = sor.processPaths(pathData, pools, swapType);

    let epsOfInterest = sor.processEpsOfInterestMultiHop(
        paths,
        swapType,
        noPools
    );

    // Returns  total amount of DAI swapped and list of swaps to make
    let swaps, totalInput;
    [swaps, totalInput] = sor.smartOrderRouterMultiHopEpsOfInterest(
        pools,
        paths,
        swapType,
        amountIn,
        noPools,
        costOutputToken,
        epsOfInterest
    );

    console.log(`Total USDC Input (Subgraph): ${totalInput.toString()}`);
    console.log(`Swaps (Subgraph): `);
    console.log(swaps);

    // Gets pools used in swaps
    let poolsToCheck: SubGraphPools = sor.getPoolsFromSwaps(
        swaps,
        subGraphPools
    );

    // Get onchain info for swap pools
    let onChainPools = await sor.getAllPoolDataOnChain(
        poolsToCheck,
        '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
        provider
    );

    // Checks Subgraph swaps against Onchain pools info.
    // Will update any invalid swaps for valid.
    [swaps, totalInput] = sor.checkSwapsExactOut(
        swaps,
        tokenIn,
        tokenOut,
        amountIn,
        totalInput,
        onChainPools
    );

    console.log(`Total USDC Input (Onchain): ${totalInput.toString()}`);
    console.log(`Swaps (Onchain): `);
    console.log(swaps);
}

swapExactIn();
