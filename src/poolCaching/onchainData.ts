import { formatFixed } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import { SubgraphPoolBase } from '../types';
import { isSameAddress } from '../utils';
import { Multicaller } from '../utils/multicaller';

// TODO: decide whether we want to trim these ABIs down to the relevant functions
import vaultAbi from '../abi/Vault.json';
import weightedPoolAbi from '../pools/weightedPool/weightedPoolAbi.json';
import stablePoolAbi from '../pools/stablePool/stablePoolAbi.json';
import elementPoolAbi from '../pools/elementPool/ConvergentCurvePool.json';
import linearPoolAbi from '../pools/linearPool/linearPoolAbi.json';

export async function getOnChainBalances(
    subgraphPools: SubgraphPoolBase[],
    multiAddress: string,
    vaultAddress: string,
    provider: Provider
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
                ...linearPoolAbi,
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
            pool.poolType === 'MetaStable' ||
            pool.poolType === 'StablePhantom'
        ) {
            // MetaStable & StablePhantom is the same as Stable for multicall purposes
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
        } else if (pool.poolType === 'Linear') {
            multiPool.call(
                `${pool.id}.swapFee`,
                pool.address,
                'getSwapFeePercentage'
            );

            multiPool.call(`${pool.id}.targets`, pool.address, 'getTargets');
            multiPool.call(
                `${pool.id}.mainIndex`,
                pool.address,
                'getMainIndex'
            );
            multiPool.call(
                `${pool.id}.wrappedIndex`,
                pool.address,
                'getWrappedIndex'
            );

            multiPool.call(
                `${pool.id}.wrappedTokenRateCache`,
                pool.address,
                'getWrappedTokenRateCache'
            );
        }
    });

    let pools = {} as Record<
        string,
        {
            amp?: string[];
            swapFee: string;
            weights?: string[];
            targets?: string[];
            mainIndex?: string;
            wrappedIndex?: string;
            poolTokens: {
                tokens: string[];
                balances: string[];
            };
            wrappedTokenRateCache?: string;
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
                subgraphPools[index].poolType === 'MetaStable' ||
                subgraphPools[index].poolType === 'StablePhantom'
            ) {
                if (!onchainData.amp) {
                    throw `Stable Pool Missing Amp: ${poolId}`;
                } else {
                    // Need to scale amp by precision to match expected Subgraph scale
                    // amp is stored with 3 decimals of precision
                    subgraphPools[index].amp = formatFixed(
                        onchainData.amp[0],
                        3
                    );
                }
            }

            if (subgraphPools[index].poolType === 'Linear') {
                if (!onchainData.targets)
                    throw `Linear Pool Missing Targets: ${poolId}`;
                else {
                    subgraphPools[index].lowerTarget = formatFixed(
                        onchainData.targets[0],
                        18
                    );
                    subgraphPools[index].upperTarget = formatFixed(
                        onchainData.targets[1],
                        18
                    );
                }

                if (!onchainData.mainIndex)
                    throw `Linear Pool Missing MainIndex: ${poolId}`;
                else
                    subgraphPools[index].mainIndex = Number(
                        onchainData.mainIndex
                    );

                if (!onchainData.wrappedIndex)
                    throw `Linear Pool Missing WrappedIndex: ${poolId}`;
                else
                    subgraphPools[index].wrappedIndex = Number(
                        onchainData.wrappedIndex
                    );

                if (!onchainData.wrappedTokenRateCache)
                    throw `Linear Pool Missing WrappedTokenRateCache: ${poolId}`;
                else {
                    subgraphPools[index].tokens[
                        onchainData.wrappedIndex
                    ].priceRate = formatFixed(
                        onchainData.wrappedTokenRateCache[0],
                        18
                    );
                }
            }

            subgraphPools[index].swapFee = formatFixed(swapFee, 18);

            poolTokens.tokens.forEach((token, i) => {
                const T = subgraphPools[index].tokens.find((t) =>
                    isSameAddress(t.address, token)
                );
                if (!T) throw `Pool Missing Expected Token: ${poolId} ${token}`;
                T.balance = formatFixed(poolTokens.balances[i], T.decimals);
                if (weights) {
                    // Only expected for WeightedPools
                    T.weight = formatFixed(weights[i], 18);
                }
            });
        } catch (err) {
            throw `Issue with pool onchain data: ${err}`;
        }
    });

    return subgraphPools;
}
