require('dotenv').config();
import { ALLOW_ADD_REMOVE } from '../src/config';
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import {
    SwapInfo,
    SwapTypes,
    PoolTypes,
    PairTypes,
    SubgraphPoolBase,
} from '../src/types';
import { BigNumber, bnum, scale } from '../src/utils/bignumber';
import {
    StablePool,
    StablePoolPairData,
} from '../src/pools/stablePool/stablePool';
import { BPTForTokensZeroPriceImpact } from '../src/frontendHelpers/stableHelpers';

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
const RANDOM = '0x1456688345527be1f37e9e627da0837d6f08c925';

// npx mocha -r ts-node/register test/stablePools.spec.ts
describe(`Tests for Stable Pools.`, () => {
    context('limit amounts', () => {
        it(`tests getLimitAmountSwap SwapExactIn`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/stablePools/singlePool.json');
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
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[0].balance).times(MAX_OUT_RATIO).toString()
            );
        });

        it(`tests getLimitAmountSwap SwapExactOut`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/stablePools/singlePool.json');
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
                swapFeeScaled: scale(bnum(pool.swapFee), 18),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: bnum(pool.amp),
                allBalances: [],
                allBalancesScaled: [],
                invariant: bnum(0),
                tokenIndexIn: 0,
                tokenIndexOut: 1,
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[1].balance).times(MAX_OUT_RATIO).toString()
            );
        });
    });

    context('direct pool', () => {
        it(`Full Swap - swapExactIn No Route`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/stablePools/singlePool.json');
            const pools = poolsFromFile.pools;
            const tokenIn = BAL;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt: BigNumber = bnum('1');

            const sor = new SOR(provider, chainId, null, pools);
            const fetchSuccess = await sor.fetchPools([], false);
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.returnAmount.toString()).eq('0');
            expect(swapInfo.swaps.length).eq(0);
        });

        it(`Full Swap - swapExactOut No Route`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/stablePools/singlePool.json');
            const pools = poolsFromFile.pools;
            const tokenIn = BAL;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('1');

            const sor = new SOR(provider, chainId, null, pools);
            const fetchSuccess = await sor.fetchPools([], false);
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.returnAmount.toString()).eq('0');
            expect(swapInfo.swaps.length).eq(0);
        });

        it(`Full Swap - swapExactIn, Token>Token`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/stablePools/singlePool.json');
            const pools = poolsFromFile.pools;
            const tokenIn = DAI;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt: BigNumber = bnum('1');

            const sor = new SOR(provider, chainId, null, pools);
            const fetchSuccess = await sor.fetchPools([], false);
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
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
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/stablePools/singlePool.json');
            const pools = poolsFromFile.pools;
            const tokenIn = USDC;
            const tokenOut = USDT;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('1');

            const sor = new SOR(provider, chainId, null, pools);
            const fetchSuccess = await sor.fetchPools([], false);
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            console.log(`Return amt:`);
            console.log(swapInfo.returnAmount.toString());
            // This value is hard coded as sanity check if things unexpectedly change. Taken from V2 test run (with extra fee logic added).
            expect(swapInfo.returnAmount.toString()).eq('1000401');
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
                const poolsFromFile: {
                    pools: SubgraphPoolBase[];
                } = require('./testData/stablePools/singlePool.json');
                const pools = poolsFromFile.pools;
                const tokenIn = DAI;
                const tokenOut = BPT;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('1');

                const sor = new SOR(provider, chainId, null, pools);

                const fetchSuccess = await sor.fetchPools([], false);
                expect(fetchSuccess).to.be.true;

                expect(fetchSuccess).to.be.true;

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    { gasPrice, maxPools }
                );
                expect(swapInfo.returnAmount.toString()).eq(
                    '304749153137929290'
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
                const poolsFromFile: {
                    pools: SubgraphPoolBase[];
                } = require('./testData/stablePools/singlePool.json');
                const pools = poolsFromFile.pools;
                const tokenIn = BPT;
                const tokenOut = USDT;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('1.77');

                const sor = new SOR(provider, chainId, null, pools);

                const fetchSuccess = await sor.fetchPools([], false);
                expect(fetchSuccess).to.be.true;

                expect(fetchSuccess).to.be.true;

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    { gasPrice, maxPools }
                );

                expect(swapInfo.returnAmount.toString()).eq('5771787');
                expect(swapInfo.swaps.length).eq(1);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);
            });

            it(`Full Swap - swapExactOut, Token > BPT`, async () => {
                const poolsFromFile: {
                    pools: SubgraphPoolBase[];
                } = require('./testData/stablePools/singlePool.json');
                const pools = poolsFromFile.pools;
                const tokenIn = USDC;
                const tokenOut = BPT;
                const swapType = SwapTypes.SwapExactOut;
                const swapAmt: BigNumber = bnum('1.276');

                const sor = new SOR(provider, chainId, null, pools);

                const fetchSuccess = await sor.fetchPools([], false);
                expect(fetchSuccess).to.be.true;

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    { gasPrice, maxPools }
                );

                // This value is hard coded as sanity check if things unexpectedly change. Taken from isolated run of calcTokenInGivenExactBptOut.
                expect(swapInfo.returnAmount.toString()).eq('4254344');
                expect(swapInfo.swaps.length).eq(1);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]
                ).eq(tokenIn);
                expect(
                    swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]
                ).eq(tokenOut);
            });

            it(`Full Swap - swapExactOut, BPT > Token`, async () => {
                const poolsFromFile: {
                    pools: SubgraphPoolBase[];
                } = require('./testData/stablePools/singlePool.json');
                const pools = poolsFromFile.pools;
                const tokenIn = BPT;
                const tokenOut = DAI;
                const swapType = SwapTypes.SwapExactOut;
                const swapAmt: BigNumber = bnum('2.44');

                const sor = new SOR(provider, chainId, null, pools);

                const fetchSuccess = await sor.fetchPools([], false);
                expect(fetchSuccess).to.be.true;

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    { gasPrice, maxPools }
                );

                expect(swapInfo.returnAmount.toString()).eq(
                    '753789411555982650'
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

    context('multihop', () => {
        it(`Full Swap - swapExactIn, Token>Token`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/stablePools/multihop.json');
            const pools = poolsFromFile.pools;
            const tokenIn = DAI;
            const tokenOut = USDT;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt: BigNumber = bnum('23.45');

            const sor = new SOR(provider, chainId, null, pools);
            const fetchSuccess = await sor.fetchPools([], false);
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
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
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/stablePools/multihop.json');
            const pools = poolsFromFile.pools;
            const tokenIn = USDT;
            const tokenOut = DAI;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt: BigNumber = bnum('17.77');

            const sor = new SOR(provider, chainId, null, pools);
            const fetchSuccess = await sor.fetchPools([], false);
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            // This value is hard coded as sanity check if things unexpectedly change. Taken from V2 test run (with extra fee logic added).
            expect(swapInfo.returnAmount.toString()).eq('18089532');
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

    context('stable helpers', () => {
        it('should test BPTForTokensZeroPriceImpact for 0.1% single token add', () => {
            const allBalances = [bnum(1000e18), bnum(1000e18), bnum(1000e18)];
            const amp = bnum(500);
            const amounts = [bnum(1e18), bnum(0), bnum(0)];
            const bptTotalSupply = bnum(3000e18);
            const decimals = [18, 18, 18];

            const bptAmt = BPTForTokensZeroPriceImpact(
                allBalances,
                decimals,
                amounts, // This has to have the same lenght as allBalances
                bptTotalSupply,
                amp
            );

            expect(bptAmt.toString()).eq('1000000000000000000');
        });

        it('should test BPTForTokensZeroPriceImpact for 1% single token add', () => {
            const allBalances = [bnum(1000e18), bnum(1000e18), bnum(1000e18)];
            const amp = bnum(500);
            const amounts = [bnum(10e18), bnum(0), bnum(0)];
            const bptTotalSupply = bnum(3000e18);
            const decimals = [18, 18, 18];

            const bptAmt = BPTForTokensZeroPriceImpact(
                allBalances,
                decimals,
                amounts, // This has to have the same lenght as allBalances
                bptTotalSupply,
                amp
            );

            expect(bptAmt.toString()).eq('10000000000000000000');
        });

        it('should test BPTForTokensZeroPriceImpact for 10% single token add', () => {
            const allBalances = [bnum(1000e18), bnum(1000e18), bnum(1000e18)];
            const amp = bnum(500);
            const amounts = [bnum(100e18), bnum(0), bnum(0)];
            const bptTotalSupply = bnum(3000e18);
            const decimals = [18, 18, 18];

            const bptAmt = BPTForTokensZeroPriceImpact(
                allBalances,
                decimals,
                amounts, // This has to have the same lenght as allBalances
                bptTotalSupply,
                amp
            );

            expect(bptAmt.toString()).eq('100000000000000000000');
        });

        it('should test BPTForTokensZeroPriceImpact for proportional add', () => {
            const allBalances = [bnum(1000e18), bnum(1000e18), bnum(1000e18)];
            const amp = bnum(500);
            const amounts = [bnum(1e18), bnum(1e18), bnum(1e18)];
            const bptTotalSupply = bnum(3000e18);
            const decimals = [18, 18, 18];

            const bptAmt = BPTForTokensZeroPriceImpact(
                allBalances,
                decimals,
                amounts, // This has to have the same lenght as allBalances
                bptTotalSupply,
                amp
            );

            expect(bptAmt.toString()).eq('3000000000000000000');
        });

        it('should test BPTForTokensZeroPriceImpact for single token add + uneven pool', () => {
            const allBalances = [bnum(2000e18), bnum(1000e18), bnum(1000e18)];
            const amp = bnum(500);
            const amounts = [bnum(1e18), bnum(0), bnum(0)];
            const bptTotalSupply = bnum(4000e18);
            const decimals = [18, 18, 18];

            const bptAmt = BPTForTokensZeroPriceImpact(
                allBalances,
                decimals,
                amounts, // This has to have the same lenght as allBalances
                bptTotalSupply,
                amp
            );

            expect(bptAmt.toString()).eq('999912236433875470');
        });

        it('should test BPTForTokensZeroPriceImpact for single token add + VERY uneven pool', () => {
            const allBalances = [bnum(2000e18), bnum(100e18), bnum(100e18)];
            const amp = bnum(500);
            const amounts = [bnum(1e18), bnum(0), bnum(0)];
            const bptTotalSupply = bnum(2200e18);
            const decimals = [18, 18, 18];

            const bptAmt = BPTForTokensZeroPriceImpact(
                allBalances,
                decimals,
                amounts, // This has to have the same lenght as allBalances
                bptTotalSupply,
                amp
            );

            expect(bptAmt.toString()).eq('997252048236528013');
        });

        it('Derivative Bug Case', () => {
            const allBalances = [
                bnum('999996728554597709758831249'),
                bnum('1000005155543154'),
                bnum('1000000822928777'),
            ];
            const amp = bnum(2000);
            const amounts = [
                bnum('9654961595845215917881'),
                bnum('9655042958'),
                bnum('9655001127'),
            ];
            const bptTotalSupply = bnum('2999263268368702307690295440');
            const decimals = [18, 6, 6];

            const bptAmt = BPTForTokensZeroPriceImpact(
                allBalances,
                decimals,
                amounts, // This has to have the same lenght as allBalances
                bptTotalSupply,
                amp
            );

            expect(bptAmt.toString()).eq('28957866405645758931354');
        });
    });

    if (ALLOW_ADD_REMOVE) {
        context('stable meta swap', () => {
            it('should return swap via meta pool Exit Swap, SwapExactIn', async () => {
                const poolsFromFile: {
                    pools: SubgraphPoolBase[];
                } = require('./testData/stablePools/metaPool.json');
                const pools = poolsFromFile.pools;
                const tokenIn = RANDOM;
                const tokenOut = USDC;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('0.01');

                const sor = new SOR(provider, chainId, null, pools);

                const fetchSuccess = await sor.fetchPools([], false);
                expect(fetchSuccess).to.be.true;

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    { gasPrice, maxPools }
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
                expect(swapInfo.returnAmount.toString()).eq('3297');
            });

            it('should return swap via meta pool Join Pool, SwapExactIn', async () => {
                const poolsFromFile: {
                    pools: SubgraphPoolBase[];
                } = require('./testData/stablePools/metaPool.json');
                const pools = poolsFromFile.pools;
                const tokenIn = USDC;
                const tokenOut = RANDOM;
                const swapType = SwapTypes.SwapExactIn;
                const swapAmt: BigNumber = bnum('0.01');

                const sor = new SOR(provider, chainId, null, pools);

                const fetchSuccess = await sor.fetchPools([], false);
                expect(fetchSuccess).to.be.true;

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    { gasPrice, maxPools }
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
                    '30273658255996171'
                );
            });

            it('should return swap via meta pool Exit Swap, SwapExactOut', async () => {
                const poolsFromFile: {
                    pools: SubgraphPoolBase[];
                } = require('./testData/stablePools/metaPool.json');
                const pools = poolsFromFile.pools;
                const tokenIn = RANDOM;
                const tokenOut = USDC;
                const swapType = SwapTypes.SwapExactOut;
                const swapAmt: BigNumber = bnum('0.01');

                const sor = new SOR(provider, chainId, null, pools);

                const fetchSuccess = await sor.fetchPools([], false);
                expect(fetchSuccess).to.be.true;

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    { gasPrice, maxPools }
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
                    '30332443764917747'
                );
            });

            it('should return swap via meta pool Join Pool, SwapExactOut', async () => {
                const poolsFromFile: {
                    pools: SubgraphPoolBase[];
                } = require('./testData/stablePools/metaPool.json');
                const pools = poolsFromFile.pools;
                const tokenIn = USDC;
                const tokenOut = RANDOM;
                const swapType = SwapTypes.SwapExactOut;
                const swapAmt: BigNumber = bnum('0.01');

                const sor = new SOR(provider, chainId, null, pools);

                const fetchSuccess = await sor.fetchPools([], false);
                expect(fetchSuccess).to.be.true;

                const swapInfo: SwapInfo = await sor.getSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    { gasPrice, maxPools }
                );

                console.log(`Return amt:`);
                console.log(swapInfo.returnAmount.toString());
                console.log(swapInfo.swaps);
                console.log(swapInfo.tokenAddresses);
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
                expect(swapInfo.returnAmount.toString()).eq('3302');
            });
        });
    }
});
