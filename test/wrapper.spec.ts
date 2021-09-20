// npx mocha -r ts-node/register test/wrapper.spec.ts
require('dotenv').config();
import { parseFixed } from '@ethersproject/bignumber';
import { AddressZero, Zero } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert, expect } from 'chai';
import { SOR } from '../src';
import {
    SwapInfo,
    SwapTypes,
    PoolFilter,
    SubgraphPoolBase,
} from '../src/types';
import { BigNumber, bnum } from '../src/utils/bignumber';

const WETHADDR = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const gasPrice = parseFixed('30', 9);
const maxPools = 4;
const chainId = 1;
const poolsUrl = `https://ipfs.fleek.co/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;

describe(`Tests for wrapper class.`, () => {
    it(`Should set constructor variables`, () => {
        const sor = new SOR(provider, chainId, poolsUrl);
        assert.equal(provider, sor.provider);
    });

    it(`Should return no swaps when pools not retrieved.`, async () => {
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = Zero;
        const sor = new SOR(provider, chainId, poolsUrl);
        const swaps: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        assert.equal(swaps.swapAmount.toString(), '0');
    });

    it(`should have a valid swap`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(provider, chainId, null, pools);

        const result: boolean = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            {
                gasPrice,
                maxPools,
                poolTypeFilter: PoolFilter.All,
                timestamp: 0,
            }
        );

        assert.isAbove(swapInfo.returnAmount.toNumber(), 0);
        assert.equal(
            swapInfo.returnAmountFromSwaps?.toString(),
            swapInfo.returnAmount.toString()
        );
        assert.isAbove(bnum(swapInfo.swaps[0].amount).toNumber(), 0);
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.toString(),
            `Wrapper should have same amount as helper.`
        );
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapInfo.swapAmountForSwaps?.toString()
        );
    });

    it(`should filter correctly - has trades`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;

        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(provider, chainId, null, pools);

        const result: boolean = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            {
                gasPrice,
                maxPools,
                poolTypeFilter: PoolFilter.Weighted,
                timestamp: 0,
            }
        );

        assert.isAbove(swapInfo.returnAmount.toNumber(), 0);
        assert.isAbove(bnum(swapInfo.swaps[0].amount).toNumber(), 0);
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`should filter correctly - no pools`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;

        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(provider, chainId, null, pools);

        const result: boolean = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            {
                gasPrice,
                maxPools,
                poolTypeFilter: PoolFilter.Stable,
                timestamp: 0,
            }
        );

        assert.equal(swapInfo.returnAmount.toNumber(), 0);
        assert.equal(swapInfo.swaps.length, 0);
        assert.equal(swapInfo.tokenIn, '');
        assert.equal(swapInfo.tokenOut, '');
        assert.equal(swapInfo.swapAmount.toString(), '0');
    });

    it(`should have a valid swap for Eth wrapping`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;

        const tokenIn = AddressZero;
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(provider, chainId, null, pools);

        const result: boolean = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddresses = [
            AddressZero,
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
            swapAmt.toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`compare weth/eth swaps, SwapExactIn, Weth In`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;

        const tokenInWeth = WETHADDR;
        const tokenInEth = AddressZero;
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(provider, chainId, null, pools);

        let result: boolean = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenInEth,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesEth = [
            tokenInEth,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOut,
        ];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenInWeth,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
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
            swapAmt.toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`compare weth/eth swaps, SwapExactIn, Weth Out`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;

        const tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const tokenOutWeth = WETHADDR;
        const tokenOutEth = AddressZero;
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 6);

        const sor = new SOR(provider, chainId, null, pools);

        let result: boolean = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutEth,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesEth = [tokenIn, AddressZero];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutWeth,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
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
            swapAmt.toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`compare weth/eth swaps, SwapExactOut, Weth In`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;
        const tokenInWeth = WETHADDR;
        const tokenInEth = AddressZero;
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt = parseFixed('0.1', 6);

        const sor = new SOR(provider, chainId, null, pools);

        let result: boolean = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenInEth,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesEth = [
            tokenInEth,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            tokenOut,
        ];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenInWeth,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
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
        expect(swapInfo.swapAmount.toString()).to.be.eq(swapAmt.toString());
    });

    it(`compare weth/eth swaps, SwapExactOut, Weth Out`, async () => {
        const poolsFromFile: {
            pools: SubgraphPoolBase[];
        } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
        const pools = poolsFromFile.pools;
        const tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const tokenOutWeth = WETHADDR;
        const tokenOutEth = AddressZero;
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(provider, chainId, null, pools);

        let result: boolean = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutEth,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesEth = [
            tokenIn,
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            AddressZero,
        ];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools([], false);
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutWeth,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
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
            swapAmt.toString(),
            `Wrapper should have same amount as helper.`
        );
    });
});
