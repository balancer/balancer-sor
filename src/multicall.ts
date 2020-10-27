import { ethers, utils, Contract } from 'ethers';
import { Pools, Pool, SubGraphPools, Token } from './types';
import * as bmath from './bmath';

export async function getAllPoolDataOnChain(
    pools: SubGraphPools,
    multiAddress: string,
    provider: ethers.providers.Web3Provider
): Promise<Pools> {
    if (pools.pools.length === 0) throw Error('There are no pools.');

    const customMultiAbi = require('./abi/customMulticall.json');
    const contract = new Contract(multiAddress, customMultiAbi, provider);

    let addresses = [];
    let total = 0;

    for (let i = 0; i < pools.pools.length; i++) {
        let pool = pools.pools[i];

        addresses.push([pool.id]);
        total++;
        pool.tokens.forEach((token, tokenIndex) => {
            addresses[i].push(token.address);
            total++;
        });
    }

    try {
        let results = await contract.getPoolInfo(addresses, total);

        let j = 0;
        let onChainPools: Pools = { pools: [] };

        for (let i = 0; i < pools.pools.length; i++) {
            let tokens: Token[] = [];
            let publicSwap = true;
            if (pools.pools[i].publicSwap === 'false') publicSwap = false;

            let p: Pool = {
                id: pools.pools[i].id,
                swapFee: bmath.scale(bmath.bnum(pools.pools[i].swapFee), 18),
                totalWeight: bmath.scale(
                    bmath.bnum(pools.pools[i].totalWeight),
                    18
                ),
                publicSwap: publicSwap,
                tokens: tokens,
                tokensList: pools.pools[i].tokensList,
            };

            pools.pools[i].tokens.forEach(token => {
                let bal = bmath.bnum(results[j]);
                j++;
                p.tokens.push({
                    id: token.id,
                    address: token.address,
                    balance: bal,
                    decimals: Number(token.decimals),
                    symbol: token.symbol,
                    denormWeight: bmath.scale(
                        bmath.bnum(token.denormWeight),
                        18
                    ),
                });
            });
            onChainPools.pools.push(p);
        }
        return onChainPools;
    } catch (e) {
        console.error('Failure querying onchain balances', { error: e });
        return;
    }
}
