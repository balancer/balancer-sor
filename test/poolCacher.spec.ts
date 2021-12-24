// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import cloneDeep from 'lodash.clonedeep';
import { MockPoolDataService } from './lib/mockPoolDataService';
import { expect } from 'chai';
import { PoolCacher } from '../src/poolCacher';
import { SubgraphPoolBase } from '../src';

const subgraphPoolsSmallWithTrade: {
    pools: SubgraphPoolBase[];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
} = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const filterTestPools = require('./testData/filterTestPools.json');

describe('PoolCacher', () => {
    describe('fetchPools', () => {
        it('should set fetch and store pools from the pool data service', async () => {
            const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);

            const poolCache = new PoolCacher(new MockPoolDataService(pools));
            await poolCache.fetchPools();

            expect(poolCache.getPools()).to.deep.eq(pools);
        });

        it(`should return false for fetchPools error`, async () => {
            const poolCache = new PoolCacher({
                getPools: async () => {
                    throw new Error('failure');
                },
            });
            const fetchSuccess = await poolCache.fetchPools();
            expect(fetchSuccess).to.be.false;
            expect(poolCache.finishedFetching).to.be.false;
        });

        it(`should fetch with NO scaling`, async () => {
            const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
            const poolCache = new PoolCacher(new MockPoolDataService(pools));
            const fetchSuccess = await poolCache.fetchPools();

            expect(fetchSuccess).to.be.true;

            expect(poolCache.finishedFetching).to.be.true;
            expect(poolCache.getPools()[1].tokens[1].balance).to.eq(
                pools[1].tokens[1].balance
            );
        });

        it(`should overwrite pools passed as input`, async () => {
            const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
            const mockPoolDataService = new MockPoolDataService(pools);
            const poolCache = new PoolCacher(mockPoolDataService);
            const newPools: { pools: SubgraphPoolBase[] } = {
                pools: filterTestPools.stableOnly,
            };

            // First fetch uses data passed as constructor
            let fetchSuccess = await poolCache.fetchPools();
            expect(fetchSuccess).to.be.true;
            expect(poolCache.finishedFetching).to.be.true;
            expect(pools).not.deep.equal(newPools.pools);
            expect(pools).deep.equal(poolCache.getPools());

            mockPoolDataService.setPools(newPools.pools);
            // Second fetch uses newPools
            fetchSuccess = await poolCache.fetchPools();
            expect(fetchSuccess).to.be.true;
            expect(poolCache.finishedFetching).to.be.true;
            expect(newPools.pools).to.not.deep.equal(pools);
            expect(poolCache.getPools()).to.not.deep.equal(pools);
            expect(poolCache.getPools()).to.deep.equal(newPools.pools);
        });
    });
});
