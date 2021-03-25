import { assert, expect } from 'chai';
import { SwapInfo } from '../src/types';
import { BigNumber } from '../src/utils/bignumber';
import { formatSwaps } from '../src/helpers';
import testSwaps from './testData/swapsForFormatting.json';

const marketSp: BigNumber = new BigNumber(7);

// npx mocha -r ts-node/register test/helpers.spec.ts
describe(`Tests for Helpers.`, () => {
    it(`Should format directhop swapExactIn`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3d';
        const swapType = 'swapExactIn';

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
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
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
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactIn';

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
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 4);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
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
        assert.equal(swapInfo.swaps[1].amountIn, '0');
        assert.equal(swapInfo.swaps[2].amountIn, '20974642128277575814498');
        assert.equal(swapInfo.swaps[3].amountIn, '0');
        assert.equal(swapInfo.swaps[0].amountOut, undefined);
        assert.equal(swapInfo.swaps[1].amountOut, undefined);
        assert.equal(swapInfo.swaps[2].amountOut, undefined);
        assert.equal(swapInfo.swaps[3].amountOut, undefined);
    });

    it(`Should format direct & multihop swapExactIn`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactIn';

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
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
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
        assert.equal(swapInfo.swaps[2].amountIn, '0');
        assert.equal(swapInfo.swaps[0].amountOut, undefined);
        assert.equal(swapInfo.swaps[1].amountOut, undefined);
        assert.equal(swapInfo.swaps[2].amountOut, undefined);
    });

    it(`Should format directhop swapExactOut`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(1);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xba100000625a3754423978a60c9317c58a424e3d';
        const swapType = 'swapExactOut';

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
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('1000000000000000000', swapInfo.returnAmount.toString());
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
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactOut';

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
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 4);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 1);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 2);
        assert.equal(swapInfo.swaps[1].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[1].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[2].tokenInIndex, 3);
        assert.equal(swapInfo.swaps[2].tokenOutIndex, 2);
        assert.equal(swapInfo.swaps[3].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[3].tokenOutIndex, 3);
        assert.equal(swapInfo.swaps[0].amountOut, '50388502611813030611'); // '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amountOut, '0');
        assert.equal(swapInfo.swaps[2].amountOut, '576855408194315533683'); //'20974642128277575814498');
        assert.equal(swapInfo.swaps[3].amountOut, '0');
        assert.equal(swapInfo.swaps[0].amountIn, undefined);
        assert.equal(swapInfo.swaps[1].amountIn, undefined);
        assert.equal(swapInfo.swaps[2].amountIn, undefined);
        assert.equal(swapInfo.swaps[3].amountIn, undefined);
    });

    it(`Should format direct & multihop swapExactOut`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd';
        const swapType = 'swapExactOut';

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
            marketSp
        );

        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[1].tokenInIndex, 2);
        assert.equal(swapInfo.swaps[1].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[2].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[2].tokenOutIndex, 2);

        assert.equal(swapInfo.swaps[0].amountOut, '79025357871722424185502');
        assert.equal(swapInfo.swaps[1].amountOut, '576855408194315533683');
        assert.equal(swapInfo.swaps[2].amountOut, '0');
        assert.equal(swapInfo.swaps[0].amountIn, undefined);
        assert.equal(swapInfo.swaps[1].amountIn, undefined);
        assert.equal(swapInfo.swaps[2].amountIn, undefined);
    });

    it(`Should scale 6 decimal token correctly swapExactIn, USDC In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = 'swapExactIn';

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
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amountIn, '77777777');
        assert.equal(swapInfo.swaps[0].amountOut, undefined);
    });

    it(`Should scale 6 decimal token correctly swapExactOut, USDC In`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const tokenOut = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const swapType = 'swapExactOut';

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
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amountOut, '77777777000000000000');
        assert.equal(swapInfo.swaps[0].amountIn, undefined);
    });

    it(`Should scale 6 decimal token correctly swapExactIn, USDC Out`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = 'swapExactIn';

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
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000000000000000', swapInfo.swapAmount.toString());
        assert.equal('2000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amountIn, '77777777000000000000');
        assert.equal(swapInfo.swaps[0].amountOut, undefined);
    });

    it(`Should scale 6 decimal token correctly swapExactOut, USDC Out`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = 'swapExactOut';

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
            marketSp
        );

        assert.equal(swapInfo.swaps.length, 1);
        assert.equal('1000000', swapInfo.swapAmount.toString());
        assert.equal('2000000000000000000', swapInfo.returnAmount.toString());
        assert.equal(tokenIn, swapInfo.tokenIn);
        assert.equal(tokenOut, swapInfo.tokenOut);
        expect(expectedTokenAddresses).to.deep.eq(swapInfo.tokenAddresses);
        assert.equal(swapInfo.swaps[0].tokenInIndex, 0);
        assert.equal(swapInfo.swaps[0].tokenOutIndex, 1);
        assert.equal(swapInfo.swaps[0].amountOut, '77777777');
        assert.equal(swapInfo.swaps[0].amountIn, undefined);
    });

    it(`Should handle no swaps case`, () => {
        const swapAmount = new BigNumber(1);
        const returnAmount = new BigNumber(2);
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = 'swapExactOut';

        const swapsV1Format: any = [];

        const expectedTokenAddresses: string[] = [];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
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
        const tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f';
        const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
        const swapType = 'swapExactOut';

        const swapsV1Format: any = [];

        const expectedTokenAddresses: string[] = [];

        const swapInfo: SwapInfo = formatSwaps(
            swapsV1Format,
            swapType,
            swapAmount,
            tokenIn,
            tokenOut,
            returnAmount,
            marketSp
        );

        assert.equal(swapInfo.marketSp, marketSp);
    });
});
