export interface TestToken {
    address: string;
    decimals: number;
}

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
