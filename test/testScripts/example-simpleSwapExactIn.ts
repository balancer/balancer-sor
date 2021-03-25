// Example showing SOR use with Vault batchSwapGivenIn, run using: $ ts-node ./test/testScripts/example-simpleSwapExactIn.ts
require('dotenv').config();
import { SOR } from '../../src';
import { SwapInfo } from '../../src/types';
import { scale } from '../../src/bmath';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { MaxUint256 } from '@ethersproject/constants';

import vaultArtifact from '../../src/abi/vault.json';
import erc20abi from '../abi/ERC20.json';

export type FundManagement = {
    sender: string;
    recipient: string;
    fromInternalBalance: boolean;
    toInternalBalance: boolean;
};

// rc01 Kovan addresses
const WETH = '0xe1329748c41A140536e41049C95c36A53bCACee6';
const BAL = '0x1688C45BC51Faa1B783D274E03Da0A0B28A0A871';
const MKR = '0xD9D9E09604c0C14B592e6E383582291b026EBced';
const vaultAddr = '0xba1c01474A7598c2B49015FdaFc67DdF06ce15f7';

// TODO - Update with ipns when ready.
const poolsUrl = `https://storageapi.fleek.co/johngrantuk-team-bucket/poolsRc1-22-03.json`;

async function simpleSwap() {
    // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
    const provider = new JsonRpcProvider(
        // `https://mainnet.infura.io/v3/${process.env.INFURA}`
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
    const tokenIn = BAL;
    const tokenOut = MKR;
    const swapType = 'swapExactIn'; // Two different swap types are used: swapExactIn & swapExactOut
    const amountIn = new BigNumber(0.1); // In normalized format, i.e. 1USDC = 1
    const decimalsIn = 18;

    const sor = new SOR(provider, gasPrice, maxNoPools, chainId, poolsUrl);

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await sor.setCostOutputToken(tokenOut, manualPriceBn)
    await sor.setCostOutputToken(tokenOut);

    // This fetches all pools list from URL in constructor then onChain balances using Multicall
    await sor.fetchPools();
    const isFinishedFetchingOnChain = sor.finishedFetchingOnChain;
    console.log(`isFinishedFetchingOnChain ${isFinishedFetchingOnChain}`);

    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );

    console.log(swapInfo.returnAmount.toString());
    console.log(swapInfo.swaps);

    // The rest of the code executes a swap using wallet funds

    /*
    // Vault needs approval for swapping
    console.log('Approving vault...');
    let tokenInContract = new Contract(
        tokenIn,
        erc20abi,
        provider
    );

    let txApprove = await tokenInContract.connect(wallet).approve(vaultAddr, MaxUint256);
    console.log(txApprove);
    */

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
    // For a multihop the intermediate tokens should be ok at 0?

    const limits = [];
    swapInfo.tokenAddresses.forEach((token, i) => {
        if (token.toLowerCase() === tokenIn.toLowerCase()) {
            limits[i] = scale(amountIn, decimalsIn).toString();
        } else if (token.toLowerCase() === tokenOut.toLowerCase()) {
            // This should be amt + slippage in UI
            limits[i] = swapInfo.returnAmount
                .times(-1)
                .times(0.9)
                .toString();
        } else {
            limits[i] = '0';
        }
    });

    console.log(swapInfo.tokenAddresses);
    console.log(limits);

    const deadline = MaxUint256;
    console.log('Swapping...');

    let tx = await vaultContract
        .connect(wallet)
        .batchSwapGivenIn(
            swapInfo.swaps,
            swapInfo.tokenAddresses,
            funds,
            limits,
            deadline,
            {
                gasLimit: '200000',
                gasPrice: '20000000000',
            }
        );

    console.log(`tx: ${tx.hash}`);
}

simpleSwap();
