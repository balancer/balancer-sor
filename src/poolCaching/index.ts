import { BaseProvider } from '@ethersproject/providers';
import { MULTIADDR, VAULTADDR } from '../constants';
import { SubgraphPoolBase, SubGraphPoolsBase } from '../types';
import { getOnChainBalances } from './multicall';
import { fetchSubgraphPools } from './subgraph';

export class PoolCacher {
    private provider: BaseProvider;
    private chainId: number;
    private isUsingPoolsUrl: boolean;
    private poolsUrl: string;
    private pools: SubgraphPoolBase[] = [];
    finishedFetchingOnChain = false;

    constructor(
        provider: BaseProvider,
        chainId: number,
        poolsSource: string | SubgraphPoolBase[]
    ) {
        this.provider = provider;
        this.chainId = chainId;
        // The pools source can be a URL (e.g. pools from Subgraph) or a data set of pools
        if (typeof poolsSource === 'string') {
            this.isUsingPoolsUrl = true;
            this.poolsUrl = poolsSource;
        } else {
            this.isUsingPoolsUrl = false;
            this.pools = poolsSource;
        }
    }

    getPools(): SubgraphPoolBase[] {
        return this.pools;
    }

    isConnectedToSubgraph(): boolean {
        return !!this.poolsUrl;
    }

    /*
     * Saves updated pools data to internal onChainBalanceCache.
     * If isOnChain is true will retrieve all required onChain data. (false is advised to only be used for testing)
     * If poolsData is passed as parameter - uses this as pools source.
     * If poolsData was passed in to constructor - uses this as pools source.
     * If pools url was passed in to constructor - uses this to fetch pools source.
     */
    async fetchPools(
        isOnChain = true,
        poolsData: SubgraphPoolBase[] = []
    ): Promise<boolean> {
        try {
            // If poolsData has been passed to function these pools should be used
            const isExternalPoolData = poolsData.length > 0 ? true : false;

            let subgraphPools: SubgraphPoolBase[];

            if (isExternalPoolData) {
                subgraphPools = JSON.parse(JSON.stringify(poolsData));
                // Store as latest pools data
                if (!this.isUsingPoolsUrl) this.pools = subgraphPools;
            } else {
                // Retrieve from URL if set otherwise use data passed in constructor
                if (this.isUsingPoolsUrl) {
                    const { pools } = await fetchSubgraphPools(this.poolsUrl);
                    subgraphPools = pools;
                } else subgraphPools = this.pools;
            }

            // Get latest on-chain balances (returns data in string/normalized format)
            this.pools = await this.fetchOnChainBalances(
                subgraphPools,
                isOnChain
            );

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
        const onChainPools: SubGraphPoolsBase = await getOnChainBalances(
            { pools: subgraphPools },
            MULTIADDR[this.chainId],
            VAULTADDR[this.chainId],
            this.provider
        );

        // Error with multicall
        if (!onChainPools) return [];

        return onChainPools.pools;
    }
}
