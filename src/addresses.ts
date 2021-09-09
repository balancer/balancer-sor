export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
}

export const MULTIMETASTABLEPOOL = {
    [Network.MAINNET]: { id: 'multiid', address: 'multiaddress' },
    [Network.KOVAN]: { id: 'multiid', address: 'multiaddress' },
};
