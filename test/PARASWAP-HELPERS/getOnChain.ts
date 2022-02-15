import { JsonRpcProvider } from '@ethersproject/providers';
import { BalancerV2 } from './balancerV2';
import { SorConfig } from '../../src';
import { mockVirtualPools } from '../testData/mockPools';
import { VirtualBoostedPool } from '../PARASWAP-CORE/VirtualBoostedPool';

export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
    ARBITRUM = 42161,
}

export const SOR_CONFIG: Record<Network, SorConfig> = {
    [Network.MAINNET]: {
        chainId: Network.MAINNET, //1
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        staBal3Pool: {
            id: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
            address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
        },
    },
    [Network.KOVAN]: {
        chainId: Network.KOVAN, //42
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
        staBal3Pool: {
            id: '0x8fd162f338b770f7e879030830cde9173367f3010000000000000000000004d8',
            address: '0x8fd162f338b770f7e879030830cde9173367f301',
        },
        wethStaBal3: {
            id: '0x6be79a54f119dbf9e8ebd9ded8c5bd49205bc62d00020000000000000000033c',
            address: '0x6be79a54f119dbf9e8ebd9ded8c5bd49205bc62d',
        },
    },
    [Network.GOERLI]: {
        chainId: Network.GOERLI, //5
        vault: '0x65748E8287Ce4B9E6D83EE853431958851550311',
        weth: '0x9A1000D492d40bfccbc03f413A48F5B6516Ec0Fd',
    },
    [Network.POLYGON]: {
        chainId: Network.POLYGON, //137
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    },
    [Network.ARBITRUM]: {
        chainId: Network.ARBITRUM, //42161
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    },
};

export const PROVIDER_URLS = {
    [Network.MAINNET]: `https://mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.GOERLI]: `https://goerli.infura.io/v3/${process.env.INFURA}`,
    [Network.KOVAN]: `https://kovan.infura.io/v3/${process.env.INFURA}`,
    [Network.POLYGON]: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.ARBITRUM]: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA}`,
};

export const MULTIADDR: { [chainId: number]: string } = {
    1: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    3: '0x53c43764255c17bd724f74c4ef150724ac50a3ed',
    4: '0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821',
    5: '0x3b2A02F22fCbc872AF77674ceD303eb269a46ce3',
    42: '0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A',
    137: '0xa1B2b503959aedD81512C37e9dce48164ec6a94d',
    42161: '0x269ff446d9892c9e19082564df3f5e8741e190a1',
    99: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
};

export const SUBGRAPH_URLS = {
    [Network.MAINNET]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
    [Network.GOERLI]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
    [Network.KOVAN]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan-v2',
    [Network.POLYGON]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2',
    [Network.ARBITRUM]: `https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2`,
};

async function getOnChain() {
    const network = 1;
    const provider = new JsonRpcProvider(PROVIDER_URLS[network]);

    const balancer = new BalancerV2(
        network,
        SOR_CONFIG[network].vault,
        SUBGRAPH_URLS[network],
        MULTIADDR[network],
        provider
    );

    // const pools: SubgraphPoolBase[] = [
    //     {
    //         address: '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8',
    //         id: '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019',
    //         poolType: 'Weighted',
    //         tokens: [
    //             {
    //                 address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    //                 decimals: 6,
    //                 // symbol: 'USDC',
    //             },
    //             {
    //                 address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //                 decimals: 18,
    //                 // symbol: 'WETH',
    //             },
    //         ],
    //     },
    // ];
    const virtualPool = new VirtualBoostedPool();
    const virtualPools = virtualPool.getVirtualBoostedPools(mockVirtualPools);

    const onChainPools = await balancer.getOnChainState([
        ...virtualPools,
        mockVirtualPools[4],
    ]);

    console.log(`RESULT: `);
    Object.entries(onChainPools).forEach(([key, value]) => {
        console.log(`'${key}':`);
        console.log(value);
    });
}

// TS_NODE_PROJECT='tsconfig.testing.json' ts-node test/PARASWAP-HELPERS/getOnChain.ts
getOnChain();
