import { assert, expect } from 'chai';
import { Swap, SwapInfo } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';
import { formatSwaps } from '../src/helpers';
import testSwaps from './testData/swapsForFormatting.json';

// npx mocha -r ts-node/register test/helpers.spec.ts
describe(`Tests for Helpers.`, () => {
    it(`Should format directhop swapExactIn`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x8b6e6e7b5b3801fed2cafd4b22b8a16c2f2db21a';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactIn';

        const swapsV1Format: Swap[][] = testSwaps.directhops;

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
            returnAmount
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal(swapAmount.toString(), swapInfo.swapAmount.toString());
        assert.equal(returnAmount.toString(), swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[1].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amountIn, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amountIn, '20974642128277575814498');
        assert.equal(swapInfo.swaps[0].amountOut, undefined);
        assert.equal(swapInfo.swaps[1].amountOut, undefined);
    });

    it(`Should format multihop swapExactIn`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x8b6e6e7b5b3801fed2cafd4b22b8a16c2f2db21a';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactIn';

        const swapsV1Format: Swap[][] = testSwaps.multihops;

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
            returnAmount
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 4);
        assert.equal(swapAmount.toString(), swapInfo.swapAmount.toString());
        assert.equal(returnAmount.toString(), swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenInIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenOutIndex, 2);
        assert.equal(swapInfo.swaps[2].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[2].tokenOutIndex, 3);
        assert.equal(swapInfo.swaps[3].tokenInIndex, 3);
        assert.equal(swapInfo.swaps[3].tokenOutIndex, 2);
        assert.equal(swapInfo.swaps[0].amountIn, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amountIn, '50388502611813030611');
        assert.equal(swapInfo.swaps[2].amountIn, '20974642128277575814498');
        assert.equal(swapInfo.swaps[3].amountIn, '576855408194315533683');
        assert.equal(swapInfo.swaps[0].amountOut, undefined);
        assert.equal(swapInfo.swaps[1].amountOut, undefined);
        assert.equal(swapInfo.swaps[2].amountOut, undefined);
        assert.equal(swapInfo.swaps[3].amountOut, undefined);
    });

    it(`Should format direct & multihop swapExactIn`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x8b6e6e7b5b3801fed2cafd4b22b8a16c2f2db21a';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactIn';

        const swapsV1Format: Swap[][] = testSwaps.directandmultihops;

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
            returnAmount
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal(swapAmount.toString(), swapInfo.swapAmount.toString());
        assert.equal(returnAmount.toString(), swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[1].tokenOutIndex, 2);
        assert.equal(swapInfo.swaps[2].tokenInIndex, 2);
        assert.equal(swapInfo.swaps[2].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amountIn, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amountIn, '20974642128277575814498');
        assert.equal(swapInfo.swaps[2].amountIn, '576855408194315533683');
        assert.equal(swapInfo.swaps[0].amountOut, undefined);
        assert.equal(swapInfo.swaps[1].amountOut, undefined);
        assert.equal(swapInfo.swaps[2].amountOut, undefined);
    });

    it(`Should format directhop swapExactOut`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(1);
        const tokenIn = '0x8b6e6e7b5b3801fed2cafd4b22b8a16c2f2db21a';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactOut';

        const swapsV1Format: Swap[][] = testSwaps.directhops;

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
            returnAmount
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal(swapAmount.toString(), swapInfo.swapAmount.toString());
        assert.equal(returnAmount.toString(), swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[1].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amountOut, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amountOut, '20974642128277575814498');
        assert.equal(swapInfo.swaps[0].amountIn, undefined);
        assert.equal(swapInfo.swaps[1].amountIn, undefined);
    });

    it(`Should format multihop swapExactOut`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x8b6e6e7b5b3801fed2cafd4b22b8a16c2f2db21a';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactOut';

        const swapsV1Format: Swap[][] = testSwaps.multihops;

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
            returnAmount
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 4);
        assert.equal(swapAmount.toString(), swapInfo.swapAmount.toString());
        assert.equal(returnAmount.toString(), swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenInIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenOutIndex, 2);
        assert.equal(swapInfo.swaps[2].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[2].tokenOutIndex, 3);
        assert.equal(swapInfo.swaps[3].tokenInIndex, 3);
        assert.equal(swapInfo.swaps[3].tokenOutIndex, 2);
        assert.equal(swapInfo.swaps[0].amountOut, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amountOut, '50388502611813030611');
        assert.equal(swapInfo.swaps[2].amountOut, '20974642128277575814498');
        assert.equal(swapInfo.swaps[3].amountOut, '576855408194315533683');
        assert.equal(swapInfo.swaps[0].amountIn, undefined);
        assert.equal(swapInfo.swaps[1].amountIn, undefined);
        assert.equal(swapInfo.swaps[2].amountIn, undefined);
        assert.equal(swapInfo.swaps[3].amountIn, undefined);
    });

    it(`Should format direct & multihop swapExactOut`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x8b6e6e7b5b3801fed2cafd4b22b8a16c2f2db21a';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactOut';

        const swapsV1Format: Swap[][] = testSwaps.directandmultihops;

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
            returnAmount
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal(swapAmount.toString(), swapInfo.swapAmount.toString());
        assert.equal(returnAmount.toString(), swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[1].tokenOutIndex, 2);
        assert.equal(swapInfo.swaps[2].tokenInIndex, 2);
        assert.equal(swapInfo.swaps[2].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amountOut, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amountOut, '20974642128277575814498');
        assert.equal(swapInfo.swaps[2].amountOut, '576855408194315533683');
        assert.equal(swapInfo.swaps[0].amountIn, undefined);
        assert.equal(swapInfo.swaps[1].amountIn, undefined);
        assert.equal(swapInfo.swaps[2].amountIn, undefined);
    });
});
