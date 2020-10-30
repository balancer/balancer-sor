import fetch from 'isomorphic-fetch';
import { utils } from 'ethers';
import { SubGraphPools } from './types';

export class IPFS {
    get(ipfsHash, protocolType = 'ipfs') {
        const url = `https://${process.env.IPFS_NODE}/${protocolType}/${ipfsHash}`;
        return fetch(url).then(res => res.json());
    }

    async getAllPublicSwapPools(
        IpfsHash: string,
        ProtocolType: string
    ): Promise<SubGraphPools> {
        let allPools = await this.get(IpfsHash, ProtocolType);
        return allPools;
    }

    async getFilteredPools(
        TokenIn: string,
        TokenOut: string,
        IpfsHash: string,
        ProtocolType: string
    ): Promise<SubGraphPools> {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();

        let allPools = await this.get(IpfsHash, ProtocolType);

        let filteredPools = [];

        allPools.pools.forEach(pool => {
            if (pool.tokensList.includes(TokenIn)) {
                filteredPools.push(pool);
            } else if (pool.tokensList.includes(TokenOut)) {
                filteredPools.push(pool);
            }
        });

        return { pools: filteredPools };
    }

    async getPoolsWithToken(
        Token: string,
        IpfsHash: string,
        ProtocolType: string
    ): Promise<SubGraphPools> {
        Token = Token.toLowerCase();

        let allPools = await this.get(IpfsHash, ProtocolType);
        let filteredPools = [];

        allPools.pools.forEach(pool => {
            if (pool.tokensList.includes(Token)) {
                filteredPools.push(pool);
            }
        });

        return { pools: filteredPools };
    }
}
