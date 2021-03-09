import fetch from 'isomorphic-fetch';
import { SubGraphPools } from './types';

export class POOLS {
    async getAllPublicSwapPools(URL: string): Promise<SubGraphPools> {
        const result = await fetch(URL);
        const allPools = result.json();
        return allPools;
    }
}
