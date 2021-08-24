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
import { BigNumber, bnum } from '../src/utils/bignumber';
import {
    WeightedPool,
    WeightedPoolPairData,
} from '../src/pools/weightedPool/weightedPool';

const gasPrice = bnum('30000000000');
const maxPools = 4;
const chainId = 1;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const BPT = '0xebfed10e11dc08fcda1af1fda146945e8710f22e';
const RANDOM = '0x1456688345527be1f37e9e627da0837d6f08c925';

// npx mocha -r ts-node/register test/weightedPools.spec.ts
describe(`Tests for Weighted Pools.`, () => {
    context('limit amounts', () => {
        it(`tests getLimitAmountSwap SwapExactIn`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/singlePool.json');
            const pool = poolsFromFile.pools[0];
            const swapType = SwapTypes.SwapExactIn;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = new WeightedPool(
                pool.id,
                pool.address,
                pool.swapFee,
                pool.totalWeight,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );

            const poolPairData: WeightedPoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Weighted,
                pairType: PairTypes.TokenToToken,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: bnum(pool.tokens[0].balance),
                balanceOut: bnum(pool.tokens[1].balance),
                swapFee: bnum(pool.swapFee),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                weightIn: bnum(pool.tokens[0].weight),
                weightOut: bnum(pool.tokens[1].weight),
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[0].balance)
                    .times(MAX_OUT_RATIO)
                    .toString()
            );
        });

        it(`tests getLimitAmountSwap SwapExactOut`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/singlePool.json');
            const pool = poolsFromFile.pools[0];
            const swapType = SwapTypes.SwapExactOut;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = new WeightedPool(
                pool.id,
                pool.address,
                pool.swapFee,
                pool.totalWeight,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );

            const poolPairData: WeightedPoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Weighted,
                pairType: PairTypes.TokenToToken,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: bnum(pool.tokens[0].balance),
                balanceOut: bnum(pool.tokens[1].balance),
                swapFee: bnum(pool.swapFee),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                weightIn: bnum(pool.tokens[0].weight),
                weightOut: bnum(pool.tokens[1].weight),
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[1].balance)
                    .times(MAX_OUT_RATIO)
                    .toString()
            );
        });
    });

    context('direct pool - BPT Swaps', () => {
        if (ALLOW_ADD_REMOVE) {
            it(`Full Swap - swapExactIn, Token > BPT`, async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/singlePool.json');
                const tokenIn = DAI;
                const tokenOut = BPT;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('1');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // TO DO - Confirm value
                expect(swapInfo.returnAmount.toString()).eq(
                    '318211202355717370'
                );
                expect(swapInfo.swaps.length).eq(1);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);
            });

            it(`Full Swap - swapExactIn, BPT > Token`, async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/singlePool.json');
                const tokenIn = BPT;
                const tokenOut = USDT;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('1.77');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // This value is hard coded as sanity check if things unexpectedly change. Taken from isolated run of calcTokenOutGivenExactBptIn.
                expect(swapInfo.returnAmount.toString()).eq('5303617');
                expect(swapInfo.swaps.length).eq(1);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);
            });

            it(`Full Swap - swapExactOut, Token > BPT`, async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/singlePool.json');
                const tokenIn = USDC;
                const tokenOut = BPT;
                const swapType = SwapTypes.SwapExactOut;
                const swapAmt: BigNumber = bnum('1.276');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // This value is hard coded as sanity check if things unexpectedly change. Taken from isolated run of calcTokenInGivenExactBptOut.
                expect(swapInfo.returnAmount.toString()).eq('4777327');
                expect(swapInfo.swaps.length).eq(1);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);
            });

            it(`Full Swap - swapExactOut, BPT > Token`, async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/singlePool.json');
                const tokenIn = BPT;
                const tokenOut = DAI;
                const swapType = SwapTypes.SwapExactOut;
                const swapAmt: BigNumber = bnum('2.44');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                expect(swapInfo.returnAmount.toString()).eq(
                    '890233084373103540'
                );
                expect(swapInfo.swaps.length).eq(1);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);
            });
        }
    });

    if (ALLOW_ADD_REMOVE) {
        context('stable meta swap', () => {
            it('should return swap via meta pool Exit Swap, SwapExactIn', async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/metaPool.json');
                const tokenIn = RANDOM;
                const tokenOut = USDC;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('0.01');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // TO DO - Need to return in correct format for Relayer
                // Should return TokenIn > BPT > Exit > TokenOut
                expect(swapInfo.swaps.length).eq(2);
                expect(swapInfo.swaps[0].amount.toString()).eq(
                    swapAmt.times(1e18).toString()
                );
                expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[1].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(poolsFromFile.pools[0].address);

                expect(swapInfo.swaps[1].amount.toString()).eq('0');
                expect(swapInfo.swaps[1].poolId).eq(poolsFromFile.pools[0].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex]
                ).eq(poolsFromFile.pools[0].address);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex]
                ).eq(tokenOut);
                // TO DO - Confirm amount via maths
                expect(swapInfo.returnAmount.toString()).eq('3274');
            });

            it('should return swap via meta pool Join Pool, SwapExactIn', async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/metaPool.json');
                const tokenIn = USDC;
                const tokenOut = RANDOM;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('1');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // TO DO - Need to return in correct format for Relayer
                // Should return TokenIn > Join > BPT > TokenOut
                expect(swapInfo.swaps.length).eq(2);
                expect(swapInfo.swaps[0].amount.toString()).eq(
                    swapAmt.times(1e6).toString()
                );
                expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[0].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(poolsFromFile.pools[0].address);

                expect(swapInfo.swaps[1].amount.toString()).eq('0');
                expect(swapInfo.swaps[1].poolId).eq(poolsFromFile.pools[1].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex]
                ).eq(poolsFromFile.pools[0].address);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex]
                ).eq(tokenOut);
                // TO DO - Confirm amount via maths
                expect(swapInfo.returnAmount.toString()).eq(
                    '2211750490727915400'
                );
            });

            it('should return swap via meta pool Exit Swap, SwapExactOut', async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/metaPool.json');
                const tokenIn = RANDOM;
                const tokenOut = USDC;
                const swapType = SwapTypes.SwapExactOut;
                const swapAmt: BigNumber = bnum('0.01');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // TO DO - Need to return in correct format for Relayer
                // Should return TokenIn > BPT > Exit > TokenOut
                expect(swapInfo.swaps.length).eq(2);
                expect(swapInfo.swaps[0].amount.toString()).eq(
                    swapAmt.times(1e6).toString()
                );
                expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[0].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(poolsFromFile.pools[0].address);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);

                expect(swapInfo.swaps[1].amount.toString()).eq('0');
                expect(swapInfo.swaps[1].poolId).eq(poolsFromFile.pools[1].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex]
                ).eq(poolsFromFile.pools[0].address);
                // TO DO - Confirm amount via maths
                expect(swapInfo.returnAmount.toString()).eq(
                    '30526486044124990'
                );
            });

            it('should return swap via meta pool Join Pool, SwapExactOut', async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/weightedPools/metaPool.json');
                const tokenIn = USDC;
                const tokenOut = RANDOM;
                const swapType = SwapTypes.SwapExactOut;
                const swapAmt: BigNumber = bnum('0.01');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // TO DO - Need to return in correct format for Relayer
                // Should return TokenIn > Join > BPT > TokenOut
                expect(swapInfo.swaps.length).eq(2);
                expect(swapInfo.swaps[0].amount.toString()).eq(
                    swapAmt.times(1e18).toString()
                );
                expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[1].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(poolsFromFile.pools[0].address);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);

                expect(swapInfo.swaps[1].amount.toString()).eq('0');
                expect(swapInfo.swaps[1].poolId).eq(poolsFromFile.pools[0].id);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex]
                ).eq(poolsFromFile.pools[0].address);
                // TO DO - Confirm amount via maths
                expect(swapInfo.returnAmount.toString()).eq('3326');
            });
        });
    }
});
