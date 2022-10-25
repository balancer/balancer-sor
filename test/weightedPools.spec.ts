// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/weightedPools.spec.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { assert, expect } from 'chai';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';

import {
    SOR,
    SwapTypes,
    PoolTypes,
    SwapInfo,
    PoolFilter,
    bnum,
    WeightedPool,
} from '../src';
import { WeightedPoolPairData } from '../src/pools/weightedPool/weightedPool';
import { mockTokenPriceService } from './lib/mockTokenPriceService';
import { MockPoolDataService } from './lib/mockPoolDataService';
import { sorConfigTest, DAI, USDT } from './lib/constants';

import poolsList from './testData/weightedPools/joinExitPools.json';

describe(`Tests for Weighted Pools.`, () => {
    context('limit amounts', () => {
        it(`tests getLimitAmountSwap SwapExactIn`, async () => {
            const pool = poolsList.pools[0];
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
                pairType: 2,
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[0].balance).times(MAX_OUT_RATIO).toString()
            );
        });

        it(`tests getLimitAmountSwap SwapExactOut`, async () => {
            const pool = poolsList.pools[0];
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
                pairType: 2,
            };

            const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
            expect(limitAmt.toString()).to.eq(
                bnum(pool.tokens[1].balance).times(MAX_OUT_RATIO).toString()
            );
        });
    });

    context('swaps using BPTs of weighted pools', () => {
        it('token->BPT, exact in', async () => {
            const tokenIn = DAI.address;
            const tokenOut = USDT.address;
            const swapType = SwapTypes.SwapExactIn;
            const pools = cloneDeep(poolsList.pools);
            const stablePool = [pools[1]];
            const swapAmount = parseFixed('1280000', 18);
            const swapInfo1 = await getSwapInfo(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                swapAmount,
                true
            );
            const swapInfo2 = await getSwapInfo(
                tokenIn,
                tokenOut,
                swapType,
                stablePool,
                swapAmount,
                true
            );
            assert.equal(swapInfo1.swaps.length, 3, 'Should have 3 swaps');
            assert.equal(swapInfo2.swaps.length, 1, 'Should have 1 swap');
            assert.equal(swapInfo1.returnAmount.toString(), '1264585520968');
            // only using the stable pool returns a lower value:
            assert.equal(swapInfo2.returnAmount.toString(), '1264579692512');
        });
        it('token->BPT, exact out', async () => {
            const tokenIn = DAI.address;
            const tokenOut = USDT.address;
            const swapType = SwapTypes.SwapExactOut;
            const pools = cloneDeep(poolsList.pools);
            const stablePool = [pools[1]];
            const swapAmount = BigNumber.from(1264585520968);
            const swapInfo1 = await getSwapInfo(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                swapAmount,
                true
            );
            const swapInfo2 = await getSwapInfo(
                tokenIn,
                tokenOut,
                swapType,
                stablePool,
                BigNumber.from(1264579692512),
                true
            );
            assert.equal(swapInfo1.swaps.length, 3, 'Should have 3 swaps');
            assert.equal(swapInfo2.swaps.length, 1, 'Should have 1 swap');
            assert.equal(
                swapInfo1.returnAmount.toString(),
                '1280000412490447883455427'
            );
            assert.equal(
                swapInfo2.returnAmount.toString(),
                '1279999999999232865155148'
            );
            // approximate reversibility of amounts shows consistency
            // between exact in and exact out formulas
        });
        it('BPT->token, exact in', async () => {
            const tokenIn = USDT.address;
            const tokenOut = DAI.address;
            const swapType = SwapTypes.SwapExactIn;
            const pools = cloneDeep(poolsList.pools);
            pools.splice(1, 1); // removes the stable pool
            const swapAmount = parseFixed('100000', 6);
            const swapInfo = await getSwapInfo(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                swapAmount,
                true
            );
            assert.equal(swapInfo.swaps.length, 2, 'Should have 2 swaps');
            assert.equal(
                swapInfo.returnAmount.toString(),
                '94961515248180000000000'
            );
        });
        it('BPT->token, exact out', async () => {
            const tokenIn = USDT.address;
            const tokenOut = DAI.address;
            const swapType = SwapTypes.SwapExactOut;
            const pools = cloneDeep(poolsList.pools);
            pools.splice(1, 1); // removes the stable pool
            const swapAmount = BigNumber.from('94961515248180000000000');
            const swapInfo = await getSwapInfo(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                swapAmount,
                true
            );
            assert.equal(swapInfo.swaps.length, 2, 'Should have 2 swaps');
            assert.equal(swapInfo.returnAmount.toString(), '100000436582');
            // approximate reversibility of amounts shows consistency
            // between exact in and exact out formulas
        });
    });
});

async function getSwapInfo(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools: any,
    swapAmount: BigNumber,
    useBpts?: boolean
) {
    const provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );
    const maxPools = 4;
    const gasPrice = BigNumber.from('0');
    const sor = new SOR(
        provider,
        sorConfigTest,
        new MockPoolDataService(pools),
        mockTokenPriceService
    );
    const isFetched = await sor.fetchPools();
    assert(isFetched, 'Pools should be fetched in wrapper');
    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        swapAmount,
        {
            gasPrice,
            maxPools,
            timestamp: 0,
            poolTypeFilter: PoolFilter.All,
        },
        useBpts
    );
    return swapInfo;
}
