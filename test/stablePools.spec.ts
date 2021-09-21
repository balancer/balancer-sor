require('dotenv').config();
import { expect } from 'chai';
import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import { SwapInfo, SwapTypes, PoolTypes, SubgraphPoolBase } from '../src/types';
import { bnum, scale } from '../src/utils/bignumber';
import {
    StablePool,
    StablePoolPairData,
} from '../src/pools/stablePool/stablePool';
import { BPTForTokensZeroPriceImpact } from '../src/frontendHelpers/stableHelpers';
import { parseFixed } from '@ethersproject/bignumber';

const gasPrice = parseFixed('30', 9);
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

            const newPool = StablePool.fromPool(pool);

            const poolPairData: StablePoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Stable,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: parseFixed(
                    pool.tokens[0].balance,
                    pool.tokens[0].decimals
                ),
                balanceOut: parseFixed(
                    pool.tokens[1].balance,
                    pool.tokens[1].decimals
                ),
                swapFee: parseFixed(pool.swapFee, 18),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: BigNumber.from(pool.amp as string),
                allBalances: [
                    bnum(pool.tokens[0].balance),
                    bnum(pool.tokens[1].balance),
                ],
                allBalancesScaled: [
                    parseFixed(pool.tokens[0].balance, 18),
                    parseFixed(pool.tokens[1].balance, 18),
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

            const newPool = StablePool.fromPool(pool);

            const poolPairData: StablePoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Stable,
                tokenIn: pool.tokens[0].address,
                tokenOut: pool.tokens[1].address,
                balanceIn: parseFixed(
                    pool.tokens[0].balance,
                    pool.tokens[0].decimals
                ),
                balanceOut: parseFixed(
                    pool.tokens[1].balance,
                    pool.tokens[1].decimals
                ),
                swapFee: parseFixed(pool.swapFee, 18),
                decimalsIn: Number(pool.tokens[0].decimals),
                decimalsOut: Number(pool.tokens[1].decimals),
                amp: BigNumber.from(pool.amp as string),
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
            const swapAmt = parseFixed('1', 18);

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
            const swapAmt = parseFixed('1', 18);

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
            const swapAmt = parseFixed('1', 18);

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
            expect(swapInfo.swaps[0].amount.toString()).eq(swapAmt.toString());
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
            const swapAmt = parseFixed('1', 6);

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
            expect(swapInfo.swaps[0].amount.toString()).eq(swapAmt.toString());
            expect(swapInfo.swaps[0].poolId).eq(poolsFromFile.pools[0].id);
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex]).eq(
                tokenIn
            );
            expect(swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex]).eq(
                tokenOut
            );
        });
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
            const swapAmt = parseFixed('23.45', 18);

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
            expect(swapInfo.swaps[0].amount.toString()).eq(swapAmt.toString());
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
            const swapAmt = parseFixed('17.77', 18);

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
            expect(swapInfo.swaps[0].amount.toString()).eq(swapAmt.toString());
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
});
