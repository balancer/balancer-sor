export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
}

export const STABLEINFO = {
    [Network.MAINNET]: {
        STABLECOINS: {
            USDC: {
                address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                decimals: 6,
                symbol: 'USDC',
                linearPoolId: 's',
                linearPoolAddress: 's',
            },
            DAI: {
                address: '0x6b175474e89094c44da98b954eedeac495271d0f',
                decimals: 18,
                symbol: 'DAI',
                linearPoolId: 's',
                linearPoolAddress: 's',
            },
        },
        MULTISTABLEPOOL: {
            id: '',
            address: '',
        },
    },
    [Network.KOVAN]: {
        // Visit https://balancer-faucet.on.fleek.co/#/faucet for test tokens
        STABLECOINS: {
            USDC: {
                address: '0xc2569dd7d0fd715B054fBf16E75B001E5c0C1115',
                decimals: 6,
                symbol: 'USDC',
                linearPoolId: 's',
                linearPoolAddress: 's',
            },
            DAI: {
                address: '0x04DF6e4121c27713ED22341E7c7Df330F56f289B',
                decimals: 18,
                symbol: 'DAI',
                linearPoolId: 's',
                linearPoolAddress: 's',
            },
        },
        MULTISTABLEPOOL: {
            id: '',
            address: '',
        },
    },
};
