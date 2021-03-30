// npx mocha -r ts-node/register test/pools.spec.ts
require('dotenv').config();
import * as sor from '../src';
import { assert, expect } from 'chai';
import { PoolDictionary, TypesForSwap, PoolTypes } from '../src/types';
import { filterPoolsOfInterest } from '../src/pools';
import { WeightedPool } from '../src/pools/weightedPool';
import { StablePool } from '../src/pools/StablePool';

import testPools from './testData/filterTestPools.json';
import disabledTokens from './testData/disabled-tokens.json';

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase();
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();

describe('Tests pools helpers', () => {
    it('weighted test pools check', () => {
        assert.equal(testPools.weightedOnly.length, 12, 'Should be 12 pools');
        let newPool = new WeightedPool(
            'testId',
            'swapFee',
            'totalWeight',
            'totalShares',
            []
        );
        newPool.setTypeForSwap(TypesForSwap.Direct);
    });

    it('should filter weighted only pools correctly', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.weightedOnly,
            DAI,
            USDC,
            4
        );

        let noDirect = 0,
            noHopIn = 0,
            noHopOut = 0;
        for (let k in poolsOfInterestDictionary) {
            if (
                poolsOfInterestDictionary[k].typeForSwap === TypesForSwap.Direct
            )
                noDirect++;
            else if (
                poolsOfInterestDictionary[k].typeForSwap === TypesForSwap.HopIn
            )
                noHopIn++;
            else if (
                poolsOfInterestDictionary[k].typeForSwap === TypesForSwap.HopOut
            )
                noHopOut++;

            assert.equal(
                poolsOfInterestDictionary[k].poolType,
                PoolTypes.Weighted
            );
        }

        assert.equal(hopTokens.length, 1);
        assert.equal(noHopIn, 3); // 1 has 0 balances
        assert.equal(noHopOut, 2); // 1 has 0 balances
        assert.equal(noDirect, 4); // 1 has 0 balances
        /*
        Remove if decided not to use decimals
        assert.equal(tokenDecimalsDict[USDC], '6');
        assert.equal(tokenDecimalsDict[DAI], '18');
        */
    });

    it('should filter stable only pools correctly', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.stableOnly,
            DAI,
            USDC,
            4
        );

        let noDirect = 0,
            noHopIn = 0,
            noHopOut = 0;
        for (let k in poolsOfInterestDictionary) {
            if (
                poolsOfInterestDictionary[k].typeForSwap === TypesForSwap.Direct
            )
                noDirect++;
            else if (
                poolsOfInterestDictionary[k].typeForSwap === TypesForSwap.HopIn
            )
                noHopIn++;
            else if (
                poolsOfInterestDictionary[k].typeForSwap === TypesForSwap.HopOut
            )
                noHopOut++;

            assert.equal(
                poolsOfInterestDictionary[k].poolType,
                PoolTypes.Stable
            );
        }

        assert.equal(hopTokens.length, 0);
        assert.equal(noHopIn, 0); // 1 has 0 balances
        assert.equal(noHopOut, 0); // 1 has 0 balances
        assert.equal(noDirect, 4); // 1 has 0 balances
    });

    /*
    OLD TEST - should pass eventually
    it('Get multihop pools - DAI>USDC', async () => {
        let poolsTokenIn, poolsTokenOut, directPools, hopTokensFilter;
        [
            directPools,
            hopTokensFilter,
            poolsTokenIn,
            poolsTokenOut,
        ] = sor.filterPools(testPools.weightedOnly, DAI, USDC, 4);

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
    */
});
