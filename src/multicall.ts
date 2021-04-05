import { Contract } from '@ethersproject/contracts';
import { BaseProvider } from '@ethersproject/providers';
import { Interface } from '@ethersproject/abi';
import { SubGraphPoolsBase, SubgraphPoolBase, SubGraphToken } from './types';
import * as bmath from './bmath';

export async function getOnChainBalances(
    pools: SubGraphPoolsBase,
    multiAddress: string,
    vaultAddress: string,
    provider: BaseProvider
): Promise<SubGraphPoolsBase> {
    let poolsWithOnChainBalance: SubGraphPoolsBase = { pools: [] };

    if (pools.pools.length === 0) return poolsWithOnChainBalance;

    const multiAbi = require('./abi/multicall.json');
    const vaultAbi = require('./abi/vault.json');

    const multicallContract = new Contract(multiAddress, multiAbi, provider);
    const vaultInterface = new Interface(vaultAbi);
    const calls = [];

    pools.pools.forEach(pool => {
        calls.push([
            vaultAddress,
            vaultInterface.encodeFunctionData('getPoolTokens', [pool.id]),
        ]);
    });

    try {
        const [, response] = await multicallContract.aggregate(calls);

        for (let i = 0; i < response.length; i++) {
            const result = vaultInterface.decodeFunctionResult(
                'getPoolTokens',
                response[i]
            );

            const resultTokens = result.tokens.map(token =>
                token.toLowerCase()
            );

            const poolTokens: SubGraphToken[] = [];

            const poolWithBalances: SubgraphPoolBase = {
                id: pools.pools[i].id,
                poolType: pools.pools[i].poolType,
                // !!!!!!! TO DO address?: pools.pools[i].address,
                swapFee: pools.pools[i].swapFee,
                totalWeight: pools.pools[i].totalWeight,
                tokens: poolTokens,
                tokensList: pools.pools[i].tokensList.map(token =>
                    token.toLowerCase()
                ),
                amp: pools.pools[i].amp,
                totalShares: pools.pools[i].totalShares,
            };

            pools.pools[i].tokens.forEach(token => {
                let resultIndex = resultTokens.indexOf(token.address);

                const balance = bmath
                    .scale(
                        bmath.bnum(result.balances[resultIndex]),
                        -Number(token.decimals)
                    )
                    .toString();
                poolWithBalances.tokens.push({
                    address: token.address.toLowerCase(),
                    balance: balance,
                    decimals: token.decimals,
                    weight: token.weight,
                });
            });

            poolsWithOnChainBalance.pools.push(poolWithBalances);
        }
    } catch (e) {
        console.error('Failure querying onchain balances', { error: e });
        return;
    }

    return poolsWithOnChainBalance;
}
