// npx mocha -r ts-node/register test/filtersAndPaths.spec.ts
import { assert } from 'chai';
import {
    PoolDictionary,
    SwapPairType,
    PoolTypes,
    NewPath,
    SwapTypes,
} from '../src/types';
import { filterPoolsOfInterest, filterHopPools } from '../src/router/paths';
import { calculatePathLimits, smartOrderRouter } from '../src/router';
import BigNumber from 'bignumber.js';
import { countPoolSwapPairTypes } from './lib/testHelpers';

import subgraphPoolsLarge from './testData/testPools/subgraphPoolsLarge.json';
import testPools from './testData/filterTestPools.json';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase();
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();

describe('Tests pools filtering and path processing', () => {
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
        const maxPools = 1;

        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            testPools.weightedOnly,
            DAI,
            USDC,
            maxPools
        );

        let noDirect = 0,
            noHopIn = 0,
            noHopOut = 0;
        for (const k in poolsOfInterestDictionary) {
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
        assert.equal(noDirect, 3); // 1 has 0 balances
    });

    it('Get multihop pools - WETH>DAI', async () => {
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            subgraphPoolsLarge.pools,
            WETH,
            DAI,
            4,
            {
                isOverRide: true,
                disabledTokens: [],
            }
        );

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            WETH,
            DAI,
            hopTokens,
            poolsOfInterestDictionary
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        assert.equal(hopTokens.length, 4, 'Should have 4 hopTokens');
        assert.equal(
            Object.keys(poolsOfInterestDictionary).length,
            16,
            'Should have 16 multi-hop pools'
        );
        // There are 4 hop tokens but one pool has 2 paths using 2 different hop tokens hence 3 hop pools
        // 0xd6f0d319b2cce75123bf63e2c2bd8ba1f7d6b37a
        assert.equal(noHopIn, 3, 'Should have 3 hop in pools');
        assert.equal(noHopOut, 3, 'Should have 3 hop out pools');
        assert.equal(pathData.length, 14, 'Should have 14 paths');
        assert.equal(
            pathData[0].id,
            '0x165a50bc092f6870dc111c349bae5fc35147ac86'
        );
        assert.equal(
            pathData[1].id,
            '0x1b09173a0ffbad1cb7670b1a640013c0facfb71f'
        );
        assert.equal(
            pathData[2].id,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee'
        );
        assert.equal(
            pathData[3].id,
            '0x2dbd24322757d2e28de4230b1ca5b88e49a76979'
        );
        assert.equal(
            pathData[4].id,
            '0x4b47b11c353f0056c73a87fefccb6c43dc0d8065'
        );
        assert.equal(
            pathData[5].id,
            '0x53b89ce35928dda346c574d9105a5479cb87231c'
        );
        assert.equal(
            pathData[6].id,
            '0x9b208194acc0a8ccb2a8dcafeacfbb7dcc093f81'
        );
        assert.equal(
            pathData[7].id,
            '0xc0b2b0c5376cb2e6f73b473a7caa341542f707ce'
        );
        assert.equal(
            pathData[8].id,
            '0xe5d1fab0c5596ef846dcc0958d6d0b20e1ec4498'
        );
        assert.equal(
            pathData[9].id,
            '0xec577a919fca1b682f584a50b1048331ef0f30dd'
        );
        assert.equal(
            pathData[10].id,
            '0xd6f0d319b2cce75123bf63e2c2bd8ba1f7d6b37a0xa29f5e42760aa987214844e5db9ac4a8e16ca969'
        );
        assert.equal(
            pathData[11].id,
            '0x7f0b4d22b8a9abe2ae9ea1077fe1ab77dc7283a30xeba4dd6771c3e8ba3f168e47d052819abcc87cb2'
        );
        assert.equal(
            pathData[12].id,
            '0xd6f0d319b2cce75123bf63e2c2bd8ba1f7d6b37a0xeba4dd6771c3e8ba3f168e47d052819abcc87cb2'
        );
        assert.equal(
            pathData[13].id,
            '0xd4dbf96db2fdf8ed40296d8d104b371adf7dee120x75286e183d923a5f52f52be205e358c5c9101b09'
        );
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
        for (const k in poolsOfInterestDictionary) {
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
        assert.equal(noHopIn, 2); // 1 has 0 balances
        assert.equal(noHopOut, 1); // 1 has 0 balances
        assert.equal(noDirect, 3); // 1 has 0 balances
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
        for (const k in poolsOfInterestDictionary) {
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
        const weighted: any = testPools.weightedOnly;
        const allPools: any = testPools.stableOnly.concat(weighted);

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
        for (const k in poolsOfInterestDictionary) {
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
        assert.equal(noHopIn, 2); // 1 has 0 balances
        assert.equal(noHopOut, 1); // 1 has 0 balances
        assert.equal(noDirect, 4); // 1 has 0 balances
        assert.equal(noWeighted, 6);
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
        for (const k in poolsOfInterestDictionary) {
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
        assert.equal(noDirect, 3);
        assert.equal(pathData.length, 4);
        assert.equal(
            pathData[0].id,
            '0x2dbd24322757d2e28de4230b1ca5b88e49a76979'
        );
        assert.equal(pathData[0].swaps.length, 1);
        assert.equal(
            pathData[0].swaps[0].pool,
            '0x2dbd24322757d2e28de4230b1ca5b88e49a76979'
        );
        assert.equal(pathData[0].swaps[0].tokenIn, DAI);
        assert.equal(pathData[0].swaps[0].tokenOut, USDC);
        assert.equal(
            pathData[1].id,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(pathData[1].swaps.length, 1);
        assert.equal(
            pathData[1].swaps[0].pool,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(pathData[1].swaps[0].tokenIn, DAI);
        assert.equal(pathData[1].swaps[0].tokenOut, USDC);
        assert.equal(
            pathData[2].id,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(pathData[2].swaps.length, 1);
        assert.equal(
            pathData[2].swaps[0].pool,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(pathData[2].swaps[0].tokenIn, DAI);
        assert.equal(pathData[2].swaps[0].tokenOut, USDC);
        assert.equal(
            pathData[3].id,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee0x12d6b6e24fdd9849abd42afd8f5775d36084a828'
        );
        assert.equal(pathData[3].swaps.length, 2);
        assert.equal(
            pathData[3].swaps[0].pool,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee'
        );
        assert.equal(pathData[3].swaps[0].tokenIn, DAI);
        assert.equal(pathData[3].swaps[0].tokenOut, hopTokens[0]);
        assert.equal(
            pathData[3].swaps[1].pool,
            '0x12d6b6e24fdd9849abd42afd8f5775d36084a828'
        );
        assert.equal(pathData[3].swaps[1].tokenIn, hopTokens[0]);
        assert.equal(pathData[3].swaps[1].tokenOut, USDC);
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

        for (const k in poolsOfInterestDictionary) {
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
        assert.equal(maxAmt.toString(), '1620.713758415909242297');
        assert.equal(paths[0].id, '0x75286e183d923a5f52f52be205e358c5c9101b09');
        assert.equal(
            paths[0].limitAmount.toString(),
            '1469.3506706536194958983'
        );
        assert.equal(paths[1].id, '0x57755f7dec33320bca83159c26e93751bfd30fbe');
        assert.equal(
            paths[1].limitAmount.toString(),
            '141.7338105725583675081'
        );
        assert.equal(paths[2].id, '0x2dbd24322757d2e28de4230b1ca5b88e49a76979');
        assert.equal(paths[2].limitAmount.toString(), '9.5956664317167564606');
        assert.equal(
            paths[3].id,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee0x12d6b6e24fdd9849abd42afd8f5775d36084a828'
        );
        assert.equal(paths[3].limitAmount.toString(), '0.03361075801462243');
    });

    it('should calc weighted path limits, exactOut', () => {
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
        [paths, maxAmt] = calculatePathLimits(pathData, SwapTypes.SwapExactOut);

        // Known results taken from previous version
        assert.equal(maxAmt.toString(), '1265.9311029');
        assert.equal(paths[0].id, '0x75286e183d923a5f52f52be205e358c5c9101b09');
        assert.equal(paths[0].limitAmount.toString(), '1113.575469');
        assert.equal(paths[1].id, '0x57755f7dec33320bca83159c26e93751bfd30fbe');
        assert.equal(paths[1].limitAmount.toString(), '142.8770136');
        assert.equal(paths[2].id, '0x2dbd24322757d2e28de4230b1ca5b88e49a76979');
        assert.equal(paths[2].limitAmount.toString(), '9.4459251');
        assert.equal(
            paths[3].id,
            '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee0x12d6b6e24fdd9849abd42afd8f5775d36084a828'
        );
        assert.equal(paths[3].limitAmount.toString(), '0.0326952');
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
        assert.equal(maxAmt.toString(), '45024648.6053403220851457557');
        assert.equal(paths[0].id, '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490');
        assert.equal(
            paths[0].limitAmount.toString(),
            '45024648.6053403220851457557'
        );

        [paths, maxAmt] = calculatePathLimits(pathData, SwapTypes.SwapExactOut);

        // Known results taken from previous version
        assert.equal(maxAmt.toString(), '76533088.793376');
        assert.equal(paths[0].id, '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490');
        assert.equal(paths[0].limitAmount.toString(), '76533088.793376');
    });

    it('Test pool class that has direct & multihop paths', async () => {
        const pools = JSON.parse(JSON.stringify(testPools))
            .pathTestDirectAndMulti;
        const tokenIn = USDC;
        const tokenOut = DAI;
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            pools,
            tokenIn,
            tokenOut,
            4
        );
        /*
        [poolsOfInterestDictionary, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            poolsOfInterestDictionary
        );
        */

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        assert.equal(hopTokens.length, 0);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2);

        assert.equal(noDirect, 1);
        assert.equal(noHopIn, 0);
        assert.equal(noHopOut, 1);
    });

    it('Test pool class that has two multihop paths, swapExactIn', async () => {
        const pools = JSON.parse(JSON.stringify(testPools))
            .pathTestPoolTwoMultiHops;
        const tokenIn = USDC;
        const tokenOut = DAI;
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            pools,
            tokenIn,
            tokenOut,
            4
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        assert.equal(hopTokens.length, 2);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2); // 4 paths using two pools.
        assert.equal(noDirect, 0);
        assert.equal(noHopIn, 1);
        assert.equal(noHopOut, 1);

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            poolsOfInterestDictionary
        );

        assert.equal(pathData.length, 2);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2);
        assert.equal(
            pathData[0].id,
            '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(
            pathData[1].id,
            '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );

        let paths: NewPath[];
        let maxLiquidityAvailable: BigNumber;
        [paths, maxLiquidityAvailable] = calculatePathLimits(
            pathData,
            SwapTypes.SwapExactIn
        );

        assert.equal(maxLiquidityAvailable.toString(), '600');
        assert.equal(paths.length, 2);
        assert.equal(paths[0].limitAmount.toString(), '300');
        assert.equal(paths[1].limitAmount.toString(), '300');

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = smartOrderRouter(
            JSON.parse(JSON.stringify(poolsOfInterestDictionary)), // Need to keep original pools for cache
            paths,
            SwapTypes.SwapExactIn,
            new BigNumber(1),
            4,
            new BigNumber(0)
        );

        assert.equal(total.toString(), '0.979134514480937');
        assert.equal(swaps.length, 2);
        assert.equal(
            swaps[0][0].pool,
            '0x0481d726c3d25250a8963221945ed93b8a5315a9'
        );
        assert.equal(swaps[0][0].swapAmount, '0.500000000000022424');
        assert.equal(swaps[0][0].tokenIn, tokenIn);
        assert.equal(
            swaps[0][0].tokenOut,
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
        assert.equal(
            swaps[0][1].pool,
            '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(swaps[0][1].swapAmount, '0.494754097206656');
        assert.equal(
            swaps[0][1].tokenIn,
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
        assert.equal(swaps[0][1].tokenOut, tokenOut);
        assert.equal(
            swaps[1][0].pool,
            '0x0481d726c3d25250a8963221945ed93b8a5315a9'
        );
        assert.equal(swaps[1][0].swapAmount, '0.499999999999977576');
        assert.equal(swaps[1][0].tokenIn, tokenIn);
        assert.equal(
            swaps[1][0].tokenOut,
            '0x0000000000085d4780b73119b644ae5ecd22b376'
        );
        assert.equal(
            swaps[1][1].pool,
            '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(swaps[1][1].swapAmount, '0.494755096217348');
        assert.equal(
            swaps[1][1].tokenIn,
            '0x0000000000085d4780b73119b644ae5ecd22b376'
        );
        assert.equal(swaps[1][1].tokenOut, tokenOut);
    });

    it('Test pool class that has two multihop paths, swapExactOut', async () => {
        const pools = JSON.parse(JSON.stringify(testPools))
            .pathTestPoolTwoMultiHops;
        const tokenIn = USDC;
        const tokenOut = DAI;
        let hopTokens: string[];
        let poolsOfInterestDictionary: PoolDictionary;
        let pathData: NewPath[];

        [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
            pools,
            tokenIn,
            tokenOut,
            4
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        assert.equal(hopTokens.length, 2);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2); // 4 paths using two pools.
        assert.equal(noDirect, 0);
        assert.equal(noHopIn, 1);
        assert.equal(noHopOut, 1);

        [poolsOfInterestDictionary, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            poolsOfInterestDictionary
        );

        assert.equal(pathData.length, 2);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2);
        assert.equal(
            pathData[0].id,
            '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(
            pathData[1].id,
            '0x0481d726c3d25250a8963221945ed93b8a5315a90x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );

        let paths: NewPath[];
        let maxLiquidityAvailable: BigNumber;
        [paths, maxLiquidityAvailable] = calculatePathLimits(
            pathData,
            SwapTypes.SwapExactOut
        );

        assert.equal(maxLiquidityAvailable.toString(), '457.9799537393987');
        assert.equal(paths.length, 2);
        assert.equal(paths[0].limitAmount.toString(), '228.98997686969935');
        assert.equal(paths[1].limitAmount.toString(), '228.98997686969935');

        let swaps: any, total: BigNumber, marketSp: BigNumber;
        [swaps, total, marketSp] = smartOrderRouter(
            JSON.parse(JSON.stringify(poolsOfInterestDictionary)), // Need to keep original pools for cache
            paths,
            SwapTypes.SwapExactOut,
            new BigNumber(1),
            4,
            new BigNumber(0)
        );

        assert.equal(total.toString(), '1.021332');
        assert.equal(swaps.length, 2);
        assert.equal(
            swaps[0][0].pool,
            '0x0481d726c3d25250a8963221945ed93b8a5315a9'
        );
        assert.equal(swaps[0][0].swapAmount, '0.505303156638908081');
        assert.equal(swaps[0][0].tokenIn, tokenIn);
        assert.equal(
            swaps[0][0].tokenOut,
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
        assert.equal(
            swaps[0][1].pool,
            '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(swaps[0][1].swapAmount, '0.499999999999981612');
        assert.equal(
            swaps[0][1].tokenIn,
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
        assert.equal(swaps[0][1].tokenOut, tokenOut);
        assert.equal(
            swaps[1][0].pool,
            '0x0481d726c3d25250a8963221945ed93b8a5315a9'
        );
        assert.equal(swaps[1][0].swapAmount, '0.505303156638945455');
        assert.equal(swaps[1][0].tokenIn, tokenIn);
        assert.equal(
            swaps[1][0].tokenOut,
            '0x0000000000085d4780b73119b644ae5ecd22b376'
        );
        assert.equal(
            swaps[1][1].pool,
            '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(swaps[1][1].swapAmount, '0.500000000000018388');
        assert.equal(
            swaps[1][1].tokenIn,
            '0x0000000000085d4780b73119b644ae5ecd22b376'
        );
        assert.equal(swaps[1][1].tokenOut, tokenOut);
    });
});
