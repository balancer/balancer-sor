import { JsonRpcProvider } from '@ethersproject/providers';
import {
    PROVIDER_URLS,
    VAULT,
    SUBGRAPH_URLS,
    MULTIADDR,
} from '../PARASWAP-CORE/constants';
import { BalancerV2 } from '../PARASWAP-CORE/balancerV2';
import { mockVirtualPools } from '../testData/mockPools';
import { VirtualBoostedPool } from '../PARASWAP-CORE/VirtualBoostedPool';

async function getOnChain() {
    const network = 1;
    const provider = new JsonRpcProvider(PROVIDER_URLS[network]);
    const balancer = new BalancerV2(
        network,
        VAULT[network],
        SUBGRAPH_URLS[network],
        MULTIADDR[network],
        provider
    );

    const virtualPool = new VirtualBoostedPool();
    // mockVirtualPools === All pools returned by current Subgraph
    // getVirtualBoostedPools returns new VirtualBoostedPool types for all hardcoded values
    // These pools have tokens list of main tokens
    // ParaSwap would have to add this step
    const virtualPools = virtualPool.getVirtualBoostedPools(mockVirtualPools);
    // And also this step - Add virtual pools to main list
    const allPools = [...virtualPools, mockVirtualPools[4]];

    // ParaSwap now call getPricesVolume.
    // This initially searches allPools for pools that contain tokenIn and tokenOut - now virtualPools will be considered i.e. USDC<>DAI
    // These pools are then updated with onchain state
    // Here we need some additions to get onChain state for all pools associated with VirtualPool
    // Added VirtualBoostedPool helper getOnChainCalls that creates multicall data for all associated pools
    // And decodeOnChainCalls that decodes all these in correct order (without affecting other pools)
    // Added to getOnChainState in an easy way
    const onChainPools = await balancer.getOnChainState(allPools);

    // console.log(onChainPools);

    // Paraswap then loop each pool and call getPricesPool with single pool state
    // We would need a change to include all pool states as we need all pools in Boosted bunch
    // This eventually calls _calcOutGivenIn on VirtualPool which handles path math to return amounts
    const prices = balancer.getPricesPool(
        'from',
        'to',
        virtualPools[0],
        onChainPools,
        []
    );

    // Add a helper to produce BatchSwap Info - not sure how this would be used?
}

// TS_NODE_PROJECT='tsconfig.testing.json' ts-node test/PARASWAP-HELPERS/getPrices.ts
getOnChain();
