import 'dotenv/config';
import { JsonRpcProvider } from '@ethersproject/providers';
import { parseFixed } from '@ethersproject/bignumber';
import { PROVIDER_URLS, VAULT, SUBGRAPH_URLS, MULTIADDR } from './constants';
import { BalancerV2 } from './balancerV2';

async function getPricesVolume() {
    const network = 1;
    const provider = new JsonRpcProvider(PROVIDER_URLS[network]);
    const balancer = new BalancerV2(
        network,
        VAULT[network],
        SUBGRAPH_URLS[network],
        MULTIADDR[network],
        provider
    );

    const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
    const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const amountsIn = [
        parseFixed('1', 6).toBigInt(),
        parseFixed('777', 6).toBigInt(),
    ];

    const priceInfo = await balancer.getPricesVolume(USDC, DAI, amountsIn);

    console.log(priceInfo);
}
/*
Example demonstrating how VirtualBoostedPool concept could be added to enable easier path/price finding for nested pools like bb-a-USD.
Uses simplified version of Paraswap code to allow local running.
Uses INFURA key in .env for provider
TS_NODE_PROJECT='tsconfig.testing.json' ts-node test/PARASWAP-CORE/exampleVirtualUse.ts
*/
getPricesVolume();
