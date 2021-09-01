import { BaseProvider } from '@ethersproject/providers';
import { SubgraphPoolBase } from '../types';
import { scale, bnum } from '../utils/bignumber';
import { Multicaller } from '../utils/multicaller';
import _ from 'lodash';

export async function getOnChainBalances(
    subgraphPools: SubgraphPoolBase[],
    multiAddress: string,
    vaultAddress: string,
    provider: BaseProvider
): Promise<SubgraphPoolBase[]> {
    if (subgraphPools.length === 0) return subgraphPools;

    /* eslint-disable @typescript-eslint/no-var-requires */
    const vaultAbi = require('../abi/Vault.json');
    const weightedPoolAbi = require('../pools/weightedPool/weightedPoolAbi.json');
    const stablePoolAbi = require('../pools/stablePool/stablePoolAbi.json');
    const elementPoolAbi = require('../pools/elementPool/ConvergentCurvePool.json');
    /* eslint-enable @typescript-eslint/no-var-requires */

    // TODO: decide whether we want to trim these ABIs down to the relevant functions
    const abis = Object.values(
        // Remove duplicate entries using their names
        Object.fromEntries(
            [
                ...vaultAbi,
                ...weightedPoolAbi,
                ...stablePoolAbi,
                ...elementPoolAbi,
            ].map((row) => [row.name, row])
        )
    );

    const multiPool = new Multicaller(multiAddress, provider, abis);

    subgraphPools.forEach((pool, i) => {
        // TO DO - This is a temp filter
        if (
            pool.id ===
            '0x6b15a01b5d46a5321b627bd7deef1af57bc629070000000000000000000000d4'
        )
            subgraphPools.splice(i, 1);

        multiPool.call(`${pool.id}.poolTokens`, vaultAddress, 'getPoolTokens', [
            pool.id,
        ]);
        multiPool.call(`${pool.id}.totalSupply`, pool.address, 'totalSupply');

        // TO DO - Make this part of class to make more flexible?
        if (pool.poolType === 'Weighted') {
            multiPool.call(
                `${pool.id}.weights`,
                pool.address,
                'getNormalizedWeights'
            );
            multiPool.call(
                `${pool.id}.swapFee`,
                pool.address,
                'getSwapFeePercentage'
            );
        } else if (
            pool.poolType === 'Stable' ||
            pool.poolType === 'MetaStable'
        ) {
            // MetaStable is the same as Stable for multicall purposes
            multiPool.call(
                `${pool.id}.amp`,
                pool.address,
                'getAmplificationParameter'
            );
            multiPool.call(
                `${pool.id}.swapFee`,
                pool.address,
                'getSwapFeePercentage'
            );
        } else if (pool.poolType === 'Element') {
            multiPool.call(`${pool.id}.swapFee`, pool.address, 'percentFee');
        }
    });

    const pools = (await multiPool.execute()) as Record<
        string,
        {
            amp?: string;
            swapFee?: string;
            weights?: string[];
            poolTokens: {
                tokens: string[];
                balances: string[];
            };
        }
    >;

    Object.entries(pools).forEach(([poolId, onchainData]) => {
        try {
            const { poolTokens, swapFee, weights } = onchainData;

            subgraphPools[poolId].swapFee = scale(
                bnum(swapFee),
                -18
            ).toString();

            poolTokens.tokens.forEach((token, i) => {
                const T = subgraphPools[poolId].tokens.find(
                    (t) => t.address === token.toLowerCase()
                );
                T.balance = scale(
                    bnum(poolTokens.balances[i]),
                    -Number(T.decimals)
                ).toString();
                if (subgraphPools[poolId].poolType === 'Weighted') {
                    T.weight = scale(bnum(weights[i]), -18).toString();
                }
            });
        } catch (err) {
            // Likely an unsupported pool type
            // console.log(`Issue with pool onchain call`)
            // console.log(subgraphPool.id);
            // console.log(onChainResult);
        }
    });

    return subgraphPools;
}
