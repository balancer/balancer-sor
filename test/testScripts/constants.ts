import { AddressZero } from '@ethersproject/constants';
import { SorConfig } from '../../src';

export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    POLYGON = 137,
    ARBITRUM = 42161,
    OPTIMISM = 10,
    GNOSIS = 100,
    ZKEVM = 1101,
}

export const SOR_CONFIG: Record<Network, SorConfig> = {
    [Network.MAINNET]: {
        chainId: Network.MAINNET, //1
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        connectingTokens: [
            {
                symbol: 'weth',
                address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            },
            {
                symbol: 'DOLA',
                address: '0x865377367054516e17014CcdED1e7d814EDC9ce4',
            },
            {
                symbol: 'wstEth',
                address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            },
        ],
        wETHwstETH: {
            id: '0x32296969ef14eb0c6d29669c550d4a0449130230000200000000000000000080',
            address: '0x32296969ef14eb0c6d29669c550d4a0449130230',
        },
        lbpRaisingTokens: [
            '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
        ],
    },
    [Network.GOERLI]: {
        chainId: Network.GOERLI, //5
        vault: '0x65748E8287Ce4B9E6D83EE853431958851550311',
        weth: '0x9A1000D492d40bfccbc03f413A48F5B6516Ec0Fd',
        connectingTokens: [
            {
                symbol: 'weth',
                address: '0x9A1000D492d40bfccbc03f413A48F5B6516Ec0Fd',
            },
        ],
    },
    [Network.POLYGON]: {
        chainId: Network.POLYGON, //137
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        connectingTokens: [
            {
                symbol: 'weth',
                address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
            },
            {
                symbol: 'bbrz2',
                address: '0xe22483774bd8611be2ad2f4194078dac9159f4ba',
            }, // Joins Stables<>BRZ via https://app.balancer.fi/#/polygon/pool/0x4a0b73f0d13ff6d43e304a174697e3d5cfd310a400020000000000000000091c
        ],
        lbpRaisingTokens: [
            '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063', // DAI
            '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // USDC
            '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
        ],
    },
    [Network.ARBITRUM]: {
        chainId: Network.ARBITRUM, //42161
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        connectingTokens: [
            {
                symbol: 'weth',
                address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            },
        ],
        lbpRaisingTokens: [
            '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
            '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC
            '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
        ],
    },
    [Network.OPTIMISM]: {
        chainId: Network.OPTIMISM,
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x4200000000000000000000000000000000000006',
        connectingTokens: [
            {
                symbol: 'weth',
                address: '0x4200000000000000000000000000000000000006',
            },
        ],
        lbpRaisingTokens: [
            '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
            '0x7f5c764cbc14f9669b88837ca1490cca17c31607', // USDC
            '0x4200000000000000000000000000000000000006', // WETH
        ],
    },
    [Network.GNOSIS]: {
        chainId: Network.GNOSIS, //100
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
        connectingTokens: [
            {
                symbol: 'weth',
                address: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
            },
        ],
    },
    [Network.ZKEVM]: {
        chainId: Network.ZKEVM, //1101
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x4f9a0e7fd2bf6067db6994cf12e4495df938e6e9',
        connectingTokens: [
            {
                symbol: 'weth',
                address: '0x4f9a0e7fd2bf6067db6994cf12e4495df938e6e9',
            },
        ],
    },
};

export const PROVIDER_URLS = {
    [Network.MAINNET]: `https://mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.GOERLI]: `https://goerli.infura.io/v3/${process.env.INFURA}`,
    [Network.POLYGON]: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.ARBITRUM]: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.GNOSIS]: `https://poa-xdai.gateway.pokt.network/v1/lb/91bc0e12a76e7a84dd76189d`,
    [Network.ZKEVM]: `${process.env.RPC_URL_ZKEVM}`,
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
    100: '0xbb6fab6b627947dae0a75808250d8b2652952cb5',
    1101: '0xca11bde05977b3631167028862be2a173976ca11',
};

export const SUBGRAPH_URLS = {
    [Network.MAINNET]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2-beta',
    [Network.GOERLI]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
    [Network.POLYGON]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2-beta',
    [Network.ARBITRUM]: `https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2`,
    [Network.GNOSIS]: `https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-gnosis-chain-v2`,
    [Network.ZKEVM]: `https://api.studio.thegraph.com/query/24660/balancer-polygon-zk-v2/version/latest`,
};

// This is the same across networks
export const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

export const ADDRESSES = {
    [Network.MAINNET]: {
        BatchRelayer: {
            address: '0xdcdbf71A870cc60C6F9B621E28a7D3Ffd6Dd4965',
        },
        ETH: {
            address: AddressZero,
            decimals: 18,
            symbol: 'ETH',
        },
        BAL: {
            address: '0xba100000625a3754423978a60c9317c58a424e3d',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
            symbol: 'USDC',
        },
        WBTC: {
            address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            decimals: 8,
            symbol: 'WBTC',
        },
        WETH: {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            decimals: 18,
            symbol: 'WETH',
        },
        DAI: {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            decimals: 18,
            symbol: 'DAI',
        },
        STETH: {
            address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
            decimals: 18,
            symbol: 'STETH',
        },
        wSTETH: {
            address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            decimals: 18,
            symbol: 'wSTETH',
        },
        bbausdOld: {
            address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
            decimals: 18,
            symbol: 'bbausd',
        },
        bbausd: {
            address: '0xA13a9247ea42D743238089903570127DdA72fE44',
            decimals: 18,
            symbol: 'bbausd',
        },
        bbausdcOld: {
            address: '0x9210F1204b5a24742Eba12f710636D76240dF3d0',
            decimals: 18,
            symbol: 'bbausdc',
        },
        bbausdc: {
            address: '0x82698aecc9e28e9bb27608bd52cf57f704bd1b83',
            decimals: 18,
            symbol: 'bbausdc',
        },
        bbadaiOld: {
            address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
            decimals: 18,
            symbol: 'bb-a-dai',
        },
        bbadai: {
            address: '0xae37d54ae477268b9997d4161b96b8200755935c',
            decimals: 18,
            symbol: 'bb-a-dai2',
        },
        bbausdtOld: {
            address: '0x2f4eb100552ef93840d5adc30560e5513dfffacb',
            decimals: 18,
            symbol: 'bbaUSDT',
        },
        bbausdt: {
            address: '0x2F4eb100552ef93840d5aDC30560E5513DFfFACb',
            decimals: 18,
            symbol: 'bb-a-usdt',
        },
        waDAI: {
            address: '0x02d60b84491589974263d922d9cc7a3152618ef6',
            decimals: 18,
            symbol: 'waDAI',
        },
        waUSDC: {
            address: '0xd093fa4fb80d09bb30817fdcd442d4d02ed3e5de',
            decimals: 6,
            symbol: 'waUSDC',
        },
        RPL: {
            address: '0xD33526068D116cE69F19A9ee46F0bd304F21A51f',
            decimals: 18,
            symbol: 'RPL',
        },
        rETH: {
            address: '0xae78736Cd615f374D3085123A210448E74Fc6393',
            decimals: 18,
            symbol: 'rETH',
        },
        auraBal: {
            address: '0x616e8bfa43f920657b3497dbf40d6b1a02d4608d',
            decimals: 18,
            symbol: 'auraBal',
        },
        FIAT: {
            address: '0x586aa273f262909eef8fa02d90ab65f5015e0516',
            decimals: 18,
            symbol: 'FIAT',
        },
        USDT: {
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            decimals: 6,
            symbol: 'USDT',
        },
        balancerHelpers: '0x5aDDCCa35b7A0D07C74063c48700C8590E87864E',
        DBR: {
            address: '0xAD038Eb671c44b853887A7E32528FaB35dC5D710',
            decimals: 18,
            symbol: 'DBR',
        },
        APE: {
            address: '0x4d224452801aced8b2f0aebe155379bb5d594381',
            decimals: 18,
            symbol: 'APE',
        },
        sAPE: {
            address: '0x7966c5bae631294d7cffcea5430b78c2f76db6fa',
            decimals: 18,
            symbol: 'sAPE',
        },
        bbtAPE: {
            address: '0x126e7643235ec0ab9c103c507642dC3F4cA23C66'.toLowerCase(),
            decimals: 18,
            symbol: 'bbtAPE',
        },
        XSGD: {
            address: '0x70e8dE73cE538DA2bEEd35d14187F6959a8ecA96'.toLowerCase(),
            decimals: 18,
            symbol: 'XSGD',
        },
        EURS: {
            address: '0xdb25f211ab05b1c97d595516f45794528a807ad8',
            decimals: 2,
            symbol: 'EURS',
        },
    },
    [Network.POLYGON]: {
        MATIC: {
            address: AddressZero,
            decimals: 18,
            symbol: 'MATIC',
        },
        LINK: {
            address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39',
            decimals: 18,
            symbol: 'LINK',
        },
        BAL: {
            address: '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
        },
        WBTC: {
            address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
            decimals: 8,
            symbol: 'WBTC',
        },
        WETH: {
            address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
            decimals: 18,
            symbol: 'WETH',
        },
        DAI: {
            address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
            decimals: 18,
            symbol: 'DAI',
        },
        STETH: {
            address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
            decimals: 18,
            symbol: 'STETH',
        },
        stUSD_PLUS: {
            address: '0x5a5c6aa6164750b530b8f7658b827163b3549a4d',
            decimals: 6,
            symbol: 'stUSD+',
        },
        bstUSD_PLUS: {
            address: '0x1aafc31091d93c3ff003cff5d2d8f7ba2e728425',
            decimals: 18,
            symbol: 'bstUSD+',
        },
        USD_PLUS: {
            address: '0x5d9d8509c522a47d9285b9e4e9ec686e6a580850',
            decimals: 6,
            symbol: 'USD_PLUS',
        },
        USDT: {
            address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            decimals: 6,
            symbol: 'USDT',
        },
        DHT: {
            address: '0x8C92e38eCA8210f4fcBf17F0951b198Dd7668292',
            decimals: 18,
            symbol: 'DHT',
        },
        dUSD: {
            address: '0xbAe28251B2a4E621aA7e20538c06DEe010Bc06DE',
            decimals: 18,
            symbol: 'dUSD',
        },
        TUSD: {
            address: '0x2e1AD108fF1D8C782fcBbB89AAd783aC49586756',
            decimals: 18,
            symbol: 'TUSD',
        },
        TETUBAL: {
            address: '0x7fC9E0Aa043787BFad28e29632AdA302C790Ce33',
            decimals: 18,
            symbol: 'TETUBAL',
        },
        WETHBAL: {
            address: '0x3d468AB2329F296e1b9d8476Bb54Dd77D8c2320f',
            decimals: 18,
            symbol: 'WETHBAL',
        },
        bbamUSD: {
            address: '0x48e6B98ef6329f8f0A30eBB8c7C960330d648085',
            decimals: 18,
            symbol: 'bb-am-usd',
        },
        brz: {
            address: '0x491a4eb4f1fc3bff8e1d2fc856a6a46663ad556f',
            decimals: 4,
            symbol: 'BRZ',
        },
        XSGD: {
            address: '0xdc3326e71d45186f113a2f448984ca0e8d201995',
            decimals: 6,
            symbol: 'XSGD',
        },
        WMATIC: {
            address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
            decimals: 18,
            symbol: 'WMATIC',
        },
        stMATIC: {
            address: '0x3A58a54C066FdC0f2D55FC9C89F0415C92eBf3C4',
            decimals: 18,
            symbol: 'stMATIC',
        },
    },
    [Network.ARBITRUM]: {
        WETH: {
            address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            decimals: 18,
            symbol: 'WETH',
        },
        BAL: {
            address: '0x040d1edc9569d4bab2d15287dc5a4f10f56a56b8',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
            decimals: 6,
            symbol: 'USDC',
        },
        STETH: {
            address: 'N/A',
            decimals: 18,
            symbol: 'STETH',
        },
    },
    [Network.GNOSIS]: {
        WETH: {
            address: '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1',
            decimals: 18,
            symbol: 'WETH',
        },
        BAL: {
            address: '0x7eF541E2a22058048904fE5744f9c7E4C57AF717',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
            decimals: 6,
            symbol: 'USDC',
        },
        WXDAI: {
            address: '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d',
            decimals: 18,
            symbol: 'DAI',
        },
        USDT: {
            address: '0x4ECaBa5870353805a9F068101A40E0f32ed605C6',
            decimals: 6,
            symbol: 'USDT',
        },
    },
    [Network.GOERLI]: {
        DAI: {
            address: '0xb8096bc53c3ce4c11ebb0069da0341d75264b104',
            decimals: 18,
            symbol: 'DAI',
        },
        USDC: {
            address: '0xdabd33683bafdd448968ab6d6f47c3535c64bf0c',
            decimals: 6,
            symbol: 'USDC',
        },
    },
    [Network.ZKEVM]: {
        USDT: {
            address: '0x1e4a5963abfd975d8c9021ce480b42188849d41d',
            decimals: 6,
            symbol: 'USDT',
        },
        USDC: {
            address: '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035',
            decimals: 6,
            symbol: 'USDC',
        },
    },
};
