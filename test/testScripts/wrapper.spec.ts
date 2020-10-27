require('dotenv').config();
import { expect } from 'chai';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import * as sor from '../src';

describe('Wrapper Tests', () => {
    const MKR = '0xef13C0c8abcaf5767160018d268f9697aE4f5375';
    const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

    const provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );
    const gasPrice = new BigNumber('30000000000');
    const maxNoPools = 4;

    const SOR = new sor.SOR(provider, gasPrice, maxNoPools, 1);

    it('should not have token in cache', () => {
        // expect(allPools).to.not.eql(allPoolsWrong);
        expect(SOR.fetchedTokens[MKR]).to.be.undefined;
        expect(SOR.fetchedTokens[USDC]).to.be.undefined;
        expect(SOR.fetchedTokens[DAI]).to.be.undefined;
        expect(SOR.subgraphCache.pools.length).to.eql(0);
        expect(SOR.onChainCache.pools.length).to.eql(0);
        expect(SOR.hasPairPools(MKR, USDC)).to.be.false;
        expect(SOR.hasPairPools(DAI, USDC)).to.be.false;
    }).timeout(10000);

    it('should now have token in cache', async () => {
        let isFetched = await SOR.fetchPairPools(MKR, USDC);
        expect(isFetched).to.be.true;
        expect(SOR.fetchedTokens[MKR.toLowerCase()]).to.be.true;
        expect(SOR.fetchedTokens[USDC.toLowerCase()]).to.be.true;
        expect(SOR.subgraphCache.pools.length).to.be.at.least(1);
        expect(SOR.subgraphCache.pools.length).to.eql(
            SOR.onChainCache.pools.length
        );
        expect(SOR.hasPairPools(MKR, USDC)).to.be.true;
    }).timeout(10000);

    it('should purge caches', async () => {
        SOR.purgeCaches();
        expect(SOR.fetchedTokens[MKR]).to.be.undefined;
        expect(SOR.fetchedTokens[USDC]).to.be.undefined;
        expect(SOR.subgraphCache.pools.length).to.eql(0);
        expect(SOR.onChainCache.pools.length).to.eql(0);
        expect(SOR.hasPairPools(MKR, USDC)).to.be.false;
        expect(SOR.hasPairPools(DAI, USDC)).to.be.false;
    }).timeout(10000);

    it('should have token in cache after no purge', async () => {
        let isFetched = await SOR.fetchPairPools(MKR, USDC, false);
        expect(isFetched).to.be.true;
        expect(SOR.fetchedTokens[MKR.toLowerCase()]).to.be.true;
        expect(SOR.fetchedTokens[USDC.toLowerCase()]).to.be.true;
        expect(SOR.subgraphCache.pools.length).to.be.at.least(1);
        expect(SOR.subgraphCache.pools.length).to.eql(
            SOR.onChainCache.pools.length
        );
        expect(SOR.hasPairPools(MKR, USDC)).to.be.true;
    }).timeout(10000);

    it('should fetch tokens with purge', async () => {
        let isFetched = await SOR.fetchPairPools(MKR, DAI);
        expect(isFetched).to.be.true;
        expect(SOR.fetchedTokens[MKR.toLowerCase()]).to.be.true;
        expect(SOR.fetchedTokens[USDC.toLowerCase()]).to.be.undefined;
        expect(SOR.fetchedTokens[DAI.toLowerCase()]).to.be.true;
        expect(SOR.subgraphCache.pools.length).to.be.at.least(1);
        expect(SOR.subgraphCache.pools.length).to.eql(
            SOR.onChainCache.pools.length
        );
        expect(SOR.hasPairPools(MKR, USDC)).to.be.false;
        expect(SOR.hasPairPools(MKR, DAI)).to.be.true;
    }).timeout(10000);

    it('should fetch tokens with no purge', async () => {
        let startingLength = SOR.subgraphCache.pools.length;
        let isFetched = await SOR.fetchPairPools(USDC, DAI, false);
        expect(isFetched).to.be.true;
        expect(SOR.fetchedTokens[MKR.toLowerCase()]).to.be.true;
        expect(SOR.fetchedTokens[USDC.toLowerCase()]).to.be.true;
        expect(SOR.fetchedTokens[DAI.toLowerCase()]).to.be.true;
        expect(SOR.subgraphCache.pools.length).to.be.above(startingLength);
        expect(SOR.subgraphCache.pools.length).to.eql(
            SOR.onChainCache.pools.length
        );
        expect(SOR.hasPairPools(MKR, USDC)).to.be.true; // This is true because we have previously fetched each token separately
        expect(SOR.hasPairPools(MKR, DAI)).to.be.true;
        expect(SOR.hasPairPools(USDC, DAI)).to.be.true;
    }).timeout(10000);

    it('should update pools cache onchain balances', async () => {
        console.time(`updateOnChainBalances`);
        let result = await SOR.updateOnChainBalances();
        console.timeEnd(`updateOnChainBalances`);
        expect(result).to.be.true;
    }).timeout(10000);

    it('should be quick with cached', async () => {
        let startingLength = SOR.subgraphCache.pools.length;
        console.time('cached');
        let isFetched = await SOR.fetchPairPools(USDC, DAI, false);
        console.timeEnd('cached');

        expect(isFetched).to.be.true;
        expect(SOR.fetchedTokens[MKR.toLowerCase()]).to.be.true;
        expect(SOR.fetchedTokens[USDC.toLowerCase()]).to.be.true;
        expect(SOR.fetchedTokens[DAI.toLowerCase()]).to.be.true;
        expect(SOR.subgraphCache.pools.length).to.eql(startingLength);
        expect(SOR.subgraphCache.pools.length).to.eql(
            SOR.onChainCache.pools.length
        );
        expect(SOR.hasPairPools(MKR, USDC)).to.be.true; // This is true because we have previously fetched each token separately
        expect(SOR.hasPairPools(MKR, DAI)).to.be.true;
        expect(SOR.hasPairPools(USDC, DAI)).to.be.true;
    }).timeout(10000);
});
