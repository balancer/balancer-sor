import cloneDeep from 'lodash.clonedeep';
import { PoolDataService, SubgraphPoolBase, SubgraphToken } from './types';

export class PoolCacher {
    private pools: SubgraphPoolBase[] = [];
    private _finishedFetching = false;

    constructor(private readonly poolDataService: PoolDataService) {}

    public get finishedFetching(): boolean {
        return this._finishedFetching;
    }

    public getPools(useBpts?: boolean): SubgraphPoolBase[] {
        const pools = cloneDeep(this.pools);
        // If we use join/exit paths add the pool token to its token list
        if (useBpts) {
            for (const pool of pools) {
                if (
                    pool.poolType === 'Weighted' ||
                    pool.poolType === 'Investment'
                ) {
                    const BptAsToken: SubgraphToken = {
                        address: pool.address,
                        balance: pool.totalShares,
                        decimals: 18,
                        priceRate: '1',
                        weight: '0',
                    };
                    pool.tokens.push(BptAsToken);
                    pool.tokensList.push(pool.address);
                }
            }
        }
        return pools;
    }

    /*
     * Saves updated pools data to internal cache.
     */
    public async fetchPools(): Promise<boolean> {
        try {
            this.pools = await this.poolDataService.getPools();
            this._finishedFetching = true;
            return true;
        } catch (err) {
            // On error clear all caches and return false so user knows to try again.
            this._finishedFetching = false;
            this.pools = [];
            console.error(`Error: fetchPools(): ${err}`);
            return false;
        }
    }
}
