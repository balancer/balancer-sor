// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/wrapper.spec.ts
import cloneDeep from 'lodash.clonedeep';
import { mockTokenPriceService } from './lib/mockTokenPriceService';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { AddressZero, Zero } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert, expect } from 'chai';
import { SOR } from '../src';
import { SwapInfo, SwapTypes, PoolFilter, SubgraphPoolBase } from '../src';
import { DAI, sorConfigEth, USDC, WETH } from './lib/constants';
import {
    MockPoolDataService,
    mockPoolDataService,
} from './lib/mockPoolDataService';

const subgraphPoolsSmallWithTrade: {
    pools: SubgraphPoolBase[];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
} = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const gasPrice = parseFixed('30', 9);
const maxPools = 4;

describe(`Tests for wrapper class.`, () => {
    it(`Should set constructor variables`, () => {
        const sor = new SOR(
            provider,
            sorConfigEth,
            mockPoolDataService,
            mockTokenPriceService
        );
        assert.equal(provider, sor.provider);
    });

    it(`Should return no swaps when pools not retrieved.`, async () => {
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = DAI.address;
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = Zero;
        const sor = new SOR(
            provider,
            sorConfigEth,
            mockPoolDataService,
            mockTokenPriceService
        );
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
        const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = DAI.address;
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        const result: boolean = await sor.fetchPools();
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

        expect(swapInfo.returnAmount.gt(0)).to.be.true;
        assert.equal(
            swapInfo.returnAmountFromSwaps?.toString(),
            swapInfo.returnAmount.toString()
        );
        expect(BigNumber.from(swapInfo.swaps[0].amount).gt(0)).to.be.true;
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
        const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = DAI.address;
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        const result: boolean = await sor.fetchPools();
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

        expect(swapInfo.returnAmount.gt(0)).to.be.true;
        expect(BigNumber.from(swapInfo.swaps[0].amount).gt(0)).to.be.true;
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(
            swapInfo.swapAmount.toString(),
            swapAmt.toString(),
            `Wrapper should have same amount as helper.`
        );
    });

    it(`should filter correctly - no pools`, async () => {
        const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = DAI.address;
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        const result: boolean = await sor.fetchPools();
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

        expect(swapInfo.returnAmount.eq(0)).to.be.true;
        assert.equal(swapInfo.swaps.length, 0);
        assert.equal(swapInfo.tokenIn, '');
        assert.equal(swapInfo.tokenOut, '');
        assert.equal(swapInfo.swapAmount.toString(), '0');
    });

    // it(`should have a valid swap for Eth wrapping`, async () => {
    //     const poolsFromFile: {
    //         pools: SubgraphPoolBase[];
    //     } = require('./testData/testPools/subgraphPoolsSmallWithTrade.json');
    //     const pools = poolsFromFile.pools;

    //     const tokenIn = AddressZero;
    //     const tokenOut = DAI.address;
    //     const swapType = SwapTypes.SwapExactIn;
    //     const swapAmt = parseFixed('0.1', 18);

    //     const sor = new SOR(provider, chainId, null, pools);

    //     const result: boolean = await sor.fetchPools([], false);
    //     assert.isTrue(result);

    //     const swapInfo: SwapInfo = await sor.getSwaps(
    //         tokenIn,
    //         tokenOut,
    //         swapType,
    //         swapAmt,
    //         { gasPrice, maxPools }
    //     );

    //     const expectedTokenAddresses = [AddressZero, DAI.address];

    //     expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
    //     expect(swapInfo.returnAmount.gt(0)).to.be.true;
    //     expect(BigNumber.from(swapInfo.swaps[0].amount).gt(0)).to.be.true;
    //     assert.equal(tokenIn, swapInfo.tokenIn);
    //     assert.equal(tokenOut, swapInfo.tokenOut);
    //     assert.equal(
    //         swapInfo.swapAmount.toString(),
    //         swapAmt.toString(),
    //         `Wrapper should have same amount as helper.`
    //     );
    // });

    it(`compare weth/eth swaps, SwapExactIn, Weth In`, async () => {
        const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
        const tokenInWeth = WETH.address;
        const tokenInEth = AddressZero;
        const tokenOut = USDC.address;
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        let result: boolean = await sor.fetchPools();
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenInEth,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesEth = [tokenInEth, DAI.address, tokenOut];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools();
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenInWeth,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesWeth = [tokenInWeth, DAI.address, tokenOut];

        // Swaps/amts, etc should be same. Token list should be different
        expect(expectedTokenAddressesWeth).to.deep.eq(swapInfo.tokenAddresses);
        expect(swapInfoEth.swaps).to.deep.eq(swapInfo.swaps);
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
        assert.equal(
            swapInfoEth.returnAmount.toNumber(),
            swapInfo.returnAmount.toNumber()
        );
        expect(BigNumber.from(swapInfo.swaps[0].amount).gt(0)).to.be.true;
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
        const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
        const tokenIn = USDC.address;
        const tokenOutWeth = WETH.address;
        const tokenOutEth = AddressZero;
        const swapType = SwapTypes.SwapExactIn;
        const swapAmt = parseFixed('0.1', 6);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        let result: boolean = await sor.fetchPools();
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

        result = await sor.fetchPools();
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutWeth,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesWeth = [tokenIn, WETH.address];

        // Swaps/amts, etc should be same. Token list should be different
        expect(expectedTokenAddressesWeth).to.deep.eq(swapInfo.tokenAddresses);
        expect(swapInfoEth.swaps).to.deep.eq(swapInfo.swaps);
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
        assert.equal(
            swapInfoEth.returnAmount.toNumber(),
            swapInfo.returnAmount.toNumber()
        );
        expect(BigNumber.from(swapInfo.swaps[0].amount).gt(0)).to.be.true;
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
        const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
        const tokenInWeth = WETH.address;
        const tokenInEth = AddressZero;
        const tokenOut = USDC.address;
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt = parseFixed('0.1', 6);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        let result: boolean = await sor.fetchPools();
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenInEth,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesEth = [tokenInEth, DAI.address, tokenOut];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools();
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenInWeth,
            tokenOut,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesWeth = [tokenInWeth, DAI.address, tokenOut];

        // Swaps/amts, etc should be same. Token list should be different
        expect(expectedTokenAddressesWeth).to.deep.eq(swapInfo.tokenAddresses);
        expect(swapInfoEth.swaps).to.deep.eq(swapInfo.swaps);
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
        assert.equal(
            swapInfoEth.returnAmount.toNumber(),
            swapInfo.returnAmount.toNumber()
        );
        expect(BigNumber.from(swapInfo.swaps[0].amount).gt(0)).to.be.true;
        assert.equal(tokenInWeth, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(tokenInEth, swapInfoEth.tokenIn);
        assert.equal(tokenOut, swapInfoEth.tokenOut);
        expect(swapInfo.swapAmount.toString()).to.be.eq(swapAmt.toString());
    });

    it(`compare weth/eth swaps, SwapExactOut, Weth Out`, async () => {
        const pools = cloneDeep(subgraphPoolsSmallWithTrade.pools);
        const tokenIn = USDC.address;
        const tokenOutWeth = WETH.address;
        const tokenOutEth = AddressZero;
        const swapType = SwapTypes.SwapExactOut;
        const swapAmt = parseFixed('0.1', 18);

        const sor = new SOR(
            provider,
            sorConfigEth,
            new MockPoolDataService(pools),
            mockTokenPriceService
        );

        let result: boolean = await sor.fetchPools();
        assert.isTrue(result);

        const swapInfoEth: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutEth,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesEth = [tokenIn, DAI.address, AddressZero];

        expect(expectedTokenAddressesEth).to.deep.eq(
            swapInfoEth.tokenAddresses
        );

        result = await sor.fetchPools();
        assert.isTrue(result);

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOutWeth,
            swapType,
            swapAmt,
            { gasPrice, maxPools }
        );

        const expectedTokenAddressesWeth = [tokenIn, DAI.address, WETH.address];

        // Swaps/amts, etc should be same. Token list should be different
        expect(expectedTokenAddressesWeth).to.deep.eq(swapInfo.tokenAddresses);
        expect(swapInfoEth.swaps).to.deep.eq(swapInfo.swaps);
        expect(swapInfo.returnAmount.gt(0)).to.be.true;
        assert.equal(
            swapInfoEth.returnAmount.toNumber(),
            swapInfo.returnAmount.toNumber()
        );
        expect(BigNumber.from(swapInfo.swaps[0].amount).gt(0)).to.be.true;
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
