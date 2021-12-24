import cloneDeep from 'lodash.clonedeep';
import { PoolDataService, SubgraphPoolBase } from './types';

export class PoolCacher {
    private pools: SubgraphPoolBase[] = [];
    private _finishedFetching = false;

    constructor(private readonly poolDataService: PoolDataService) {}

    public get finishedFetching(): boolean {
        return this._finishedFetching;
    }

    public getPools(): SubgraphPoolBase[] {
        return cloneDeep(this.pools);
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
            console.error(`Error: fetchPools(): ${err.message}`);
            return false;
        }
    }
}
