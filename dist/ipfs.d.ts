import { SubGraphPools, Pools } from './types';
export declare class IPFS {
    get(ipfsHash: any, protocolType?: string): any;
    getAllPublicSwapPools(
        IpfsHash: string,
        ProtocolType: string
    ): Promise<SubGraphPools>;
    getAllPublicSwapPoolsBigNumber(pools: any): Promise<Pools>;
    getFilteredPools(
        TokenIn: string,
        TokenOut: string,
        IpfsHash: string,
        ProtocolType: string
    ): Promise<SubGraphPools>;
    getPoolsWithToken(
        Token: string,
        IpfsHash: string,
        ProtocolType: string
    ): Promise<SubGraphPools>;
}
