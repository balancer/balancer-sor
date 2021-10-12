// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/linear.spec.ts
import { assert, expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, bnum } from '../src/utils/bignumber';
import {
    PoolDictionary,
    NewPath,
    SwapTypes,
    PoolTypes,
    SubgraphPoolBase,
} from '../src/types';
import {
    filterPoolsOfInterest,
    filterHopPools,
    getPathsUsingLinearPools,
    parseToPoolsDict,
} from '../src/routeProposal/filtering';
import { calculatePathLimits } from '../src/routeProposal/pathLimits';
import { LinearPool, PairTypes } from '../src/pools/linearPool/linearPool';
import { checkPath, getFullSwap, getTotalSwapAmount } from './lib/testHelpers';
import {
    DAI,
    aDAI,
    bDAI,
    USDC,
    bUSDC,
    BAL,
    staBAL3,
    TestToken,
    MKR,
    GUSD,
} from './lib/constants';

// Single Linear pool DAI/aDAI/bDAI
import singleLinear from './testData/linearPools/singleLinear.json';
// weightedWeth/StaBal3Id, weightedBal/Weth, weightedUsdc/Weth, weightedDai/Weth, weightedDai/Usdc, linearUSDC, linearDAI, linearUSDT, staBal3Id, staBal3/Gusd, weightedMkr/Dai
import smallLinear from './testData/linearPools/smallLinear.json';

const chainId = 99;

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

        it(`getLimitAmountSwap, SwapExactIn, TokenToBpt should return valid limit`, async () => {
            const tokenIn = DAI.address;
            const tokenInDecimals = DAI.decimals;
            const tokenOut = bDAI.address;
            const swapType = SwapTypes.SwapExactIn;
            const pools = singleLinear.pools;
            const poolIndex = 0;

            const MAX_RATIO = bnum(10);

            const expectedAmt = bnum(pools[poolIndex].tokens[0].balance)
                .times(MAX_RATIO)
                .dp(tokenInDecimals);

            testLimit(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                poolIndex,
                expectedAmt
            );
        });

        it(`getLimitAmountSwap, SwapExactIn, BptToToken should return valid limit`, async () => {
            testLimit(
                bDAI.address,
                DAI.address,
                SwapTypes.SwapExactIn,
                singleLinear.pools,
                0,
                bnum('937.94411054836482804')
            );
        });

        it(`getLimitAmountSwap, SwapExactOut, TokenToBpt should return valid limit`, async () => {
            const tokenIn = DAI.address;
            const tokenOut = bDAI.address;
            const tokenOutDecimals = bDAI.decimals;
            const swapType = SwapTypes.SwapExactOut;
            const pools = singleLinear.pools;
            const poolIndex = 0;

            const MAX_RATIO = bnum(10);

            const expectedAmt = bnum(pools[poolIndex].tokens[2].balance)
                .times(MAX_RATIO)
                .dp(tokenOutDecimals);

            testLimit(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                poolIndex,
                expectedAmt
            );
        });

        it(`getLimitAmountSwap, SwapExactOut, BptToToken should return valid limit`, async () => {
            testLimit(
                bDAI.address,
                DAI.address,
                SwapTypes.SwapExactOut,
                singleLinear.pools,
                0,
                bnum('1485000000.122222221232222221')
            );
        });
    });

    context('Considering Linear Paths Only', () => {
        context('Using Single Linear Pool', () => {
            it('getPathsUsingLinearPool return empty paths', () => {
                const tokenIn = DAI.address;
                const tokenOut = USDC.address;
                const maxPools = 4;

                const [, , pathsUsingLinear] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    singleLinear.pools,
                    maxPools
                );
                expect(pathsUsingLinear).to.be.empty;
            });

            it('getPathsUsingLinearPool return empty paths', () => {
                const tokenIn = DAI.address;
                const tokenOut = USDC.address;
                const maxPools = 4;

                const [, , pathsUsingLinear] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    singleLinear.pools,
                    maxPools
                );

                expect(pathsUsingLinear).to.be.empty;
            });
        });

        context('Stable<>Token with no staBal or WETH paired pool', () => {
            it('Stable>Token, getPathsUsingLinearPool return empty paths', async () => {
                const tokenIn = MKR.address;
                const tokenOut = DAI.address;
                const maxPools = 10;

                const [, , pathsUsingLinear] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(pathsUsingLinear.length, 0);
            });

            it('Token>Stable, getPathsUsingLinearPool return empty paths', async () => {
                const tokenIn = USDC.address;
                const tokenOut = MKR.address;
                const maxPools = 10;

                const [, , pathsUsingLinear] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(pathsUsingLinear.length, 0);
            });
        });

        context('getPathsUsingLinearPools - stable pair', () => {
            it('should return 1 valid linear path', async () => {
                const tokenIn = DAI.address;
                const tokenOut = USDC.address;
                const maxPools = 10;

                const [, poolsAllDict, pathsUsingLinear] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
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

                const [paths, poolAllDict] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(paths.length, 3);
                checkPath(
                    ['linearDAI', 'staBal3Id', 'linearUSDC'],
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

        context('non-stable pair with no staBal or WETH paired pool', () => {
            it('should return 1 path via weighted pools', async () => {
                const tokenIn = MKR.address;
                const tokenOut = DAI.address;
                const maxPools = 10;

                const [paths, poolsAllDict] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(paths.length, 1);
                checkPath(
                    ['weightedMkrDai'],
                    poolsAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
            });
        });

        context('token paired with staBal3 BPT', () => {
            it('should return 1 valid linear paths', async () => {
                const tokenIn = GUSD.address;
                const tokenOut = DAI.address;
                const maxPools = 10;

                const [paths, poolsAllDict] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(paths.length, 1);
                // TokenIn>[weightedBalStaBal3]>bDAI>[staBAL3]>staBal3>[linearDAI]>DAI
                checkPath(
                    ['staBal3Gusd', 'staBal3Id', 'linearDAI'],
                    poolsAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
            });

            it('should return 1 valid linear paths', async () => {
                const tokenIn = USDC.address;
                const tokenOut = GUSD.address;
                const maxPools = 10;

                const [paths, poolsAllDict] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    smallLinear.pools,
                    maxPools
                );

                assert.equal(paths.length, 1);
                // TokenIn>[linearUSDC]>bUSDC>[staBAL3]>staBal3>[staBal3Gusd]>TokenOut
                checkPath(
                    ['linearUSDC', 'staBal3Id', 'staBal3Gusd'],
                    poolsAllDict,
                    paths[0],
                    tokenIn,
                    tokenOut
                );
            });
        });
    });

    context('Long paths using linear and WETH-staBAL3 pool', () => {
        it('should return 2 valid linear paths', async () => {
            const tokenIn = USDC.address;
            const tokenOut = BAL.address;
            const maxPools = 10;

            const [paths, poolsAllDict] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                smallLinear.pools,
                maxPools
            );
            assert.equal(paths.length, 2);
            // USDC>[linearUSDC]>bUSDC>[staBAL3]>staBal3Bpt>[staBAL3Weth]>WETH>[BalWeth]>BAL
            checkPath(
                [
                    'linearUSDC',
                    'staBal3Id',
                    'weightedWethStaBal3Id',
                    'weightedBalWeth',
                ],
                poolsAllDict,
                paths[0],
                tokenIn,
                tokenOut
            );

            checkPath(
                ['weightedUsdcWeth', 'weightedBalWeth'],
                poolsAllDict,
                paths[1],
                tokenIn,
                tokenOut
            );
        });
        it('should return 2 valid linear paths', async () => {
            const tokenIn = BAL.address;
            const tokenOut = USDC.address;
            const maxPools = 10;

            const [paths, poolsAllDict] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                smallLinear.pools,
                maxPools
            );
            assert.equal(paths.length, 2);

            // BAL>[BalWeth]>WETH>[staBAL3Weth]>staBal3Bpt>[staBAL3]>bUSDC>[linearUSDC]>USDC
            checkPath(
                [
                    'weightedBalWeth',
                    'weightedWethStaBal3Id',
                    'staBal3Id',
                    'linearUSDC',
                ],
                poolsAllDict,
                paths[0],
                tokenIn,
                tokenOut
            );
            checkPath(
                ['weightedBalWeth', 'weightedUsdcWeth'],
                poolsAllDict,
                paths[1],
                tokenIn,
                tokenOut
            );
        });
    });

    context('SOR Full Swaps', () => {
        context('Stable Swaps', () => {
            it('DAI>USDC, SwapExactIn', async () => {
                const returnAmount = await testFullSwap(
                    DAI.address,
                    USDC.address,
                    SwapTypes.SwapExactIn,
                    parseFixed('25', DAI.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('25631282');
            });

            it('DAI>USDC, SwapExactOut', async () => {
                const returnAmount = await testFullSwap(
                    DAI.address,
                    USDC.address,
                    SwapTypes.SwapExactOut,
                    parseFixed('27', USDC.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('26335005495898592574');
            });

            it('USDC>DAI, SwapExactIn', async () => {
                const returnAmount = await testFullSwap(
                    USDC.address,
                    DAI.address,
                    SwapTypes.SwapExactIn,
                    parseFixed('270', USDC.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('263139420004032600258');
            });

            it('USDC>DAI, SwapExactOut', async () => {
                const returnAmount = await testFullSwap(
                    USDC.address,
                    DAI.address,
                    SwapTypes.SwapExactOut,
                    parseFixed('7777', DAI.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('7979762223'); // Confirmed by Sergio
            });
        });

        context('Stable <> Token paired with WETH', () => {
            it('USDC>BAL, SwapExactIn', async () => {
                const returnAmount = await testFullSwap(
                    USDC.address,
                    BAL.address,
                    SwapTypes.SwapExactIn,
                    parseFixed('7.21', USDC.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('652413919893769122');
            });

            it('BAL>DAI, SwapExactIn', async () => {
                const returnAmount = await testFullSwap(
                    BAL.address,
                    DAI.address,
                    SwapTypes.SwapExactIn,
                    parseFixed('321.123', BAL.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('3320451170714139189569');
            });

            it('USDC>BAL, SwapExactOut', async () => {
                const returnAmount = await testFullSwap(
                    USDC.address,
                    BAL.address,
                    SwapTypes.SwapExactOut,
                    parseFixed('0.652413919893769122', BAL.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('7210002');
            });

            it('BAL>DAI, SwapExactOut', async () => {
                const returnAmount = await testFullSwap(
                    BAL.address,
                    DAI.address,
                    SwapTypes.SwapExactOut,
                    parseFixed('3320.451170714139189569', DAI.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('321122999999986750182');
            });
        });

        context('Relayer Routes', () => {
            it('DAI>staBAL3, SwapExactIn', async () => {
                const returnAmount = await testFullSwap(
                    DAI.address,
                    staBAL3.address,
                    SwapTypes.SwapExactIn,
                    parseFixed('1', DAI.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('946927175843694145');
            });

            it('USDC>staBAL3, SwapExactOut', async () => {
                const returnAmount = await testFullSwap(
                    USDC.address,
                    staBAL3.address,
                    SwapTypes.SwapExactOut,
                    parseFixed('1', staBAL3.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('1083149');
            });

            it('staBAL3>USDC, SwapExactIn', async () => {
                const returnAmount = await testFullSwap(
                    staBAL3.address,
                    USDC.address,
                    SwapTypes.SwapExactIn,
                    parseFixed('1', staBAL3.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('1082280');
            });

            it('staBAL3>DAI, SwapExactOut', async () => {
                const returnAmount = await testFullSwap(
                    staBAL3.address,
                    DAI.address,
                    SwapTypes.SwapExactOut,
                    parseFixed('1', DAI.decimals),
                    smallLinear.pools
                );
                expect(returnAmount).to.eq('947685172351949208');
            });
        });
    });
});

function getPaths(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools: SubgraphPoolBase[],
    maxPools: number
): [NewPath[], PoolDictionary, NewPath[]] {
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
    return [paths, poolsAll, pathsUsingLinear];
}

async function testFullSwap(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    swapAmount: BigNumber,
    pools: SubgraphPoolBase[]
) {
    const returnAmountDecimals = 18; // TO DO Remove?
    const maxPools = 4;
    // const costOutputToken = BigNumber.from('1000000000000000000');
    const costOutputToken = BigNumber.from('0');
    const gasPrice = BigNumber.from(`10000000000`);
    const provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );
    const swapGas = BigNumber.from(`32500`);

    const swapInfo = await getFullSwap(
        cloneDeep(pools),
        tokenIn,
        tokenOut,
        returnAmountDecimals,
        maxPools,
        swapType,
        swapAmount,
        costOutputToken,
        gasPrice,
        provider,
        swapGas,
        chainId
    );

    const totalSwapAmount = getTotalSwapAmount(swapType, swapInfo);
    assert.equal(
        swapAmount.toString(),
        totalSwapAmount.toString(),
        'Total From SwapInfo Should Equal Swap Amount.'
    );
    console.log(swapInfo.swaps);
    console.log(swapInfo.tokenAddresses);
    console.log(`Return: ${swapInfo.returnAmount.toString()}`);
    console.log(
        `ReturnFees: ${swapInfo.returnAmountConsideringFees.toString()}`
    );
    return swapInfo.returnAmount.toString();
}

function testLimit(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools: SubgraphPoolBase[],
    poolIndex: number,
    expectedAmt: OldBigNumber
) {
    const pool = LinearPool.fromPool(cloneDeep(pools)[poolIndex]);
    const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);
    const limitAmt = pool.getLimitAmountSwap(poolPairData, swapType);
    expect(limitAmt.toString()).to.eq(expectedAmt.toString());
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
