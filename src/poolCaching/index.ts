import { Provider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';
import { MULTIADDR, VAULTADDR } from '../constants';
import { SubgraphPoolBase } from '../types';
import { getOnChainBalances } from './onchainData';
import { fetchSubgraphPools } from './subgraph';

export class PoolCacher {
    private pools: SubgraphPoolBase[] = [];
    finishedFetchingOnChain = false;

    constructor(
        private provider: Provider,
        private chainId: number,
        private poolsUrl: string | null = null,
        initialPools: SubgraphPoolBase[] = []
    ) {
        this.pools = initialPools;
    }

    getPools(): SubgraphPoolBase[] {
        return cloneDeep(this.pools);
    }

    isConnectedToSubgraph(): boolean {
        return this.poolsUrl !== null;
    }

    /*
     * Saves updated pools data to internal onChainBalanceCache.
     * If isOnChain is true will retrieve all required onChain data. (false is advised to only be used for testing)
     * If poolsData is passed as parameter - uses this as pools source.
     * If poolsData was passed in to constructor - uses this as pools source.
     * If pools url was passed in to constructor - uses this to fetch pools source.
     */
    async fetchPools(
        poolsData: SubgraphPoolBase[] = [],
        isOnChain = true
    ): Promise<boolean> {
        try {
            let newPools: SubgraphPoolBase[];

            // If poolsData has been passed to function these pools should be used
            if (poolsData.length > 0) {
                newPools = cloneDeep(poolsData);
            } else {
                // Retrieve from URL if set otherwise use data passed in constructor
                if (this.poolsUrl !== null) {
                    newPools = await fetchSubgraphPools(
                        this.poolsUrl,
                        this.chainId
                    );
                } else {
                    newPools = this.pools;
                }
            }

            // Get latest on-chain balances (returns data in string/normalized format)
            this.pools = await this.fetchOnChainBalances(newPools, isOnChain);

            this.finishedFetchingOnChain = true;

            return true;
        } catch (err) {
            // On error clear all caches and return false so user knows to try again.
            this.finishedFetchingOnChain = false;
            this.pools = [];
            console.error(`Error: fetchPools(): ${err.message}`);
            return false;
        }
    }

    /*
     * Uses multicall contract to fetch all onchain balances for pools.
     */
    private async fetchOnChainBalances(
        subgraphPools: SubgraphPoolBase[],
        isOnChain = true
    ): Promise<SubgraphPoolBase[]> {
        if (subgraphPools.length === 0) {
            console.error('ERROR: No Pools To Fetch.');
            return [];
        }

        // Allows for testing
        if (!isOnChain) {
            console.log(
                `!!!!!!! WARNING - Not Using Real OnChain Balances !!!!!!`
            );
            return subgraphPools;
        }

        // This will return in normalized/string format
        const onChainPools = await getOnChainBalances(
            subgraphPools,
            MULTIADDR[this.chainId],
            VAULTADDR[this.chainId],
            this.provider
        );

        return onChainPools;
    }
}
