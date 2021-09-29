require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { expect } from 'chai';
import { PoolCacher } from '../src/poolCaching';
import { SubgraphPoolBase } from '../src/types';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const chainId = 1;
const poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;

describe('PoolCacher', () => {
    describe('constructor', () => {
        it(`should correctly report whether it is connected to a subgraph`, () => {
            const connectedPoolCache = new PoolCacher(
                provider,
                chainId,
                poolsUrl
            );
            expect(connectedPoolCache.isConnectedToSubgraph()).to.be.true;

            const disconnectedpoolCache = new PoolCacher(
                provider,
                chainId,
                null,
                []
            );
            expect(disconnectedpoolCache.isConnectedToSubgraph()).to.be.false;
        });

        it(`should set pools source to pools passed`, () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
            const pools = poolsFromFile.pools;
            const poolCache = new PoolCacher(provider, chainId, null, pools);

            expect(poolCache.getPools()).to.deep.eq(poolsFromFile.pools);
        });
    });

    describe('fetchPools', () => {
        it(`should return false for fetchPools error`, async () => {
            const failUrl = ``;
            const poolCache = new PoolCacher(provider, chainId, failUrl);
            const fetchSuccess = await poolCache.fetchPools();
            expect(fetchSuccess).to.be.false;
            expect(poolCache.finishedFetchingOnChain).to.be.false;
        }).timeout(100000);

        it(`should fetch with NO scaling`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
            const pools = poolsFromFile.pools;
            const poolCache = new PoolCacher(provider, chainId, null, pools);

            const fetchSuccess = await poolCache.fetchPools([], false);
            expect(fetchSuccess).to.be.true;

            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(poolCache.getPools()[1].tokens[1].balance).to.eq(
                poolsFromFile.pools[1].tokens[1].balance
            );
        });

        it(`should overwrite pools passed as input`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
            const pools = poolsFromFile.pools;
            const poolCache = new PoolCacher(provider, chainId, null, pools);

            const testPools = require('./testData/filterTestPools.json');
            const newPools: {
                pools: SubgraphPoolBase[];
            } = { pools: testPools.stableOnly };

            // First fetch uses data passed as constructor
            let fetchSuccess = await poolCache.fetchPools([], false);
            expect(fetchSuccess).to.be.true;
            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(poolsFromFile).not.deep.equal(newPools);
            expect(poolsFromFile.pools).deep.equal(poolCache.getPools());

            // Second fetch uses newPools passed
            fetchSuccess = await poolCache.fetchPools(newPools.pools, false);
            expect(fetchSuccess).to.be.true;
            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(newPools).to.not.deep.equal(poolsFromFile);
            expect(poolCache.getPools()).to.not.deep.equal(poolsFromFile.pools);
            expect(poolCache.getPools()).to.deep.equal(newPools.pools);
        });

        it(`should work with no onChain Balances`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
            const pools = poolsFromFile.pools;
            const poolCache = new PoolCacher(provider, chainId, null, pools);

            const result: boolean = await poolCache.fetchPools([], false);
            expect(result).to.be.true;
            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(poolCache.getPools().length).to.be.gt(0);
        });

        it(`should fail multicall`, async () => {
            // Calling mainnet multicall with kovan pools will cause multicall to fail
            const poolCache = new PoolCacher(
                provider,
                chainId,
                'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan-v2',
                []
            );

            const fetchSuccess = await poolCache.fetchPools([], true);
            expect(fetchSuccess).to.be.false;
            expect(poolCache.finishedFetchingOnChain).to.be.false;
            expect(poolCache.getPools().length).to.eq(0);
        }).timeout(10000);

        it(`should successfully call onchain data`, async () => {
            const poolCache = new PoolCacher(
                provider,
                chainId,
                'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
                []
            );

            const fetchSuccess = await poolCache.fetchPools([], true);
            expect(fetchSuccess).to.be.true;
            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(poolCache.getPools().length).to.be.gt(0);
        }).timeout(10000);
    });
});
