// Example using SOR to find the best swap at a given block and at the most recent block
// Run using: $ TS_NODE_PROJECT='tsconfig.testing.json' ts-node ./test/testScripts/swapExample.ts
// NOTE: This is for test/debug purposes, the Balancer SDK Swaps module has a more user friendly interface for interacting with SOR:
// https://github.com/balancer-labs/balancer-sdk/tree/develop/balancer-js#swaps-module
import dotenv from 'dotenv';
dotenv.config();
import { BigNumber, parseFixed, formatFixed } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
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
    const gasPrice = BigNumber.from('0');
    // This determines the max no of pools the SOR will use to swap.
    const maxPools = 4;
    const tokenIn = ADDRESSES[networkId].WETH;
    const tokenOut = ADDRESSES[networkId].USDC;
    const swapType: SwapTypes = SwapTypes.SwapExactIn;
    const swapAmount = parseFixed('1', 18);

    const sor = setUp(networkId, provider);

    const targetBlockNumber = 17_000_000;
    // Get pools info using Subgraph/onchain calls
    await sor.fetchPools(undefined, undefined, targetBlockNumber);

    // Find swapInfo for best trade for given pair and amount
    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn.address,
        tokenOut.address,
        swapType,
        swapAmount,
        { gasPrice, maxPools },
        false
    );

    const sorNow = setUp(networkId, provider);

    await sorNow.fetchPools();

    // Find swapInfo for best trade for given pair and amount
    const swapInfoNow = await sorNow.getSwaps(
        tokenIn.address,
        tokenOut.address,
        swapType,
        swapAmount,
        { gasPrice, maxPools },
        false
    );

    console.log(
        `1 WETH is ${formatFixed(
            swapInfoNow.returnAmount,
            6
        )} USDC using the most recent data`
    );
    console.log(
        `1 WETH was ${formatFixed(
            swapInfo.returnAmount,
            6
        )} USDC at block ${targetBlockNumber}`
    );
}

// $ TS_NODE_PROJECT='tsconfig.testing.json' npx ts-node ./test/testScripts/swapHistoricalExample.ts
swap();
