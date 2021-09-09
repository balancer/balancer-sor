export declare enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
}
export declare const STABLEINFO: {
    1: {
        STABLECOINS: {
            USDC: {
                address: string;
                decimals: number;
                symbol: string;
                linearPoolId: string;
                linearPoolAddress: string;
            };
            DAI: {
                address: string;
                decimals: number;
                symbol: string;
                linearPoolId: string;
                linearPoolAddress: string;
            };
        };
        MULTISTABLEPOOL: {
            id: string;
            address: string;
        };
    };
    42: {
        STABLECOINS: {
            USDC: {
                address: string;
                decimals: number;
                symbol: string;
                linearPoolId: string;
                linearPoolAddress: string;
            };
            DAI: {
                address: string;
                decimals: number;
                symbol: string;
                linearPoolId: string;
                linearPoolAddress: string;
            };
        };
        MULTISTABLEPOOL: {
            id: string;
            address: string;
        };
    };
};
