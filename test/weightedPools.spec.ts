require('dotenv').config();
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import { SwapInfo, SwapTypes, PoolTypes, SubgraphPoolBase } from '../src/types';
import { BigNumber, bnum } from '../src/utils/bignumber';
import {
    WeightedPool,
    WeightedPoolPairData,
    WeightedPoolToken,
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
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/weightedPools/singlePool.json');
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
                pool.tokens as WeightedPoolToken[],
                pool.tokensList
            );

            const poolPairData: WeightedPoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Weighted,
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
                bnum(pool.tokens[0].balance).times(MAX_OUT_RATIO).toString()
            );
        });

        it(`tests getLimitAmountSwap SwapExactOut`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
            } = require('./testData/weightedPools/singlePool.json');
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
                pool.tokens as WeightedPoolToken[],
                pool.tokensList
            );

            const poolPairData: WeightedPoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Weighted,
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
                bnum(pool.tokens[1].balance).times(MAX_OUT_RATIO).toString()
            );
        });
    });
});
