// Tests multihop filter methods by comparing to old SOR getMultihopPoolsWithTokens function
// which was replaced as too slow - uses allPoolsSmall.json for pool data.
import { assert } from 'chai';
import 'mocha';
import { formatAndFilterPools } from './testScripts/utils/subgraph';
const sor = require('../src');
const helpers = require('../src/helpers');
const { utils } = require('ethers');
// Following has:
// Both DAI&USDC: 4 pools
// DAI, No USDC: 3
// No DAI, USDC: 2
// Neither: 3
const allPools = require('./allPoolsSmall.json');
import { BONE } from '../src/bmath';

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(); // DAI
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();

let allTokensSet, allPoolsNonZeroBalances;

describe('Test Filter Functions using allPoolsSmall.json & full SOR comparrions', () => {
    it('Saved pool check', async () => {
        assert.equal(allPools.pools.length, 12, 'Should be 12 pools');

        [allTokensSet, allPoolsNonZeroBalances] = formatAndFilterPools(
            allPools
        );
        assert.equal(
            allPoolsNonZeroBalances.pools.length,
            8,
            'Should be 8 pools with non-zero balance'
        );
    });

    it('Should filter without mutual pools', async () => {
        let daiPools, usdcPools, daiPairedTokens, usdcPairedTokens;
        [
            daiPools,
            daiPairedTokens,
            usdcPools,
            usdcPairedTokens,
        ] = helpers.filterPoolsWithoutMutualTokens(allPools.pools, DAI, USDC);

        assert.equal(
            Object.keys(daiPools).length,
            3,
            'Should have 3 DAI only pools'
        );

        assert.equal(
            Object.keys(usdcPools).length,
            2,
            'Should have 2 USDC only pools'
        );
    });

    it('Get multihop pools - DAI>USDC', async () => {
        console.time('filterPoolsWithTokensMultihop');
        let mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
            hopTokensFilter,
        ] = await sor.filterPoolsWithTokensMultihop(
            allPoolsNonZeroBalances.pools,
            DAI,
            USDC
        );
        console.timeEnd('filterPoolsWithTokensMultihop');

        assert.equal(
            mostLiquidPoolsFirstHopFilter.length,
            1,
            'Should have 1 first hop pools.'
        );
        assert.equal(
            mostLiquidPoolsSecondHopFilter.length,
            1,
            'Should have 1 second hop pools.'
        );
        assert.equal(hopTokensFilter.length, 1, 'Should have 5 hop tokens.');
        assert.equal(
            hopTokensFilter[0],
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            'Token Addresses should match.'
        );
        assert.equal(
            mostLiquidPoolsFirstHopFilter[0].id,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee',
            'Pool Addresses should match.'
        );
        assert.equal(
            mostLiquidPoolsSecondHopFilter[0].id,
            '0x12d6b6e24fdd9849abd42afd8f5775d36084a828',
            'Pool Addresses should match.'
        );
    });
});
