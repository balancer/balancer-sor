// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { parseFixed } from '@ethersproject/bignumber';
import { bnum } from '../src/utils/bignumber';
import {
    mockWeightedPool,
    mockStablePool,
    mockMetaStablePool,
    mockPhantomStablePool,
    mockLinearPool,
    mockVirtualPools,
} from './testData/mockPools';
import { poolToEvm } from './PARASWAP-HELPERS/utils';
import { WeightedPool } from '../src/pools/weightedPool/weightedPool';
import { StablePool } from '../src/pools/stablePool/stablePool';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';
import { PhantomStablePool } from '../src/pools/phantomStablePool/phantomStablePool';
import { LinearPool } from '../src/pools/linearPool/linearPool';
import { WeightedPool as WeightedPoolSdk } from './SDK/WeightedPool';
import { WeightedPool as WeightedPoolPs } from './PARASWAP-CORE/WeightedPool';
import { StablePool as StablePoolSdk } from './SDK/StablePool';
import { StablePool as StablePoolPs } from './PARASWAP-CORE/StablePool';
import { MetaStablePool as MetaStablePoolSdk } from './SDK/MetaStablePool';
import { MetaStablePool as MetaStablePoolPs } from './PARASWAP-CORE/MetaStablePool';
import { PhantomStablePool as PhantomStableSdk } from './SDK/PhantomStablePool';
import { PhantomStablePool as PhantomStablePoolPs } from './PARASWAP-CORE/PhantomStablePool';
import { LinearPool as LinearSdk } from './SDK/LinearPool';
import { LinearPool as LinearPoolPs } from './PARASWAP-CORE/LinearPool';
import { VirtualBoostedPool } from './PARASWAP-CORE/VirtualBoostedPool';

import StablePoolABI from '../src/pools/stablePool/stablePoolAbi.json';
import WeightedPoolABI from '../src/pools/weightedPool/weightedPoolAbi.json';
import MetaStablePoolABI from '../src/pools/metaStablePool/metaStablePoolAbi.json';
import LinearPoolABI from '../src/pools/linearPool/linearPoolAbi.json';
import VaultABI from '../src/abi/Vault.json';

import { SubgraphPoolBase } from '../src';
import {
    WeightedPoolHelper,
    StablePoolHelper,
    MetaStablePoolHelper,
    PhantomStablePoolHelper,
    LinearPoolHelper,
} from './PARASWAP-HELPERS/utils';
import { BZERO } from '../src/utils/basicOperations';
import { PoolState } from './PARASWAP-CORE/types';
import { Interface } from '@ethersproject/abi';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const wstETH = '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const bbausdt = '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c';
const bbadai = '0x804cdb9116a10bb78768d3252355a1b18067bf8f';
const bbausd = '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2';

const poolState = {
    '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2': {
        swapFee: BigInt('10000000000000'),
        tokens: {
            '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c': {
                balance: BigInt('46963606244185845033448695'),
                scalingFactor: BigInt('1003860945658441527'),
            },
            '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2': {
                balance: BigInt('5192296680484544281642949655295699'),
                scalingFactor: BigInt('1000000000000000000'),
            },
            '0x804cdb9116a10bb78768d3252355a1b18067bf8f': {
                balance: BigInt('57597769020277591465532500'),
                scalingFactor: BigInt('1003407877186982634'),
            },
            '0x9210f1204b5a24742eba12f710636d76240df3d0': {
                balance: BigInt('73831193288594519348378621'),
                scalingFactor: BigInt('1003611213001924196'),
            },
        },
        amp: BigInt('1472000'),
    },
    '0x804cdb9116a10bb78768d3252355a1b18067bf8f': {
        swapFee: BigInt('200000000000000'),
        mainIndex: 1,
        wrappedIndex: 0,
        bptIndex: 2,
        lowerTarget: BigInt('2900000000000000000000000'),
        upperTarget: BigInt('3100000000000000000000000'),
        tokens: {
            '0x02d60b84491589974263d922d9cc7a3152618ef6': {
                balance: BigInt('51016099016319982080407268'),
                scalingFactor: BigInt('1066220614553065054'),
            },
            '0x6b175474e89094c44da98b954eedeac495271d0f': {
                balance: BigInt('3404000000000000000000000'),
                scalingFactor: BigInt('1000000000000000000'),
            },
            '0x804cdb9116a10bb78768d3252355a1b18067bf8f': {
                balance: BigInt('5192296800933072990747876289206773'),
                scalingFactor: BigInt('1000000000000000000'),
            },
        },
    },
    '0x9210f1204b5a24742eba12f710636d76240df3d0': {
        swapFee: BigInt('200000000000000'),
        mainIndex: 1,
        wrappedIndex: 2,
        bptIndex: 0,
        lowerTarget: BigInt('2900000000000000000000000'),
        upperTarget: BigInt('3100000000000000000000000'),
        tokens: {
            '0x9210f1204b5a24742eba12f710636d76240df3d0': {
                balance: BigInt('5192296784703634339935976980841474'),
                scalingFactor: BigInt('1000000000000000000'),
            },
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
                balance: BigInt('2970000000000'),
                scalingFactor: BigInt('1000000000000000000000000000000'),
            },
            '0xd093fa4fb80d09bb30817fdcd442d4d02ed3e5de': {
                balance: BigInt('66503732221769'),
                scalingFactor: BigInt('1069536072894931950000000000000'),
            },
        },
    },
    '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c': {
        swapFee: BigInt('200000000000000'),
        mainIndex: 1,
        wrappedIndex: 2,
        bptIndex: 0,
        lowerTarget: BigInt('2900000000000000000000000'),
        upperTarget: BigInt('3100000000000000000000000'),
        tokens: {
            '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c': {
                balance: BigInt('5192296811571216535353749913746942'),
                scalingFactor: BigInt('1000000000000000000'),
            },
            '0xdac17f958d2ee523a2206206994597c13d831ec7': {
                balance: BigInt('3060838083894'),
                scalingFactor: BigInt('1000000000000000000000000000000'),
            },
            '0xf8fd466f12e236f4c96f7cce6c79eadb819abf58': {
                balance: BigInt('40823068446482'),
                scalingFactor: BigInt('1079887266497105149000000000000'),
            },
        },
    },
};

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/invariant-test.spec.ts
describe(`Testing invariant`, () => {
    context('weightedPool', () => {
        context('_calcOutGivenIn', () => {
            it(`SOR vs SDK, token>token`, () => {
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

            it(`Paraswap vs SDK, token>token`, () => {
                const tokenIn = USDC;
                const tokenOut = WETH;
                const amountsIn = [
                    parseFixed('1', 6).toBigInt(),
                    parseFixed('777', 6).toBigInt(),
                ];

                const sdkPairData = WeightedPoolSdk.parsePoolPairDataBigInt(
                    cloneDeep(mockWeightedPool),
                    tokenIn,
                    tokenOut
                );
                const sdkAmtsOut = WeightedPoolSdk.calcOutGivenIn(
                    sdkPairData,
                    amountsIn
                );
                const evmPool = poolToEvm(cloneDeep(mockWeightedPool));
                const psPairData = WeightedPoolHelper.parsePoolPairDataBigInt(
                    cloneDeep(evmPool),
                    tokenIn,
                    tokenOut
                );
                const weightPoolPs = new WeightedPoolPs();
                const psAmtsOut = weightPoolPs.onSell(
                    amountsIn,
                    psPairData.balanceIn,
                    psPairData.balanceOut,
                    psPairData.scalingFactorTokenIn,
                    psPairData.scalingFactorTokenOut,
                    psPairData.weightIn,
                    psPairData.weightOut,
                    psPairData.fee
                );

                expect(sdkAmtsOut[0]).to.not.eq(BZERO);
                expect(sdkAmtsOut).to.deep.eq(psAmtsOut);
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

            it(`Paraswap vs SDK, token>token`, () => {
                const tokenIn = DAI;
                const tokenOut = USDC;
                const amountsIn = [
                    parseFixed('1', 18).toBigInt(),
                    parseFixed('777', 18).toBigInt(),
                ];

                const sdkPairData = StablePoolSdk.parsePoolPairDataBigInt(
                    cloneDeep(mockStablePool),
                    tokenIn,
                    tokenOut
                );
                const sdkAmtsOut = StablePoolSdk.calcOutGivenIn(
                    sdkPairData,
                    cloneDeep(amountsIn)
                );
                const evmPool = poolToEvm(cloneDeep(mockStablePool));
                const psPairData = StablePoolHelper.parsePoolPairDataBigInt(
                    cloneDeep(evmPool),
                    tokenIn,
                    tokenOut
                );
                const stablePoolPs = new StablePoolPs();
                const psAmtsOut = stablePoolPs.onSell(
                    amountsIn,
                    psPairData.balances,
                    psPairData.tokenIndexIn,
                    psPairData.tokenIndexOut,
                    psPairData.scalingFactors,
                    psPairData.fee,
                    psPairData.amp
                );

                console.log(sdkAmtsOut.toString());
                console.log(psAmtsOut.toString());

                expect(sdkAmtsOut[0]).to.not.eq(BZERO);
                expect(sdkAmtsOut).to.deep.eq(psAmtsOut);
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

            it(`Paraswap vs SDK, token>token`, () => {
                const tokenIn = WETH;
                const tokenOut = wstETH;
                const amountsIn = [
                    parseFixed('1', 18).toBigInt(),
                    parseFixed('777', 18).toBigInt(),
                ];

                const sdkPairData = MetaStablePoolSdk.parsePoolPairDataBigInt(
                    cloneDeep(mockMetaStablePool),
                    tokenIn,
                    tokenOut
                );
                const sdkAmtsOut = MetaStablePoolSdk.calcOutGivenIn(
                    sdkPairData,
                    cloneDeep(amountsIn)
                );
                const evmPool = poolToEvm(cloneDeep(mockMetaStablePool));
                // This parsing includes rate in scaling factors
                const psPairData = MetaStablePoolHelper.parsePoolPairDataBigInt(
                    cloneDeep(evmPool),
                    tokenIn,
                    tokenOut
                );
                const metaStablePoolPs = new MetaStablePoolPs();
                const psAmtsOut = metaStablePoolPs.onSell(
                    amountsIn,
                    psPairData.balances,
                    psPairData.tokenIndexIn,
                    psPairData.tokenIndexOut,
                    psPairData.scalingFactors,
                    psPairData.fee,
                    psPairData.amp
                );

                /*
                MockPool using real values from onChain Data.
                Used queryBatchSwap call to find vault deltas: 777000000000000000000, -733563956569874227512
                733563956569874227512 - SDK amount matches
                733563956569874227512
                */
                console.log(sdkAmtsOut.toString());
                console.log(psAmtsOut.toString());
                expect(sdkAmtsOut[0]).to.not.eq(BZERO);
                expect(sdkAmtsOut).to.deep.eq(psAmtsOut);
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

                it(`Paraswap vs SDK, token>token`, () => {
                    const tokenIn = bbadai;
                    const tokenOut = bbausdt;
                    const amountsIn = [
                        parseFixed('1', 18).toBigInt(),
                        parseFixed('1023', 18).toBigInt(),
                    ];

                    const sdkPairData =
                        PhantomStableSdk.parsePoolPairDataBigInt(
                            cloneDeep(mockPhantomStablePool),
                            tokenIn,
                            tokenOut
                        );
                    const sdkAmtsOut = PhantomStableSdk.calcOutGivenIn(
                        sdkPairData,
                        cloneDeep(amountsIn)
                    );
                    const evmPool = poolToEvm(cloneDeep(mockPhantomStablePool));
                    // This parsing includes rate in scaling factors
                    const psPairData =
                        PhantomStablePoolHelper.parsePoolPairDataBigInt(
                            cloneDeep(evmPool),
                            tokenIn,
                            tokenOut
                        );

                    const phantomStablePoolPs = new PhantomStablePoolPs();
                    const psAmtsOut = phantomStablePoolPs.onSell(
                        amountsIn,
                        psPairData.tokens,
                        psPairData.balances,
                        psPairData.tokenIndexIn,
                        psPairData.tokenIndexOut,
                        psPairData.bptIndex,
                        psPairData.scalingFactors,
                        psPairData.fee,
                        psPairData.amp
                    );

                    /*
                    MockPool using real values from onChain Data.
                    Used queryBatchSwap call to find vault deltas: 1023000000000000000000,-1022399151333072469408
                    */
                    console.log(sdkAmtsOut.toString());
                    console.log(psAmtsOut.toString());
                    expect(sdkAmtsOut[0]).to.not.eq(BZERO);
                    expect(sdkAmtsOut).to.deep.eq(psAmtsOut);
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

                it(`Paraswap vs SDK, token>bpt`, () => {
                    const tokenIn = bbadai;
                    const tokenOut = bbausd;
                    const amountsIn = [
                        parseFixed('1', 18).toBigInt(),
                        parseFixed('1023', 18).toBigInt(),
                    ];

                    const sdkPairData =
                        PhantomStableSdk.parsePoolPairDataBigInt(
                            cloneDeep(mockPhantomStablePool),
                            tokenIn,
                            tokenOut
                        );
                    const sdkAmtsOut = PhantomStableSdk.calcOutGivenIn(
                        sdkPairData,
                        cloneDeep(amountsIn)
                    );
                    const evmPool = poolToEvm(cloneDeep(mockPhantomStablePool));
                    // This parsing includes rate in scaling factors
                    const psPairData =
                        PhantomStablePoolHelper.parsePoolPairDataBigInt(
                            cloneDeep(evmPool),
                            tokenIn,
                            tokenOut
                        );
                    const metaStablePoolPs = new PhantomStablePoolPs();
                    const psAmtsOut = metaStablePoolPs.onSell(
                        amountsIn,
                        psPairData.tokens,
                        psPairData.balances,
                        psPairData.tokenIndexIn,
                        psPairData.tokenIndexOut,
                        psPairData.bptIndex,
                        psPairData.scalingFactors,
                        psPairData.fee,
                        psPairData.amp
                    );

                    /*
                    MockPool using real values from onChain Data.
                    Used queryBatchSwap call to find vault deltas: 1023000000000000000000,-1020812001962720918272
                    (1020.810329084016699455)
                    */
                    console.log(sdkAmtsOut.toString());
                    console.log(psAmtsOut.toString());
                    expect(sdkAmtsOut[0]).to.not.eq(BZERO);
                    expect(sdkAmtsOut).to.deep.eq(psAmtsOut);
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

                it(`Paraswap vs SDK, bpt>token`, () => {
                    const tokenIn = bbausd;
                    const tokenOut = bbadai;
                    const amountsIn = [
                        parseFixed('1', 18).toBigInt(),
                        parseFixed('1023', 18).toBigInt(),
                    ];

                    const sdkPairData =
                        PhantomStableSdk.parsePoolPairDataBigInt(
                            cloneDeep(mockPhantomStablePool),
                            tokenIn,
                            tokenOut
                        );
                    const sdkAmtsOut = PhantomStableSdk.calcOutGivenIn(
                        sdkPairData,
                        cloneDeep(amountsIn)
                    );
                    const evmPool = poolToEvm(cloneDeep(mockPhantomStablePool));
                    // This parsing includes rate in scaling factors
                    const psPairData =
                        PhantomStablePoolHelper.parsePoolPairDataBigInt(
                            cloneDeep(evmPool),
                            tokenIn,
                            tokenOut
                        );
                    const metaStablePoolPs = new PhantomStablePoolPs();
                    const psAmtsOut = metaStablePoolPs.onSell(
                        amountsIn,
                        psPairData.tokens,
                        psPairData.balances,
                        psPairData.tokenIndexIn,
                        psPairData.tokenIndexOut,
                        psPairData.bptIndex,
                        psPairData.scalingFactors,
                        psPairData.fee,
                        psPairData.amp
                    );

                    /*
                    MockPool using real values from onChain Data.
                    Used queryBatchSwap call to find vault deltas: 1023000000000000000000,-1025172173977726185664
                    (1025.173854004505107673)
                    */
                    console.log(sdkAmtsOut.toString());
                    console.log(psAmtsOut.toString());
                    expect(sdkAmtsOut[0]).to.not.eq(BZERO);
                    expect(sdkAmtsOut).to.deep.eq(psAmtsOut);
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

            it(`Paraswap vs SDK, main>bpt`, () => {
                const tokenIn = USDT;
                const tokenOut = bbausdt;
                const amountsIn = [
                    parseFixed('1', 18).toBigInt(),
                    parseFixed('1023', 18).toBigInt(),
                ];

                const sdkPairData = LinearSdk.parsePoolPairDataBigInt(
                    cloneDeep(mockLinearPool),
                    tokenIn,
                    tokenOut
                );
                const sdkAmtsOut = LinearSdk.calcOutGivenIn(
                    sdkPairData,
                    cloneDeep(amountsIn)
                );
                const evmPool = poolToEvm(cloneDeep(mockLinearPool));
                // This parsing includes rate in scaling factors
                const psPairData = LinearPoolHelper.parsePoolPairDataBigInt(
                    cloneDeep(evmPool),
                    tokenIn,
                    tokenOut
                );
                const linearPoolPs = new LinearPoolPs();

                const psAmtsOut = linearPoolPs.onSell(
                    amountsIn,
                    psPairData.tokens,
                    psPairData.balances,
                    psPairData.tokenIndexIn,
                    psPairData.tokenIndexOut,
                    psPairData.bptIndex,
                    psPairData.wrappedIndex,
                    psPairData.mainIndex,
                    psPairData.scalingFactors,
                    psPairData.fee,
                    psPairData.lowerTarget,
                    psPairData.upperTarget
                );
                console.log(sdkAmtsOut.toString());
                console.log(psAmtsOut.toString());
                expect(sdkAmtsOut[0]).to.not.eq(BZERO);
                expect(sdkAmtsOut).to.deep.eq(psAmtsOut);
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

            it(`Paraswap vs SDK, bpt>main`, () => {
                const tokenIn = bbausdt;
                const tokenOut = USDT;
                const amountsIn = [
                    parseFixed('1', 18).toBigInt(),
                    parseFixed('1023', 18).toBigInt(),
                ];

                const sdkPairData = LinearSdk.parsePoolPairDataBigInt(
                    cloneDeep(mockLinearPool),
                    tokenIn,
                    tokenOut
                );
                const sdkAmtsOut = LinearSdk.calcOutGivenIn(
                    sdkPairData,
                    cloneDeep(amountsIn)
                );
                const evmPool = poolToEvm(cloneDeep(mockLinearPool));
                // This parsing includes rate in scaling factors
                const psPairData = LinearPoolHelper.parsePoolPairDataBigInt(
                    cloneDeep(evmPool),
                    tokenIn,
                    tokenOut
                );
                const linearPoolPs = new LinearPoolPs();

                const psAmtsOut = linearPoolPs.onSell(
                    amountsIn,
                    psPairData.tokens,
                    psPairData.balances,
                    psPairData.tokenIndexIn,
                    psPairData.tokenIndexOut,
                    psPairData.bptIndex,
                    psPairData.wrappedIndex,
                    psPairData.mainIndex,
                    psPairData.scalingFactors,
                    psPairData.fee,
                    psPairData.lowerTarget,
                    psPairData.upperTarget
                );
                console.log(sdkAmtsOut.toString());
                console.log(psAmtsOut.toString());
                expect(sdkAmtsOut[0]).to.not.eq(BZERO);
                expect(sdkAmtsOut).to.deep.eq(psAmtsOut);
            });
        });
    });

    context('VirtualPool', () => {
        context('helpers', () => {
            it(`should parse virtual pools from Subgraph info`, () => {
                const virtualPool = new VirtualBoostedPool();
                const virtualPools = virtualPool.getVirtualBoostedPools(
                    cloneDeep(mockVirtualPools)
                );
                expect(virtualPools.length).to.eq(1);
                expect(virtualPools[0].poolType).to.eq('VirtualBoosted');
                expect(virtualPools[0].tokens[0].address).to.eq(DAI);
                expect(virtualPools[0].tokens[1].address).to.eq(USDC);
                expect(virtualPools[0].tokens[2].address).to.eq(USDT);
            });

            it(`should find bpt token pool correctly`, () => {
                const virtualPool = new VirtualBoostedPool();
                const tokenPool = virtualPool.getTokenPool(
                    '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
                    bbausd
                );
                expect(tokenPool.address).to.eq(bbausd);
                expect(tokenPool.type).to.eq('StablePhantom');
            });

            it(`should find main token pool correctly`, () => {
                const virtualPool = new VirtualBoostedPool();
                const tokenPool = virtualPool.getTokenPool(
                    '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
                    USDT
                );
                expect(tokenPool.address).to.eq(
                    '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c'
                );
                expect(tokenPool.type).to.eq('Linear');
            });

            it(`should throw when token not in pool`, () => {
                const virtualPool = new VirtualBoostedPool();
                expect(() =>
                    virtualPool.getTokenPool(
                        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
                        WETH
                    )
                ).to.throw();
            });
        });
        context('onchain', () => {
            it(`should decode multicall data correctly`, () => {
                const returnData = [
                    '0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000d8d59b00000000000000000000000000000000000000000000000000000000000000040000000000000000000000002bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c0000000000000000000000007b50775383d3d6f0215a8f290f2c9e2eebbeceb2000000000000000000000000804cdb9116a10bb78768d3252355a1b18067bf8f0000000000000000000000009210f1204b5a24742eba12f710636d76240df3d0000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000026d8ee3225850918fdb4f7000000000000000000000000000000000000ffffff6cb78b31ac0704ee6d6b0c0000000000000000000000000000000000000000002fa5a560388f7d728f260a0000000000000000000000000000000000000000003d125d020e8db176a67bfd',
                    '0x000000000000000000000000000000000000000000000000000009184e72a000',
                    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000dee6e361ddbef370000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000decd225e48f12ea0000000000000000000000000000000000000000000000000ded8b14b3941e64',
                    '0x0000000000000000000000000000000000000000000000000000000000167600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e8',
                    '0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000d8d59b000000000000000000000000000000000000000000000000000000000000000300000000000000000000000002d60b84491589974263d922d9cc7a3152618ef60000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000804cdb9116a10bb78768d3252355a1b18067bf8f00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000002a331444ee521ea750b6e400000000000000000000000000000000000000000002d0d335b2a30c37800000000000000000000000000000000000000000ffffffd05a5a9fc770828d70d9f5',
                    '0x0000000000000000000000000000000000000000000000000000b5e620f48000',
                    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000ecbf681ce9d6fed0000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a7640000',
                    '0x0000000000000000000000000000000000000000000000000000000000000001',
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                    '0x0000000000000000000000000000000000000000000000000000000000000002',
                    '0x00000000000000000000000000000000000000000002661950a4857dec80000000000000000000000000000000000000000000000002907356344813d9800000',
                    '0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000d8ca5e00000000000000000000000000000000000000000000000000000000000000030000000000000000000000009210f1204b5a24742eba12f710636d76240df3d0000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000d093fa4fb80d09bb30817fdcd442d4d02ed3e5de0000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000ffffffc2eda2fdf1724e89598402000000000000000000000000000000000000000000000000000002b381cb840000000000000000000000000000000000000000000000000000003c7c1b55d749',
                    '0x0000000000000000000000000000000000000000000000000000b5e620f48000',
                    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000c9f2c9cd04674edea40000000000000000000000000000000000000000000000d7fd8dbba90bb2bc6153f8000',
                    '0x0000000000000000000000000000000000000000000000000000000000000001',
                    '0x0000000000000000000000000000000000000000000000000000000000000002',
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                    '0x00000000000000000000000000000000000000000002661950a4857dec80000000000000000000000000000000000000000000000002907356344813d9800000',
                    '0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000d8bece00000000000000000000000000000000000000000000000000000000000000030000000000000000000000002bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000f8fd466f12e236f4c96f7cce6c79eadb819abf580000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000ffffffd927118a8f676e43083dfe000000000000000000000000000000000000000000000000000002c8a82aad3600000000000000000000000000000000000000000000000000002520dc7e4f12',
                    '0x0000000000000000000000000000000000000000000000000000b5e620f48000',
                    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000c9f2c9cd04674edea40000000000000000000000000000000000000000000000da14af8a0bb91ee810e0b5000',
                    '0x0000000000000000000000000000000000000000000000000000000000000001',
                    '0x0000000000000000000000000000000000000000000000000000000000000002',
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
                    '0x00000000000000000000000000000000000000000002661950a4857dec80000000000000000000000000000000000000000000000002907356344813d9800000',
                    '0x000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000d8b84100000000000000000000000000000000000000000000000000000000000000020000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000ced6cdbaf57cd019bff000000000000000000000000000000000000000000000d6af42b3f524bfd5043',
                    '0x00000000000000000000000000000000000000000000000000016bcc41e90000',
                    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000eb84c805f75347f0000000000000000000000000000000000000000000000000de0b6b3a7640000',
                    '0x000000000000000000000000000000000000000000000000000000000000c350000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e8',
                ];

                const poolInterfaces = {
                    Stable: new Interface(StablePoolABI),
                    Weighted: new Interface(WeightedPoolABI),
                    MetaStable: new Interface(MetaStablePoolABI),
                    Linear: new Interface(LinearPoolABI),
                };

                const vaultInterface = new Interface(VaultABI);

                const virtualPool = new VirtualBoostedPool();
                const virtualPools = virtualPool.getVirtualBoostedPools(
                    cloneDeep(mockVirtualPools)
                );
                const [decoded, newIndex] = virtualPool.decodeOnChainCalls(
                    virtualPools[0],
                    poolInterfaces,
                    vaultInterface,
                    {
                        returnData,
                    },
                    0
                );

                expect(newIndex).to.eq(25);
                expect(
                    decoded[
                        '0x9210f1204b5a24742eba12f710636d76240df3d0'
                    ].lowerTarget?.toString()
                ).to.eq(parseFixed('2900000', 18).toString());
                expect(Object.keys(decoded).length).to.eq(4);
                expect(
                    decoded['0x9210f1204b5a24742eba12f710636d76240df3d0']
                        .tokens[USDC]
                ).to.not.be.undefined;
            });
        });

        context('pricing', () => {
            it(`_calcOutGivenIn, Main>Main`, () => {
                const amountsIn = [
                    parseFixed('1', 6).toBigInt(),
                    parseFixed('777', 6).toBigInt(),
                ];
                const virtualPool = new VirtualBoostedPool();
                const virtualPools = virtualPool.getVirtualBoostedPools(
                    cloneDeep(mockVirtualPools)
                );
                const prices = virtualPool._calcOutGivenIn(
                    USDC,
                    DAI,
                    '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
                    poolState,
                    amountsIn
                );

                console.log(prices);
            });
            it(`_calcOutGivenIn, Main>Bpt`, () => {
                const amountsIn = [
                    parseFixed('1', 18).toBigInt(),
                    parseFixed('777', 18).toBigInt(),
                ];
                const virtualPool = new VirtualBoostedPool();
                const virtualPools = virtualPool.getVirtualBoostedPools(
                    cloneDeep(mockVirtualPools)
                );
                const prices = virtualPool._calcOutGivenIn(
                    USDC,
                    bbausd,
                    '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
                    poolState,
                    amountsIn
                );
            });
            it(`_calcOutGivenIn, Bpt>Main`, () => {
                const amountsIn = [
                    parseFixed('1', 18).toBigInt(),
                    parseFixed('777', 18).toBigInt(),
                ];
                const virtualPool = new VirtualBoostedPool();
                const virtualPools = virtualPool.getVirtualBoostedPools(
                    cloneDeep(mockVirtualPools)
                );
                const prices = virtualPool._calcOutGivenIn(
                    bbausd,
                    DAI,
                    '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
                    poolState,
                    amountsIn
                );
            });
        });
    });
});

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

function compareParaswapSdk(
    pool: SubgraphPoolBase,
    tokenIn: string,
    tokenOut: string,
    amounts: bigint[],
    sdkPoolClass,
    sdkFunction,
    paraswapClass
) {
    const sdkPairData = sdkPoolClass.parsePoolPairDataBigInt(
        cloneDeep(pool),
        tokenIn,
        tokenOut
    );
    const sdkAmtsOut = sdkFunction(sdkPairData, amounts);

    const evmPool = poolToEvm(cloneDeep(pool));
    const psAmtsOut = paraswapClass.onSell();
    // expect(parseFixed(sorAmtOut.toString(), tokenOutDecimals).toString()).to.eq(
    //     sdkAmtOut[1].toString()
    // );
}
