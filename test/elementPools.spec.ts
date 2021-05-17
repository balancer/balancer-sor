require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR } from '../src';
import {
    SubgraphPoolBase,
    SubGraphPoolsBase,
    SwapInfo,
    SwapTypes,
} from '../src/types';
import { bnum } from '../src/bmath';
import { BigNumber } from '../src/utils/bignumber';
import { expect } from 'chai';

const gasPrice = bnum('30000000000');
const maxPools = 4;
const chainId = 1;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// This must be updated with pools of interest (see ./test/testData/testPools)
let testFiles = [
    'elementFinanceTest1',
    'elementFinanceTest2',
    'elementFinanceTest3',
    'elementFinanceTest4',
];

// npx mocha -r ts-node/register test/elementPools.spec.ts
describe(`Tests for Element Pools.`, () => {
    it(`swapExactIn Direct Pool`, async () => {
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

        let swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt
        );

        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });

    it(`swapExactOut Direct Pool`, async () => {
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

        let swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt
        );

        // TO DO - Once Element Maths is finalised add real value check
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
    });
});
