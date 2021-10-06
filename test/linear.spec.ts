// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/linear.spec.ts
import { assert, expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    PoolDictionary,
    NewPath,
    SwapTypes,
    PoolDictionaryByMain,
    PoolPairBase,
    PoolTypes,
    SubgraphPoolBase,
} from '../src/types';
import {
    LinearPool,
    LinearPoolPairData,
    PairTypes,
} from '../src/pools/linearPool/linearPool';
import {
    filterPoolsOfInterest,
    filterHopPools,
    getPathsUsingLinearPools,
    parseToPoolsDict,
} from '../src/routeProposal/filtering';
import { calculatePathLimits } from '../src/routeProposal/pathLimits';
import OldBigNumber from 'bignumber.js';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { formatSwaps } from '../src/formatSwaps';

import subgraphPoolsLargeLinear from './testData/linearPools/subgraphPoolsLargeLinear.json';
import smallLinear from './testData/linearPools/smallLinear.json';
import singleLinear from './testData/linearPools/singleLinear.json';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';
import { bnum } from '../src/index';
import { getBestPaths } from '../src/router';
import path from 'path';

export interface TestToken {
    symbol: string;
    address: string;
    decimals: number;
}

const WETH = {
    symbol: 'WETH',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    decimals: 18,
};
const DAI = {
    symbol: 'DAI',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    decimals: 18,
};
const aDAI = {
    symbol: 'aDAI',
    address: '0xfc1e690f61efd961294b3e1ce3313fbd8aa4f85d',
    decimals: 18,
};
const USDC = {
    symbol: 'USDC',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
};
const bUSDC = {
    symbol: 'bUSDC',
    address: '0x0000000000000000000000000000000000000001',
    decimals: 18,
};
const USDT = {
    symbol: 'USDT',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    decimals: 6,
}; // USDT precision = 6
const BAL = {
    symbol: 'BAL',
    address: '0xba100000625a3754423978a60c9317c58a424e3d',
    decimals: 18,
};

const bDAI = {
    symbol: 'bDAI',
    address: '0x0000000000000000000000000000000000000002',
    decimals: 18,
};

const chainId = 1;

describe('linear pool tests', () => {
    context('parsePoolPairData', () => {
        it(`should correctly parse token > phantomBpt`, async () => {
            const tokenIn = DAI;
            const tokenOut = bDAI;
            const poolSG = cloneDeep(singleLinear).pools[0];
            testParsePool(poolSG, tokenIn, tokenOut, PairTypes.TokenToBpt);
        });

        it(`should correctly parse phantomBpt > token`, async () => {
            const tokenIn = bUSDC;
            const tokenOut = USDC;
            const poolSG = cloneDeep(smallLinear).pools[4];
            testParsePool(poolSG, tokenIn, tokenOut, PairTypes.BptToToken);
        });

        it(`should correctly parse token > token`, async () => {
            const tokenIn = DAI;
            const tokenOut = aDAI;
            const poolSG = cloneDeep(singleLinear).pools[0];
            testParsePool(poolSG, tokenIn, tokenOut, PairTypes.TokenToToken);
        });
    });

    context('limit amounts', () => {
        it(`getLimitAmountSwap, SwapExactIn, TokenToBpt should return valid limit`, async () => {
            const tokenIn = DAI.address;
            const tokenInDecimals = DAI.decimals;
            const tokenOut = bDAI.address;
            const poolSG = cloneDeep(singleLinear);
            const swapType = SwapTypes.SwapExactIn;
            const MAX_RATIO = bnum(10);

            const pool = LinearPool.fromPool(poolSG.pools[0]);

            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            const limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[0].balance)
                    .times(MAX_RATIO)
                    .dp(tokenInDecimals)
                    .toString()
            );
        });

        it(`getLimitAmountSwap, SwapExactIn, BptToToken should return valid limit`, async () => {
            const tokenIn = bDAI.address;
            const tokenOut = DAI.address;
            const poolSG = cloneDeep(singleLinear);
            const swapType = SwapTypes.SwapExactIn;

            const pool = LinearPool.fromPool(poolSG.pools[0]);

            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            const limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq('956.89246046982109274'); // TO DO - Confirm with Sergio this limit looks ok
        });

        it(`getLimitAmountSwap, SwapExactOut, TokenToBpt should return valid limit`, async () => {
            const tokenIn = DAI.address;
            const tokenOut = bDAI.address;
            const tokenOutDecimals = bDAI.decimals;
            const poolSG = cloneDeep(singleLinear);
            const swapType = SwapTypes.SwapExactOut;
            const MAX_RATIO = bnum(10);

            const pool = LinearPool.fromPool(poolSG.pools[0]);

            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            const limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[2].balance)
                    .times(MAX_RATIO)
                    .dp(tokenOutDecimals)
                    .toString()
            );
        });

        it(`getLimitAmountSwap, SwapExactOut, BptToToken should return valid limit`, async () => {
            const tokenIn = bDAI.address;
            const tokenOut = DAI.address;
            const poolSG = cloneDeep(singleLinear);
            const swapType = SwapTypes.SwapExactOut;

            const pool = LinearPool.fromPool(poolSG.pools[0]);

            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            const limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq('1485000000.122222221232222221'); // TO DO - Confirm with Sergio this limit looks ok
        });

        it(`getLimitAmountSwap, token to token should throw error`, async () => {
            const tokenIn = DAI.address;
            const tokenOut = aDAI.address;
            const poolSG = cloneDeep(singleLinear);
            const pool = LinearPool.fromPool(poolSG.pools[0]);
            const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

            expect(() =>
                pool.getLimitAmountSwap(poolPairData, SwapTypes.SwapExactIn)
            ).to.throw('LinearPool does not support TokenToToken');

            expect(() =>
                pool.getLimitAmountSwap(poolPairData, SwapTypes.SwapExactOut)
            ).to.throw('LinearPool does not support TokenToToken');
        });
    });
    context('with no LinearPools', () => {
        it('getPathsUsingLinearPool return empty paths', () => {
            const tokenIn = DAI.address;
            const tokenOut = USDC.address;
            const maxPools = 4;

            const [pathsUsingLinear] = getLinearPaths(
                tokenIn,
                tokenOut,
                singleLinear.pools,
                maxPools
            );
            expect(pathsUsingLinear).to.be.empty;
        });
    });

    context('stable pair with no joining MetaStablePool', () => {
        it('getPathsUsingLinearPool return empty paths', () => {
            const tokenIn = DAI.address;
            const tokenOut = USDC.address;
            const maxPools = 4;

            const [pathsUsingLinear] = getLinearPaths(
                tokenIn,
                tokenOut,
                singleLinear.pools,
                maxPools
            );

            expect(pathsUsingLinear).to.be.empty;
        });
    });

    context('non-stable pair with no staBal paired pool', () => {
        it('getPathsUsingLinearPool return empty paths', async () => {
            const tokenIn = WETH.address;
            const tokenOut = DAI.address;
            const maxPools = 10;

            const [pathsUsingLinear] = getLinearPaths(
                tokenIn,
                tokenOut,
                smallLinear.pools,
                maxPools
            );

            assert.equal(pathsUsingLinear.length, 0);
        });
    });

    context('Considering Linear Paths Only', () => {
        context('getPathsUsingLinearPools - stable pair', () => {
            it('should return 1 valid linear path', async () => {
                const tokenIn = DAI.address;
                const tokenOut = USDC.address;
                const maxPools = 10;

                const [pathsUsingLinear, poolsAllDict] = getLinearPaths(
                    tokenIn,
                    tokenOut,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(pathsUsingLinear.length, 1);
                checkPath(
                    ['linearDAI', 'staBal3Id', 'linearUSDC'],
                    poolsAllDict,
                    pathsUsingLinear[0],
                    tokenIn,
                    tokenOut
                );
            });
        });
    });

    context('Considering All Paths', () => {
        context('stable pair with weighted and linear pools', () => {
            it('should return 3 paths via weighted and linear pools', async () => {
                const tokenIn = DAI.address;
                const tokenOut = USDC.address;
                const maxPools = 10;

                const [paths, poolAllDict] = getFullPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(paths.length, 3);
                checkPath(
                    ['weightedDaiWeth', 'weightedUsdcWeth'],
                    poolAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
                checkPath(
                    ['weightedDaiUsdc'],
                    poolAllDict,
                    paths[1],
                    tokenIn,
                    tokenOut
                );
                checkPath(
                    ['linearDAI', 'staBal3Id', 'linearUSDC'],
                    poolAllDict,
                    paths[2],
                    tokenIn,
                    tokenOut
                );
            });
        });

        context('non-stable pair with no staBal paired pool', () => {
            it('should return 2 paths via weighted pools', async () => {
                const tokenIn = WETH.address;
                const tokenOut = DAI.address;
                const maxPools = 10;

                const [paths, poolsAllDict] = getFullPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(paths.length, 2);
                checkPath(
                    ['weightedUsdcWeth', 'weightedDaiUsdc'],
                    poolsAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
                checkPath(
                    ['weightedDaiWeth'],
                    poolsAllDict,
                    paths[1],
                    tokenIn,
                    tokenOut
                );
            });
        });

        context('token paired with staBal3 BPT', () => {
            it('should return 2 valid linear paths', async () => {
                const tokenIn = BAL.address;
                const tokenOut = DAI.address;
                const maxPools = 10;

                const [paths, poolsAllDict] = getFullPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(paths.length, 1);

                checkPath(
                    ['weightedBalStaBal3', 'staBal3Id', 'linearDAI'],
                    poolsAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
            });

            it('should return 1 valid linear paths', async () => {
                const tokenIn = USDC.address;
                const tokenOut = BAL.address;
                const maxPools = 10;

                const [paths, poolsAllDict] = getFullPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(paths.length, 1);
                // TokenIn>[linearUSDC]>bUSDC>[staBAL3]>staBal3>[weightedBalStaBal3]>TokenOut
                checkPath(
                    ['linearUSDC', 'staBal3Id', 'weightedBalStaBal3'],
                    poolsAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
            });
        });
    });

    context('TO DO - ADD SOME TESTS FOR THESE FULL CASES??', () => {
        it('basic swap cases', async () => {
            runSOR(
                DAI,
                USDC,
                SwapTypes.SwapExactIn,
                parseFixed('25', 18),
                smallLinear
            );
            // runSOR(
            //     DAI,
            //     USDC,
            //     SwapTypes.SwapExactIn,
            //     parseFixed('2500', 18),
            //     subgraphPoolsLargeLinear
            // );
            // console.log('second: ');
            // runSOR(
            //     DAI,
            //     USDC,
            //     SwapTypes.SwapExactIn,
            //     parseFixed('2500', 18),
            //     singleLinear
            // );
            // console.log('third: ');
            // runSOR(
            //     WETH,
            //     USDC,
            //     SwapTypes.SwapExactIn,
            //     parseFixed('10', 18),
            //     smallLinear
            // );
            // console.log('fourth: ');
            // runSOR(
            //     WETH,
            //     USDC,
            //     SwapTypes.SwapExactOut,
            //     parseFixed('10', 6),
            //     smallLinear
            // );
        });

        it('basic swap cases', async () => {
            runSOR(
                DAI,
                USDC,
                SwapTypes.SwapExactOut,
                parseFixed('27', 6),
                smallLinear
            );
        });

        it('basic swap cases', async () => {
            runSOR(
                USDC,
                DAI,
                SwapTypes.SwapExactIn,
                parseFixed('270', 6),
                smallLinear
            );
        });

        it('basic swap cases', async () => {
            runSOR(
                USDC,
                DAI,
                SwapTypes.SwapExactOut,
                parseFixed('7777', 18),
                smallLinear
            );
        });
    });
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
        expect(path.swaps[i].tokenInDecimals).eq(poolPairData.decimalsIn);
        expect(path.swaps[i].tokenOutDecimals).eq(poolPairData.decimalsOut);
        lastTokenOut = tokenOut;
    }

    // TokenIn/Out should be first and last of path
    expect(path.swaps[0].tokenIn).to.eq(tokenIn);
    expect(path.swaps[path.swaps.length - 1].tokenOut).to.eq(tokenOut);
}

// Gets Linear paths only.
function getLinearPaths(
    tokenIn: string,
    tokenOut: string,
    pools,
    maxPools
): [NewPath[], PoolDictionary] {
    const poolsAll = parseToPoolsDict(cloneDeep(pools), 0);

    const [poolsFilteredDict] = filterPoolsOfInterest(
        poolsAll,
        tokenIn,
        tokenOut,
        maxPools
    );

    const pathsUsingLinear = getPathsUsingLinearPools(
        tokenIn,
        tokenOut,
        poolsAll,
        poolsFilteredDict,
        chainId
    );

    return [pathsUsingLinear, poolsAll];
}

// Gets linear and non-linear paths
function getFullPaths(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools,
    maxPools
): [NewPath[], PoolDictionary] {
    const poolsAll = parseToPoolsDict(cloneDeep(pools), 0);

    const [poolsFilteredDict, hopTokens] = filterPoolsOfInterest(
        poolsAll,
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
        poolsAll,
        poolsFilteredDict,
        chainId
    );
    pathData = pathData.concat(pathsUsingLinear);
    const [paths] = calculatePathLimits(pathData, swapType);
    return [paths, poolsAll];
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
    const [paths] = getFullPaths(
        tokenIn,
        tokenOut,
        swapType,
        jsonPools.pools,
        maxPools
    );

    const [inputDecimals, outputDecimals] =
        swapType === SwapTypes.SwapExactIn
            ? [tokIn.decimals, tokOut.decimals]
            : [tokOut.decimals, tokIn.decimals];

    const [swaps, total, marketSp, totalConsideringFees] = getBestPaths(
        paths,
        swapType,
        swapAmount,
        inputDecimals,
        outputDecimals,
        maxPools,
        parseFixed('0.01', outputDecimals)
    );

    const swapInfo = formatSwaps(
        swaps,
        swapType,
        swapAmount,
        tokenIn,
        tokenOut,
        parseFixed(
            total.dp(outputDecimals, OldBigNumber.ROUND_FLOOR).toString(),
            outputDecimals
        ),
        parseFixed(
            totalConsideringFees
                .dp(outputDecimals, OldBigNumber.ROUND_FLOOR)
                .toString(),
            outputDecimals
        ),
        marketSp
    );
    // console.log('swaps: ', swaps);
    console.log(`Swap Amt: ${swapAmount.toString()}`);
    console.log(`Total: ${total.toString()}`);
    console.log(`Total Considering Fees: ${totalConsideringFees.toString()}`);
    console.log(`SwapInfo Return: ${swapInfo.returnAmount.toString()}`);
    console.log(
        `SwapInfo Return Considering Fees: ${swapInfo.returnAmountConsideringFees.toString()}`
    );
}

function testParsePool(
    poolSG: SubgraphPoolBase,
    tokenIn: TestToken,
    tokenOut: TestToken,
    pairType: PairTypes
) {
    const tokenIndexIn = poolSG.tokens.findIndex(
        (t) => t.address === tokenIn.address
    );
    const tokenIndexOut = poolSG.tokens.findIndex(
        (t) => t.address === tokenOut.address
    );

    const pool = LinearPool.fromPool(poolSG);

    const poolPairData = pool.parsePoolPairData(
        tokenIn.address,
        tokenOut.address
    );
    if (!poolSG.wrappedIndex || !poolSG.target1 || !poolSG.target2) return;
    expect(poolPairData.id).to.eq(poolSG.id);
    expect(poolPairData.address).to.eq(poolSG.address);
    expect(poolPairData.tokenIn).to.eq(tokenIn.address);
    expect(poolPairData.tokenOut).to.eq(tokenOut.address);
    expect(poolPairData.decimalsIn).to.eq(tokenIn.decimals);
    expect(poolPairData.decimalsOut).to.eq(tokenOut.decimals);
    expect(poolPairData.poolType).to.eq(PoolTypes.Linear);
    expect(poolPairData.swapFee.toString()).to.eq(
        parseFixed(poolSG.swapFee, 18).toString()
    );
    expect(poolPairData.balanceIn.toString()).to.eq(
        parseFixed(
            poolSG.tokens[tokenIndexIn].balance,
            poolSG.tokens[tokenIndexIn].decimals
        ).toString()
    );
    expect(poolPairData.balanceOut.toString()).to.eq(
        parseFixed(
            poolSG.tokens[tokenIndexOut].balance,
            poolSG.tokens[tokenIndexOut].decimals
        ).toString()
    );
    expect(poolPairData.pairType).to.eq(pairType);
    expect(poolPairData.wrappedDecimals).to.eq(
        poolSG.tokens[poolSG.wrappedIndex].decimals
    );
    expect(poolPairData.wrappedBalance.toString()).to.eq(
        parseFixed(
            poolSG.tokens[poolSG.wrappedIndex].balance,
            poolSG.tokens[poolSG.wrappedIndex].decimals
        ).toString()
    );
    expect(poolPairData.rate.toString()).to.eq(
        parseFixed(poolSG.tokens[poolSG.wrappedIndex].priceRate, 18).toString()
    );
    expect(poolPairData.target1.toString()).to.eq(
        parseFixed(
            poolSG.target1,
            poolSG.tokens[poolSG.wrappedIndex].decimals
        ).toString()
    );
    expect(poolPairData.target2.toString()).to.eq(
        parseFixed(
            poolSG.target2,
            poolSG.tokens[poolSG.wrappedIndex].decimals
        ).toString()
    );
}
