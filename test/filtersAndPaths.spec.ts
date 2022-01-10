// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/filtersAndPaths.spec.ts
import { assert } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    PoolDictionary,
    NewPath,
    SwapTypes,
    SubgraphPoolBase,
} from '../src/types';
import {
    filterPoolsOfInterest,
    filterHopPools,
    parseToPoolsDict,
} from '../src/routeProposal/filtering';
import { calculatePathLimits } from '../src/routeProposal/pathLimits';
import { getBestPaths } from '../src/router';
import { countPoolSwapPairTypes, checkPath } from './lib/testHelpers';

import subgraphPoolsLarge from './testData/testPools/subgraphPoolsLarge.json';
import testPools from './testData/filterTestPools.json';
import { Zero } from '@ethersproject/constants';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { DAI, USDC, WETH } from './lib/constants';

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

        const [poolsOfInterestDictionary, hopTokens] = filter(
            testPools.weightedOnly,
            DAI.address,
            USDC.address,
            maxPools
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        assert.equal(hopTokens.length, 0);
        assert.equal(noHopIn, 0);
        assert.equal(noHopOut, 0);
        assert.equal(noDirect, 3); // 1 has 0 balances
    });

    it('Get multihop pools - WETH>DAI', async () => {
        const maxPools = 4;
        const tokenIn = WETH.address;
        const tokenOut = DAI.address;

        const [, hopTokens, poolsMostLiquid, pathData, poolsAll] = filter(
            subgraphPoolsLarge.pools,
            tokenIn,
            tokenOut,
            maxPools
        );

        const [, noHopIn, noHopOut] = countPoolSwapPairTypes(poolsMostLiquid);

        assert.equal(hopTokens.length, 4, 'Should have 4 hopTokens');
        assert.equal(
            Object.keys(poolsMostLiquid).length,
            16,
            'Should have 16 multi-hop pools'
        );
        // There are 4 hop tokens but one pool has 2 paths using 2 different hop tokens hence 3 hop pools
        // 0xd6f0d319b2cce75123bf63e2c2bd8ba1f7d6b37a
        assert.equal(noHopIn, 3, 'Should have 3 hop in pools');
        assert.equal(noHopOut, 3, 'Should have 3 hop out pools');
        assert.equal(pathData.length, 14, 'Should have 14 paths');
        checkPath(
            ['0x165a50bc092f6870dc111c349bae5fc35147ac86'],
            poolsAll,
            pathData[0],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x1b09173a0ffbad1cb7670b1a640013c0facfb71f'],
            poolsAll,
            pathData[1],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x29f55de880d4dcae40ba3e63f16407a31b4d44ee'],
            poolsAll,
            pathData[2],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x2dbd24322757d2e28de4230b1ca5b88e49a76979'],
            poolsAll,
            pathData[3],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x4b47b11c353f0056c73a87fefccb6c43dc0d8065'],
            poolsAll,
            pathData[4],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x53b89ce35928dda346c574d9105a5479cb87231c'],
            poolsAll,
            pathData[5],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x9b208194acc0a8ccb2a8dcafeacfbb7dcc093f81'],
            poolsAll,
            pathData[6],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0xc0b2b0c5376cb2e6f73b473a7caa341542f707ce'],
            poolsAll,
            pathData[7],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0xe5d1fab0c5596ef846dcc0958d6d0b20e1ec4498'],
            poolsAll,
            pathData[8],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0xec577a919fca1b682f584a50b1048331ef0f30dd'],
            poolsAll,
            pathData[9],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0xd6f0d319b2cce75123bf63e2c2bd8ba1f7d6b37a',
                '0xa29f5e42760aa987214844e5db9ac4a8e16ca969',
            ],
            poolsAll,
            pathData[10],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0x7f0b4d22b8a9abe2ae9ea1077fe1ab77dc7283a3',
                '0xeba4dd6771c3e8ba3f168e47d052819abcc87cb2',
            ],
            poolsAll,
            pathData[11],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0xd6f0d319b2cce75123bf63e2c2bd8ba1f7d6b37a',
                '0xeba4dd6771c3e8ba3f168e47d052819abcc87cb2',
            ],
            poolsAll,
            pathData[12],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0xd4dbf96db2fdf8ed40296d8d104b371adf7dee12',
                '0x75286e183d923a5f52f52be205e358c5c9101b09',
            ],
            poolsAll,
            pathData[13],
            tokenIn,
            tokenOut
        );
    });

    it('should filter weighted only pools correctly', () => {
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;

        const [poolsOfInterestDictionary, hopTokens] = filter(
            testPools.weightedOnly,
            tokenIn,
            tokenOut,
            maxPools
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

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
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;

        const [poolsOfInterestDictionary, hopTokens] = filter(
            testPools.stableOnly,
            tokenIn,
            tokenOut,
            maxPools
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        assert.equal(hopTokens.length, 0);
        assert.equal(noHopIn, 0); // 1 has 0 balances
        assert.equal(noHopOut, 0); // 1 has 0 balances
        assert.equal(noDirect, 1); // 1 has 0 balances
    });

    it('should filter stable & weighted pools correctly', () => {
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const weighted: SubgraphPoolBase[] = testPools.weightedOnly;
        const stable: SubgraphPoolBase[] = testPools.stableOnly;
        const allPools = stable.concat(...weighted);

        const [poolsOfInterestDictionary, hopTokens] = filter(
            allPools,
            tokenIn,
            tokenOut,
            maxPools
        );

        const [noDirect, noHopIn, noHopOut, noWeighted, noStable] =
            countPoolSwapPairTypes(poolsOfInterestDictionary);

        assert.equal(hopTokens.length, 1);
        assert.equal(noHopIn, 2); // 1 has 0 balances
        assert.equal(noHopOut, 1); // 1 has 0 balances
        assert.equal(noDirect, 4); // 1 has 0 balances
        assert.equal(noWeighted, 6);
        assert.equal(noStable, 1);
    });

    it('should filter weighted only hop pools correctly', () => {
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;

        const [, hopTokens, poolsMostLiquid, pathData, poolsAll] = filter(
            testPools.weightedOnly,
            tokenIn,
            tokenOut,
            maxPools
        );

        const [noDirect, noHopIn, noHopOut] =
            countPoolSwapPairTypes(poolsMostLiquid);

        assert.equal(hopTokens.length, 1);
        assert.equal(noHopIn, hopTokens.length);
        assert.equal(noHopOut, hopTokens.length);
        assert.equal(noDirect, 3);
        assert.equal(pathData.length, 4);

        checkPath(
            ['0x2dbd24322757d2e28de4230b1ca5b88e49a76979'],
            poolsAll,
            pathData[0],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x57755f7dec33320bca83159c26e93751bfd30fbe'],
            poolsAll,
            pathData[1],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x75286e183d923a5f52f52be205e358c5c9101b09'],
            poolsAll,
            pathData[2],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee',
                '0x12d6b6e24fdd9849abd42afd8f5775d36084a828',
            ],
            poolsAll,
            pathData[3],
            tokenIn,
            tokenOut
        );
    });

    it('should filter stable only hop pools correctly', () => {
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;

        const [, hopTokens, poolsMostLiquid, pathData, poolsAll] = filter(
            testPools.stableOnly,
            tokenIn,
            tokenOut,
            maxPools
        );

        const [noDirect, noHopIn, noHopOut] =
            countPoolSwapPairTypes(poolsMostLiquid);

        assert.equal(hopTokens.length, 0);
        assert.equal(noHopIn, hopTokens.length);
        assert.equal(noHopOut, hopTokens.length);
        assert.equal(noDirect, 1);
        assert.equal(pathData.length, 1);
        checkPath(
            ['0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'],
            poolsAll,
            pathData[0],
            tokenIn,
            tokenOut
        );
    });

    it('should calc weighted path limits', () => {
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;

        const [, , , , poolsAll, pathsSorted, maxAmt] = filter(
            testPools.weightedOnly,
            tokenIn,
            tokenOut,
            maxPools
        );

        // Known results taken from previous version
        assert.equal(maxAmt.toString(), '1620713758415909242296');
        checkPath(
            ['0x75286e183d923a5f52f52be205e358c5c9101b09'],
            poolsAll,
            pathsSorted[0],
            tokenIn,
            tokenOut
        );
        assert.equal(
            pathsSorted[0].limitAmount.toString(),
            '1469350670653619495898'
        );
        checkPath(
            ['0x57755f7dec33320bca83159c26e93751bfd30fbe'],
            poolsAll,
            pathsSorted[1],
            tokenIn,
            tokenOut
        );
        assert.equal(
            pathsSorted[1].limitAmount.toString(),
            '141733810572558367508'
        );
        checkPath(
            ['0x2dbd24322757d2e28de4230b1ca5b88e49a76979'],
            poolsAll,
            pathsSorted[2],
            tokenIn,
            tokenOut
        );
        assert.equal(
            pathsSorted[2].limitAmount.toString(),
            '9595666431716756460'
        );
        checkPath(
            [
                '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee',
                '0x12d6b6e24fdd9849abd42afd8f5775d36084a828',
            ],
            poolsAll,
            pathsSorted[3],
            tokenIn,
            tokenOut
        );

        assert.equal(
            pathsSorted[3].limitAmount.toString(),
            '33610758014622430'
        );
    });

    it('should calc weighted path limits, exactOut', () => {
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;

        const [, , , , poolsAll, pathsSorted, maxAmt] = filter(
            testPools.weightedOnly,
            tokenIn,
            tokenOut,
            maxPools,
            SwapTypes.SwapExactOut
        );

        // Known results taken from previous version
        assert.equal(maxAmt.toString(), '1265931102');
        checkPath(
            ['0x75286e183d923a5f52f52be205e358c5c9101b09'],
            poolsAll,
            pathsSorted[0],
            tokenIn,
            tokenOut
        );
        assert.equal(pathsSorted[0].limitAmount.toString(), '1113575469');
        checkPath(
            ['0x57755f7dec33320bca83159c26e93751bfd30fbe'],
            poolsAll,
            pathsSorted[1],
            tokenIn,
            tokenOut
        );
        assert.equal(pathsSorted[1].limitAmount.toString(), '142877013');
        checkPath(
            ['0x2dbd24322757d2e28de4230b1ca5b88e49a76979'],
            poolsAll,
            pathsSorted[2],
            tokenIn,
            tokenOut
        );
        assert.equal(pathsSorted[2].limitAmount.toString(), '9445925');
        checkPath(
            [
                '0x29f55de880d4dcae40ba3e63f16407a31b4d44ee',
                '0x12d6b6e24fdd9849abd42afd8f5775d36084a828',
            ],
            poolsAll,
            pathsSorted[3],
            tokenIn,
            tokenOut
        );
        assert.equal(pathsSorted[3].limitAmount.toString(), '32695');
    });

    it('should calc stable path limits', () => {
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;

        const [, , , , poolsAll, pathsSorted, maxAmt] = filter(
            testPools.stableOnly,
            tokenIn,
            tokenOut,
            maxPools,
            SwapTypes.SwapExactIn
        );

        // Known results taken from previous version
        assert.equal(maxAmt.toString(), '45024648605340322085145755');
        checkPath(
            ['0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'],
            poolsAll,
            pathsSorted[0],
            tokenIn,
            tokenOut
        );
        assert.equal(
            pathsSorted[0].limitAmount.toString(),
            '45024648605340322085145755'
        );
    });

    it('Test pool class that has direct & multihop paths', async () => {
        const tokenIn = USDC.address;
        const tokenOut = DAI.address;
        const maxPools = 4;

        const [poolsOfInterestDictionary, hopTokens] = filter(
            testPools.pathTestDirectAndMulti,
            tokenIn,
            tokenOut,
            maxPools,
            SwapTypes.SwapExactIn
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary // poolsMostLiquid
        );

        assert.equal(hopTokens.length, 0);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2);
        assert.equal(noDirect, 1);
        assert.equal(noHopIn, 0);
        assert.equal(noHopOut, 1);
    });

    it('Test pool class that has two multihop paths, swapExactIn', async () => {
        const maxPools = 4;
        const tokenIn = USDC.address;
        const tokenOut = DAI.address;

        const [
            poolsOfInterestDictionary,
            hopTokens,
            poolsMostLiquid,
            pathData,
            poolsAll,
            pathsSorted,
            maxAmt,
        ] = filter(
            testPools.pathTestPoolTwoMultiHops,
            tokenIn,
            tokenOut,
            maxPools,
            SwapTypes.SwapExactIn
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        assert.equal(hopTokens.length, 2);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2); // 4 paths using two pools.
        assert.equal(noDirect, 0);
        assert.equal(noHopIn, 1);
        assert.equal(noHopOut, 1);
        assert.equal(pathData.length, 2);
        assert.equal(Object.keys(poolsMostLiquid).length, 2);
        checkPath(
            [
                '0x0481d726c3d25250a8963221945ed93b8a5315a9',
                '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e',
            ],
            poolsAll,
            pathsSorted[0],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0x0481d726c3d25250a8963221945ed93b8a5315a9',
                '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e',
            ],
            poolsAll,
            pathsSorted[1],
            tokenIn,
            tokenOut
        );
        assert.equal(maxAmt.toString(), '600000000');
        assert.equal(pathsSorted.length, 2);
        assert.equal(pathsSorted[0].limitAmount.toString(), '300000000');
        assert.equal(pathsSorted[1].limitAmount.toString(), '300000000');

        const [swaps, total] = getBestPaths(
            pathsSorted,
            SwapTypes.SwapExactIn,
            parseFixed('1', 6),
            6,
            18,
            4,
            Zero
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
            '0x0000000000085d4780b73119b644ae5ecd22b376'
        );
        assert.equal(
            swaps[0][1].pool,
            '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(swaps[0][1].swapAmount, '0.494754097206656');
        assert.equal(
            swaps[0][1].tokenIn,
            '0x0000000000085d4780b73119b644ae5ecd22b376'
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
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
        assert.equal(
            swaps[1][1].pool,
            '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(swaps[1][1].swapAmount, '0.494755096217348');
        assert.equal(
            swaps[1][1].tokenIn,
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
        assert.equal(swaps[1][1].tokenOut, tokenOut);
    });

    it('Test pool class that has two multihop paths, swapExactOut', async () => {
        const maxPools = 4;
        const tokenIn = USDC.address;
        const tokenOut = DAI.address;

        const [
            poolsOfInterestDictionary,
            hopTokens,
            ,
            pathData,
            poolsAll,
            pathsSorted,
            maxLiquidityAvailable,
        ] = filter(
            testPools.pathTestPoolTwoMultiHops,
            tokenIn,
            tokenOut,
            maxPools,
            SwapTypes.SwapExactOut
        );

        const [noDirect, noHopIn, noHopOut] = countPoolSwapPairTypes(
            poolsOfInterestDictionary
        );

        assert.equal(hopTokens.length, 2);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2); // 4 paths using two pools.
        assert.equal(noDirect, 0);
        assert.equal(noHopIn, 1);
        assert.equal(noHopOut, 1);
        assert.equal(pathData.length, 2);
        assert.equal(Object.keys(poolsOfInterestDictionary).length, 2);
        checkPath(
            [
                '0x0481d726c3d25250a8963221945ed93b8a5315a9',
                '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e',
            ],
            poolsAll,
            pathData[0],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0x0481d726c3d25250a8963221945ed93b8a5315a9',
                '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e',
            ],
            poolsAll,
            pathData[1],
            tokenIn,
            tokenOut
        );
        assert.equal(maxLiquidityAvailable.toString(), '600000000000000000000');
        assert.equal(pathsSorted.length, 2);
        assert.equal(
            pathsSorted[0].limitAmount.toString(),
            '300000000000000000000'
        );
        assert.equal(
            pathsSorted[1].limitAmount.toString(),
            '300000000000000000000'
        );

        const [swaps, total] = getBestPaths(
            pathsSorted,
            SwapTypes.SwapExactOut,
            parseFixed('1', 18),
            18,
            6,
            4,
            Zero
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
            '0x0000000000085d4780b73119b644ae5ecd22b376'
        );
        assert.equal(
            swaps[0][1].pool,
            '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(swaps[0][1].swapAmount, '0.499999999999981612');
        assert.equal(
            swaps[0][1].tokenIn,
            '0x0000000000085d4780b73119b644ae5ecd22b376'
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
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
        assert.equal(
            swaps[1][1].pool,
            '0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'
        );
        assert.equal(swaps[1][1].swapAmount, '0.500000000000018388');
        assert.equal(
            swaps[1][1].tokenIn,
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        );
        assert.equal(swaps[1][1].tokenOut, tokenOut);
    });
});

function filter(
    pools: SubgraphPoolBase[],
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    swapType = SwapTypes.SwapExactIn
): [
    PoolDictionary,
    string[],
    PoolDictionary,
    NewPath[],
    PoolDictionary,
    NewPath[],
    BigNumber
] {
    const timestamp = 0;
    const poolsAll = parseToPoolsDict(pools, timestamp);

    const [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
        poolsAll,
        tokenIn,
        tokenOut,
        maxPools
    );

    const [poolsMostLiquid, pathData] = filterHopPools(
        tokenIn,
        tokenOut,
        hopTokens,
        cloneDeep(poolsOfInterestDictionary)
    );

    let pathsSorted: NewPath[] = [];
    let maxAmt = Zero;
    [pathsSorted, maxAmt] = calculatePathLimits(cloneDeep(pathData), swapType);

    return [
        poolsOfInterestDictionary,
        hopTokens,
        poolsMostLiquid,
        pathData,
        poolsAll,
        pathsSorted,
        maxAmt,
    ];
}
