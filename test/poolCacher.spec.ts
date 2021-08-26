require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { expect } from 'chai';
import { PoolCacher } from '../src/poolCaching';
import { SubGraphPoolsBase } from '../src/types';

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

            const disconnectedpoolCache = new PoolCacher(provider, chainId, []);
            expect(disconnectedpoolCache.isConnectedToSubgraph()).to.be.false;
        });

        it(`should set pools source to pools passed`, () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
            const poolCache = new PoolCacher(
                provider,
                chainId,
                poolsFromFile.pools
            );

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
            const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
            const poolCache = new PoolCacher(
                provider,
                chainId,
                poolsFromFile.pools
            );
            const fetchSuccess = await poolCache.fetchPools(false);
            expect(fetchSuccess).to.be.true;

            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(poolCache.getPools()[1].tokens[1].balance).to.eq(
                poolsFromFile.pools[1].tokens[1].balance
            );
        });

        it(`should overwrite pools passed as input`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
            const poolCache = new PoolCacher(
                provider,
                chainId,
                poolsFromFile.pools
            );

            const testPools = require('./testData/filterTestPools.json');
            const newPools: SubGraphPoolsBase = { pools: testPools.stableOnly };

            // First fetch uses data passed as constructor
            let fetchSuccess = await poolCache.fetchPools(false);
            expect(fetchSuccess).to.be.true;
            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(poolsFromFile).not.deep.equal(newPools);
            expect(poolsFromFile.pools).deep.equal(poolCache.getPools());

            // Second fetch uses newPools passed
            fetchSuccess = await poolCache.fetchPools(false, newPools.pools);
            expect(fetchSuccess).to.be.true;
            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(newPools).to.not.deep.equal(poolsFromFile);
            expect(poolCache.getPools()).to.not.deep.equal(poolsFromFile.pools);
            expect(poolCache.getPools()).to.deep.equal(newPools.pools);
        });

        it(`should work with no onChain Balances`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
            const poolCache = new PoolCacher(
                provider,
                chainId,
                poolsFromFile.pools
            );

            const result: boolean = await poolCache.fetchPools(false);
            expect(result).to.be.true;
            expect(poolCache.finishedFetchingOnChain).to.be.true;
            expect(poolCache.getPools().length).to.be.gt(0);
        });
    });
});
