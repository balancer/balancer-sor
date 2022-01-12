import { SorConfig } from '../../src';

export interface TestToken {
    address: string;
    decimals: number;
}

export const sorConfigTest = {
    chainId: 99,
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    vault: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    usdcConnectingPool: {
        id: 'usdcConnecting',
        usdc: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
    },
    staBal3Pool: {
        id: 'staBal3Id',
        address: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42',
    },
    wethStaBal3: {
        id: 'weightedWethStaBal3Id',
        address: 'weightedWethStaBal3',
    },
};

export const sorConfigEth: SorConfig = {
    chainId: 1,
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    vault: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    staBal3Pool: {
        id: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
        address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
    },
};

export const sorConfigKovan: SorConfig = {
    chainId: 42,
    weth: '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
    vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    staBal3Pool: {
        id: '0x8fd162f338b770f7e879030830cde9173367f3010000000000000000000004d8',
        address: '0x8fd162f338b770f7e879030830cde9173367f301',
    },
    wethStaBal3: {
        id: '0x6be79a54f119dbf9e8ebd9ded8c5bd49205bc62d00020000000000000000033c',
        address: '0x6be79a54f119dbf9e8ebd9ded8c5bd49205bc62d',
    },
};

export const WETH: TestToken = {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(),
    decimals: 18,
};
export const DAI: TestToken = {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(),
    decimals: 18,
};
export const aDAI: TestToken = {
    address: '0xfc1e690f61efd961294b3e1ce3313fbd8aa4f85d',
    decimals: 18,
};
export const USDC: TestToken = {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(),
    decimals: 6,
};
export const bUSDC: TestToken = {
    address: '0x0000000000000000000000000000000000000001',
    decimals: 18,
};
export const BAL: TestToken = {
    address: '0xba100000625a3754423978a60c9317c58a424e3D'.toLowerCase(),
    decimals: 18,
};
export const bDAI: TestToken = {
    address: '0x0000000000000000000000000000000000000002',
    decimals: 18,
};
export const staBAL3: TestToken = {
    address: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42',
    decimals: 18,
};

export const WBTC: TestToken = {
    address: '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb'.toLowerCase(),
    decimals: 8,
};

export const MKR: TestToken = {
    address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2'.toLowerCase(),
    decimals: 18,
};

export const USDT: TestToken = {
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7'.toLowerCase(),
    decimals: 6,
};

export const GUSD: TestToken = {
    address: '0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd'.toLowerCase(),
    decimals: 2,
};

export const TUSD: TestToken = {
    address: '0x0000000000085d4780b73119b644ae5ecd22b376'.toLowerCase(),
    decimals: 18,
};

export const bTUSD: TestToken = {
    address: '0x0000000000000000000000000000000000000005'.toLowerCase(),
    decimals: 18,
};

export const stETH: TestToken = {
    address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84'.toLowerCase(),
    decimals: 18,
};

export const LINEAR_AUSDT: TestToken = {
    address: '0x6a8c3239695613c0710dc971310b36f9b81e115e',
    decimals: 18,
};

export const LINEAR_AUSDC: TestToken = {
    address: '0x3d1b554f1b1d1b6108b601ff22fea9c90fdfe50d',
    decimals: 18,
};

export const LINEAR_ADAI: TestToken = {
    address: '0xcd32a460b6fecd053582e43b07ed6e2c04e15369',
    decimals: 18,
};

export const STABAL3PHANTOM: TestToken = {
    address: '0x8fd162f338b770f7e879030830cde9173367f301',
    decimals: 18,
};

export const aUSDT: TestToken = {
    address: '0xe8191aacfcdb32260cda25830dc6c9342142f310',
    decimals: 6,
};

export const KOVAN_BAL: TestToken = {
    address: '0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7',
    decimals: 18,
};

export const AAVE_USDT: TestToken = {
    address: '0x13512979ade267ab5100878e2e0f485b568328a4',
    decimals: 6,
};
