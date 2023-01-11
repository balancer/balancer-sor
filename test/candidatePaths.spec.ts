// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/candidatePaths.spec.ts
import { assert } from 'chai';
import { SwapTypes, PoolFilter, SwapOptions } from '../src/types';
import { parseToPoolsDict } from '../src/routeProposal/filtering';
import { checkPath } from './lib/testHelpers';
import subgraphPoolsLarge from './testData/testPools/subgraphPoolsLarge.json';
import testPools from './testData/filterTestPools.json';
import { BigNumber } from '@ethersproject/bignumber';
import { DAI, sorConfigTest, USDC, WETH } from './lib/constants';
import { RouteProposer } from '../src/routeProposal';

import pools_14717479 from './testData/boostedPools/pools_14717479.json';

describe('Tests pools filtering and path processing', () => {
    it('should filter to only direct pools for maxPools = 1', () => {
        const maxPools = 1;
        const routeProposer = new RouteProposer(sorConfigTest);
        const paths = routeProposer.getCandidatePaths(
            WETH.address,
            DAI.address,
            SwapTypes.SwapExactIn,
            subgraphPoolsLarge.pools,
            getSwapOptions(maxPools)
        );
        assert.equal(paths.length, 10, 'Should have 10 paths');
        for (let i = 0; i < paths.length; i++) {
            assert.equal(paths[i].swaps.length, 1, 'should have length 1');
        }
    });

    it('Check paths - WETH>DAI', async () => {
        const maxPools = 4;
        const tokenIn = WETH.address;
        const tokenOut = DAI.address;
        const swapOptions = getSwapOptions(maxPools);
        const routeProposer = new RouteProposer(sorConfigTest);
        const pathData = routeProposer.getCandidatePaths(
            WETH.address,
            DAI.address,
            SwapTypes.SwapExactIn,
            subgraphPoolsLarge.pools,
            swapOptions
        );
        const poolsAll = parseToPoolsDict(
            subgraphPoolsLarge.pools,
            swapOptions.timestamp
        );

        assert.equal(pathData.length, 14, 'Should have 14 paths');
        for (let i = 0; i < pathData.length; i++) {
            assert(pathData[i].limitAmount, 'limitAmount should be defined');
        }

        checkPath(
            ['0x9b208194acc0a8ccb2a8dcafeacfbb7dcc093f81'],
            poolsAll,
            pathData[0],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0xe5d1fab0c5596ef846dcc0958d6d0b20e1ec4498'],
            poolsAll,
            pathData[1],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0xc0b2b0c5376cb2e6f73b473a7caa341542f707ce'],
            poolsAll,
            pathData[2],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0xd6f0d319b2cce75123bf63e2c2bd8ba1f7d6b37a',
                '0xeba4dd6771c3e8ba3f168e47d052819abcc87cb2',
            ],
            poolsAll,
            pathData[3],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0xd4dbf96db2fdf8ed40296d8d104b371adf7dee12',
                '0x75286e183d923a5f52f52be205e358c5c9101b09',
            ],
            poolsAll,
            pathData[4],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x1b09173a0ffbad1cb7670b1a640013c0facfb71f'],
            poolsAll,
            pathData[5],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x53b89ce35928dda346c574d9105a5479cb87231c'],
            poolsAll,
            pathData[6],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x29f55de880d4dcae40ba3e63f16407a31b4d44ee'],
            poolsAll,
            pathData[7],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x4b47b11c353f0056c73a87fefccb6c43dc0d8065'],
            poolsAll,
            pathData[8],
            tokenIn,
            tokenOut
        );
        checkPath(
            [
                '0x7f0b4d22b8a9abe2ae9ea1077fe1ab77dc7283a3',
                '0xeba4dd6771c3e8ba3f168e47d052819abcc87cb2',
            ],
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
            ['0x2dbd24322757d2e28de4230b1ca5b88e49a76979'],
            poolsAll,
            pathData[11],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0xec577a919fca1b682f584a50b1048331ef0f30dd'],
            poolsAll,
            pathData[12],
            tokenIn,
            tokenOut
        );
        checkPath(
            ['0x165a50bc092f6870dc111c349bae5fc35147ac86'],
            poolsAll,
            pathData[13],
            tokenIn,
            tokenOut
        );
    });

    it('should make correct paths for weighted only', () => {
        const maxPools = 4;
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapOptions = getSwapOptions(maxPools);
        const routeProposer = new RouteProposer(sorConfigTest);
        const pathData = routeProposer.getCandidatePaths(
            tokenIn,
            tokenOut,
            SwapTypes.SwapExactOut,
            testPools.weightedOnly,
            swapOptions
        );
        const poolsAll = parseToPoolsDict(
            testPools.weightedOnly,
            swapOptions.timestamp
        );
        assert.equal(pathData.length, 4);
        checkPath(
            ['0x75286e183d923a5f52f52be205e358c5c9101b09'],
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
            ['0x2dbd24322757d2e28de4230b1ca5b88e49a76979'],
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
        const swapOptions = getSwapOptions(maxPools);
        const routeProposer = new RouteProposer(sorConfigTest);
        const pathData = routeProposer.getCandidatePaths(
            tokenIn,
            tokenOut,
            SwapTypes.SwapExactOut,
            testPools.stableOnly,
            swapOptions
        );
        const poolsAll = parseToPoolsDict(
            testPools.stableOnly,
            swapOptions.timestamp
        );
        assert.equal(pathData.length, 1);
        checkPath(
            ['0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'],
            poolsAll,
            pathData[0],
            tokenIn,
            tokenOut
        );
    });

    it('Test pool class that has two multihop paths, swapExactOut', async () => {
        const maxPools = 4;
        const tokenIn = USDC.address;
        const tokenOut = DAI.address;
        const swapOptions = getSwapOptions(maxPools);
        const routeProposer = new RouteProposer(sorConfigTest);
        const pathData = routeProposer.getCandidatePaths(
            tokenIn,
            tokenOut,
            SwapTypes.SwapExactOut,
            testPools.pathTestPoolTwoMultiHops,
            swapOptions
        );
        const poolsAll = parseToPoolsDict(
            testPools.pathTestPoolTwoMultiHops,
            swapOptions.timestamp
        );
        assert.equal(pathData.length, 2);
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
        assert.equal(
            pathData[0].limitAmount.toString(),
            '300000000000000000000'
        );
        assert.equal(
            pathData[1].limitAmount.toString(),
            '300000000000000000000'
        );
    });

    it('lbp test', () => {
        // This test was originally failing due to lbp token addresses
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poolsDict = parseToPoolsDict(pools_14717479 as any, 0);

        const config = {
            chainId: 1,
            vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            bbausd: {
                id: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
                address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
            },
            staBal3Pool: undefined,
            wETHwstETH: undefined,
            lbpRaisingTokens: [
                '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            ],
        };
        const routeProposer = new RouteProposer(config);
        const paths = routeProposer.getCandidatePathsFromDict(
            WETH.address,
            USDC.address,
            SwapTypes.SwapExactIn,
            poolsDict
            //4
        );
        assert.equal(paths.length, 34, 'Should have 34 paths');
    });
});

function getSwapOptions(maxPools: number) {
    const swapOptions: SwapOptions = {
        gasPrice: BigNumber.from(0),
        swapGas: BigNumber.from(0),
        timestamp: 0,
        maxPools: maxPools,
        poolTypeFilter: PoolFilter.All,
        forceRefresh: true,
    };
    return swapOptions;
}
