// Example showing SOR with Vault batchSwap & Eth in, run using: $ ts-node ./test/testScripts/swapExactOutEthIn.ts
require('dotenv').config();
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { MaxUint256 } from '@ethersproject/constants';
import {
    SOR,
    SwapInfo,
    SwapTypes,
    ZERO_ADDRESS,
    fetchSubgraphPools,
} from '../../src';
import { scale } from '../../src/bmath';

import vaultArtifact from '../../src/abi/Vault.json';
import erc20abi from '../abi/ERC20.json';

export type FundManagement = {
    sender: string;
    recipient: string;
    fromInternalBalance: boolean;
    toInternalBalance: boolean;
};

// rc01 Kovan addresses
const WETH = '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1';
const BAL = '0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7';
const MKR = '0xAf9ac3235be96eD496db7969f60D354fe5e426B0';
const WBTC = '0x1C8E3Bcb3378a443CC591f154c5CE0EBb4dA9648';
const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

const poolsUrl = `https://storageapi.fleek.co/johngrantuk-team-bucket/poolsRc02.json`;

async function simpleSwap() {
    // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
    const provider = new JsonRpcProvider(
        `https://kovan.infura.io/v3/${process.env.INFURA}`
    );

    // Add TRADE_KEY pk to env for address that will exectute trade
    const wallet = new Wallet(process.env.TRADER_KEY, provider);
    console.log(`Trader Address: ${wallet.address}`);

    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    // Can be changed in future using sor.gasPrice = newPrice
    const gasPrice = new BigNumber('30000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxNoPools = 4;
    const chainId = 42;
    // The zero address is used to signal Eth used in swap
    const tokenIn = ZERO_ADDRESS;
    const tokenOut = BAL;
    const swapType = SwapTypes.SwapExactOut;
    // In normalized format, i.e. 1USDC = 1
    const amountOut = new BigNumber(0.1);
    const decimalsOut = 6;

    // Fetch pools list from Subgraph
    // Uses default API or value set in env
    // Can also pass in API address via parameter
    let subgraphPools = await fetchSubgraphPools();

    const sor = new SOR(provider, gasPrice, maxNoPools, chainId, subgraphPools);

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await sor.setCostOutputToken(tokenOut, manualPriceBn)
    await sor.setCostOutputToken(tokenOut);

    // Fetch refreshed pools list from Subgraph
    subgraphPools = await fetchSubgraphPools();
    // Will get onChain data for refreshed pools list
    await sor.fetchPools(true, subgraphPools);
    const isFinishedFetchingOnChain = sor.finishedFetchingOnChain;
    console.log(`isFinishedFetchingOnChain ${isFinishedFetchingOnChain}`);

    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountOut
    );

    console.log(swapInfo.returnAmount.toString());
    console.log(swapInfo.swaps);

    const vaultContract = new Contract(vaultAddr, vaultArtifact, provider);
    vaultContract.connect(wallet);

    const funds: FundManagement = {
        sender: wallet.address,
        recipient: wallet.address,
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    // Limits:
    // +ve means max to send
    // -ve mean min to receive
    // For a multihop the intermediate tokens should be 0
    // This is where slippage tolerance would be added
    const limits = [];
    swapInfo.tokenAddresses.forEach((token, i) => {
        if (token.toLowerCase() === tokenIn.toLowerCase()) {
            limits[i] = swapInfo.returnAmount.toString();
        } else if (token.toLowerCase() === tokenOut.toLowerCase()) {
            limits[i] = scale(amountOut, decimalsOut)
                .times(-1)
                .toString();
        } else {
            limits[i] = '0';
        }
    });
    const deadline = MaxUint256;

    console.log('Swapping...');
    let tx = await vaultContract
        .connect(wallet)
        .batchSwap(
            swapType,
            swapInfo.swaps,
            swapInfo.tokenAddresses,
            funds,
            limits,
            deadline,
            {
                // Note that value must be passed, i.e. send Eth
                value: limits[0],
                gasLimit: '200000',
                gasPrice: '20000000000',
            }
        );

    console.log(`tx: ${tx.hash}`);
}

simpleSwap();
