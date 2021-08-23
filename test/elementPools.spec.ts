require('dotenv').config();
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import {
    SubGraphPoolsBase,
    SwapInfo,
    SwapTypes,
    PoolTypes,
    PairTypes,
    PoolFilter,
} from '../src/types';
import { bnum } from '../src/bmath';
import { BigNumber } from '../src/utils/bignumber';
import {
    ElementPool,
    ElementPoolPairData,
} from '../src/pools/elementPool/elementPool';

const gasPrice = bnum('30000000000');
const maxPools = 4;
const chainId = 1;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// npx mocha -r ts-node/register test/elementPools.spec.ts
describe(`Tests for Element Pools.`, () => {
    it(`tests getLimitAmountSwap SwapExactOut`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/elementPools/elementFinanceTest1.json');
        const pool = poolsFromFile.pools[0];
        const swapType = SwapTypes.SwapExactOut;

        // Max out uses standard V2 limits
        const MAX_OUT_RATIO = bnum(0.3);

        const newPool = new ElementPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.expiryTime,
            pool.unitSeconds,
            pool.principalToken,
            pool.baseToken
        );

        const poolPairData: ElementPoolPairData = {
            id: pool.id,
            address: pool.address,
            poolType: PoolTypes.Element,
            pairType: PairTypes.TokenToToken,
            tokenIn: pool.tokens[0].address,
            tokenOut: pool.tokens[1].address,
            balanceIn: bnum(pool.tokens[0].balance),
            balanceOut: bnum(pool.tokens[1].balance),
            swapFee: bnum(pool.swapFee),
            decimalsIn: Number(pool.tokens[0].decimals),
            decimalsOut: Number(pool.tokens[1].decimals),
            totalShares: bnum(pool.totalShares),
            expiryTime: pool.expiryTime,
            unitSeconds: pool.unitSeconds,
            principalToken: pool.principalToken,
            baseToken: pool.baseToken,
            currentBlockTimestamp: 0,
        };

        const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
        expect(limitAmt.toString()).to.eq(
            bnum(pool.tokens[1].balance)
                .times(MAX_OUT_RATIO)
                .toString()
        );
    });

    it(`tests getLimitAmountSwap SwapExactIn, within expiry`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/elementPools/elementFinanceTest1.json');
        const pool = poolsFromFile.pools[0];
        const swapType = SwapTypes.SwapExactIn;

        const newPool = new ElementPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            Number(pool.expiryTime),
            Number(pool.unitSeconds),
            pool.principalToken,
            pool.baseToken
        );

        // Needs to be called to update the currentBlockTimestamp
        newPool.setCurrentBlockTimestamp(pool.expiryTime - 10);

        const poolPairData: ElementPoolPairData = {
            id: pool.id,
            address: pool.address,
            poolType: PoolTypes.Element,
            pairType: PairTypes.TokenToToken,
            tokenIn: pool.tokens[0].address,
            tokenOut: pool.tokens[1].address,
            balanceIn: bnum(pool.tokens[0].balance),
            balanceOut: bnum(pool.tokens[1].balance),
            swapFee: bnum(pool.swapFee),
            decimalsIn: Number(pool.tokens[0].decimals),
            decimalsOut: Number(pool.tokens[1].decimals),
            totalShares: bnum(pool.totalShares),
            expiryTime: pool.expiryTime,
            unitSeconds: pool.unitSeconds,
            principalToken: pool.principalToken,
            baseToken: pool.baseToken,
            currentBlockTimestamp: 0, // This will be updated to use value set above in the function getLimitAmountSwap
        };

        const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(limitAmt.gt(0)).to.be.true;
    });

    it(`tests getLimitAmountSwap SwapExactIn, outwith expiry`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/elementPools/elementFinanceTest1.json');
        const pool = poolsFromFile.pools[0];
        const swapType = SwapTypes.SwapExactIn;

        const newPool = new ElementPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            Number(pool.expiryTime),
            Number(pool.unitSeconds),
            pool.principalToken,
            pool.baseToken
        );

        // Needs to be called to update the currentBlockTimestamp
        newPool.setCurrentBlockTimestamp(pool.expiryTime + 1);

        const poolPairData: ElementPoolPairData = {
            id: pool.id,
            address: pool.address,
            poolType: PoolTypes.Element,
            pairType: PairTypes.TokenToToken,
            tokenIn: pool.tokens[0].address,
            tokenOut: pool.tokens[1].address,
            balanceIn: bnum(pool.tokens[0].balance),
            balanceOut: bnum(pool.tokens[1].balance),
            swapFee: bnum(pool.swapFee),
            decimalsIn: Number(pool.tokens[0].decimals),
            decimalsOut: Number(pool.tokens[1].decimals),
            totalShares: bnum(pool.totalShares),
            expiryTime: pool.expiryTime,
            unitSeconds: pool.unitSeconds,
            principalToken: pool.principalToken,
            baseToken: pool.baseToken,
            currentBlockTimestamp: 0, // This will be updated to use value set above in the function getLimitAmountSwap
        };

        const limitAmt = newPool.getLimitAmountSwap(poolPairData, swapType);
        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(limitAmt.gt(0)).to.be.true;
    });

    it(`Full Swap - swapExactIn Direct Pool, Within Expiry`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/elementPools/elementFinanceTest1.json');
        const tokenIn = '0x0000000000000000000000000000000000000001';
        const tokenOut = '0x000000000000000000000000000000000000000b';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt: BigNumber = bnum('0.1');

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
            swapAmt,
            {
                poolTypeFilter: PoolFilter.All,
                timestamp: poolsFromFile.pools[0].expiryTime - 22, // This is the value for currentBlockTimestamp
            }
        );

        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });

    it(`Full Swap - swapExactIn Direct Pool, Outwith Expiry`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/elementPools/elementFinanceTest1.json');
        const tokenIn = '0x0000000000000000000000000000000000000001';
        const tokenOut = '0x000000000000000000000000000000000000000b';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt: BigNumber = bnum('0.1');

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
            swapAmt,
            {
                poolTypeFilter: PoolFilter.All,
                timestamp: poolsFromFile.pools[0].expiryTime + 22, // This is the value for currentBlockTimestamp
            }
        );

        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });

    it(`Full Swap - swapExactOut Direct Pool, Within Expiry`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/elementPools/elementFinanceTest1.json');
        const tokenIn = '0x0000000000000000000000000000000000000001';
        const tokenOut = '0x000000000000000000000000000000000000000b';
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt: BigNumber = bnum('777');

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
            swapAmt,
            {
                poolTypeFilter: PoolFilter.All,
                timestamp: poolsFromFile.pools[0].expiryTime - 22, // This is the value for currentBlockTimestamp
            }
        );

        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });

    it(`Full Swap - swapExactOut Direct Pool, Outwith Expiry`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/elementPools/elementFinanceTest1.json');
        const tokenIn = '0x0000000000000000000000000000000000000001';
        const tokenOut = '0x000000000000000000000000000000000000000b';
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt: BigNumber = bnum('777');

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
            swapAmt,
            {
                poolTypeFilter: PoolFilter.All,
                timestamp: poolsFromFile.pools[0].expiryTime + 22, // This is the value for currentBlockTimestamp
            }
        );

        // TO DO - Confirm that behaviour is correct for timestamp
        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });
});
