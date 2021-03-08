import fetch from 'isomorphic-fetch';
import { SubGraphPools } from './types';

export class POOLS {
    async getAllPublicSwapPools(URL: string): Promise<SubGraphPools> {
        const result = await fetch(URL);
        const allPools = result.json();
        return allPools;
    }
    /* !!!!!!! TODO Remove This
    async formatPoolsBigNumber(pools: SubGraphPools): Promise<Pools> {
        let onChainPools: Pools = { pools: [] };

        for (let i = 0; i < pools.pools.length; i++) {
            let tokens: Token[] = [];

            let p: SubGraphPool = {
                id: pools.pools[i].id,
                swapFee: bmath.bnum(pools.pools[i].swapFee),
                totalWeight: bmath.bnum(pools.pools[i].totalWeight),
                tokens: tokens,
                tokensList: pools.pools[i].tokensList,
            };

            pools.pools[i].tokens.forEach(token => {
                let decimals = Number(token.decimals);

                p.tokens.push({
                    address: token.address,
                    balance: bmath.bnum(token.balance),
                    decimals: decimals,
                    denormWeight: bmath.bnum(token.denormWeight),
                });
            });
            onChainPools.pools.push(p);
        }

        return onChainPools;
    }
    */
}
