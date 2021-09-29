import { BaseProvider } from '@ethersproject/providers';
import { SubgraphPoolBase } from '../types';
import { isSameAddress } from '../utils';
import { scale, bnum } from '../utils/bignumber';
import { Multicaller } from '../utils/multicaller';

// TODO: decide whether we want to trim these ABIs down to the relevant functions
import vaultAbi from '../abi/Vault.json';
import weightedPoolAbi from '../pools/weightedPool/weightedPoolAbi.json';
import stablePoolAbi from '../pools/stablePool/stablePoolAbi.json';
import elementPoolAbi from '../pools/elementPool/ConvergentCurvePool.json';

export async function getOnChainBalances(
    subgraphPools: SubgraphPoolBase[],
    multiAddress: string,
    vaultAddress: string,
    provider: BaseProvider
): Promise<SubgraphPoolBase[]> {
    if (subgraphPools.length === 0) return subgraphPools;

    const abis: any = Object.values(
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

    subgraphPools.forEach((pool) => {
        multiPool.call(`${pool.id}.poolTokens`, vaultAddress, 'getPoolTokens', [
            pool.id,
        ]);
        multiPool.call(`${pool.id}.totalSupply`, pool.address, 'totalSupply');

        // TO DO - Make this part of class to make more flexible?
        if (
            pool.poolType === 'Weighted' ||
            pool.poolType === 'LiquidityBootstrapping' ||
            pool.poolType === 'Investment'
        ) {
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

    let pools = {} as Record<
        string,
        {
            amp?: string[];
            swapFee: string;
            weights?: string[];
            poolTokens: {
                tokens: string[];
                balances: string[];
            };
        }
    >;

    try {
        pools = (await multiPool.execute()) as Record<
            string,
            {
                amp?: string[];
                swapFee: string;
                weights?: string[];
                poolTokens: {
                    tokens: string[];
                    balances: string[];
                };
            }
        >;
    } catch (err) {
        throw `Issue with multicall execution.`;
    }

    Object.entries(pools).forEach(([poolId, onchainData], index) => {
        try {
            const { poolTokens, swapFee, weights } = onchainData;

            if (
                subgraphPools[index].poolType === 'Stable' ||
                subgraphPools[index].poolType === 'MetaStable'
            ) {
                if (!onchainData.amp) {
                    throw `Stable Pool Missing Amp: ${poolId}`;
                } else {
                    // Need to scale amp by precision to match expected Subgraph scale
                    subgraphPools[index].amp = bnum(onchainData.amp[0])
                        .div(bnum(onchainData.amp[2]))
                        .toString();
                }
            }

            subgraphPools[index].swapFee = scale(bnum(swapFee), -18).toString();

            poolTokens.tokens.forEach((token, i) => {
                const T = subgraphPools[index].tokens.find((t) =>
                    isSameAddress(t.address, token)
                );
                if (!T) throw `Pool Missing Expected Token: ${poolId} ${token}`;
                T.balance = scale(
                    bnum(poolTokens.balances[i]),
                    -Number(T.decimals)
                ).toString();
                if (weights) {
                    // Only expected for WeightedPools
                    T.weight = scale(bnum(weights[i]), -18).toString();
                }
            });
        } catch (err) {
            throw `Issue with pool onchain data: ${err}`;
        }
    });

    return subgraphPools;
}
