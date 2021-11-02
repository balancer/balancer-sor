import { formatFixed } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import { SubgraphPoolBase } from '../types';
import { isSameAddress } from '../utils';
import { Multicaller } from '../utils/multicaller';

const abi = [
    'function getPoolTokens(bytes32 poolId) external view returns (address[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock)',
    'function totalSupply() public view returns (uint256)',
    'function getNormalizedWeights() external view returns (uint256[] memory)',
    'function getSwapFeePercentage() public view returns (uint256)',
    'function getAmplificationParameter() external view returns (uint256 value, bool isUpdating, uint256 precision)',
    'function percentFee() public view returns (uint256)',
];

export async function getOnChainBalances(
    subgraphPools: SubgraphPoolBase[],
    multiAddress: string,
    vaultAddress: string,
    provider: Provider
): Promise<SubgraphPoolBase[]> {
    if (subgraphPools.length === 0) return subgraphPools;

    const multiPool = new Multicaller(multiAddress, provider, abi);

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
                    // amp is stored with 3 decimals of precision
                    subgraphPools[index].amp = formatFixed(
                        onchainData.amp[0],
                        3
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
