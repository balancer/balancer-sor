// Example comparing EVM maths to result: $ ts-node ./test/testScripts/swapExactOut/swapKovanOutTestSor.ts
require('dotenv').config();
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { MaxUint256 } from '@ethersproject/constants';
import { SOR, SwapInfo, SwapTypes, fetchSubgraphPools } from '../../../src';
import { scale } from '../../../src/bmath';
import vaultArtifact from '../../../src/abi/Vault.json';
import erc20abi from '../../abi/ERC20.json';

export type FundManagement = {
    sender: string;
    recipient: string;
    fromInternalBalance: boolean;
    toInternalBalance: boolean;
};

const BAL = '0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7';
const WETH = '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1';
const USDC = '0xc2569dd7d0fd715b054fbf16e75b001e5c0c1115';
const DAI = '0x04df6e4121c27713ed22341e7c7df330f56f289b';
const GUSD = '0x22ee6c3b011facc530dd01fe94c58919344d6db5';
const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

async function simpleSwap() {
    // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
    const provider = new JsonRpcProvider(
        `https://kovan.infura.io/v3/${process.env.INFURA}`
    );

    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    // Can be changed in future using sor.gasPrice = newPrice
    const gasPrice = new BigNumber('40000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxNoPools = 4;
    const chainId = 42;
    const tokenIn = DAI;
    const tokenOut = USDC;
    const swapType = SwapTypes.SwapExactOut;
    // In normalized format, i.e. 1USDC = 1
    const swapAmount = new BigNumber(7);
    const decimalsIn = 18;
    const decimalsOut = 6;

    // Fetch pools list from Subgraph
    // Uses default API or value set in env
    // Can also pass in API address via parameter
    // let subgraphPools = await fetchSubgraphPools(
    //     'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan-v2'
    // );

    // Use filtered pool from file
    const subgraphPools = require('./tempKovanPool.json');

    const sor = new SOR(provider, gasPrice, maxNoPools, chainId, subgraphPools);

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await sor.setCostOutputToken(tokenOut, manualPriceBn)
    // tokenOut for SwapExactIn, tokenIn for SwapExactOut
    const cost = await sor.setCostOutputToken(tokenIn, decimalsIn);

    console.log('Cost:');
    console.log(cost.toString());

    // Will get onChain balances, etc
    await sor.fetchPools(true, subgraphPools);

    const isFinishedFetchingOnChain = sor.finishedFetchingOnChain;
    console.log(`isFinishedFetchingOnChain ${isFinishedFetchingOnChain}`);

    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        swapAmount
    );

    const vaultContract = new Contract(vaultAddr, vaultArtifact, provider);

    const funds: FundManagement = {
        sender: '0x6aB9E397d22634dCB71FcD1A075EC434050b8647',
        recipient: '0x6aB9E397d22634dCB71FcD1A075EC434050b8647',
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    console.log('Swapping...');
    let deltas = await vaultContract.callStatic.queryBatchSwap(
        swapType,
        swapInfo.swaps,
        swapInfo.tokenAddresses,
        funds
    );

    console.log('Calculated Swaps:');
    console.log(swapInfo.swaps);
    console.log('Calculated Return Amt:');
    console.log(swapInfo.returnAmount.toString());
    console.log('Real deltas:');
    deltas.forEach(delta => console.log(delta.toString()));
}

simpleSwap();
