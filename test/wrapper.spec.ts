// npx mocha -r ts-node/register test/wrapper.spec.ts
require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert, expect } from 'chai';
import { SOR, ZERO_ADDRESS } from '../src';
import {
    SubgraphPoolBase,
    SubGraphPoolsBase,
    SwapInfo,
    SwapTypes,
} from '../src/types';
import { bnum } from '../src/bmath';
import { BigNumber } from '../src/utils/bignumber';

const WETHADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const gasPrice = new BigNumber('30000000000');
const maxPools = 4;
const chainId = 1;
const poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
const swapCost = new BigNumber('100000');

describe(`Tests for wrapper class.`, () => {
    it(`Should set constructor variables`, () => {
        const sor = new SOR(provider, gasPrice, maxPools, chainId, poolsUrl);
        assert.equal(provider, sor.provider);
        assert.equal(gasPrice, sor.gasPrice);
        assert.equal(maxPools, sor.maxPools);
        assert.equal(maxPools, sor.maxPools);
        assert.equal(swapCost.toString(), sor.swapCost.toString());
    });

    it(`Should set pools source to URL`, () => {
        const sor = new SOR(provider, gasPrice, maxPools, chainId, poolsUrl);
        assert.isTrue(sor.isUsingPoolsUrl);
        assert.equal(poolsUrl, sor.poolsUrl);
    });

    it(`Should set pools source to pools passed`, () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );
        assert.isFalse(sor.isUsingPoolsUrl);
        expect(sor.subgraphPools).to.deep.eq(poolsFromFile);
    });

    it(`Should manually set costOutputToken`, () => {
        const tokenOut = `0xba100000625a3754423978a60c9317c58a424e3d`;
        const manualCost = new BigNumber('700000000000');
        const sor = new SOR(provider, gasPrice, maxPools, chainId, poolsUrl);
        sor.setCostOutputToken(tokenOut, 18, manualCost);
        assert.equal(manualCost, sor.tokenCost[tokenOut]);
    });

    it(`Should return correct costOutputToken for ZERO & WETH addresses`, async () => {
        const tokenOut = ZERO_ADDRESS;
        const sor = new SOR(provider, gasPrice, maxPools, chainId, poolsUrl);
        let cost = await sor.setCostOutputToken(tokenOut, 18);
        assert.equal(
            cost.toString(),
            gasPrice
                .times(sor.swapCost)
                .div(bnum(10 ** 18))
                .toString()
        );
        assert.equal(cost.toString(), sor.tokenCost[tokenOut]);
        cost = await sor.setCostOutputToken(WETHADDR, 18);
        assert.equal(
            cost.toString(),
            gasPrice
                .times(sor.swapCost)
                .div(bnum(10 ** 18))
                .toString()
        );
        assert.equal(cost.toString(), sor.tokenCost[WETHADDR]);
    });

    // Valid test but outputs large error
    // it(`Should return false for fetchPools error`, async () => {
    //     const failUrl = ``;
    //     const sor = new SOR(provider, gasPrice, maxPools, chainId, failUrl);
    //     const fetchSuccess = await sor.fetchPools();
    //     assert.isFalse(fetchSuccess);
    //     assert.isFalse(sor.finishedFetchingOnChain);
    // }).timeout(100000);

    it(`fetchPools should fetch with NO scaling`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );
        const fetchSuccess = await sor.fetchPools(false);
        assert.isTrue(fetchSuccess);
        assert.isTrue(sor.finishedFetchingOnChain);
        assert.equal(
            poolsFromFile.pools[1].tokens[1].balance,
            sor.onChainBalanceCache.pools[1].tokens[1].balance
        );
    });

    it(`fetchPools with pools passed as input should overwrite pools`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            JSON.parse(JSON.stringify(poolsFromFile))
        );

        const testPools = require('./testData/filterTestPools.json');
        const newPools: SubGraphPoolsBase = { pools: testPools.stableOnly };

        // Initial cache should be empty
        expect(poolsFromFile).not.deep.equal(newPools);
        expect(newPools).not.deep.equal(sor.onChainBalanceCache);
        expect({ pools: [] }).deep.equal(sor.onChainBalanceCache);

        // First fetch uses data passed as constructor
        let fetchSuccess = await sor.fetchPools(false);
        assert.isTrue(fetchSuccess);
        assert.isTrue(sor.finishedFetchingOnChain);
        expect(poolsFromFile).not.deep.equal(newPools);
        expect(poolsFromFile).deep.equal(sor.onChainBalanceCache);

        // Second fetch uses newPools passed
        fetchSuccess = await sor.fetchPools(false, newPools);
        assert.isTrue(fetchSuccess);
        assert.isTrue(sor.finishedFetchingOnChain);
        expect(poolsFromFile).not.deep.equal(newPools);
        expect(poolsFromFile).not.deep.equal(sor.onChainBalanceCache);
        expect(newPools).deep.equal(sor.onChainBalanceCache);
    });

    it(`Should return no swaps when pools not retrieved.`, async () => {
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt: BigNumber = bnum(0);
        const sor = new SOR(provider, gasPrice, maxPools, chainId, poolsUrl);
        const swaps: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt
        );

        assert.equal(swaps.swapAmount.toString(), '0');
    });

    it(`fetchPools should work with no onChain Balances`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );

        const result: boolean = await sor.fetchPools(false);
        assert.isTrue(result);
        assert.isTrue(sor.finishedFetchingOnChain);
        assert.isAbove(sor.onChainBalanceCache.pools.length, 0);
    });

    it(`should have a valid swap`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt: BigNumber = bnum('0.1');

        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );

        const result: boolean = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt
        );

        assert.isAbove(swapInfo.returnAmount.toNumber(), 0);
        assert.isAbove(bnum(swapInfo.swaps[0].amount).toNumber(), 0);
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.times(bnum(10 ** 18)).toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`should have a valid swap for Eth wrapping`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const tokenIn = ZERO_ADDRESS;
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt: BigNumber = bnum('0.1');

        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );

        const result: boolean = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt
        );

        const expectedTokenAddresses = [
            ZERO_ADDRESS,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        ];

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.isAbove(swapInfo.returnAmount.toNumber(), 0);
        assert.isAbove(bnum(swapInfo.swaps[0].amount).toNumber(), 0);
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.times(bnum(10 ** 18)).toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`compare weth/eth swaps, SwapExactIn, Weth In`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const tokenInWeth = WETHADDR;
        const tokenInEth = ZERO_ADDRESS;
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt: BigNumber = bnum('0.1');

        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );

        let result: boolean = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenInEth,
            tokenOut,
            swapType,
            swapAmt
        );

        const expectedTokenAddressesEth = [
            tokenInEth,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOut,
        ];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenInWeth,
            tokenOut,
            swapType,
            swapAmt
        );

        const expectedTokenAddressesWeth = [
            tokenInWeth,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOut,
        ];

        // Swaps/amts, etc should be same. Token list should be different
        expect(expectedTokenAddressesWeth).to.deep.eq(swapInfo.tokenAddresses);
        expect(swapInfoEth.swaps).to.deep.eq(swapInfo.swaps);
        assert.isAbove(swapInfo.returnAmount.toNumber(), 0);
        assert.equal(
            swapInfoEth.returnAmount.toNumber(),
            swapInfo.returnAmount.toNumber()
        );
        assert.isAbove(bnum(swapInfo.swaps[0].amount).toNumber(), 0);
        assert.equal(tokenInWeth, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(tokenInEth, swapInfoEth.tokenIn);
        assert.equal(tokenOut, swapInfoEth.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.times(bnum(10 ** 18)).toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`compare weth/eth swaps, SwapExactIn, Weth Out`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const tokenOutWeth = WETHADDR;
        const tokenOutEth = ZERO_ADDRESS;
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt: BigNumber = bnum('0.1');

        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );

        let result: boolean = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutEth,
            swapType,
            swapAmt
        );

        const expectedTokenAddressesEth = [tokenIn, ZERO_ADDRESS];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutWeth,
            swapType,
            swapAmt
        );

        const expectedTokenAddressesWeth = [tokenIn, WETHADDR];

        // Swaps/amts, etc should be same. Token list should be different
        expect(expectedTokenAddressesWeth).to.deep.eq(swapInfo.tokenAddresses);
        expect(swapInfoEth.swaps).to.deep.eq(swapInfo.swaps);
        assert.isAbove(swapInfo.returnAmount.toNumber(), 0);
        assert.equal(
            swapInfoEth.returnAmount.toNumber(),
            swapInfo.returnAmount.toNumber()
        );
        assert.isAbove(bnum(swapInfo.swaps[0].amount).toNumber(), 0);
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOutWeth, swapInfo.tokenOut);
        assert.equal(tokenIn, swapInfoEth.tokenIn);
        assert.equal(tokenOutEth, swapInfoEth.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.times(bnum(10 ** 6)).toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`compare weth/eth swaps, SwapExactOut, Weth In`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const tokenInWeth = WETHADDR;
        const tokenInEth = ZERO_ADDRESS;
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt: BigNumber = bnum('0.1');

        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );

        let result: boolean = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenInEth,
            tokenOut,
            swapType,
            swapAmt
        );

        const expectedTokenAddressesEth = [
            tokenInEth,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOut,
        ];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenInWeth,
            tokenOut,
            swapType,
            swapAmt
        );

        const expectedTokenAddressesWeth = [
            tokenInWeth,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOut,
        ];

        // Swaps/amts, etc should be same. Token list should be different
        expect(expectedTokenAddressesWeth).to.deep.eq(swapInfo.tokenAddresses);
        expect(swapInfoEth.swaps).to.deep.eq(swapInfo.swaps);
        assert.isAbove(swapInfo.returnAmount.toNumber(), 0);
        assert.equal(
            swapInfoEth.returnAmount.toNumber(),
            swapInfo.returnAmount.toNumber()
        );
        assert.isAbove(bnum(swapInfo.swaps[0].amount).toNumber(), 0);
        assert.equal(tokenInWeth, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(tokenInEth, swapInfoEth.tokenIn);
        assert.equal(tokenOut, swapInfoEth.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.times(bnum(10 ** 6)).toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`compare weth/eth swaps, SwapExactOut, Weth Out`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const tokenOutWeth = WETHADDR;
        const tokenOutEth = ZERO_ADDRESS;
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt: BigNumber = bnum('0.1');

        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );

        let result: boolean = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutEth,
            swapType,
            swapAmt
        );

        const expectedTokenAddressesEth = [
            tokenIn,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            ZERO_ADDRESS,
        ];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools(false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutWeth,
            swapType,
            swapAmt
        );

        const expectedTokenAddressesWeth = [
            tokenIn,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            WETHADDR,
        ];

        // Swaps/amts, etc should be same. Token list should be different
        expect(expectedTokenAddressesWeth).to.deep.eq(swapInfo.tokenAddresses);
        expect(swapInfoEth.swaps).to.deep.eq(swapInfo.swaps);
        assert.isAbove(swapInfo.returnAmount.toNumber(), 0);
        assert.equal(
            swapInfoEth.returnAmount.toNumber(),
            swapInfo.returnAmount.toNumber()
        );
        assert.isAbove(bnum(swapInfo.swaps[0].amount).toNumber(), 0);
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOutWeth, swapInfo.tokenOut);
        assert.equal(tokenIn, swapInfoEth.tokenIn);
        assert.equal(tokenOutEth, swapInfoEth.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.times(bnum(10 ** 18)).toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`Should have no cached process data before a swap is called`, () => {
        const sor = new SOR(provider, gasPrice, maxPools, chainId, poolsUrl);
        const cache = sor.processedDataCache;
        expect(cache).to.deep.eq({});
    });

    it(`Should save cached data correctly`, async () => {
        const poolsFromFile: SubGraphPoolsBase = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt: BigNumber = bnum('0.1');

        const sor = new SOR(
            provider,
            gasPrice,
            maxPools,
            chainId,
            poolsFromFile
        );

        const result: boolean = await sor.fetchPools(false);
        assert.isTrue(result);

        let swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt
        );

        let cacheZero =
            sor.processedDataCache[`${tokenIn}${tokenOut}${swapType}0`];
        expect(cacheZero.paths.length).to.be.gt(0);
        let cacheOne =
            sor.processedDataCache[`${tokenIn}${tokenOut}${swapType}1`];
        expect(cacheOne).to.be.undefined;

        swapInfo = await sor.getSwaps(tokenIn, tokenOut, swapType, swapAmt, 1);

        let cacheZeroRepeat =
            sor.processedDataCache[`${tokenIn}${tokenOut}${swapType}0`];
        expect(cacheZero).to.deep.eq(cacheZeroRepeat);
        cacheOne = sor.processedDataCache[`${tokenIn}${tokenOut}${swapType}1`];
        expect(cacheOne.paths.length).to.be.gt(0);
    });
});
