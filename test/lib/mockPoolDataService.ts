import { PoolDataService, SubgraphPoolBase } from '../../src';

export class MockPoolDataService implements PoolDataService {
    constructor(private pools: SubgraphPoolBase[] = []) {}

    public async getPools(): Promise<SubgraphPoolBase[]> {
        return this.pools;
    }

    public setPools(pools: SubgraphPoolBase[]): void {
        this.pools = pools;
    }
}

export const mockPoolDataService = new MockPoolDataService();
