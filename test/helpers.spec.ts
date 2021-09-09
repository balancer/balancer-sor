import { assert, expect } from 'chai';
import { AddressZero } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';

import { formatSwaps } from '../src/formatSwaps';
import { getWrappedInfo, setWrappedInfo } from '../src/wrapInfo';
import { bnum, scale } from '../src';
import { WETHADDR } from '../src/constants';
import { Lido } from '../src/pools/lido';
import { SwapInfo, SwapTypes, SwapV2 } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';
import testSwaps from './testData/swapsForFormatting.json';

const marketSp: BigNumber = new BigNumber(7);

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

const BAL = '0xba100000625a3754423978a60c9317c58a424e3d';

// npx mocha -r ts-node/register test/helpers.spec.ts
describe(`Tests for Helpers.`, () => {
    it(`Should format directhop swapExactIn`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3d';
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.directhops;

        const expectedTokenAddresses: string[] = [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(
            '1900000000000000000',
            swapInfo.returnAmountConsideringFees.toString()
        );
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 0);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '20974642128277575814498');
    });

    it(`Should format multihop swapExactIn`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.multihops;

        const expectedTokenAddresses: string[] = [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 4);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(
            '1900000000000000000',
            swapInfo.returnAmountConsideringFees.toString()
        );
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 1);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[2].assetInIndex, 0);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 3);
        assert.equal(swapInfo.swaps[3].assetInIndex, 3);
        assert.equal(swapInfo.swaps[3].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '0');
        assert.equal(swapInfo.swaps[2].amount, '20974642128277575814498');
        assert.equal(swapInfo.swaps[3].amount, '0');
    });

    it(`Should format direct & multihop swapExactIn`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.directandmultihops;

        const expectedTokenAddresses: string[] = [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(
            '1900000000000000000',
            swapInfo.returnAmountConsideringFees.toString()
        );
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 0);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[2].assetInIndex, 2);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '20974642128277575814498');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should format directhop swapExactOut`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(1);
        const returnAmountConsideringFees = new BigNumber(0.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3d';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.directhops;

        const expectedTokenAddresses: string[] = [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('1000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(
            '900000000000000000',
            swapInfo.returnAmountConsideringFees.toString()
        );
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 0);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '20974642128277575814498');
    });

    it(`Should format multihop swapExactOut`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.multihops;

        const expectedTokenAddresses: string[] = [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 4);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 1);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[1].assetInIndex, 0);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[2].assetInIndex, 3);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[3].assetInIndex, 0);
        assert.equal(swapInfo.swaps[3].assetOutIndex, 3);
        assert.equal(swapInfo.swaps[0].amount, '50388502611813030611'); // '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '0');
        assert.equal(swapInfo.swaps[2].amount, '576855408194315533683'); //'20974642128277575814498');
        assert.equal(swapInfo.swaps[3].amount, '0');
    });

    it(`Should format direct & multihop swapExactOut`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.directandmultihops;

        const expectedTokenAddresses: string[] = [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 2);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[2].assetInIndex, 0);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 2);

        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '576855408194315533683');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should scale 6 decimal token correctly swapExactIn, USDC In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.directhopUSDCIn;

        const expectedTokenAddresses: string[] = [
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            '0x6b175474e89094c44da98b954eedeac495271d0f',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '77777777');
    });

    it(`Should scale 6 decimal token correctly swapExactOut, USDC In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.directhopUSDCIn;

        const expectedTokenAddresses: string[] = [
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            '0x6b175474e89094c44da98b954eedeac495271d0f',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '77777777000000000000');
    });

    it(`Should scale 6 decimal token correctly swapExactIn, USDC Out`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.directhopUSDCOut;

        const expectedTokenAddresses: string[] = [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '77777777000000000000');
    });

    it(`Should scale 6 decimal token correctly swapExactOut, USDC Out`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.directhopUSDCOut;

        const expectedTokenAddresses: string[] = [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '77777777');
    });

    it(`Should handle no swaps case`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = [];

        const expectedTokenAddresses: string[] = [];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 0);
        assert.equal('0', swapInfo.swapAmount.toString());
        assert.equal('0', swapInfo.returnAmount.toString());
        assert.equal('', swapInfo.tokenIn);
        assert.equal('', swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
    });

    it(`Should return marketSp`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = [];

        const expectedTokenAddresses: string[] = [];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        assert.equal(swapInfo.marketSp, marketSp);
    });

    it(`Should format directhop swapExactIn for Weth In, no Eth Wrap`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // Weth In
        const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3d';
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.directhopsWethIn;

        const expectedTokenAddresses: string[] = [
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
    });

    it(`Should format directhop swapExactIn for Eth Wrap, Weth In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // Weth In
        const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3d';
        const swapType = SwapTypes.SwapExactIn;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        };

        const swapsV1Format: any = testSwaps.directhopsWethIn;

        const expectedTokenAddresses: string[] = [
            isEthSwap.wethAddress,
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
    });

    it(`Should format directhop swapExactIn for Weth Out, no Eth Wrap`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xba100000625a3754423978a60c9317c58a424e3d';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // Weth Out
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.directhopsWethOut;

        const expectedTokenAddresses: string[] = [
            '0xba100000625a3754423978a60c9317c58a424e3d',
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
    });

    it(`Should format directhop swapExactIn for Eth Wrap, Weth Out`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xba100000625a3754423978a60c9317c58a424e3d';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // Weth Out
        const swapType = SwapTypes.SwapExactIn;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        };

        const swapsV1Format: any = testSwaps.directhopsWethOut;

        const expectedTokenAddresses: string[] = [
            '0xba100000625a3754423978a60c9317c58a424e3d',
            isEthSwap.wethAddress,
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
    });

    it(`Should format directhop swapExactOut for No Eth Wrap, Weth In`, () => {
        const swapAmount = new BigNumber(2);
        const returnAmount = new BigNumber(1);
        const returnAmountConsideringFees = new BigNumber(0.9);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3d';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.directhopsWethIn;

        const expectedTokenAddresses: string[] = [
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('2000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('1000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
    });

    it(`Should format directhop swapExactOut for Eth Wrap, Weth In`, () => {
        const swapAmount = new BigNumber(2);
        const returnAmount = new BigNumber(1);
        const returnAmountConsideringFees = new BigNumber(0.9);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3d';
        const swapType = SwapTypes.SwapExactOut;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        };

        const swapsV1Format: any = testSwaps.directhopsWethIn;

        const expectedTokenAddresses: string[] = [
            isEthSwap.wethAddress,
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('2000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('1000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
    });

    it(`Should format directhop swapExactOut for No Eth Wrap, Weth Out`, () => {
        const swapAmount = new BigNumber(2);
        const returnAmount = new BigNumber(1);
        const returnAmountConsideringFees = new BigNumber(0.9);
        const tokenIn = '0xba100000625a3754423978a60c9317c58a424e3d';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.directhopsWethOut;

        const expectedTokenAddresses: string[] = [
            '0xba100000625a3754423978a60c9317c58a424e3d',
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('2000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('1000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
    });

    it(`Should format directhop swapExactOut for Eth Wrap, Weth Out`, () => {
        const swapAmount = new BigNumber(2);
        const returnAmount = new BigNumber(1);
        const returnAmountConsideringFees = new BigNumber(0.9);
        const tokenIn = '0xba100000625a3754423978a60c9317c58a424e3d';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const swapType = SwapTypes.SwapExactOut;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        };

        const swapsV1Format: any = testSwaps.directhopsWethOut;

        const expectedTokenAddresses: string[] = [
            '0xba100000625a3754423978a60c9317c58a424e3d',
            isEthSwap.wethAddress,
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('2000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('1000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
    });

    it(`Should format direct & multihop swapExactIn, No Eth Wrap, Weth In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.directandmultihopsWethIn;

        const expectedTokenAddresses: string[] = [
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 0);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[2].assetInIndex, 2);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '20974642128277575814498');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should format direct & multihop swapExactIn, Eth Wrap, Weth In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = SwapTypes.SwapExactIn;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        };

        const swapsV1Format: any = testSwaps.directandmultihopsWethIn;

        const expectedTokenAddresses: string[] = [
            isEthSwap.wethAddress,
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 0);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[2].assetInIndex, 2);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '20974642128277575814498');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should format direct & multihop swapExactOut, No Eth Wrap, Weth In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.directandmultihopsWethIn;

        const expectedTokenAddresses: string[] = [
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 2);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[2].assetInIndex, 0);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 2);

        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '576855408194315533683');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should format direct & multihop swapExactOut, Eth Wrap, Weth In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = SwapTypes.SwapExactOut;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        };

        const swapsV1Format: any = testSwaps.directandmultihopsWethIn;

        const expectedTokenAddresses: string[] = [
            isEthSwap.wethAddress,
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 2);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[2].assetInIndex, 0);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 2);

        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '576855408194315533683');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should format direct & multihop swapExactIn, No Eth Wrap, Weth In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: any = testSwaps.directandmultihopsWethOut;

        const expectedTokenAddresses: string[] = [
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 0);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[2].assetInIndex, 2);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '20974642128277575814498');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should format direct & multihop swapExactIn, Eth Wrap, Weth Out`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const swapType = SwapTypes.SwapExactIn;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        };

        const swapsV1Format: any = testSwaps.directandmultihopsWethOut;

        const expectedTokenAddresses: string[] = [
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            isEthSwap.wethAddress,
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 0);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 2);
        assert.equal(swapInfo.swaps[2].assetInIndex, 2);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '20974642128277575814498');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should format direct & multihop swapExactOut, No Eth Wrap, Weth Out`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: any = testSwaps.directandmultihopsWethOut;

        const expectedTokenAddresses: string[] = [
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 2);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[2].assetInIndex, 0);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 2);

        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '576855408194315533683');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    it(`Should format direct & multihop swapExactOut, Eth Wrap, Weth Out`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const returnAmountConsideringFees = new BigNumber(1.9);
        const tokenIn = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const tokenOut = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
        const swapType = SwapTypes.SwapExactOut;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        };

        const swapsV1Format: any = testSwaps.directandmultihopsWethOut;

        const expectedTokenAddresses: string[] = [
            '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd',
            isEthSwap.wethAddress,
            '0xba100000625a3754423978a60c9317c58a424e3d',
        ];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            returnAmountConsideringFees,
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].assetInIndex, 0);
        assert.equal(swapInfo.swaps[0].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[1].assetInIndex, 2);
        assert.equal(swapInfo.swaps[1].assetOutIndex, 1);
        assert.equal(swapInfo.swaps[2].assetInIndex, 0);
        assert.equal(swapInfo.swaps[2].assetOutIndex, 2);

        assert.equal(swapInfo.swaps[0].amount, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amount, '576855408194315533683');
        assert.equal(swapInfo.swaps[2].amount, '0');
    });

    context(`Tests for handling tokens with wrapping, i.e. ETH/WETH`, () => {
        // it(`Should handle non-wrapped tokens`, async () => {
        //     const tokenIn = DAI;
        //     const tokenOut = BAL;
        //     const chainId = 1;
        //     const swapAmount = bnum('7.7');
        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactIn, tokenIn, tokenOut, chainId, swapAmount);

        //     expect(wrappedInfo.tokenIn.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenIn.addressOriginal).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenIn.addressForSwaps).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenOut.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenOut.addressOriginal).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.tokenOut.addressForSwaps).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.swapAmountOriginal.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.swapAmountForSwaps.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle ETH token in`, async () => {
        //     const tokenIn = AddressZero;
        //     const tokenOut = BAL;
        //     const chainId = 1;
        //     const swapAmount = bnum('7.7');
        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactIn, tokenIn, tokenOut, chainId, swapAmount);

        //     expect(wrappedInfo.tokenIn.wrapType).to.eq(WrapTypes.ETH);
        //     expect(wrappedInfo.tokenIn.addressOriginal).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenIn.addressForSwaps).to.eq(WETHADDR[chainId].toLowerCase());
        //     expect(wrappedInfo.tokenOut.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenOut.addressOriginal).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.tokenOut.addressForSwaps).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.swapAmountOriginal.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.swapAmountForSwaps.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle ETH token out`, async () => {
        //     const tokenIn = BAL;
        //     const tokenOut = AddressZero;
        //     const chainId = 1;
        //     const swapAmount = bnum('7.7');
        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactIn, tokenIn, tokenOut, chainId, swapAmount);

        //     expect(wrappedInfo.tokenIn.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenIn.addressOriginal).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenIn.addressForSwaps).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenOut.wrapType).to.eq(WrapTypes.ETH);
        //     expect(wrappedInfo.tokenOut.addressOriginal).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.tokenOut.addressForSwaps).to.eq(WETHADDR[chainId].toLowerCase());
        //     expect(wrappedInfo.swapAmountOriginal.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.swapAmountForSwaps.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle stETH token in, SwapExactIn`, async () => {
        //     const chainId = 1;
        //     const tokenIn = Lido.stETH[chainId];
        //     const tokenOut = BAL;
        //     const swapAmount = bnum('7.7');
        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactIn, tokenIn, tokenOut, chainId, swapAmount);

        //     expect(wrappedInfo.tokenIn.wrapType).to.eq(WrapTypes.stETH);
        //     expect(wrappedInfo.tokenIn.addressOriginal).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenIn.addressForSwaps).to.eq(Lido.wstETH[chainId]);
        //     expect(wrappedInfo.tokenOut.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenOut.addressOriginal).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.tokenOut.addressForSwaps).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.swapAmountOriginal.toString()).to.eq(swapAmount.toString());
        //     const rate = await getStEthRate(provider, chainId);
        //     expect(wrappedInfo.swapAmountForSwaps.toString()).to.eq(swapAmount.times(rate).dp(18).toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq(rate.toString());
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle stETH token in, SwapExactOut`, async () => {
        //     const chainId = 1;
        //     const tokenIn = Lido.stETH[chainId];
        //     const tokenOut = BAL;
        //     const swapAmount = bnum('7.7');
        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactOut, tokenIn, tokenOut, chainId, swapAmount);

        //     expect(wrappedInfo.tokenIn.wrapType).to.eq(WrapTypes.stETH);
        //     expect(wrappedInfo.tokenIn.addressOriginal).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenIn.addressForSwaps).to.eq(Lido.wstETH[chainId]);
        //     expect(wrappedInfo.tokenOut.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenOut.addressOriginal).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.tokenOut.addressForSwaps).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.swapAmountOriginal.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.swapAmountForSwaps.toString()).to.eq(swapAmount.toString());
        //     const rate = await getStEthRate(provider, chainId);
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq(rate.toString());
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle stETH token out, SwapExactIn`, async () => {
        //     const chainId = 1;
        //     const tokenIn = BAL;
        //     const tokenOut = Lido.stETH[chainId];
        //     const swapAmount = bnum('7.7');
        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactIn, tokenIn, tokenOut, chainId, swapAmount);

        //     expect(wrappedInfo.tokenIn.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenIn.addressOriginal).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenIn.addressForSwaps).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenOut.wrapType).to.eq(WrapTypes.stETH);
        //     expect(wrappedInfo.tokenOut.addressOriginal).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.tokenOut.addressForSwaps).to.eq(Lido.wstETH[chainId]);
        //     expect(wrappedInfo.swapAmountOriginal.toString()).to.eq(swapAmount.toString());
        //     const rate = await getStEthRate(provider, chainId);
        //     expect(wrappedInfo.swapAmountForSwaps.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq(rate.toString());
        // });

        // it(`Should handle stETH token out, SwapExactOut`, async () => {
        //     const chainId = 1;
        //     const tokenIn = BAL;
        //     const tokenOut = Lido.stETH[chainId];
        //     const swapAmount = bnum('7.7');
        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactOut, tokenIn, tokenOut, chainId, swapAmount);

        //     expect(wrappedInfo.tokenIn.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenIn.addressOriginal).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenIn.addressForSwaps).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenOut.wrapType).to.eq(WrapTypes.stETH);
        //     expect(wrappedInfo.tokenOut.addressOriginal).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.tokenOut.addressForSwaps).to.eq(Lido.wstETH[chainId]);
        //     expect(wrappedInfo.swapAmountOriginal.toString()).to.eq(swapAmount.toString());
        //     const rate = await getStEthRate(provider, chainId);
        //     expect(wrappedInfo.swapAmountForSwaps.toString()).to.eq(swapAmount.times(rate).dp(18).toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq(rate.toString());
        // });

        // it(`setWrappedInfo, no swaps`, async () => {
        //     const chainId = 1;
        //     const swapType = SwapTypes.SwapExactIn;
        //     const tokenIn = BAL;
        //     const tokenOut = Lido.stETH[chainId];
        //     const swapAmount = bnum(0);

        //     const swapInfo: SwapInfo = {
        //         tokenAddresses: [],
        //         swaps: [],
        //         swapAmount: bnum(0),
        //         swapAmountForSwaps: bnum(0),
        //         returnAmount: bnum(0),
        //         returnAmountFromSwaps: bnum(0),
        //         returnAmountConsideringFees: bnum(0),
        //         tokenIn: '',
        //         tokenOut: '',
        //         marketSp: bnum(0)
        //     }

        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactOut, tokenIn, tokenOut, chainId, swapAmount);

        //     const swapInfoUpdated = setWrappedInfo(swapInfo, swapType, wrappedInfo, chainId);

        //     expect(swapInfoUpdated.swapAmount.toString()).be.eq('0');
        //     expect(swapInfoUpdated.swaps.length).be.eq(0);
        // });

        it(`setWrappedInfo, ETH In, SwapExactIn`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactIn;
            const tokenIn = AddressZero;
            const tokenOut = BAL;
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [WETHADDR[chainId], BAL],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountConsideringFees: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                tokenIn: WETHADDR[chainId],
                tokenOut: BAL,
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                AddressZero,
                BAL,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, ETH In, SwapExactOut`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactOut;
            const tokenIn = AddressZero;
            const tokenOut = BAL;
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [WETHADDR[chainId], BAL],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountConsideringFees: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                tokenIn: WETHADDR[chainId],
                tokenOut: BAL,
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                AddressZero,
                BAL,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, ETH Out, SwapExactIn`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactIn;
            const tokenIn = BAL;
            const tokenOut = AddressZero;
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [BAL, WETHADDR[chainId]],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: BAL,
                tokenOut: WETHADDR[chainId],
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                BAL,
                AddressZero,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, ETH Out, SwapExactOut`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactOut;
            const tokenIn = BAL;
            const tokenOut = AddressZero;
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [BAL, WETHADDR[chainId]],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: BAL,
                tokenOut: WETHADDR[chainId],
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                BAL,
                AddressZero,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH In, SwapExactIn`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactIn;
            const tokenIn = Lido.stETH[chainId];
            const tokenOut = BAL;
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [Lido.wstETH[chainId], BAL],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount: swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: Lido.wstETH[chainId],
                tokenOut: tokenOut,
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                Lido.wstETH[chainId],
                BAL,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                scale(swapAmount, 18).toString()
            );
            // This should be equivalent amount of wstETH in for swaps
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                scale(wrappedInfo.swapAmountForSwaps, 18).toString()
            );
            // Return amount is in BAL so no conversion
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH In, SwapExactOut`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactOut;
            const tokenIn = Lido.stETH[chainId];
            const tokenOut = BAL;
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [Lido.wstETH[chainId], BAL],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount: swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: Lido.wstETH[chainId],
                tokenOut: tokenOut,
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                Lido.wstETH[chainId],
                BAL,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            // BAL is out so should be same
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                swapInfoUpdated.swapAmount.toString()
            );
            // Return amount is in stETH so needs conversion
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.div(wrappedInfo.tokenIn.rate).dp(0).toString()
            );
            // Return amount from swaps is original return amount
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH Out, SwapExactIn`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactIn;
            const tokenIn = BAL;
            const tokenOut = Lido.stETH[chainId];
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [BAL, Lido.wstETH[chainId]],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount: swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: tokenIn,
                tokenOut: Lido.wstETH[chainId],
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                BAL,
                Lido.wstETH[chainId],
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            // This should equal swap amount as BAL in
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                swapAmount.toString()
            );
            // Return amount is stETH so from swaps will be converted
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.div(wrappedInfo.tokenOut.rate).dp(0).toString()
            );
            // Return amount from swaps is original return amount
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH Out, SwapExactOut`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactOut;
            const tokenIn = BAL;
            const tokenOut = Lido.stETH[chainId];
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [BAL, Lido.wstETH[chainId]],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount: swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: tokenIn,
                tokenOut: Lido.wstETH[chainId],
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                BAL,
                Lido.wstETH[chainId],
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                scale(swapAmount, 18).toString()
            );
            // stETH in so should be exchanged to wstETH
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                scale(swapAmount.times(wrappedInfo.tokenOut.rate), 18)
                    .dp(0)
                    .toString()
            );
            // Return amount is BAL so no exchange
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps is original return amount
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH > ETH`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactIn;
            const tokenIn = Lido.stETH[chainId];
            const tokenOut = AddressZero;
            const swapAmount = bnum(7.7);
            const returnAmount = bnum(1.67);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [Lido.wstETH[chainId], WETHADDR[chainId]],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount: swapAmount,
                swapAmountForSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmount: returnAmount,
                returnAmountFromSwaps: bnum(0), // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: Lido.wstETH[chainId],
                tokenOut: WETHADDR[chainId],
                marketSp: bnum(0),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                chainId,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                chainId
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                Lido.wstETH[chainId],
                AddressZero,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                scale(swapAmount, 18).toString()
            );
            // This should be equivalent amount of wstETH in for swaps
            expect(swapInfoUpdated.swapAmountForSwaps.toString()).to.eq(
                scale(wrappedInfo.swapAmountForSwaps, 18).toString()
            );
            // Return amount is in ETH so no conversion
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });
    });
});
