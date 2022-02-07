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
} from './testData/mockPools';
import { poolToEvm } from './PARASWAP/utils';
import { WeightedPool } from '../src/pools/weightedPool/weightedPool';
import { StablePool } from '../src/pools/stablePool/stablePool';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';
import { PhantomStablePool } from '../src/pools/phantomStablePool/phantomStablePool';
import { LinearPool } from '../src/pools/linearPool/linearPool';
import { WeightedPool as WeightedPoolSdk } from './SDK/WeightedPool';
import { WeightedPool as WeightedPoolPs } from './PARASWAP/WeightedPool';
import { StablePool as StablePoolSdk } from './SDK/StablePool';
import { StablePool as StablePoolPs } from './PARASWAP/StablePool';
import { MetaStablePool as MetaStablePoolSdk } from './SDK/MetaStablePool';
import { MetaStablePool as MetaStablePoolPs } from './PARASWAP/MetaStablePool';
import { PhantomStablePool as PhantomStableSdk } from './SDK/PhantomStablePool';
import { PhantomStablePool as PhantomStablePoolPs } from './PARASWAP/PhantomStablePool';
import { LinearPool as LinearSdk } from './SDK/LinearPool';
import { SubgraphPoolBase } from '../src';
import {
    WeightedPoolHelper,
    StablePoolHelper,
    MetaStablePoolHelper,
    PhantomStablePoolHelper,
} from './PARASWAP/utils';
import { BZERO } from '../src/utils/basicOperations';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const wstETH = '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const bbausdt = '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c';
const bbadai = '0x804cdb9116a10bb78768d3252355a1b18067bf8f';
const bbausd = '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2';

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
