// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/linear.spec.ts
import { assert, expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    PoolDictionary,
    NewPath,
    SwapTypes,
    PoolDictionaryByMain,
    PoolPairBase,
} from '../src/types';
import {
    filterPoolsOfInterest,
    filterHopPools,
    getPathsUsingLinearPools,
} from '../src/routeProposal/filtering';
import { calculatePathLimits } from '../src/routeProposal/pathLimits';
import BigNumber from 'bignumber.js';
import { formatSwaps } from '../src/formatSwaps';

import subgraphPoolsLargeLinear from './testData/linearPools/subgraphPoolsLargeLinear.json';
import smallLinear from './testData/linearPools/smallLinear.json';
import singleLinear from './testData/linearPools/singleLinear.json';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';
import { bnum } from '../src/index';
import { getBestPaths } from '../src/router';

const WETH = {
    symbol: 'WETH',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
};
const DAI = {
    symbol: 'DAI',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
};
const USDC = {
    symbol: 'USDC',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
}; // USDC precision = 6
const USDT = {
    symbol: 'USDT',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
}; // USDT precision = 6

const chainId = 1;

describe('linear pool tests', () => {
    context('with no LinearPools', () => {
        it('getPathsUsingLinearPool return empty paths', () => {
            const tokenIn = DAI.address;
            const tokenOut = USDC.address;
            const maxPools = 4;

            const testPools: any = cloneDeep(singleLinear.pools);

            let [poolsFilteredDict, , poolsAllDict] = filterPoolsOfInterest(
                testPools,
                tokenIn,
                tokenOut,
                maxPools
            );

            const pathsUsingLinear = getPathsUsingLinearPools(
                tokenIn,
                tokenOut,
                poolsAllDict,
                poolsFilteredDict,
                chainId
            );

            console.log(pathsUsingLinear);

            expect(pathsUsingLinear).to.be.empty;
        });
    });

    context('with no joining MetaStablePool', () => {
        it('getPathsUsingLinearPool return empty paths', () => {
            const tokenIn = DAI.address;
            const tokenOut = USDC.address;
            const maxPools = 4;

            const testPools: any = cloneDeep(singleLinear.pools);

            const [poolsFilteredDict, , poolsAllDict] = filterPoolsOfInterest(
                testPools,
                tokenIn,
                tokenOut,
                maxPools
            );

            const pathsUsingLinear = getPathsUsingLinearPools(
                tokenIn,
                tokenOut,
                poolsAllDict,
                poolsFilteredDict,
                99
            );

            expect(pathsUsingLinear).to.be.empty;
        });
    });

    context('Considering Linear Paths Only', () => {
        context('getPathsUsingLinearPools - stable pair', () => {
            it('should return 1 valid linear path', async () => {
                const tokenIn = DAI.address;
                const tokenOut = USDC.address;
                const maxPools = 10;
                const testPools: any = cloneDeep(smallLinear.pools);

                const [poolsFilteredDict, , poolsAllDict] =
                    filterPoolsOfInterest(
                        testPools,
                        tokenIn,
                        tokenOut,
                        maxPools
                    );

                const pathsUsingLinear = getPathsUsingLinearPools(
                    tokenIn,
                    tokenOut,
                    poolsAllDict,
                    poolsFilteredDict,
                    chainId
                );

                assert.equal(pathsUsingLinear.length, 1);
                checkPath(
                    ['linearDAI', 'multiid', 'linearUSDC'],
                    poolsAllDict,
                    pathsUsingLinear[0],
                    tokenIn,
                    tokenOut
                );
            });
        });

        context(
            'getPathsUsingLinearPools - non-stable pair with one linear pathways',
            () => {
                it('should return 1 valid linear paths', async () => {
                    const tokenIn = WETH.address;
                    const tokenOut = DAI.address;
                    const maxPools = 10;
                    const testPools: any = cloneDeep(smallLinear.pools);

                    const [poolsFilteredDict, , poolsAllDict] =
                        filterPoolsOfInterest(
                            testPools,
                            tokenIn,
                            tokenOut,
                            maxPools
                        );

                    const pathsUsingLinear = getPathsUsingLinearPools(
                        tokenIn,
                        tokenOut,
                        poolsAllDict,
                        poolsFilteredDict,
                        chainId
                    );

                    assert.equal(pathsUsingLinear.length, 1);
                    checkPath(
                        [
                            'weightedUsdcWeth',
                            'linearUSDC',
                            'multiid',
                            'linearDAI',
                        ],
                        poolsAllDict,
                        pathsUsingLinear[0],
                        tokenIn,
                        tokenOut
                    );
                });
            }
        );

        context(
            'getPathsUsingLinearPools - non-stable pair with two linear pathways',
            () => {
                it('should return 2 valid linear paths', async () => {
                    const tokenIn = USDT.address;
                    const tokenOut = WETH.address;
                    const maxPools = 10;
                    const testPools: any = cloneDeep(smallLinear.pools);

                    const [poolsFilteredDict, , poolsAllDict] =
                        filterPoolsOfInterest(
                            testPools,
                            tokenIn,
                            tokenOut,
                            maxPools
                        );

                    const pathsUsingLinear = getPathsUsingLinearPools(
                        tokenIn,
                        tokenOut,
                        poolsAllDict,
                        poolsFilteredDict,
                        chainId
                    );

                    assert.equal(pathsUsingLinear.length, 2);
                    checkPath(
                        [
                            'linearUSDT',
                            'multiid',
                            'linearUSDC',
                            'weightedUsdcWeth',
                        ],
                        poolsAllDict,
                        pathsUsingLinear[0],
                        tokenIn,
                        tokenOut
                    );
                    checkPath(
                        [
                            'linearUSDT',
                            'multiid',
                            'linearDAI',
                            'weightedDaiWeth',
                        ],
                        poolsAllDict,
                        pathsUsingLinear[1],
                        tokenIn,
                        tokenOut
                    );
                });
            }
        );
    });

    context('Considering All Paths', () => {
        context('stable pair with weighted and linear pools', () => {
            it('should return 3 paths', async () => {
                const tokenIn = DAI.address;
                const tokenOut = USDC.address;
                const maxPools = 10;
                const testPools: any = cloneDeep(smallLinear.pools);

                const [paths, poolAllDict] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    testPools,
                    maxPools
                );

                assert.equal(paths.length, 3);
                checkPath(
                    ['linearDAI', 'multiid', 'linearUSDC'],
                    poolAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
                checkPath(
                    ['weightedDaiWeth', 'weightedUsdcWeth'],
                    poolAllDict,
                    paths[1],
                    tokenIn,
                    tokenOut
                );
                checkPath(
                    ['weightedDaiUsdc'],
                    poolAllDict,
                    paths[2],
                    tokenIn,
                    tokenOut
                );
            });
        });

        context('non-stable pair with weighted and linear pools', () => {
            it('should return 3 paths', async () => {
                const tokenIn = WETH.address;
                const tokenOut = DAI.address;
                const maxPools = 10;
                const testPools: any = cloneDeep(smallLinear.pools);

                const [paths, poolsAllDict] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    testPools,
                    maxPools
                );

                assert.equal(paths.length, 3);
                checkPath(
                    ['weightedUsdcWeth', 'linearUSDC', 'multiid', 'linearDAI'],
                    poolsAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
                checkPath(
                    ['weightedUsdcWeth', 'weightedDaiUsdc'],
                    poolsAllDict,
                    paths[1],
                    tokenIn,
                    tokenOut
                );
                checkPath(
                    ['weightedDaiWeth'],
                    poolsAllDict,
                    paths[2],
                    tokenIn,
                    tokenOut
                );
            });
        });

        context('non-stable pair with weighted and linear pools', () => {
            it('should return 2 valid linear paths, no other paths', async () => {
                const tokenIn = USDT.address;
                const tokenOut = WETH.address;
                const maxPools = 10;
                const testPools: any = cloneDeep(smallLinear.pools);

                const [paths, poolsAllDict] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    testPools,
                    maxPools
                );

                assert.equal(paths.length, 2);
                checkPath(
                    ['linearUSDT', 'multiid', 'linearUSDC', 'weightedUsdcWeth'],
                    poolsAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
                checkPath(
                    ['linearUSDT', 'multiid', 'linearDAI', 'weightedDaiWeth'],
                    poolsAllDict,
                    paths[1],
                    tokenIn,
                    tokenOut
                );
            });
        });
    });

    // context('TO DO - ADD SOME TESTS FOR THESE FULL CASES??', () => {
    //     it('basic swap cases', async () => {
    //         runSOR(
    //             DAI,
    //             USDC,
    //             SwapTypes.SwapExactIn,
    //             new BigNumber(2500),
    //             subgraphPoolsLargeLinear
    //         );
    //         console.log('second: ');
    //         runSOR(
    //             DAI,
    //             USDC,
    //             SwapTypes.SwapExactIn,
    //             new BigNumber(2500),
    //             singleLinear
    //         );
    //         console.log('third: ');
    //         runSOR(
    //             WETH,
    //             USDC,
    //             SwapTypes.SwapExactIn,
    //             new BigNumber(10),
    //             smallLinear
    //         );
    //         console.log('fourth: ');
    //         runSOR(
    //             WETH,
    //             USDC,
    //             SwapTypes.SwapExactOut,
    //             new BigNumber(10),
    //             smallLinear
    //         );
    //     });
    // });
});

/*
Checks path for:
- ID
- tokenIn/Out
- poolPairData
- Valid swap path
*/
function checkPath(
    poolIds: string[],
    pools: PoolDictionary,
    path: NewPath,
    tokenIn: string,
    tokenOut: string
) {
    // IDS should be all IDS concatenated
    expect(path.id).to.eq(poolIds.join(''));
    // Lengths of pools, pairData and swaps should all be equal
    expect(poolIds.length).to.eq(path.poolPairData.length);
    expect(
        path.poolPairData.length === path.swaps.length &&
            path.swaps.length === path.pools.length
    ).to.be.true;

    let lastTokenOut = path.swaps[0].tokenIn;

    // Check each part of path
    for (let i = 0; i < poolIds.length; i++) {
        const poolId = poolIds[i];
        const poolInfo = pools[poolId];
        const tokenIn = path.swaps[i].tokenIn;
        const tokenOut = path.swaps[i].tokenOut;
        const poolPairData = poolInfo.parsePoolPairData(tokenIn, tokenOut);
        expect(path.pools[i]).to.deep.eq(poolInfo);
        expect(path.poolPairData[i]).to.deep.eq(poolPairData);

        expect(path.swaps[i].pool).eq(poolId);
        // TokenIn should equal previous swaps tokenOut
        expect(path.swaps[i].tokenIn).eq(lastTokenOut);
        // expect(path.swaps[i].tokenInDecimals).eq(poolPairData.decimalsIn); TO DO - Not currently passing
        // expect(path.swaps[i].tokenOutDecimals).eq(poolPairData.decimalsOut);
        lastTokenOut = tokenOut;
    }

    // TokenIn/Out should be first and last of path
    expect(path.swaps[0].tokenIn).to.eq(tokenIn);
    expect(path.swaps[path.swaps.length - 1].tokenOut).to.eq(tokenOut);
}

function getPaths(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools,
    maxPools
): [NewPath[], PoolDictionary] {
    const [poolsFilteredDict, hopTokens, poolsAllDict] = filterPoolsOfInterest(
        cloneDeep(pools),
        tokenIn,
        tokenOut,
        maxPools
    );

    let pathData: NewPath[] = [];
    [, pathData] = filterHopPools(
        tokenIn,
        tokenOut,
        hopTokens,
        poolsFilteredDict
    );

    const pathsUsingLinear = getPathsUsingLinearPools(
        tokenIn,
        tokenOut,
        poolsAllDict,
        poolsFilteredDict,
        chainId
    );
    pathData = pathData.concat(pathsUsingLinear);
    const [paths] = calculatePathLimits(pathData, swapType);
    return [paths, poolsAllDict];
}

function runSOR(
    tokIn,
    tokOut,
    swapType: SwapTypes,
    swapAmount: BigNumber,
    jsonPools
) {
    console.log(
        'Input info:\ntoken in: ',
        tokIn.symbol,
        '\ntoken out:',
        tokOut.symbol
    );
    console.log(
        'swap type: ',
        swapType.toString(),
        '\nswap amount: ',
        swapAmount.toString(),
        '\n'
    );
    const maxPools = 10;
    const tokenIn = tokIn.address;
    const tokenOut = tokOut.address;
    const [paths] = getPaths(
        tokenIn,
        tokenOut,
        swapType,
        jsonPools.pools,
        maxPools
    );
    let swaps: any,
        total: BigNumber,
        totalConsideringFees: BigNumber,
        marketSp: BigNumber;
    [swaps, total, marketSp, totalConsideringFees] = getBestPaths(
        // getBestRoute?
        paths,
        swapType,
        swapAmount,
        maxPools,
        bnum(0.01)
    );
    console.log('swaps: ', swaps);
    /*
    const swapInfo = formatSwaps(
        swaps,
        swapType,
        swapAmount,
        tokIn,
        tokenOut,
        total,
        totalConsideringFees,
        marketSp
    );
    console.log(swapInfo.swaps );
    console.log(swapInfo.tokenAddresses );*/
}
