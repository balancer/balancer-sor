import { assert, expect } from 'chai';
import { parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { AddressZero } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';

import { formatSwaps } from '../src/formatSwaps';
import { getWrappedInfo, setWrappedInfo } from '../src/wrapInfo';
import { Lido } from '../src/pools/lido';
import { Swap, SwapInfo, SwapTypes, SwapV2 } from '../src/types';
import { bnum } from '../src/utils/bignumber';
import testSwaps from './testData/swapsForFormatting.json';
import { BAL, DAI, GUSD, sorConfigEth, USDC, WETH } from './lib/constants';

const marketSp = '7';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// npx mocha -r ts-node/register test/helpers.spec.ts
describe(`Tests for Helpers.`, () => {
    it(`Should format directhop swapExactIn`, () => {
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = BAL.address;
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.directhops;

        const expectedTokenAddresses: string[] = [DAI.address, BAL.address];

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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = GUSD.address;
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.multihops;

        const expectedTokenAddresses: string[] = [
            DAI.address,
            WETH.address,
            GUSD.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = GUSD.address;
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.directandmultihops;

        const expectedTokenAddresses: string[] = [
            DAI.address,
            GUSD.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('1', 18);
        const returnAmountConsideringFees = parseFixed('0.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = BAL.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directhops;

        const expectedTokenAddresses: string[] = [DAI.address, BAL.address];

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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = GUSD.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.multihops;

        const expectedTokenAddresses: string[] = [
            DAI.address,
            WETH.address,
            GUSD.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = GUSD.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directandmultihops;

        const expectedTokenAddresses: string[] = [
            DAI.address,
            GUSD.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 6);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = USDC.address;
        const tokenOut = DAI.address;
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.directhopUSDCIn;

        const expectedTokenAddresses: string[] = [USDC.address, DAI.address];

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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 6);
        const returnAmountConsideringFees = parseFixed('1.9', 6);
        const tokenIn = USDC.address;
        const tokenOut = DAI.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directhopUSDCIn;

        const expectedTokenAddresses: string[] = [USDC.address, DAI.address];

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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 6);
        const returnAmountConsideringFees = parseFixed('1.9', 6);
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.directhopUSDCOut;

        const expectedTokenAddresses: string[] = [DAI.address, USDC.address];

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
        const swapAmount = parseFixed('1', 6);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directhopUSDCOut;

        const expectedTokenAddresses: string[] = [DAI.address, USDC.address];

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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = [];

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
        const swapAmount = parseFixed('1', 6);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directhopUSDCOut;

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

        expect(swapInfo.marketSp.toString()).to.be.eq(marketSp);
    });

    it(`Should format directhop swapExactIn for Weth In, no Eth Wrap`, () => {
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = WETH.address;
        const tokenOut = BAL.address;
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.directhopsWethIn;

        const expectedTokenAddresses: string[] = [WETH.address, BAL.address];

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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = WETH.address; // Weth In
        const tokenOut = BAL.address;
        const swapType = SwapTypes.SwapExactIn;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: WETH.address,
        };

        const swapsV1Format: Swap[][] = testSwaps.directhopsWethIn;

        const expectedTokenAddresses: string[] = [
            isEthSwap.wethAddress,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = BAL.address;
        const tokenOut = WETH.address; // Weth Out
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.directhopsWethOut;

        const expectedTokenAddresses: string[] = [BAL.address, WETH.address];

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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = BAL.address;
        const tokenOut = WETH.address; // Weth Out
        const swapType = SwapTypes.SwapExactIn;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: WETH.address,
        };

        const swapsV1Format: Swap[][] = testSwaps.directhopsWethOut;

        const expectedTokenAddresses: string[] = [
            BAL.address,
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
        const swapAmount = parseFixed('2', 18);
        const returnAmount = parseFixed('1', 18);
        const returnAmountConsideringFees = parseFixed('0.9', 18);
        const tokenIn = WETH.address;
        const tokenOut = BAL.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directhopsWethIn;

        const expectedTokenAddresses: string[] = [WETH.address, BAL.address];

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
        const swapAmount = parseFixed('2', 18);
        const returnAmount = parseFixed('1', 18);
        const returnAmountConsideringFees = parseFixed('0.9', 18);
        const tokenIn = WETH.address;
        const tokenOut = BAL.address;
        const swapType = SwapTypes.SwapExactOut;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: WETH.address,
        };

        const swapsV1Format: Swap[][] = testSwaps.directhopsWethIn;

        const expectedTokenAddresses: string[] = [
            isEthSwap.wethAddress,
            BAL.address,
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
        const swapAmount = parseFixed('2', 18);
        const returnAmount = parseFixed('1', 18);
        const returnAmountConsideringFees = parseFixed('0.9', 18);
        const tokenIn = BAL.address;
        const tokenOut = WETH.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directhopsWethOut;

        const expectedTokenAddresses: string[] = [BAL.address, WETH.address];

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
        const swapAmount = parseFixed('2', 18);
        const returnAmount = parseFixed('1', 18);
        const returnAmountConsideringFees = parseFixed('0.9', 18);
        const tokenIn = BAL.address;
        const tokenOut = WETH.address;
        const swapType = SwapTypes.SwapExactOut;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: WETH.address,
        };

        const swapsV1Format: Swap[][] = testSwaps.directhopsWethOut;

        const expectedTokenAddresses: string[] = [
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = WETH.address;
        const tokenOut = GUSD.address;
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.directandmultihopsWethIn;

        const expectedTokenAddresses: string[] = [
            WETH.address,
            GUSD.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = WETH.address;
        const tokenOut = GUSD.address;
        const swapType = SwapTypes.SwapExactIn;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: WETH.address,
        };

        const swapsV1Format: Swap[][] = testSwaps.directandmultihopsWethIn;

        const expectedTokenAddresses: string[] = [
            isEthSwap.wethAddress,
            GUSD.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = WETH.address;
        const tokenOut = GUSD.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directandmultihopsWethIn;

        const expectedTokenAddresses: string[] = [
            WETH.address,
            GUSD.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = WETH.address;
        const tokenOut = GUSD.address;
        const swapType = SwapTypes.SwapExactOut;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: WETH.address,
        };

        const swapsV1Format: Swap[][] = testSwaps.directandmultihopsWethIn;

        const expectedTokenAddresses: string[] = [
            isEthSwap.wethAddress,
            GUSD.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = GUSD.address;
        const tokenOut = WETH.address;
        const swapType = SwapTypes.SwapExactIn;

        const swapsV1Format: Swap[][] = testSwaps.directandmultihopsWethOut;

        const expectedTokenAddresses: string[] = [
            GUSD.address,
            WETH.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = GUSD.address;
        const tokenOut = WETH.address;
        const swapType = SwapTypes.SwapExactIn;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: WETH.address,
        };

        const swapsV1Format: Swap[][] = testSwaps.directandmultihopsWethOut;

        const expectedTokenAddresses: string[] = [
            GUSD.address,
            isEthSwap.wethAddress,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = GUSD.address;
        const tokenOut = WETH.address;
        const swapType = SwapTypes.SwapExactOut;

        const swapsV1Format: Swap[][] = testSwaps.directandmultihopsWethOut;

        const expectedTokenAddresses: string[] = [
            GUSD.address,
            WETH.address,
            BAL.address,
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
        const swapAmount = parseFixed('1', 18);
        const returnAmount = parseFixed('2', 18);
        const returnAmountConsideringFees = parseFixed('1.9', 18);
        const tokenIn = GUSD.address;
        const tokenOut = WETH.address;
        const swapType = SwapTypes.SwapExactOut;
        const isEthSwap = {
            isEthSwap: true,
            wethAddress: WETH.address,
        };

        const swapsV1Format: Swap[][] = testSwaps.directandmultihopsWethOut;

        const expectedTokenAddresses: string[] = [
            GUSD.address,
            isEthSwap.wethAddress,
            BAL.address,
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
        //     const tokenIn = DAI.address;
        //     const tokenOut = BAL.address;
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
        //     expect(wrappedInfo.swapAmountForSwaps?.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle ETH token in`, async () => {
        //     const tokenIn = AddressZero;
        //     const tokenOut = BAL.address;
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
        //     expect(wrappedInfo.swapAmountForSwaps?.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle ETH token out`, async () => {
        //     const tokenIn = BAL.address;
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
        //     expect(wrappedInfo.swapAmountForSwaps?.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle stETH token in, SwapExactIn`, async () => {
        //     const chainId = 1;
        //     const tokenIn = Lido.stETH[chainId];
        //     const tokenOut = BAL.address;
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
        //     expect(wrappedInfo.swapAmountForSwaps?.toString()).to.eq(swapAmount.times(rate).dp(18).toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq(rate.toString());
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle stETH token in, SwapExactOut`, async () => {
        //     const chainId = 1;
        //     const tokenIn = Lido.stETH[chainId];
        //     const tokenOut = BAL.address;
        //     const swapAmount = bnum('7.7');
        //     const wrappedInfo = await getWrappedInfo(provider, SwapTypes.SwapExactOut, tokenIn, tokenOut, chainId, swapAmount);

        //     expect(wrappedInfo.tokenIn.wrapType).to.eq(WrapTypes.stETH);
        //     expect(wrappedInfo.tokenIn.addressOriginal).to.eq(tokenIn.toLowerCase());
        //     expect(wrappedInfo.tokenIn.addressForSwaps).to.eq(Lido.wstETH[chainId]);
        //     expect(wrappedInfo.tokenOut.wrapType).to.eq(WrapTypes.None);
        //     expect(wrappedInfo.tokenOut.addressOriginal).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.tokenOut.addressForSwaps).to.eq(tokenOut.toLowerCase());
        //     expect(wrappedInfo.swapAmountOriginal.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.swapAmountForSwaps?.toString()).to.eq(swapAmount.toString());
        //     const rate = await getStEthRate(provider, chainId);
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq(rate.toString());
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq('1');
        // });

        // it(`Should handle stETH token out, SwapExactIn`, async () => {
        //     const chainId = 1;
        //     const tokenIn = BAL.address;
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
        //     expect(wrappedInfo.swapAmountForSwaps?.toString()).to.eq(swapAmount.toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq(rate.toString());
        // });

        // it(`Should handle stETH token out, SwapExactOut`, async () => {
        //     const chainId = 1;
        //     const tokenIn = BAL.address;
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
        //     expect(wrappedInfo.swapAmountForSwaps?.toString()).to.eq(swapAmount.times(rate).dp(18).toString());
        //     expect(wrappedInfo.tokenIn.rate.toString()).to.eq('1');
        //     expect(wrappedInfo.tokenOut.rate.toString()).to.eq(rate.toString());
        // });

        // it(`setWrappedInfo, no swaps`, async () => {
        //     const chainId = 1;
        //     const swapType = SwapTypes.SwapExactIn;
        //     const tokenIn = BAL.address;
        //     const tokenOut = Lido.stETH[chainId];
        //     const swapAmount = bnum(0);

        //     const swapInfo: SwapInfo = {
        //         tokenAddresses: [],
        //         swaps: [],
        //         swapAmount: bnum(0),
        //         swapAmountForSwaps: Zero,
        //         returnAmount: bnum(0),
        //         returnAmountFromSwaps: Zero,
        //         returnAmountConsideringFees: bnum(0),
        //         tokenIn: '',
        //         tokenOut: '',
        //         marketSp: Zero.toString()
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
            const tokenOut = BAL.address;
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [sorConfigEth.weth, BAL.address],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountConsideringFees: returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                tokenIn: sorConfigEth.weth,
                tokenOut: BAL.address,
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                AddressZero,
                BAL.address,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, ETH In, SwapExactOut`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactOut;
            const tokenIn = AddressZero;
            const tokenOut = BAL.address;
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [sorConfigEth.weth, BAL.address],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountConsideringFees: returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                tokenIn: sorConfigEth.weth,
                tokenOut: BAL.address,
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                AddressZero,
                BAL.address,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, ETH Out, SwapExactIn`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactIn;
            const tokenIn = BAL.address;
            const tokenOut = AddressZero;
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [BAL.address, sorConfigEth.weth],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: BAL.address,
                tokenOut: sorConfigEth.weth,
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                BAL.address,
                AddressZero,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, ETH Out, SwapExactOut`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactOut;
            const tokenIn = BAL.address;
            const tokenOut = AddressZero;
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [BAL.address, sorConfigEth.weth],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: BAL.address,
                tokenOut: sorConfigEth.weth,
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                BAL.address,
                AddressZero,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                swapAmount.toString()
            );
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH In, SwapExactIn`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactIn;
            const tokenIn = Lido.stETH[chainId];
            const tokenOut = BAL.address;
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [Lido.wstETH[chainId], BAL.address],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: Lido.wstETH[chainId],
                tokenOut: tokenOut,
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                Lido.wstETH[chainId],
                BAL.address,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            // This should be equivalent amount of wstETH in for swaps
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                wrappedInfo.swapAmountForSwaps.toString()
            );
            // Return amount is in BAL so no conversion
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH In, SwapExactOut`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactOut;
            const tokenIn = Lido.stETH[chainId];
            const tokenOut = BAL.address;
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [Lido.wstETH[chainId], BAL.address],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: Lido.wstETH[chainId],
                tokenOut: tokenOut,
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                Lido.wstETH[chainId],
                BAL.address,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            // BAL is out so should be same
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                swapInfoUpdated.swapAmount.toString()
            );
            // Return amount is in stETH so needs conversion
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.mul(ONE).div(wrappedInfo.tokenIn.rate).toString()
            );
            // Return amount from swaps is original return amount
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH Out, SwapExactIn`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactIn;
            const tokenIn = BAL.address;
            const tokenOut = Lido.stETH[chainId];
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [BAL.address, Lido.wstETH[chainId]],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: tokenIn,
                tokenOut: Lido.wstETH[chainId],
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                BAL.address,
                Lido.wstETH[chainId],
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            // This should equal swap amount as BAL in
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                swapAmount.toString()
            );
            // Return amount is stETH so from swaps will be converted
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount
                    .mul(ONE.toString())
                    .div(wrappedInfo.tokenOut.rate.toString())
                    .toString()
            );
            // Return amount from swaps is original return amount
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });

        it(`setWrappedInfo, stETH Out, SwapExactOut`, async () => {
            const chainId = 1;
            const swapType = SwapTypes.SwapExactOut;
            const tokenIn = BAL.address;
            const tokenOut = Lido.stETH[chainId];
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [BAL.address, Lido.wstETH[chainId]],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: tokenIn,
                tokenOut: Lido.wstETH[chainId],
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                BAL.address,
                Lido.wstETH[chainId],
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            // stETH in so should be exchanged to wstETH
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                bnum(swapAmount.toString())
                    .times(wrappedInfo.tokenOut.rate.toString())
                    .dividedBy(ONE.toString())
                    .dp(0)
                    .toString()
            );
            // Return amount is BAL so no exchange
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps is original return amount
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
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
            const swapAmount = parseFixed('7.7', 18);
            const returnAmount = parseFixed('1.67', 18);

            const swap: SwapV2 = {
                poolId: '0x',
                assetInIndex: 0,
                assetOutIndex: 1,
                amount: '1',
                userData: '0x',
            };

            const swapInfo: SwapInfo = {
                tokenAddresses: [Lido.wstETH[chainId], sorConfigEth.weth],
                swaps: [swap, swap], // Doesn't need valid swaps for this
                swapAmount,
                swapAmountForSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmount,
                returnAmountFromSwaps: Zero, // This isn't set until after setWrappedInfo
                returnAmountConsideringFees: returnAmount,
                tokenIn: Lido.wstETH[chainId],
                tokenOut: sorConfigEth.weth,
                marketSp: Zero.toString(),
            };

            const wrappedInfo = await getWrappedInfo(
                provider,
                swapType,
                tokenIn,
                tokenOut,
                sorConfigEth,
                swapAmount
            );

            const swapInfoUpdated = setWrappedInfo(
                swapInfo,
                swapType,
                wrappedInfo,
                sorConfigEth
            );

            expect(swapInfoUpdated.tokenAddresses).to.deep.eq([
                Lido.wstETH[chainId],
                AddressZero,
            ]);
            expect(swapInfoUpdated.swapAmount.toString()).to.eq(
                swapAmount.toString()
            );
            // This should be equivalent amount of wstETH in for swaps
            expect(swapInfoUpdated.swapAmountForSwaps?.toString()).to.eq(
                wrappedInfo.swapAmountForSwaps.toString()
            );
            // Return amount is in ETH so no conversion
            expect(swapInfoUpdated.returnAmount.toString()).to.eq(
                returnAmount.toString()
            );
            // Return amount from swaps will only be different if token has an exchangeRate
            expect(swapInfoUpdated.returnAmountFromSwaps?.toString()).to.eq(
                returnAmount.toString()
            );
            expect(swapInfoUpdated.tokenIn).to.eq(tokenIn);
            expect(swapInfoUpdated.tokenOut).to.eq(tokenOut);
        });
    });
});
