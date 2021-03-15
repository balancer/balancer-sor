// Example showing SOR use with Vault batchSwapGivenIn, run using: $ ts-node ./test/testScripts/example-simpleSwapExactIn.ts
require('dotenv').config();
import { SOR } from '../../src';
import { SwapInfo } from '../../src/types';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';

export type FundManagement = {
    recipient: string;
    fromInternalBalance: boolean;
    toInternalBalance: boolean;
};

// TODO - Remove if unused in mainnet deploy
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI Address
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // USDC Address

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
    // TODO - Update with ipns when ready.
    const poolsUrl = `https://storageapi.fleek.co/johngrantuk-team-bucket/poolsV2.json`;

    const sor = new SOR(provider, gasPrice, maxNoPools, chainId, poolsUrl);

    const tokenIn = '0xfa06b7b5e149e575b457e595c606ec58b17e9e13';
    const tokenOut = '0xb5399358fa9744c604f8fae7043a547f74206d4c';
    const swapType = 'swapExactIn'; // Two different swap types are used: swapExactIn & swapExactOut
    let amountIn = new BigNumber(0.1); // In normalized format, i.e. 1USDC = 1

    // This can be used to check if all pools have been fetched
    let isFinishedFetchingOnChain = sor.finishedFetchingOnChain;

    // Can be used to check if pair/pools been fetched
    let hasDataForPair = sor.hasDataForPair(tokenIn, tokenOut);
    console.log(`isFinishedFetchingOnChain ${isFinishedFetchingOnChain}`);

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await sor.setCostOutputToken(tokenOut, manualPriceBn)
    await sor.setCostOutputToken(tokenOut);

    // This fetches all pools list from URL in constructor then onChain balances using Multicall
    let fetch = await sor.fetchPools();
    isFinishedFetchingOnChain = sor.finishedFetchingOnChain;
    console.log(`isFinishedFetchingOnChain ${isFinishedFetchingOnChain}`);

    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );

    console.log(swapInfo.returnAmount.toString());
    console.log(swapInfo.swaps);

    // TODO - Update with deploy
    const vaultAddr = '0x99EceD8Ba43D090CA4283539A31431108FD34438';
    const validatorAddr = '0x6648473ae4D7a7FdE330846D11ee95FDE2DE9447';
    const vaultArtifact = require('../../src/abi/vault.json');

    const vaultContract = new Contract(vaultAddr, vaultArtifact, provider);
    vaultContract.connect(wallet);

    const funds: FundManagement = {
        recipient: wallet.address,
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    // TODO - Add approve?

    let tx = await vaultContract
        .connect(wallet)
        .batchSwapGivenIn(
            ZERO_ADDRESS,
            '0x',
            swapInfo.swaps,
            swapInfo.tokenAddresses,
            funds
        );

    console.log(`tx: ${tx.hash}`);
}

simpleSwap();
