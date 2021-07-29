require('dotenv').config();
import { ALLOW_ADD_REMOVE } from '../src/config';
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import {
    SubGraphPoolsBase,
    SwapInfo,
    SwapTypes,
    PoolTypes,
    PairTypes,
} from '../src/types';
import { bnum, scale } from '../src/bmath';
import { BigNumber } from '../src/utils/bignumber';
import {
    MetaStablePool,
    MetaStablePoolPairData,
} from '../src/pools/metaStablePool/metaStablePool';

const gasPrice = bnum('30000000000');
const maxPools = 4;
const chainId = 1;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

const BAL = '0xba100000625a3754423978a60c9317c58a424e3d';
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const BPT = '0xebfed10e11dc08fcda1af1fda146945e8710f22e';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const stETH = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
const randomETH = '0x42d6622dece394b54999fbd73d108123806f6a18';

async function getStableComparrison(
    stablePools: SubGraphPoolsBase,
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    swapAmt: BigNumber
): Promise<SwapInfo> {
    const sorStable = new SOR(
        provider,
        gasPrice,
        maxPools,
        chainId,
        stablePools
    );
    await sorStable.fetchPools(false);

    let swapInfoStable: SwapInfo = await sorStable.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        swapAmt
    );

    return swapInfoStable;
}

// npx mocha -r ts-node/register test/metaStablePools.spec.ts
describe(`Tests for MetaStable Pools.`, () => {
    context('limit amounts', () => {
        it(`tests getLimitAmountSwap SwapExactIn`, async () => {
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pool = JSON.parse(
                JSON.stringify(poolsFromFile.metaStablePool[0])
            );
            const swapType = SwapTypes.SwapExactIn;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = new MetaStablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );

            const poolPairData: MetaStablePoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Stable,
                pairType: PairTypes.TokenToToken,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: bnum(pool.tokens[0].balance),
                balanceOut: bnum(pool.tokens[1].balance),
                swapFee: bnum(pool.swapFee),
                swapFeeScaled: scale(bnum(pool.swapFee), 18),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: bnum(pool.amp),
                allBalances: [
                    bnum(pool.tokens[0].balance),
                    bnum(pool.tokens[1].balance),
                ],
                allBalancesScaled: [
                    scale(bnum(pool.tokens[0].balance), 18),
                    scale(bnum(pool.tokens[1].balance), 18),
                ],
                invariant: bnum(0),
                tokenIndexIn: 0,
                tokenIndexOut: 1,
                tokenInExchangeRate: bnum(pool.tokens[0].exchangeRate),
                tokenOutExchangeRate: bnum(pool.tokens[1].exchangeRate),
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[0].balance)
                    .times(MAX_OUT_RATIO)
                    .toString()
            );
        });

        it(`tests getLimitAmountSwap SwapExactOut`, async () => {
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pool = JSON.parse(
                JSON.stringify(poolsFromFile.metaStablePool[0])
            );
            const swapType = SwapTypes.SwapExactOut;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = new MetaStablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );

            const poolPairData: MetaStablePoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Stable,
                pairType: PairTypes.TokenToToken,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: bnum(pool.tokens[0].balance),
                balanceOut: bnum(pool.tokens[1].balance),
                swapFee: bnum(pool.swapFee),
                swapFeeScaled: scale(bnum(pool.swapFee), 18),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: bnum(pool.amp),
                allBalances: [],
                allBalancesScaled: [],
                invariant: bnum(0),
                tokenIndexIn: 0,
                tokenIndexOut: 1,
                tokenInExchangeRate: bnum(pool.tokens[0].exchangeRate),
                tokenOutExchangeRate: bnum(pool.tokens[1].exchangeRate),
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[1].balance)
                    .div(bnum(pool.tokens[1].exchangeRate))
                    .times(MAX_OUT_RATIO)
                    .toString()
            );
        });
    });

    context('direct pool', () => {
        it(`Full Swap - swapExactIn No Route`, async () => {
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubGraphPoolsBase = {
                pools: JSON.parse(JSON.stringify(poolsFromFile.metaStablePool)),
            };
            const tokenIn = BAL;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt: BigNumber = bnum('1');

            const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            expect(swapInfo.returnAmount.toString()).eq('0');
            expect(swapInfo.swaps.length).eq(0);
        });

        it(`Full Swap - swapExactOut No Route`, async () => {
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubGraphPoolsBase = {
                pools: JSON.parse(JSON.stringify(poolsFromFile.metaStablePool)),
            };
            const tokenIn = BAL;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('1');

            const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            expect(swapInfo.returnAmount.toString()).eq('0');
            expect(swapInfo.swaps.length).eq(0);
        });

        it(`Full Swap - swapExactIn, Token ETH >Token Meta`, async () => {
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubGraphPoolsBase = {
                pools: JSON.parse(JSON.stringify(poolsFromFile.metaStablePool)),
            };
            const tokenIn = WETH;
            const tokenInExchangeRate = bnum(1);
            const tokenOut = stETH;
            const tokenOutExchangeRate = bnum(0.5);
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt: BigNumber = bnum('1'); // Would expect ~ 2 back

            const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            const stablePools: SubGraphPoolsBase = {
                pools: poolsFromFile.stablePool,
            };
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.times(tokenInExchangeRate)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            // Would expect stable to be half of amounts, i.e. 2stETH = 1ETH
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.times(tokenOutExchangeRate).toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees
                    .times(tokenOutExchangeRate)
                    .toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    bnum(swapInfo.swaps[i].amount)
                        .times(tokenInExchangeRate)
                        .toString()
                );
            });
        });

        it(`Full Swap - swapExactIn, Token Meta > Token ETH`, async () => {
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubGraphPoolsBase = {
                pools: JSON.parse(JSON.stringify(poolsFromFile.metaStablePool)),
            };
            const tokenIn = stETH;
            const tokenInExchangeRate = bnum(0.5);
            const tokenOut = WETH;
            const tokenOutExchangeRate = bnum(1);
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt: BigNumber = bnum('2'); // Would expect ~ 1 back

            const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            const stablePools: SubGraphPoolsBase = {
                pools: poolsFromFile.stablePool,
            };
            // Should be same as a 1/1 stable pool with swapAmt * exchangeRate, i.e swapAmt = 1 in this case
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.times(tokenInExchangeRate)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees.toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    bnum(swapInfo.swaps[i].amount)
                        .times(tokenInExchangeRate)
                        .toString()
                );
            });
        });

        it(`Full Swap - swapExactOut, Token ETH >Token Meta`, async () => {
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubGraphPoolsBase = {
                pools: JSON.parse(JSON.stringify(poolsFromFile.metaStablePool)),
            };
            const tokenIn = WETH;
            const tokenInExchangeRate = bnum(1);
            const tokenOut = stETH;
            const tokenOutExchangeRate = bnum(0.5);
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('2'); // Would expect ~ 1 as input

            const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            const stablePools: SubGraphPoolsBase = {
                pools: poolsFromFile.stablePool,
            };
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.times(tokenOutExchangeRate)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees.toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    bnum(swapInfo.swaps[i].amount)
                        .times(tokenOutExchangeRate)
                        .toString()
                );
            });
        });

        it(`Full Swap - swapExactOut, Token Meta > Token ETH`, async () => {
            const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
            const pools: SubGraphPoolsBase = {
                pools: JSON.parse(JSON.stringify(poolsFromFile.metaStablePool)),
            };
            const tokenIn = stETH;
            const tokenInExchangeRate = bnum(0.5);
            const tokenOut = WETH;
            const tokenOutExchangeRate = bnum(1);
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('2'); // Would expect ~ 4 as input

            const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            const stablePools: SubGraphPoolsBase = {
                pools: poolsFromFile.stablePool,
            };
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.times(tokenOutExchangeRate)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.times(tokenInExchangeRate).toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees
                    .times(tokenInExchangeRate)
                    .toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    bnum(swapInfo.swaps[i].amount)
                        .times(tokenOutExchangeRate)
                        .toString()
                );
            });
        });
    });

    context('multihop', () => {
        it(`Full Swap - swapExactIn, Token>Token`, async () => {
            // With meta token as hop the result in/out should be same as a normal stable pool
            const poolsFromFile = require('./testData/metaStablePools/multihop.json');
            const pools: SubGraphPoolsBase = {
                pools: JSON.parse(
                    JSON.stringify(poolsFromFile.metaStablePools)
                ),
            };
            const tokenIn = WETH;
            const tokenInExchangeRate = bnum(1);
            const tokenHop = stETH;
            const tokenHopExchangeRate = bnum(0.25);
            const tokenOut = randomETH;
            const tokenOutExchangeRate = bnum(1);
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt: BigNumber = bnum('77.723');

            const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            const stablePools: SubGraphPoolsBase = {
                pools: poolsFromFile.stablePools,
            };
            // Same as stable with
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.times(tokenInExchangeRate)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            // These should match as should
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees
                    .times(tokenOutExchangeRate)
                    .toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    bnum(swapInfo.swaps[i].amount)
                        .times(tokenInExchangeRate)
                        .toString()
                );
            });
        });

        it(`Full Swap - swapExactOut, Token>Token`, async () => {
            // With meta token as hop the result in/out should be same as a normal stable pool
            const poolsFromFile = require('./testData/metaStablePools/multihop.json');
            const pools: SubGraphPoolsBase = {
                pools: JSON.parse(
                    JSON.stringify(poolsFromFile.metaStablePools)
                ),
            };
            const tokenIn = WETH;
            const tokenInExchangeRate = bnum(1);
            const tokenHop = stETH;
            const tokenHopExchangeRate = bnum(0.25);
            const tokenOut = randomETH;
            const tokenOutExchangeRate = bnum(1);
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('77.8');

            const sor = new SOR(provider, gasPrice, maxPools, chainId, pools);

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            const stablePools: SubGraphPoolsBase = {
                pools: poolsFromFile.stablePools,
            };
            // Same as stable with
            const swapInfoStable = await getStableComparrison(
                stablePools,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt.times(tokenInExchangeRate)
            );

            expect(swapInfoStable.tokenAddresses).to.deep.eq(
                swapInfo.tokenAddresses
            );
            expect(swapInfoStable.tokenIn).to.deep.eq(swapInfo.tokenIn);
            expect(swapInfoStable.tokenOut).to.deep.eq(swapInfo.tokenOut);
            // These should match as should
            expect(swapInfoStable.returnAmount.toString()).eq(
                swapInfo.returnAmount.toString()
            );
            expect(swapInfoStable.returnAmountConsideringFees.toString()).eq(
                swapInfo.returnAmountConsideringFees
                    .times(tokenOutExchangeRate)
                    .toString()
            );
            expect(swapInfoStable.swaps.length).eq(swapInfo.swaps.length);
            swapInfoStable.swaps.forEach((swapStable, i) => {
                expect(swapStable.poolId).eq(swapInfo.swaps[i].poolId);
                expect(swapStable.assetInIndex).eq(
                    swapInfo.swaps[i].assetInIndex
                );
                expect(swapStable.assetOutIndex).eq(
                    swapInfo.swaps[i].assetOutIndex
                );
                expect(swapStable.userData).eq(swapInfo.swaps[i].userData);
                expect(swapStable.amount).eq(
                    bnum(swapInfo.swaps[i].amount)
                        .times(tokenInExchangeRate)
                        .toString()
                );
            });
        });
    });

    //     if (ALLOW_ADD_REMOVE) {
    //         it(`Full Swap - swapExactIn, Token > BPT`, async () => {
    //             const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
    //             const tokenIn = DAI;
    //             const tokenOut = BPT;
    //             const swapType = SwapTypes.SwapExactIn;
    //             const swapAmt: BigNumber = bnum('1');

    //             const sor = new SOR(
    //                 provider,
    //                 gasPrice,
    //                 maxPools,
    //                 chainId,
    //                 poolsFromFile
    //             );

    //             const fetchSuccess = await sor.fetchPools(false);

    //             let swapInfo: SwapInfo = await sor.getSwaps(
    //                 tokenIn,
    //                 tokenOut,
    //                 swapType,
    //                 swapAmt
    //             );
    //             expect(swapInfo.returnAmount.toString()).eq(
    //                 '304749153137929290'
    //             );
    //             expect(swapInfo.swaps.length).eq(1);
    //             expect(
    //                 swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
    //             ).eq(tokenIn);
    //             expect(
    //                 swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
    //             ).eq(tokenOut);
    //         });

    //         it(`Full Swap - swapExactIn, BPT > Token`, async () => {
    //             const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
    //             const tokenIn = BPT;
    //             const tokenOut = USDT;
    //             const swapType = SwapTypes.SwapExactIn;
    //             const swapAmt: BigNumber = bnum('1.77');

    //             const sor = new SOR(
    //                 provider,
    //                 gasPrice,
    //                 maxPools,
    //                 chainId,
    //                 poolsFromFile
    //             );

    //             const fetchSuccess = await sor.fetchPools(false);

    //             let swapInfo: SwapInfo = await sor.getSwaps(
    //                 tokenIn,
    //                 tokenOut,
    //                 swapType,
    //                 swapAmt
    //             );

    //             expect(swapInfo.returnAmount.toString()).eq('5771787');
    //             expect(swapInfo.swaps.length).eq(1);
    //             expect(
    //                 swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
    //             ).eq(tokenIn);
    //             expect(
    //                 swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
    //             ).eq(tokenOut);
    //         });

    //         it(`Full Swap - swapExactOut, Token > BPT`, async () => {
    //             const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
    //             const tokenIn = USDC;
    //             const tokenOut = BPT;
    //             const swapType = SwapTypes.SwapExactOut;
    //             const swapAmt: BigNumber = bnum('1.276');

    //             const sor = new SOR(
    //                 provider,
    //                 gasPrice,
    //                 maxPools,
    //                 chainId,
    //                 poolsFromFile
    //             );

    //             const fetchSuccess = await sor.fetchPools(false);

    //             let swapInfo: SwapInfo = await sor.getSwaps(
    //                 tokenIn,
    //                 tokenOut,
    //                 swapType,
    //                 swapAmt
    //             );

    //             // This value is hard coded as sanity check if things unexpectedly change. Taken from isolated run of calcTokenInGivenExactBptOut.
    //             expect(swapInfo.returnAmount.toString()).eq('4254344');
    //             expect(swapInfo.swaps.length).eq(1);
    //             expect(
    //                 swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
    //             ).eq(tokenIn);
    //             expect(
    //                 swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
    //             ).eq(tokenOut);
    //         });

    //         it(`Full Swap - swapExactOut, BPT > Token`, async () => {
    //             const poolsFromFile = require('./testData/metaStablePools/singlePool.json');
    //             const tokenIn = BPT;
    //             const tokenOut = DAI;
    //             const swapType = SwapTypes.SwapExactOut;
    //             const swapAmt: BigNumber = bnum('2.44');

    //             const sor = new SOR(
    //                 provider,
    //                 gasPrice,
    //                 maxPools,
    //                 chainId,
    //                 poolsFromFile
    //             );

    //             const fetchSuccess = await sor.fetchPools(false);

    //             let swapInfo: SwapInfo = await sor.getSwaps(
    //                 tokenIn,
    //                 tokenOut,
    //                 swapType,
    //                 swapAmt
    //             );

    //             expect(swapInfo.returnAmount.toString()).eq(
    //                 '753789411555982650'
    //             );
    //             expect(swapInfo.swaps.length).eq(1);
    //             expect(
    //                 swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
    //             ).eq(tokenIn);
    //             expect(
    //                 swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
    //             ).eq(tokenOut);
    //         });
    //     }
});
