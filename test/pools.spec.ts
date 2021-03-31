// npx mocha -r ts-node/register test/pools.spec.ts
import { assert, expect } from 'chai';
import {
    PoolDictionary,
    SwapPairType,
    PoolTypes,
    NewPath,
    SwapTypes,
} from '../src/types';
import { filterPoolsOfInterest, filterHopPools } from '../src/pools';
import { calculatePathLimits, smartOrderRouter } from '../src/sorClass';
import BigNumber from 'bignumber.js';

import testPools from './testData/filterTestPools.json';
import disabledTokens from './testData/disabled-tokens.json';

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase();
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();

describe('Tests pools helpers', () => {
    it('weighted test pools check', () => {
        assert.equal(
            testPools.weightedOnly.length,
            12,
            'Should be 12 weighted pools'
        );
        assert.equal(
            testPools.stableOnly.length,
            2,
            'Should be 2 stable pools'
        );
    });

    it('should filter to only direct pools for maxPools = 1', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        const maxPools = 1;

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.weightedOnly,
            DAI,
            USDC,
            maxPools
        );

        let noDirect = 0,
            noHopIn = 0,
            noHopOut = 0;
        for (let k in poolsOfInterestDictionary) {
            if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.Direct
            )
                noDirect++;
            else if (
                poolsOfInterestDictionary[k].swapPairType === SwapPairType.HopIn
            )
                noHopIn++;
            else if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.HopOut
            )
                noHopOut++;

            assert.equal(
                poolsOfInterestDictionary[k].poolType,
                PoolTypes.Weighted
            );
        }

        assert.equal(hopTokens.length, 0);
        assert.equal(noHopIn, 0);
        assert.equal(noHopOut, 0);
        assert.equal(noDirect, 4); // 1 has 0 balances
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
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.Direct
            )
                noDirect++;
            else if (
                poolsOfInterestDictionary[k].swapPairType === SwapPairType.HopIn
            )
                noHopIn++;
            else if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.HopOut
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
        assert.equal(
            hopTokens[0],
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
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
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.Direct
            )
                noDirect++;
            else if (
                poolsOfInterestDictionary[k].swapPairType === SwapPairType.HopIn
            )
                noHopIn++;
            else if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.HopOut
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
        assert.equal(noDirect, 1); // 1 has 0 balances
    });

    it('should filter stable & weighted pools correctly', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let weighted: any = testPools.weightedOnly;
        let allPools: any = testPools.stableOnly.concat(weighted);

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            allPools,
            DAI,
            USDC,
            4
        );

        let noDirect = 0,
            noHopIn = 0,
            noHopOut = 0,
            noWeighted = 0,
            noStable = 0;
        for (let k in poolsOfInterestDictionary) {
            if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.Direct
            )
                noDirect++;
            else if (
                poolsOfInterestDictionary[k].swapPairType === SwapPairType.HopIn
            )
                noHopIn++;
            else if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.HopOut
            )
                noHopOut++;

            if (poolsOfInterestDictionary[k].poolType === PoolTypes.Weighted)
                noWeighted++;
            else if (poolsOfInterestDictionary[k].poolType === PoolTypes.Stable)
                noStable++;
        }

        assert.equal(hopTokens.length, 1);
        assert.equal(noHopIn, 3); // 1 has 0 balances
        assert.equal(noHopOut, 2); // 1 has 0 balances
        assert.equal(noDirect, 5); // 1 has 0 balances
        assert.equal(noWeighted, 9);
        assert.equal(noStable, 1);
    });

    it('should filter weighted only hop pools correctly', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.weightedOnly,
            DAI,
            USDC,
            4
        );

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            DAI,
            USDC,
            hopTokens,
            poolsOfInterestDictionary
        );

        let noDirect = 0,
            noHopIn = 0,
            noHopOut = 0;
        for (let k in poolsOfInterestDictionary) {
            if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.Direct
            )
                noDirect++;
            else if (
                poolsOfInterestDictionary[k].swapPairType === SwapPairType.HopIn
            ) {
                noHopIn++;
                assert.equal(
                    poolsOfInterestDictionary[k].id,
                    '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee',
                    'Pool Addresses should match.'
                );
            } else if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.HopOut
            ) {
                noHopOut++;
                assert.equal(
                    poolsOfInterestDictionary[k].id,
                    '0x12d6b6e24fdd9849abd42afd8f5775d36084a828',
                    'Pool Addresses should match.'
                );
            }

            assert.equal(
                poolsOfInterestDictionary[k].poolType,
                PoolTypes.Weighted
            );
        }
        assert.equal(hopTokens.length, 1);
        assert.equal(noHopIn, hopTokens.length);
        assert.equal(noHopOut, hopTokens.length);
        assert.equal(noDirect, 4);
        assert.equal(pathData.length, 5);
        assert.equal(
            pathData[0].id,
            '0x0481d726c3d25250a8963221945ed93b8a5315a9'
        );
        assert.equal(pathData[0].swaps.length, 1);
        assert.equal(
            pathData[0].swaps[0].pool,
            '0x0481d726c3d25250a8963221945ed93b8a5315a9'
        );
        assert.equal(pathData[0].swaps[0].tokenIn, DAI);
        assert.equal(pathData[0].swaps[0].tokenOut, USDC);
        assert.equal(
            pathData[1].id,
            '0x2dbd24322757d2e28de4230b1ca5b88e49a76979'
        );
        assert.equal(pathData[1].swaps.length, 1);
        assert.equal(
            pathData[1].swaps[0].pool,
            '0x2dbd24322757d2e28de4230b1ca5b88e49a76979'
        );
        assert.equal(pathData[1].swaps[0].tokenIn, DAI);
        assert.equal(pathData[1].swaps[0].tokenOut, USDC);
        assert.equal(
            pathData[2].id,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(pathData[2].swaps.length, 1);
        assert.equal(
            pathData[2].swaps[0].pool,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(pathData[2].swaps[0].tokenIn, DAI);
        assert.equal(pathData[2].swaps[0].tokenOut, USDC);
        assert.equal(
            pathData[3].id,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(pathData[3].swaps.length, 1);
        assert.equal(
            pathData[3].swaps[0].pool,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(pathData[3].swaps[0].tokenIn, DAI);
        assert.equal(pathData[3].swaps[0].tokenOut, USDC);
        assert.equal(
            pathData[4].id,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee0x12d6b6e24fdd9849abd42afd8f5775d36084a828'
        );
        assert.equal(pathData[4].swaps.length, 2);
        assert.equal(
            pathData[4].swaps[0].pool,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee'
        );
        assert.equal(pathData[4].swaps[0].tokenIn, DAI);
        assert.equal(pathData[4].swaps[0].tokenOut, hopTokens[0]);
        assert.equal(
            pathData[4].swaps[1].pool,
            '0x12d6b6e24fdd9849abd42afd8f5775d36084a828'
        );
        assert.equal(pathData[4].swaps[1].tokenIn, hopTokens[0]);
        assert.equal(pathData[4].swaps[1].tokenOut, USDC);
    });

    it('should filter stable only hop pools correctly', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.stableOnly,
            DAI,
            USDC,
            4
        );

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            DAI,
            USDC,
            hopTokens,
            poolsOfInterestDictionary
        );

        let noDirect = 0,
            noHopIn = 0,
            noHopOut = 0;

        for (let k in poolsOfInterestDictionary) {
            if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.Direct
            )
                noDirect++;
            else if (
                poolsOfInterestDictionary[k].swapPairType === SwapPairType.HopIn
            ) {
                noHopIn++;
            } else if (
                poolsOfInterestDictionary[k].swapPairType ===
                SwapPairType.HopOut
            ) {
                noHopOut++;
            }

            assert.equal(
                poolsOfInterestDictionary[k].poolType,
                PoolTypes.Stable
            );
        }
        assert.equal(hopTokens.length, 0);
        assert.equal(noHopIn, hopTokens.length);
        assert.equal(noHopOut, hopTokens.length);
        assert.equal(noDirect, 1);
        assert.equal(pathData.length, 1);
        assert.equal(
            pathData[0].id,
            '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'
        );
        assert.equal(pathData[0].swaps.length, 1);
        assert.equal(
            pathData[0].swaps[0].pool,
            '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'
        );
        assert.equal(pathData[0].swaps[0].tokenIn, DAI);
        assert.equal(pathData[0].swaps[0].tokenOut, USDC);
    });

    it('should calc weighted path limits', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.weightedOnly,
            DAI,
            USDC,
            4
        );

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            DAI,
            USDC,
            hopTokens,
            poolsOfInterestDictionary
        );

        let paths: NewPath[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = calculatePathLimits(pathData, SwapTypes.SwapExactIn);

        // Known results taken from previous version
        assert.equal(
            maxAmt.toString(),
            '2701.18959849598293269784114035126711'
        );
        assert.equal(paths[0].id, '0x75286e183d923a5f52f52be205e358c5c9101b09');
        assert.equal(
            paths[0].limitAmount.toString(),
            '2448.917784422694261994931154601680339'
        );
        assert.equal(paths[1].id, '0x57755f7dec33320bca83159c26e93751bfd30fbe');
        assert.equal(
            paths[1].limitAmount.toString(),
            '236.223017620930140067464758138774973'
        );
        assert.equal(paths[2].id, '0x2dbd24322757d2e28de4230b1ca5b88e49a76979');
        assert.equal(
            paths[2].limitAmount.toString(),
            '15.992777386194562115445227610811798'
        );
        assert.equal(
            paths[3].id,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee0x12d6b6e24fdd9849abd42afd8f5775d36084a828'
        );
        assert.equal(paths[3].limitAmount.toString(), '0.05601906616396852');
        assert.equal(paths[4].id, '0x0481d726c3d25250a8963221945ed93b8a5315a9');
        assert.equal(paths[4].limitAmount.toString(), '0');
    });

    it('should calc stable path limits', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.stableOnly,
            DAI,
            USDC,
            4
        );

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            DAI,
            USDC,
            hopTokens,
            poolsOfInterestDictionary
        );

        let paths: NewPath[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = calculatePathLimits(pathData, SwapTypes.SwapExactIn);

        // Known results taken from previous version
        assert.equal(
            maxAmt.toString(),
            '75041081.008900386726414241698926382847481'
        );
        assert.equal(paths[0].id, '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490');
        assert.equal(
            paths[0].limitAmount.toString(),
            '75041081.008900386726414241698926382847481'
        );
    });

    it('should full swap weighted', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.weightedOnly,
            DAI,
            USDC,
            4
        );

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            DAI,
            USDC,
            hopTokens,
            poolsOfInterestDictionary
        );

        let paths: NewPath[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = calculatePathLimits(pathData, SwapTypes.SwapExactIn);

        console.log(maxAmt.toString());
        paths.forEach(path => {
            console.log(path.id);
            console.log(path.limitAmount.toString());
        });

        let swapAmt = new BigNumber(0.1);

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = smartOrderRouter(
            JSON.parse(JSON.stringify(poolsOfInterestDictionary)), // Need to keep original pools for cache
            paths,
            SwapTypes.SwapExactIn,
            swapAmt,
            4,
            new BigNumber(0)
        );

        console.log(total.toString());
        console.log(swaps);
    });

    it('should full swap stable', () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.stableOnly,
            DAI,
            USDC,
            4
        );

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            DAI,
            USDC,
            hopTokens,
            poolsOfInterestDictionary
        );

        let paths: NewPath[];
        let maxAmt: BigNumber;
        [paths, maxAmt] = calculatePathLimits(pathData, SwapTypes.SwapExactIn);

        console.log(maxAmt.toString());
        paths.forEach(path => {
            console.log(path.id);
            console.log(path.limitAmount.toString());
        });

        let swapAmt = new BigNumber(0.1);

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = smartOrderRouter(
            JSON.parse(JSON.stringify(poolsOfInterestDictionary)), // Need to keep original pools for cache
            paths,
            SwapTypes.SwapExactIn,
            swapAmt,
            4,
            new BigNumber(0)
        );

        console.log(total.toString());
        console.log(swaps);
    });
});
