// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { expect } from 'chai';
import { SwapTypes, PoolTypes, SubgraphPoolBase } from '../src/types';
import { bnum } from '../src/utils/bignumber';
import {
    WeightedPool,
    WeightedPoolPairData,
} from '../src/pools/weightedPool/weightedPool';
import { parseFixed } from '@ethersproject/bignumber';

// npx mocha -r ts-node/register test/weightedPools.spec.ts
describe(`Tests for Weighted Pools.`, () => {
    context('limit amounts', () => {
        it(`tests getLimitAmountSwap SwapExactIn`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
                // eslint-disable-next-line @typescript-eslint/no-var-requires
            } = require('./testData/weightedPools/singlePool.json');
            const pool = poolsFromFile.pools[0];
            const swapType = SwapTypes.SwapExactIn;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = WeightedPool.fromPool(pool);

            const poolPairData: WeightedPoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Weighted,
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
                weightIn: parseFixed(pool.tokens[0].weight as string, 18),
                weightOut: parseFixed(pool.tokens[1].weight as string, 18),
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[0].balance).times(MAX_OUT_RATIO).toString()
            );
        });

        it(`tests getLimitAmountSwap SwapExactOut`, async () => {
            const poolsFromFile: {
                pools: SubgraphPoolBase[];
                // eslint-disable-next-line @typescript-eslint/no-var-requires
            } = require('./testData/weightedPools/singlePool.json');
            const pool = poolsFromFile.pools[0];
            const swapType = SwapTypes.SwapExactOut;

            // Max out uses standard V2 limits
            const MAX_OUT_RATIO = bnum(0.3);

            const newPool = WeightedPool.fromPool(pool);

            const poolPairData: WeightedPoolPairData = {
                id: pool.id,
                address: pool.address,
                poolType: PoolTypes.Weighted,
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
                weightIn: parseFixed(pool.tokens[0].weight as string, 18),
                weightOut: parseFixed(pool.tokens[1].weight as string, 18),
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[1].balance).times(MAX_OUT_RATIO).toString()
            );
        });
    });
});
