// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { sorConfigEth } from './lib/constants';
import { expect } from 'chai';
import { mockTokenPriceService } from './lib/mockTokenPriceService';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import {
    SwapInfo,
    SwapTypes,
    PoolTypes,
    PoolFilter,
    SubgraphPoolBase,
} from '../src/types';
import { bnum } from '../src/utils/bignumber';
import {
    ElementPool,
    ElementPoolPairData,
} from '../src/pools/elementPool/elementPool';
import { parseFixed } from '@ethersproject/bignumber';
import { MockPoolDataService } from './lib/mockPoolDataService';

const gasPrice = parseFixed('30', 9);
const maxPools = 4;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// npx mocha -r ts-node/register test/elementPools.spec.ts
describe(`Tests for Element Pools.`, () => {
    it(`tests getLimitAmountSwap SwapExactOut`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
        } = require('./testData/elementPools/elementFinanceTest1.json');
        const pool = poolsFromFile.pools[0];
        const swapType = SwapTypes.SwapExactOut;

        // Max out uses standard V2 limits
        const MAX_OUT_RATIO = bnum(0.3);

        const newPool = ElementPool.fromPool(pool);

        const poolPairData: ElementPoolPairData = {
            id: pool.id,
            address: pool.address,
            poolType: PoolTypes.Element,
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
            totalShares: parseFixed(pool.totalShares, 18),
            expiryTime: pool.expiryTime as number,
            unitSeconds: pool.unitSeconds as number,
            principalToken: pool.principalToken as string,
            baseToken: pool.baseToken as string,
            currentBlockTimestamp: 0,
        };

        const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
        expect(limitAmt.toString()).to.eq(
            bnum(pool.tokens[1].balance).times(MAX_OUT_RATIO).toString()
        );
    });

    it(`tests getLimitAmountSwap SwapExactIn, within expiry`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
        } = require('./testData/elementPools/elementFinanceTest1.json');
        const pool = poolsFromFile.pools[0];
        const swapType = SwapTypes.SwapExactIn;

        const newPool = ElementPool.fromPool(pool);

        if (!pool.expiryTime) throw Error('Invalid pool data');
        // Needs to be called to update the currentBlockTimestamp
        newPool.setCurrentBlockTimestamp(pool.expiryTime - 10);

        const poolPairData: ElementPoolPairData = {
            id: pool.id,
            address: pool.address,
            poolType: PoolTypes.Element,
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
            totalShares: parseFixed(pool.totalShares, 18),
            expiryTime: pool.expiryTime as number,
            unitSeconds: pool.unitSeconds as number,
            principalToken: pool.principalToken as string,
            baseToken: pool.baseToken as string,
            currentBlockTimestamp: 0, // This will be updated to use value set above in the function getLimitAmountSwap
        };

        const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(limitAmt.gt(0)).to.be.true;
    });

    it(`tests getLimitAmountSwap SwapExactIn, outwith expiry`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
        } = require('./testData/elementPools/elementFinanceTest1.json');
        const pool = poolsFromFile.pools[0];
        const swapType = SwapTypes.SwapExactIn;

        const newPool = ElementPool.fromPool(pool);

        if (!pool.expiryTime) throw Error('Invalid pool data');
        // Needs to be called to update the currentBlockTimestamp
        newPool.setCurrentBlockTimestamp(pool.expiryTime + 1);

        const poolPairData: ElementPoolPairData = {
            id: pool.id,
            address: pool.address,
            poolType: PoolTypes.Element,
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
            totalShares: parseFixed(pool.totalShares, 18),
            expiryTime: pool.expiryTime as number,
            unitSeconds: pool.unitSeconds as number,
            principalToken: pool.principalToken as string,
            baseToken: pool.baseToken as string,
            currentBlockTimestamp: 0, // This will be updated to use value set above in the function getLimitAmountSwap
        };

        const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(limitAmt.gt(0)).to.be.true;
    });

    it(`Full Swap - swapExactIn Direct Pool, Within Expiry`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
        } = require('./testData/elementPools/elementFinanceTest1.json');
        const pools = poolsFromFile.pools;
        const tokenIn = '0x0000000000000000000000000000000000000001';
        const tokenOut = '0x000000000000000000000000000000000000000b';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        const fetchSuccess = await sor.fetchPools();
        expect(fetchSuccess).to.be.true;

        if (!pools[0].expiryTime) throw Error('Invalid pool data');
        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            {
                gasPrice,
                maxPools,
                poolTypeFilter: PoolFilter.All,
                timestamp: pools[0].expiryTime - 22, // This is the value for currentBlockTimestamp
            }
        );

        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });

    it(`Full Swap - swapExactIn Direct Pool, Outwith Expiry`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
        } = require('./testData/elementPools/elementFinanceTest1.json');
        const pools = poolsFromFile.pools;
        const tokenIn = '0x0000000000000000000000000000000000000001';
        const tokenOut = '0x000000000000000000000000000000000000000b';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        const fetchSuccess = await sor.fetchPools();
        expect(fetchSuccess).to.be.true;

        if (!pools[0].expiryTime) throw Error('Invalid pool data');
        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            {
                gasPrice,
                maxPools,
                poolTypeFilter: PoolFilter.All,
                timestamp: pools[0].expiryTime + 22, // This is the value for currentBlockTimestamp
            }
        );

        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });

    it(`Full Swap - swapExactOut Direct Pool, Within Expiry`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
        } = require('./testData/elementPools/elementFinanceTest1.json');
        const pools = poolsFromFile.pools;
        const tokenIn = '0x0000000000000000000000000000000000000001';
        const tokenOut = '0x000000000000000000000000000000000000000b';
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt = parseFixed('777', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        const fetchSuccess = await sor.fetchPools();
        expect(fetchSuccess).to.be.true;

        if (!pools[0].expiryTime) throw Error('Invalid pool data');
        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            {
                gasPrice,
                maxPools,
                poolTypeFilter: PoolFilter.All,
                timestamp: pools[0].expiryTime - 22, // This is the value for currentBlockTimestamp
            }
        );

        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });

    it(`Full Swap - swapExactOut Direct Pool, Outwith Expiry`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
            // eslint-disable-next-line @typescript-eslint/no-var-requires
        } = require('./testData/elementPools/elementFinanceTest1.json');
        const pools = poolsFromFile.pools;
        const tokenIn = '0x0000000000000000000000000000000000000001';
        const tokenOut = '0x000000000000000000000000000000000000000b';
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt = parseFixed('777', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        const fetchSuccess = await sor.fetchPools();
        expect(fetchSuccess).to.be.true;

        if (!pools[0].expiryTime) throw Error('Invalid pool data');
        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            {
                gasPrice,
                maxPools,
                poolTypeFilter: PoolFilter.All,
                timestamp: pools[0].expiryTime + 22, // This is the value for currentBlockTimestamp
            }
        );

        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });
});
