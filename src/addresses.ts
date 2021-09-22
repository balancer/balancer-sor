export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
}

export const STABAL3POOL = {
    [Network.MAINNET]: {
        id: 'staBal3Id',
        address: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42',
    },
    [Network.KOVAN]: {
        id: 'staBal3Id',
        address: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42',
    },
};
