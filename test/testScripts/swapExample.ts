// Example using SOR to find the best swap for a given pair and simulate using batchSwap.
// Requires TRADER_KEY in .env.
// Run using: $ TS_NODE_PROJECT='tsconfig.testing.json' ts-node ./test/testScripts/swapExample.ts
// NOTE: This is for test/debug purposes, the Balancer SDK Swaps module has a more user friendly interface for interacting with SOR:
// https://github.com/balancer-labs/balancer-sdk/tree/develop/balancer-js#swaps-module
import dotenv from 'dotenv';
dotenv.config();
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { SOR, SwapInfo, SwapTypes } from '../../src';
import { CoingeckoTokenPriceService } from '../lib/coingeckoTokenPriceService';
import { SubgraphPoolDataService } from '../lib/subgraphPoolDataService';
import {
    Network,
    SOR_CONFIG,
    ADDRESSES,
    SUBGRAPH_URLS,
    PROVIDER_URLS,
    vaultAddr,
    MULTIADDR,
} from './constants';
import { buildTx, printOutput } from './utils';

import vaultArtifact from '../../src/abi/Vault.json';

// Setup SOR with data services
function setUp(networkId: Network, provider: JsonRpcProvider): SOR {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const subgraphPoolDataService = new SubgraphPoolDataService({
        chainId: networkId,
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        subgraphUrl: SUBGRAPH_URLS[networkId],
        onchain: true,
    });

    // Use the mock pool data service if you want to use pool data from a file.
    // const poolsSource = require('../testData/testPools/gusdBug.json');
    // mockPoolDataService.setPools(poolsSource);

    // Use coingecko to fetch token price information. Used to calculate cost of additonal swaps/hops.
    const coingeckoTokenPriceService = new CoingeckoTokenPriceService(
        networkId
    );
    // Use the mock token price service if you want to manually set the token price in native asset
    // import { mockPoolDataService } from '../lib/mockPoolDataService';
    //  mockTokenPriceService.setTokenPrice('0.001');

    return new SOR(
        provider,
        SOR_CONFIG[networkId],
        subgraphPoolDataService,
        coingeckoTokenPriceService
    );
}

export async function swap(): Promise<void> {
    const networkId = Network.MAINNET;
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    const gasPrice = BigNumber.from('14000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxPools = 4;
    const tokenIn = ADDRESSES[networkId].DAI;
    const tokenOut = ADDRESSES[networkId].USDC;
    const swapType: SwapTypes = SwapTypes.SwapExactIn;
    const swapAmount = parseFixed('100', 18);

    const sor = setUp(networkId, provider);

    // Get pools info using Subgraph/onchain calls
    await sor.fetchPools();

    // Find swapInfo for best trade for given pair and amount
    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn.address,
        tokenOut.address,
        swapType,
        swapAmount,
        { gasPrice, maxPools },
        false
    );

    // Simulate the swap transaction
    if (swapInfo.returnAmount.gt(0)) {
        const key = process.env.TRADER_KEY as string;
        const wallet = new Wallet(key, provider);
        // await handleAllowances(wallet, tokenIn: string, amount: BigNumber)
        const tx = buildTx(wallet, swapInfo, swapType);

        await printOutput(
            swapInfo,
            sor,
            tokenIn,
            tokenOut,
            swapType,
            swapAmount,
            gasPrice,
            tx.limits
        );

        if (![tokenIn, tokenOut].includes(ADDRESSES[networkId].STETH)) {
            console.log('VAULT SWAP');
            const vaultContract = new Contract(
                vaultAddr,
                vaultArtifact,
                provider
            );
            // Simulates a call to `batchSwap`, returning an array of Vault asset deltas.
            // Each element in the array corresponds to the asset at the same index, and indicates the number of tokens(or ETH)
            // the Vault would take from the sender(if positive) or send to the recipient(if negative).
            const deltas = await vaultContract.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                tx.funds
            );
            console.log(deltas.toString());
            // To actually make the trade:
            // vaultContract.connect(wallet);
            // const tx = await vaultContract
            //     .connect(wallet)
            //     .batchSwap(
            //         swapType,
            //         swapInfo.swaps,
            //         swapInfo.tokenAddresses,
            //         tx.funds,
            //         tx.limits,
            //         tx.deadline,
            //         tx.overRides
            //     );

            // console.log(`tx: ${tx}`);
        } else {
            console.log('RELAYER SWAP - Execute via batchRelayer.');
        }
    } else {
        console.log('No Valid Swap');
        await printOutput(
            swapInfo,
            sor,
            tokenIn,
            tokenOut,
            swapType,
            swapAmount,
            gasPrice,
            []
        );
    }
}

// $ TS_NODE_PROJECT='tsconfig.testing.json' npx ts-node ./test/testScripts/swapExample.ts
swap();
