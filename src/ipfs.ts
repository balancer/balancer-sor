import fetch from 'isomorphic-fetch';
import { utils } from 'ethers';
import { SubGraphPools, Pools, Pool, Token } from './types';
import * as bmath from './bmath';

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

    async getAllPublicSwapPoolsBigNumber(pools): Promise<Pools> {
        let onChainPools: Pools = { pools: [] };

        for (let i = 0; i < pools.pools.length; i++) {
            let tokens: Token[] = [];

            let p: Pool = {
                id: pools.pools[i].id,
                swapFee: bmath.scale(bmath.bnum(pools.pools[i].swapFee), 18),
                totalWeight: bmath.scale(
                    bmath.bnum(pools.pools[i].totalWeight),
                    18
                ),
                tokens: tokens,
                tokensList: pools.pools[i].tokensList,
            };

            pools.pools[i].tokens.forEach(token => {
                let decimals = Number(token.decimals);

                p.tokens.push({
                    address: token.address,
                    balance: bmath.scale(bmath.bnum(token.balance), decimals),
                    decimals: decimals,
                    denormWeight: bmath.scale(
                        bmath.bnum(token.denormWeight),
                        18
                    ),
                });
            });
            onChainPools.pools.push(p);
        }

        return onChainPools;
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
