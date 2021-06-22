// npx mocha -r ts-node/register test/fullSwaps.spec.ts
require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { assert } from 'chai';
import { SwapTypes, DisabledOptions } from '../src/types';
import BigNumber from 'bignumber.js';
import { getV2Swap } from './lib/testHelpers';
import { compareTest } from './lib/compareHelper';
import { bnum } from '../src/bmath';

const gasPrice = new BigNumber('30000000000');

import subgraphPoolsLarge from './testData/testPools/subgraphPoolsLarge.json';
import testPools from './testData/filterTestPools.json';
import disabledTokens from './testData/disabled-tokens.json';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase();
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();
const ANT = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT lower case
const MKR = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR lower case
const WBTC = '0xe0C9275E44Ea80eF17579d33c55136b7DA269aEb'.toLowerCase();
const MKR2 = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'.toLowerCase();
const yUSD = '0xb2fdd60ad80ca7ba89b9bab3b5336c2601c020b4';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

describe('Tests full swaps against known values', () => {
    it('weighted test pools check', () => {
        assert.equal(
            testPools.weightedOnly.length,
            12,
            'Should be 12 weighted pools'
        );
        assert.equal(
            testPools.stableOnly.length,
            2,
            'Should be 2 stable pools'
        );
    });

    it('Should have no swaps for pair with no routes, ExactIn', async () => {
        const swapAmount = new BigNumber(1);
        const swapType = SwapTypes.SwapExactIn;
        const maxPools = 4;
        const tokenIn = WETH;
        const tokenOut = ANT;
        const costOutputToken = new BigNumber(0);

        const swapInfo = await getV2Swap(
            provider,
            JSON.parse(JSON.stringify(subgraphPoolsLarge)),
            tokenIn,
            tokenOut,
            maxPools,
            swapType,
            swapAmount,
            gasPrice,
            18,
            {
                isOverRide: false,
                disabledTokens: [],
            },
            {
                isOverRide: true,
                overRideCost: costOutputToken,
            }
        );

        assert.equal(swapInfo.swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            swapInfo.returnAmount.toString(),
            '0',
            'Should have 0 amount.'
        );
    }).timeout(10000);

    it('Should have no swaps for pair with no routes, ExactOut', async () => {
        const swapAmount = new BigNumber(1);
        const swapType = SwapTypes.SwapExactOut;
        const maxPools = 4;
        const tokenIn = WETH;
        const tokenOut = ANT;
        const costOutputToken = new BigNumber(0);

        const swapInfo = await getV2Swap(
            provider,
            JSON.parse(JSON.stringify(subgraphPoolsLarge)),
            tokenIn,
            tokenOut,
            maxPools,
            swapType,
            swapAmount,
            gasPrice,
            18,
            {
                isOverRide: false,
                disabledTokens: [],
            },
            {
                isOverRide: true,
                overRideCost: costOutputToken,
            }
        );

        assert.equal(swapInfo.swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            swapInfo.returnAmount.toString(),
            '0',
            'Should have 0 amount.'
        );
    }).timeout(10000);

    it('USDC>MKR, subgraphPoolsLarge.json, swapExactIn', async () => {
        // This was a previous failing case because of a bug.
        const name = 'USDC>MKR, subgraphPoolsLarge.json,  swapExactIn';
        const amountIn = new BigNumber('1000000'); // 1 USDC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = MKR;

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountIn,
            GasPrice: gasPrice,
            SwapAmountDecimals: 6,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(subgraphPoolsLarge.pools)),
            tradeInfo,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [v1SwapData, v2SwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions,
            {
                compareResults: false,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: new BigNumber(0),
                },
            }
        );

        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            v1SwapData.returnAmount.toString(),
            '0.002932410291658511',
            'V1 sanity check.'
        );
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.002932407296944381',
            'V2 sanity check.'
        );
    }).timeout(10000);

    it('should full swap weighted swapExactIn', async () => {
        const name = 'full swap weighted swapExactIn';
        const tokenIn = DAI;
        const tokenOut = USDC;
        const swapType = 'swapExactIn';
        const noPools = 4;
        const swapAmt = new BigNumber('100000000000000000');

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: swapAmt,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 6,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(testPools.weightedOnly)),
            tradeInfo,
        };

        const amountNormalised = testData.tradeInfo.SwapAmount.div(
            bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
        );

        const testSettings = {
            compareResults: true,
            costOutputTokenOveride: { isOverRide: true, overRideCost: bnum(0) },
        };

        const v2SwapData = await getV2Swap(
            provider,
            JSON.parse(JSON.stringify(testData)),
            testData.tradeInfo.TokenIn,
            testData.tradeInfo.TokenOut,
            testData.tradeInfo.NoPools,
            testData.tradeInfo.SwapType,
            amountNormalised,
            testData.tradeInfo.GasPrice,
            testData.tradeInfo.ReturnAmountDecimals,
            disabledOptions,
            testSettings.costOutputTokenOveride
        );

        const total = v2SwapData.returnAmount;
        const swaps = v2SwapData.swaps;
        // The expected test results are from previous version
        assert.equal(total.toString(), '0.100753');
        assert.equal(swaps.length, 2);
        assert.equal(
            swaps[0][0].pool,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(swaps[0][0].tokenIn, DAI);
        assert.equal(swaps[0][0].tokenOut, USDC);
        assert.equal(
            swaps[0][0].swapAmount,
            '0.0898837681429279943294092423005817'
        );
        assert.equal(
            swaps[1][0].pool,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(swaps[1][0].tokenIn, DAI);
        assert.equal(swaps[1][0].tokenOut, USDC);
        assert.equal(
            swaps[1][0].swapAmount,
            '0.0101162318570720056705907576994183'
        );
        // assert.equal(marketSp.toString(), '0.9924950453298881'); // TODO Different method to V1 so find diff result 0.9925374301712606
    }).timeout(10000);

    it('should full swap weighted swapExactOut', async () => {
        const name = 'full swap weighted swapExactOut';
        const tokenIn = DAI;
        const tokenOut = USDC;
        const swapType = 'swapExactOut';
        const noPools = 4;
        const swapAmt = new BigNumber('100000');

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: swapAmt,
            GasPrice: gasPrice,
            SwapAmountDecimals: 6,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(testPools.weightedOnly)),
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions,
            {
                compareResults: true,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: new BigNumber(0),
                },
            }
        );
        const total = v2SwapData.returnAmount;
        const swaps = v2SwapData.swaps;

        // The expected test results are from previous version
        assert.equal(total.toString(), '0.099251606996029317');
        assert.equal(swaps.length, 2);
        assert.equal(
            swaps[0][0].pool,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(swaps[0][0].tokenIn, DAI);
        assert.equal(swaps[0][0].tokenOut, USDC);
        assert.equal(
            swaps[0][0].swapAmount,
            '0.089883596532642998246978787601520525'
        );
        assert.equal(
            swaps[1][0].pool,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(swaps[1][0].tokenIn, DAI);
        assert.equal(swaps[1][0].tokenOut, USDC);
        assert.equal(
            swaps[1][0].swapAmount,
            '0.010116403467357001753021212398479475'
        );
        // assert.equal(marketSp.toString(), '0.9924950453298881'); // TODO Different method to V1 so find diff result 0.9925374301712606
    }).timeout(10000);

    it('should full swap stable swapExactIn', async () => {
        const name = 'full swap stable swapExactIn';
        const tokenIn = DAI;
        const tokenOut = USDC;
        const swapType = 'swapExactIn';
        const noPools = 4;
        const swapAmt = new BigNumber('100000000000000000');

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: swapAmt,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 6,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(testPools.stableOnly)),
            tradeInfo,
        };

        const [v1SwapData, v2SwapData, wrapperSwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions,
            {
                compareResults: true,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: new BigNumber(0),
                },
            }
        );
        const swaps = v2SwapData.swaps;

        // The expected test results are from previous version
        assert.equal(wrapperSwapData.returnAmount.toString(), '100077');
        assert.equal(swaps.length, 1);
        assert.equal(
            swaps[0][0].pool,
            '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'
        );
        assert.equal(swaps[0][0].tokenIn, DAI);
        assert.equal(swaps[0][0].tokenOut, USDC);
        assert.equal(swaps[0][0].swapAmount, swapAmt.div(1e18).toString());
        // assert.equal(marketSp.toString(), '1.000269192445070817');
    }).timeout(10000);

    it('should full swap stable swapExactOut', async () => {
        const name = 'full swap stable swapExactOut';
        const tokenIn = DAI;
        const tokenOut = USDC;
        const swapType = 'swapExactOut';
        const noPools = 4;
        const swapAmt = new BigNumber('100000');

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: swapAmt,
            GasPrice: gasPrice,
            SwapAmountDecimals: 6,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(testPools.stableOnly)),
            tradeInfo,
        };

        const [v1SwapData, v2SwapData, wrapperSwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions,
            {
                compareResults: true,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: new BigNumber(0),
                },
            }
        );
        const total = v2SwapData.returnAmount;
        const swaps = v2SwapData.swaps;

        // The expected test results are from previous version
        assert.equal(
            wrapperSwapData.returnAmount.toString(),
            '99922537274909963'
        );
        assert.equal(swaps.length, 1);
        assert.equal(
            swaps[0][0].pool,
            '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'
        );
        assert.equal(swaps[0][0].tokenIn, DAI);
        assert.equal(swaps[0][0].tokenOut, USDC);
        assert.equal(swaps[0][0].swapAmount, swapAmt.div(1e6).toString());
    }).timeout(10000);

    it('should full swap stable & weighted swapExactIn', async () => {
        const name = 'full swap stable & weighted swapExactIn';
        let testPools = require('./testData/filterTestPools.json');
        let weighted: any = testPools.weightedOnly;
        let allPools: any = testPools.stableOnly.concat(weighted);
        const tokenIn = DAI;
        const tokenOut = USDC;
        const swapType = 'swapExactIn';
        const noPools = 4;
        const swapAmt = new BigNumber('770000000000000000');

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: swapAmt,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 6,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(allPools)),
            tradeInfo,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [v1SwapData, v2SwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions,
            {
                compareResults: false,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: new BigNumber(0),
                },
            }
        );
        const total = v2SwapData.returnAmount;
        const swaps = v2SwapData.swaps;

        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            v1SwapData.returnAmount.toString(),
            '0.775695',
            'V1 sanity check.'
        );
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.775694',
            'V2 sanity check.'
        );

        // The expected test results are from previous version
        assert.equal(total.toString(), '0.775694');
        assert.equal(swaps.length, 2);
        assert.equal(
            swaps[0][0].pool,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(swaps[0][0].tokenIn, DAI);
        assert.equal(swaps[0][0].tokenOut, USDC);
        assert.equal(
            swaps[0][0].swapAmount,
            '0.6922565054733028450722693839594802'
        );
        assert.equal(
            swaps[1][0].pool,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(swaps[1][0].tokenIn, DAI);
        assert.equal(swaps[1][0].tokenOut, USDC);
        assert.equal(
            swaps[1][0].swapAmount,
            '0.0777434945266971549277306160405198'
        );
    }).timeout(10000);

    it('should full swap stable & weighted swapExactOut', async () => {
        const name = 'full swap stable & weighted swapExactOut';
        let testPools = require('./testData/filterTestPools.json');
        let weighted: any = testPools.weightedOnly;
        let allPools: any = testPools.stableOnly.concat(weighted);
        const tokenIn = DAI;
        const tokenOut = USDC;
        const swapType = 'swapExactOut';
        const noPools = 4;
        const swapAmt = new BigNumber('100732100');

        const disabledOptions: DisabledOptions = {
            isOverRide: true,
            disabledTokens: disabledTokens.tokens,
        };

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: swapAmt,
            GasPrice: gasPrice,
            SwapAmountDecimals: 6,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(allPools)),
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            name,
            provider,
            testData,
            disabledOptions,
            {
                compareResults: true,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: new BigNumber(0),
                },
            }
        );
        const total = v2SwapData.returnAmount;
        const swaps = v2SwapData.swaps;

        // The expected test results are from previous version
        assert.equal(total.toString(), '100.601647181094661074');
        assert.equal(swaps.length, 3);
        assert.equal(
            swaps[0][0].pool,
            '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'
        );
        assert.equal(swaps[0][0].tokenIn, DAI);
        assert.equal(swaps[0][0].tokenOut, USDC);
        assert.equal(
            swaps[0][0].swapAmount,
            '82.3648872742060488825550534281238557568302367743795256'
        );
        assert.equal(
            swaps[1][0].pool,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(swaps[1][0].tokenIn, DAI);
        assert.equal(swaps[1][0].tokenOut, USDC);
        assert.equal(
            swaps[1][0].swapAmount,
            '16.5128308714673736601609054311512561552497632256204744'
        );
        assert.equal(
            swaps[2][0].pool,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(swaps[2][0].tokenIn, DAI);
        assert.equal(swaps[2][0].tokenOut, USDC);
        assert.equal(
            swaps[2][0].swapAmount,
            '1.85438185432657745728404114072488808792'
        );
    }).timeout(10000);

    it('WBTC>MKR2, swapExactIn', async () => {
        const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
        const amountIn = new BigNumber(100000); // 0.00100000 WBTC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = WBTC;
        const tokenOut = MKR2;

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountIn,
            GasPrice: gasPrice,
            SwapAmountDecimals: 8,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(allPools.pools)),
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            `WBTC>MKR2, swapExactIn`,
            provider,
            testData
        );

        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 multiswap.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.094899465593600104',
            'Amount should match previous result.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, USDC>yUSD, swapExactIn', async () => {
        const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
        const amountIn = new BigNumber(1000000);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = yUSD;

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountIn,
            GasPrice: gasPrice,
            SwapAmountDecimals: 6,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(allPools.pools)),
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            `USDC>yUSD, swapExactIn`,
            provider,
            testData
        );

        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 multiswap.');
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.962208461003483771',
            'Amount should match previous result.'
        );
    }).timeout(10000);

    it('Full Multihop SOR,  WBTC>MKR2, swapExactOut', async () => {
        const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
        const amountOut = new BigNumber(1000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WBTC;
        const tokenOut = MKR2;

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountOut,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 8,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(allPools.pools)),
            tradeInfo,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [v1SwapData, v2SwapData] = await compareTest(
            `WBTC>MKR2, swapExactOut`,
            provider,
            testData,
            {
                isOverRide: false,
                disabledTokens: [],
            },
            {
                compareResults: false,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: new BigNumber(0),
                },
            }
        );

        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            v1SwapData.returnAmount.toString(),
            '0.00000702',
            'V1 sanity check.'
        );
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.00000703',
            'V2 sanity check.'
        );
        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 multiswap.');
    }).timeout(10000);

    it('Full Multihop SOR, USDC>yUSD, swapExactOut', async () => {
        const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
        const amountOut = new BigNumber(10000000000000000);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = USDC;
        const tokenOut = yUSD;

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountOut,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 6,
        };

        const testData = {
            pools: JSON.parse(JSON.stringify(allPools.pools)),
            tradeInfo,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [v1SwapData, v2SwapData] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            testData,
            {
                isOverRide: false,
                disabledTokens: [],
            },
            {
                compareResults: false,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: new BigNumber(0),
                },
            }
        );
        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            v1SwapData.returnAmount.toString(),
            '0.010393',
            'V1 sanity check.'
        );
        assert.equal(
            v2SwapData.returnAmount.toString(),
            '0.010394',
            'V2 sanity check.'
        );
        assert.equal(v2SwapData.swaps.length, 1, 'Should have 1 multiswap.');
    }).timeout(10000);
});
