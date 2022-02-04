// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { performance, PerformanceObserver } from 'perf_hooks';
import { parseFixed } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import {
    mockWeightedPool,
    mockStablePool,
    mockMetaStablePool,
    mockPhantomStablePool,
    mockLinearPool,
} from './testData/mockPools';
import { WeightedPool } from '../src/pools/weightedPool/weightedPool';
import { StablePool } from '../src/pools/stablePool/stablePool';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';
import { PhantomStablePool } from '../src/pools/phantomStablePool/phantomStablePool';
import { LinearPool } from '../src/pools/linearPool/linearPool';
import { WeightedPool as WeightedPoolSdk } from './SDK/WeightedPool';
import { StablePool as StablePoolSdk } from './SDK/StablePool';
import { MetaStablePool as MetaStablePoolSdk } from './SDK/MetaStablePool';
import { PhantomStablePool as PhantomStableSdk } from './SDK/PhantomStablePool';
import { LinearPool as LinearSdk } from './SDK/LinearPool';
import { SubgraphPoolBase } from '../src';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const wstETH = '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const bbausdt = '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c';
const bbadai = '0x804cdb9116a10bb78768d3252355a1b18067bf8f';
const bbausd = '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2';

const amounts = [
    parseFixed('1', 18).toBigInt(),
    parseFixed('10', 18).toBigInt(),
    parseFixed('100', 18).toBigInt(),
    parseFixed('1000', 18).toBigInt(),
    parseFixed('10000', 18).toBigInt(),
];

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/invariant-test.spec.ts
describe(`Testing invariant`, () => {
    context('weightedPool', () => {
        context('_calcOutGivenIn', () => {
            it(`token>token`, () => {
                const tokenIn = USDC;
                const tokenOut = WETH;

                compareSorSdk(
                    mockWeightedPool,
                    tokenIn,
                    tokenOut,
                    '106',
                    6,
                    18,
                    '_exactTokenInForTokenOut',
                    WeightedPoolSdk.calcOutGivenIn,
                    WeightedPool,
                    WeightedPoolSdk
                );
            });
        });

        context('_calcInGivenOut', () => {
            it(`token>token`, () => {
                const tokenIn = USDC;
                const tokenOut = WETH;

                compareSorSdk(
                    mockWeightedPool,
                    tokenIn,
                    tokenOut,
                    '7',
                    18,
                    6,
                    '_tokenInForExactTokenOut',
                    WeightedPoolSdk.calcInGivenOut,
                    WeightedPool,
                    WeightedPoolSdk
                );
            });
        });
    });

    context('stablePool', () => {
        context('_calcOutGivenIn', () => {
            it(`token>token`, () => {
                const tokenIn = DAI;
                const tokenOut = USDC;

                compareSorSdk(
                    mockStablePool,
                    tokenIn,
                    tokenOut,
                    '106',
                    18,
                    6,
                    '_exactTokenInForTokenOut',
                    StablePoolSdk.calcOutGivenIn,
                    StablePool,
                    StablePoolSdk
                );
            });
        });

        context('_calcInGivenOut', () => {
            it(`token>token`, () => {
                const tokenIn = DAI;
                const tokenOut = USDC;

                compareSorSdk(
                    mockStablePool,
                    tokenIn,
                    tokenOut,
                    '106',
                    6,
                    18,
                    '_tokenInForExactTokenOut',
                    StablePoolSdk.calcInGivenOut,
                    StablePool,
                    StablePoolSdk
                );
            });
        });
    });

    context('metaStablePool', () => {
        context('_calcOutGivenIn', () => {
            it(`token>token`, () => {
                const tokenIn = WETH;
                const tokenOut = wstETH;

                compareSorSdk(
                    mockMetaStablePool,
                    tokenIn,
                    tokenOut,
                    '106',
                    18,
                    18,
                    '_exactTokenInForTokenOut',
                    MetaStablePoolSdk.calcOutGivenIn,
                    MetaStablePool,
                    MetaStablePoolSdk
                );
            });
        });

        context('_calcInGivenOut', () => {
            it(`token>token`, () => {
                const tokenIn = WETH;
                const tokenOut = wstETH;

                compareSorSdk(
                    mockMetaStablePool,
                    tokenIn,
                    tokenOut,
                    '106',
                    18,
                    18,
                    '_tokenInForExactTokenOut',
                    MetaStablePoolSdk.calcInGivenOut,
                    MetaStablePool,
                    MetaStablePoolSdk
                );
            });
        });
    });

    context('PhantomStablePool', () => {
        context('compare SDK', () => {
            context('_calcOutGivenIn', () => {
                it(`token>token`, () => {
                    const tokenIn = bbadai;
                    const tokenOut = bbausdt;

                    compareSorSdk(
                        mockPhantomStablePool,
                        tokenIn,
                        tokenOut,
                        '106',
                        18,
                        18,
                        '_exactTokenInForTokenOut',
                        PhantomStableSdk.calcOutGivenIn,
                        PhantomStablePool,
                        PhantomStableSdk
                    );
                });

                it(`token>bpt`, () => {
                    const tokenIn = bbadai;
                    const tokenOut = bbausd;

                    compareSorSdk(
                        mockPhantomStablePool,
                        tokenIn,
                        tokenOut,
                        '77',
                        18,
                        18,
                        '_exactTokenInForTokenOut',
                        PhantomStableSdk.calcOutGivenIn,
                        PhantomStablePool,
                        PhantomStableSdk
                    );
                });

                it(`bpt>token`, () => {
                    const tokenIn = bbausd;
                    const tokenOut = bbadai;

                    compareSorSdk(
                        mockPhantomStablePool,
                        tokenIn,
                        tokenOut,
                        '1234',
                        18,
                        18,
                        '_exactTokenInForTokenOut',
                        PhantomStableSdk.calcOutGivenIn,
                        PhantomStablePool,
                        PhantomStableSdk
                    );
                });
            });

            context('_calcInGivenOut', () => {
                it(`token>token`, () => {
                    const tokenIn = bbadai;
                    const tokenOut = bbausdt;

                    compareSorSdk(
                        mockPhantomStablePool,
                        tokenIn,
                        tokenOut,
                        '106',
                        18,
                        18,
                        '_tokenInForExactTokenOut',
                        PhantomStableSdk.calcInGivenOut,
                        PhantomStablePool,
                        PhantomStableSdk
                    );
                });

                it(`token>bpt`, () => {
                    const tokenIn = bbadai;
                    const tokenOut = bbausd;

                    compareSorSdk(
                        mockPhantomStablePool,
                        tokenIn,
                        tokenOut,
                        '77',
                        18,
                        18,
                        '_tokenInForExactTokenOut',
                        PhantomStableSdk.calcInGivenOut,
                        PhantomStablePool,
                        PhantomStableSdk
                    );
                });

                it(`bpt>token`, () => {
                    const tokenIn = bbausd;
                    const tokenOut = bbadai;

                    compareSorSdk(
                        mockPhantomStablePool,
                        tokenIn,
                        tokenOut,
                        '1234',
                        18,
                        18,
                        '_tokenInForExactTokenOut',
                        PhantomStableSdk.calcInGivenOut,
                        PhantomStablePool,
                        PhantomStableSdk
                    );
                });
            });
        });
    });

    context('LinearPool', () => {
        context('compare SDK', () => {
            context('_calcOutGivenIn', () => {
                it(`main>bpt`, () => {
                    const tokenIn = USDT;
                    const tokenOut = bbausdt;

                    compareSorSdk(
                        mockLinearPool,
                        tokenIn,
                        tokenOut,
                        '106',
                        6,
                        18,
                        '_exactMainTokenInForBPTOut',
                        LinearSdk.calcOutGivenIn,
                        LinearPool,
                        LinearSdk
                    );
                });

                it(`bpt>main`, () => {
                    const tokenIn = bbausdt;
                    const tokenOut = USDT;

                    compareSorSdk(
                        mockLinearPool,
                        tokenIn,
                        tokenOut,
                        '77',
                        18,
                        6,
                        '_exactBPTInForMainTokenOut',
                        LinearSdk.calcOutGivenIn,
                        LinearPool,
                        LinearSdk
                    );
                });
            });
        });

        context('_calcInGivenOut', () => {
            it(`main>bpt`, () => {
                const tokenIn = USDT;
                const tokenOut = bbausdt;

                compareSorSdk(
                    mockLinearPool,
                    tokenIn,
                    tokenOut,
                    '12',
                    18,
                    6,
                    '_mainTokenInForExactBPTOut',
                    LinearSdk.calcInGivenOut,
                    LinearPool,
                    LinearSdk
                );
            });

            it(`bpt>main`, () => {
                const tokenIn = bbausdt;
                const tokenOut = USDT;

                compareSorSdk(
                    mockLinearPool,
                    tokenIn,
                    tokenOut,
                    '3467',
                    6,
                    18,
                    '_BPTInForExactMainTokenOut',
                    LinearSdk.calcInGivenOut,
                    LinearPool,
                    LinearSdk
                );
            });
        });
    });
});

function compare(
    testFn,
    testArgs,
    amtIndex,
    invariantFn,
    invariantArgs,
    isBenchmark = false
) {
    const resultsWithInvariant: BigInt[] = [];
    amounts.forEach((amt) => {
        testArgs[amtIndex] = amt;
        const result = testFn.apply(this, testArgs);
        resultsWithInvariant.push(result);
    });

    const resultsWithoutInvariant: BigInt[] = [];
    const invariant = invariantFn.apply(this, invariantArgs);
    const testArgsClone = cloneDeep(testArgs);
    testArgsClone.push(invariant);
    amounts.forEach((amt) => {
        testArgsClone[amtIndex] = amt;
        const result = testFn.apply(this, testArgsClone);
        resultsWithoutInvariant.push(result);
    });

    console.log(resultsWithInvariant.toString());
    console.log(resultsWithoutInvariant.toString());

    expect(resultsWithInvariant).to.deep.eq(resultsWithoutInvariant);
    if (isBenchmark)
        benchmark(testFn, testArgs, amtIndex, invariantFn, invariantArgs);
}

function benchmark(testFn, testArgs, amtIndex, invariantFn, invariantArgs) {
    const amt = parseFixed('1000', 18).toBigInt();
    testArgs[amtIndex] = amt;
    let iterations = 1000000;

    performance.mark('start');
    while (iterations--) {
        testFn.apply(this, testArgs);
    }
    performance.mark('end');

    iterations = 1000000;

    performance.mark('startSecond');
    const invariant = invariantFn.apply(this, invariantArgs);
    const testArgsClone = cloneDeep(testArgs);
    testArgsClone.push(invariant);
    while (iterations--) {
        testFn.apply(this, testArgsClone);
    }
    performance.mark('endSecond');

    const obs = new PerformanceObserver((list, observer) => {
        console.log(list.getEntries()); // [0]);
        performance.clearMarks();
        observer.disconnect();
    });
    obs.observe({ entryTypes: ['measure'] });

    performance.measure('NoOptimisation', 'start', 'end');
    performance.measure('WithOptimisation', 'startSecond', 'endSecond');
}

function compareSorSdk(
    pool: SubgraphPoolBase,
    tokenIn: string,
    tokenOut: string,
    amountHuman: string,
    amountInDecimals: number,
    tokenOutDecimals: number,
    sorFunctionName: string,
    sdkFunction,
    sorPoolClass,
    sdkPoolClass
) {
    // const sorPhantomPool = PhantomStablePool.fromPool(cloneDeep(pool));
    const sorPool = sorPoolClass.fromPool(cloneDeep(pool));
    const sorPairData = sorPool.parsePoolPairData(tokenIn, tokenOut);

    // const sdkPairData = PhantomStableSdk.parsePoolPairDataBigInt(
    const sdkPairData = sdkPoolClass.parsePoolPairDataBigInt(
        cloneDeep(pool),
        tokenIn,
        tokenOut
    );

    const amtBn = bnum(amountHuman);
    const sorAmtOut = sorPool[sorFunctionName](sorPairData, amtBn);
    const amtSdk = parseFixed(amountHuman, amountInDecimals).toBigInt();
    const sdkAmtOut = sdkFunction(sdkPairData, [amtSdk, amtSdk]);
    console.log(sdkAmtOut[1].toString());
    expect(parseFixed(sorAmtOut.toString(), tokenOutDecimals).toString()).to.eq(
        sdkAmtOut[1].toString()
    );
    expect(parseFixed(sorAmtOut.toString(), tokenOutDecimals).toString()).to.eq(
        sdkAmtOut[0].toString()
    );
}
