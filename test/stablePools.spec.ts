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
import { bnum } from '../src/bmath';
import { BigNumber } from '../src/utils/bignumber';
import {
    StablePool,
    StablePoolPairData,
} from '../src/pools/stablePool/stablePool';

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

// npx mocha -r ts-node/register test/stablePools.spec.ts
describe(`Tests for Stable Pools.`, () => {
    context('limit amounts', () => {
        it(`tests getLimitAmountSwap SwapExactIn`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
            const pool = poolsFromFile.pools[0];
            const swapType = SwapTypes.SwapExactIn;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = new StablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );

            const poolPairData: StablePoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Stable,
                pairType: PairTypes.TokenToToken,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: bnum(pool.tokens[0].balance),
                balanceOut: bnum(pool.tokens[1].balance),
                swapFee: bnum(pool.swapFee),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: bnum(pool.amp),
                allBalances: [
                    bnum(pool.tokens[0].balance),
                    bnum(pool.tokens[1].balance),
                ],
                invariant: bnum(0),
                tokenIndexIn: 0,
                tokenIndexOut: 1,
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[0].balance)
                    .times(MAX_OUT_RATIO)
                    .toString()
            );
        });

        it(`tests getLimitAmountSwap SwapExactOut`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
            const pool = poolsFromFile.pools[0];
            const swapType = SwapTypes.SwapExactOut;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = new StablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );

            const poolPairData: StablePoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Stable,
                pairType: PairTypes.TokenToToken,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: bnum(pool.tokens[0].balance),
                balanceOut: bnum(pool.tokens[1].balance),
                swapFee: bnum(pool.swapFee),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: bnum(pool.amp),
                allBalances: [],
                invariant: bnum(0),
                tokenIndexIn: 0,
                tokenIndexOut: 1,
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[1].balance)
                    .times(MAX_OUT_RATIO)
                    .toString()
            );
        });
    });

    context('direct pool', () => {
        it(`Full Swap - swapExactIn No Route`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
            const tokenIn = BAL;
            const tokenOut = USDC;
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
            const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
            const tokenIn = BAL;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

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

        it(`Full Swap - swapExactIn, Token>Token`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
            const tokenIn = DAI;
            const tokenOut = USDC;
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

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            console.log(`Return amt:`);
            console.log(swapInfo.returnAmount.toString());
            // This value is hard coded as sanity check if things unexpectedly change. Taken from V2 test run (with extra fee logic added).
            expect(swapInfo.returnAmount.toString()).eq('999603');
            expect(swapInfo.swaps.length).eq(1);
            expect(swapInfo.swaps[0].amount.toString()).eq(
                swapAmt.times(1e18).toString()
            );
            expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[0].id);
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]).eq(
                tokenIn
            );
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]).eq(
                tokenOut
            );
        });

        it(`Full Swap - swapExactOut, Token>Token`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
            const tokenIn = USDC;
            const tokenOut = USDT;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            console.log(`Return amt:`);
            console.log(swapInfo.returnAmount.toString());
            // This value is hard coded as sanity check if things unexpectedly change. Taken from V2 test run (with extra fee logic added).
            expect(swapInfo.returnAmount.toString()).eq('1000400');
            expect(swapInfo.swaps.length).eq(1);
            expect(swapInfo.swaps[0].amount.toString()).eq(
                swapAmt.times(1e6).toString()
            );
            expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[0].id);
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]).eq(
                tokenIn
            );
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]).eq(
                tokenOut
            );
        });

        if (ALLOW_ADD_REMOVE) {
            it(`Full Swap - swapExactIn, Token > BPT`, async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
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

                let swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // This value is hard coded as sanity check if things unexpectedly change. Taken from isolated run of calcBptOutGivenExactTokensIn.
                expect(swapInfo.returnAmount.toString()).eq(
                    '0.304749044227756947',
                    `.env ALLOW_ADD_REMOVE must be true for BPT swaps`
                );
            });

            it(`Full Swap - swapExactIn, BPT > Token`, async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
                const tokenIn = BPT;
                const tokenOut = USDT;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('3.7');

                const sor = new SOR(
                    provider,
                    gasPrice,
                    maxPools,
                    chainId,
                    poolsFromFile
                );

                const fetchSuccess = await sor.fetchPools(false);

                let swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // This value is hard coded as sanity check if things unexpectedly change. Taken from isolated run of calcTokenOutGivenExactBptIn.
                expect(swapInfo.returnAmount.toString()).eq(
                    '10.26896515265958154',
                    `.env ALLOW_ADD_REMOVE must be true for BPT swaps`
                );
            });

            it(`Full Swap - swapExactOut, Token > BPT`, async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
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

                let swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // This value is hard coded as sanity check if things unexpectedly change. Taken from isolated run of calcTokenInGivenExactBptOut.
                expect(swapInfo.returnAmount.toString()).eq(
                    '4.254344791006178555',
                    `.env ALLOW_ADD_REMOVE must be true for BPT swaps`
                );
            });

            it(`Full Swap - swapExactOut, BPT > Token`, async () => {
                const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/singlePool.json');
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

                let swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt
                );

                // This value is hard coded as sanity check if things unexpectedly change. Taken from isolated run of calcBptInGivenExactTokensOut.
                expect(swapInfo.returnAmount.toString()).eq(
                    '0.753783887870341458',
                    `.env ALLOW_ADD_REMOVE must be true for BPT swaps`
                );
            });
        }
    });

    context('multihop', () => {
        it(`Full Swap - swapExactIn, Token>Token`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/multihop.json');
            const tokenIn = DAI;
            const tokenOut = USDT;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt: BigNumber = bnum('23.45');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );
            // This value is hard coded as sanity check if things unexpectedly change. Taken from V2 test run (with extra fee logic added).
            expect(swapInfo.returnAmount.toString()).eq('23533631');
            expect(swapInfo.swaps.length).eq(2);
            expect(swapInfo.swaps[0].amount.toString()).eq(
                swapAmt.times(1e18).toString()
            );
            expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[0].id);
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]).eq(
                tokenIn
            );
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]).eq(
                USDC
            );
            expect(swapInfo.swaps[1].amount.toString()).eq('0'); // Should be 0 for multihop
            expect(swapInfo.swaps[1].poolId).eq(poolsFromFile.pools[1].id);
            expect(swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex]).eq(
                USDC
            );
            expect(swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex]).eq(
                tokenOut
            );
        });

        it(`Full Swap - swapExactOut, Token>Token`, async () => {
            const poolsFromFile: SubGraphPoolsBase = require('./testData/stablePools/multihop.json');
            const tokenIn = USDT;
            const tokenOut = DAI;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('17.77');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            let swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            // This value is hard coded as sanity check if things unexpectedly change. Taken from V2 test run (with extra fee logic added).
            expect(swapInfo.returnAmount.toString()).eq('18089531');
            expect(swapInfo.swaps.length).eq(2);
            expect(swapInfo.swaps[0].amount.toString()).eq(
                swapAmt.times(1e18).toString()
            );
            expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[0].id);
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]).eq(
                USDC
            );
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]).eq(
                tokenOut
            );
            expect(swapInfo.swaps[1].amount.toString()).eq('0'); // Should be 0 for multihop
            expect(swapInfo.swaps[1].poolId).eq(poolsFromFile.pools[1].id);
            expect(swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex]).eq(
                tokenIn
            );
            expect(swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex]).eq(
                USDC
            );
        });
    });
});
