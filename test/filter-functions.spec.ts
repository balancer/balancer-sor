// Tests multihop filter methods by comparing to old SOR getMultihopPoolsWithTokens function
// which was replaced as too slow - uses allPoolsSmall.json for pool data.
import * as sor from '../src';
import { assert } from 'chai';
import 'mocha';
import { formatAndFilterPools } from './utils';
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

    it('Get multihop pools - DAI>USDC', async () => {
        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(allPoolsNonZeroBalances.pools, DAI, USDC);

        let mostLiquidPoolsFirstHopFilter, mostLiquidPoolsSecondHopFilter;
        [
            mostLiquidPoolsFirstHopFilter,
            mostLiquidPoolsSecondHopFilter,
        ] = sor.sortPoolsMostLiquid(
            DAI,
            USDC,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut
        );

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
