// Example showing full swapExactIn - run using: $ ts-node ./test/testScripts/example-swapExactIn.ts
require('dotenv').config();
const sor = require('../../src');
const BigNumber = require('bignumber.js');
import { BONE } from '../../src/bmath';
import { JsonRpcProvider } from 'ethers/providers';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}` // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
);
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI Address
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Address
const amountIn = new BigNumber('1000000'); // 1 USDC, Always pay attention to Token Decimals. i.e. In this case USDC has 6 decimals.
const tokenIn = USDC;
const tokenOut = DAI;
const swapType = 'swapExactIn';
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
    const allPoolsNonZeroBalances = await sor.getAllPublicSwapPools();

    // Retrieves all pools that contain both DAI & USDC, i.e. pools that can be used for direct swaps
    const directPools = await sor.filterPoolsWithTokensDirect(
        allPoolsNonZeroBalances.pools,
        tokenIn.toLowerCase(), // The Subgraph returns tokens in lower case format so we must match this
        tokenOut.toLowerCase()
    );

    // Retrieves pools in order of liquidity for intermediate pools along with tokens that are contained in these.
    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens,
    ] = await sor.filterPoolsWithTokensMultihop(
        allPoolsNonZeroBalances.pools,
        tokenIn.toLowerCase(),
        tokenOut.toLowerCase()
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
    let swaps, totalReturnWei;
    [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
        pools,
        paths,
        swapType,
        amountIn,
        noPools,
        costOutputToken,
        epsOfInterest
    );

    const totalReturnEth = totalReturnWei.div(BONE); // Just converts from wei units
    console.log(`Total DAI Return: ${totalReturnEth.toString()}`);
    console.log(swaps);
}

swapExactIn();
