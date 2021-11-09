// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/fullSwaps.spec.ts
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';
import { assert } from 'chai';
import { SwapTypes } from '../src/types';
import { compareTest } from './lib/compareHelper';
import { getFullSwap, ResultParsed, TradeInfo } from './lib/testHelpers';

import subgraphPoolsLarge from './testData/testPools/subgraphPoolsLarge.json';
import testPools from './testData/filterTestPools.json';
import { WETH, DAI, USDC, MKR, WBTC } from './lib/constants';

const ANT = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT lower case
const MKR2 = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'.toLowerCase();
const yUSD = '0xb2fdd60ad80ca7ba89b9bab3b5336c2601c020b4';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

describe('Tests full swaps against known values', () => {
    const gasPrice = parseFixed('30', 9);

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
        const tokenIn = WETH.address;
        const tokenOut = ANT;
        const swapType = SwapTypes.SwapExactIn;
        const returnAmountDecimals = 18;
        const maxPools = 4;
        const swapAmount = parseFixed('1', 18);
        const swapGas = BigNumber.from('100000');
        const costOutputToken = Zero;

        const swapInfo = await getFullSwap(
            cloneDeep(subgraphPoolsLarge.pools),
            tokenIn,
            tokenOut,
            returnAmountDecimals,
            maxPools,
            swapType,
            swapAmount,
            costOutputToken,
            gasPrice,
            provider,
            swapGas
        );

        assert.equal(swapInfo.swaps.length, 0, 'Should have 0 swaps.');
        assert.equal(
            swapInfo.returnAmount.toString(),
            '0',
            'Should have 0 amount.'
        );
    }).timeout(10000);

    it('Should have no swaps for pair with no routes, ExactOut', async () => {
        const tokenIn = WETH.address;
        const tokenOut = ANT;
        const swapType = SwapTypes.SwapExactOut;
        const returnAmountDecimals = 18;
        const maxPools = 4;
        const swapAmount = parseFixed('1', 18);
        const swapGas = BigNumber.from('100000');
        const costOutputToken = Zero;

        const swapInfo = await getFullSwap(
            cloneDeep(subgraphPoolsLarge.pools),
            tokenIn,
            tokenOut,
            returnAmountDecimals,
            maxPools,
            swapType,
            swapAmount,
            costOutputToken,
            gasPrice,
            provider,
            swapGas
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
        const amountIn = parseFixed('1', 6); // 1 USDC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = USDC.address;
        const tokenOut = MKR.address;

        const tradeInfo: TradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: BigNumber.from(amountIn),
            GasPrice: BigNumber.from(gasPrice),
            SwapAmountDecimals: 6,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: cloneDeep(subgraphPoolsLarge.pools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [, swapInfo] = await compareTest(name, provider, testData, {
            compareResults: false,
            costOutputTokenOveride: {
                isOverRide: true,
                overRideCost: Zero,
            },
        });

        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            swapInfo.returnAmount.toString(),
            '2932407280899120',
            'V2 sanity check.'
        );
    }).timeout(10000);

    it('should full swap weighted swapExactIn', async () => {
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = 'swapExactIn';
        const returnAmountDecimals = 6;
        const maxPools = 4;
        const swapAmt = parseFixed('0.1', 18);
        const swapGas = BigNumber.from('100000');
        const costOutputToken = Zero;

        const swapInfo = await getFullSwap(
            cloneDeep(testPools.weightedOnly),
            tokenIn,
            tokenOut,
            returnAmountDecimals,
            maxPools,
            swapType,
            swapAmt,
            costOutputToken,
            gasPrice,
            provider,
            swapGas
        );

        // const swaps = swapInfo.swaps;
        // The expected test results are from previous version
        assert.equal(swapInfo.returnAmount.toString(), '100754');
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal(
            swapInfo.swaps[0].poolId,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[0].amount, '89882277269017451');
        assert.equal(
            swapInfo.swaps[1].poolId,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[1].amount, '10117722730982549');
    }).timeout(10000);

    it('should full swap weighted swapExactOut', async () => {
        const name = 'full swap weighted swapExactOut';
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = 'swapExactOut';
        const noPools = 4;
        const swapAmt = BigNumber.from('100000');

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
            pools: cloneDeep(testPools.weightedOnly),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        const [, swapInfo] = await compareTest(name, provider, testData, {
            compareResults: true,
            costOutputTokenOveride: {
                isOverRide: true,
                overRideCost: Zero,
            },
        });

        // The expected test results are from previous version
        assert.equal(swapInfo.returnAmount.toString(), '99251606996029317');
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal(
            swapInfo.swaps[0].poolId,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[0].amount, '89884');
        assert.equal(
            swapInfo.swaps[1].poolId,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[1].amount, '10116');
        // assert.equal(marketSp.toString(), '0.9924950453298881'); // TODO Different method to V1 so find diff result 0.9925374301712606
    }).timeout(10000);

    it('should full swap stable swapExactIn', async () => {
        const name = 'full swap stable swapExactIn';
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = 'swapExactIn';
        const noPools = 4;
        const swapAmt = parseFixed('0.1', 18);

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
            pools: cloneDeep(testPools.stableOnly),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        const [, swapInfo] = await compareTest(name, provider, testData, {
            compareResults: true,
            costOutputTokenOveride: {
                isOverRide: true,
                overRideCost: Zero,
            },
        });
        // The expected test results are from previous version
        assert.equal(swapInfo.returnAmount.toString(), '100077');
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal(
            swapInfo.swaps[0].poolId,
            '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[0].amount, swapAmt.toString());
        // assert.equal(marketSp.toString(), '1.000269192445070817');
    }).timeout(10000);

    it('should full swap stable swapExactOut', async () => {
        const name = 'full swap stable swapExactOut';
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = 'swapExactOut';
        const noPools = 4;
        const swapAmt = BigNumber.from('100000');

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
            pools: cloneDeep(testPools.stableOnly),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        const [, swapInfo] = await compareTest(name, provider, testData, {
            compareResults: true,
            costOutputTokenOveride: {
                isOverRide: true,
                overRideCost: Zero,
            },
        });
        assert.equal(swapInfo.returnAmount.toString(), '99922470289305282');
        assert.equal(swapInfo.swaps.length, 1);
        assert.equal(
            swapInfo.swaps[0].poolId,
            '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[0].amount, swapAmt.toString());
    }).timeout(10000);

    it('should full swap stable & weighted swapExactIn', async () => {
        const name = 'full swap stable & weighted swapExactIn';
        const testPools = require('./testData/filterTestPools.json');
        const weighted: any = testPools.weightedOnly;
        const allPools: any = testPools.stableOnly.concat(weighted);
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = 'swapExactIn';
        const noPools = 4;
        const swapAmt = parseFixed('0.77', 18);

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
            pools: cloneDeep(allPools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [, swapInfo] = await compareTest(name, provider, testData, {
            compareResults: false,
            costOutputTokenOveride: {
                isOverRide: true,
                overRideCost: Zero,
            },
        });

        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            swapInfo.returnAmount.toString(),
            '775694',
            'V2 sanity check.'
        );

        // The expected test results are from previous version
        assert.equal(swapInfo.returnAmount.toString(), '775694');
        assert.equal(swapInfo.swaps.length, 2);
        assert.equal(
            swapInfo.swaps[0].poolId,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[0].amount, '692168081518784406');
        assert.equal(
            swapInfo.swaps[1].poolId,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[1].amount, '77831918481215594');
    }).timeout(10000);

    it('should full swap stable & weighted swapExactOut', async () => {
        const name = 'full swap stable & weighted swapExactOut';
        const testPools = require('./testData/filterTestPools.json');
        const weighted: any = testPools.weightedOnly;
        const allPools: any = testPools.stableOnly.concat(weighted);
        const tokenIn = DAI.address;
        const tokenOut = USDC.address;
        const swapType = 'swapExactOut';
        const noPools = 4;
        const swapAmt = BigNumber.from('100732100');

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
            pools: cloneDeep(allPools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        const [, swapInfo] = await compareTest(name, provider, testData, {
            compareResults: true,
            costOutputTokenOveride: {
                isOverRide: true,
                overRideCost: Zero,
            },
        });

        assert.equal(swapInfo.returnAmount.toString(), '100601647114105022960');
        assert.equal(swapInfo.swaps.length, 3);
        assert.equal(
            swapInfo.swaps[0].poolId,
            '0x6c3f90f043a72fa612cbac8115ee7e52bde6e490'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[0].amount, '82364889');
        assert.equal(
            swapInfo.swaps[1].poolId,
            '0x75286e183d923a5f52f52be205e358c5c9101b09'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[1].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[1].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[1].amount, '16512830');
        assert.equal(
            swapInfo.swaps[2].poolId,
            '0x57755f7dec33320bca83159c26e93751bfd30fbe'
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[2].assetInIndex],
            DAI.address
        );
        assert.equal(
            swapInfo.tokenAddresses[swapInfo.swaps[2].assetOutIndex],
            USDC.address
        );
        assert.equal(swapInfo.swaps[2].amount, '1854381');
    }).timeout(10000);

    it('WBTC>MKR2, swapExactIn', async () => {
        const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
        const amountIn = parseFixed('0.001', 8); // 0.00100000 WBTC
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = WBTC.address;
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
            pools: cloneDeep(allPools.pools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        const [, swapInfo] = await compareTest(
            `WBTC>MKR2, swapExactIn`,
            provider,
            testData
        );

        assert.equal(swapInfo.swaps.length, 2, 'Should have 1 multiswap.');
        assert.equal(
            swapInfo.returnAmount.toString(),
            '94899465593646237',
            'Amount should match previous result.'
        );
    }).timeout(10000);

    it('Full Multihop SOR, USDC>yUSD, swapExactIn', async () => {
        const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
        const amountIn = parseFixed('1', 6);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = USDC.address;
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
            pools: cloneDeep(allPools.pools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        const [, swapInfo] = await compareTest(
            `USDC>yUSD, swapExactIn`,
            provider,
            testData
        );

        assert.equal(swapInfo.swaps.length, 1, 'Should have 1 multiswap.');
        assert.equal(
            swapInfo.returnAmount.toString(),
            '962208461003483771',
            'Amount should match previous result.'
        );
    }).timeout(10000);

    it('Full Multihop SOR,  WBTC>MKR2, swapExactOut', async () => {
        const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
        const amountOut = parseFixed('0.001', 18);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = WBTC.address;
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
            pools: cloneDeep(allPools.pools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [, swapInfo] = await compareTest(
            `WBTC>MKR2, swapExactOut`,
            provider,
            testData,
            {
                compareResults: false,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: Zero,
                },
            }
        );

        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            swapInfo.returnAmount.toString(),
            '703',
            'V2 sanity check.'
        );
        assert.equal(swapInfo.swaps.length, 2, 'Should have 1 multiswap.');
    }).timeout(10000);

    it('Full Multihop SOR, USDC>yUSD, swapExactOut', async () => {
        const allPools = require('./testData/testPools/subgraphPoolsDecimalsTest.json');
        const amountOut = parseFixed('0.01', 18);
        const swapType = 'swapExactOut';
        const noPools = 4;
        const tokenIn = USDC.address;
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
            pools: cloneDeep(allPools.pools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [, swapInfo] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            testData,
            {
                compareResults: false,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: Zero,
                },
            }
        );
        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            swapInfo.returnAmount.toString(),
            '10394',
            'V2 sanity check.'
        );
        assert.equal(swapInfo.swaps.length, 1, 'Should have 1 multiswap.');
    }).timeout(10000);

    it('Test for swap with 2 decimal token - small amount with no valid swap', async () => {
        /*
        This was a path that was previously causing issues because of GUSD having 2 decimals.
        Before fix the wrapper would return swaps even when return amount was 0.
        */
        const allPools = require('./testData/testPools/gusdBugSinglePath.json');
        const amountOut = parseFixed('0.01', 18);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = '0x04df6e4121c27713ed22341e7c7df330f56f289b';
        const tokenOut = '0xdfcea9088c8a88a76ff74892c1457c17dfeef9c1';

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountOut,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: cloneDeep(allPools.pools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [, swapInfo] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            testData,
            {
                compareResults: false,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: Zero,
                },
            }
        );
        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(swapInfo.returnAmount.toString(), '0', 'V2 sanity check.');
        assert.equal(swapInfo.swaps.length, 0, 'Should have 0 swaps.');
    });

    it('Test for swap with 2 decimal token - route available', async () => {
        /*
        This was a path that was previously causing issues because of GUSD having 2 decimals.
        Before fix the wrapper would return a swap amount of 0 because it was routing a small amount via GUSD that was < two decimals.
        After fix the SOR should consider an alternative viable route with swap amount > 0.
        */
        const allPools = require('./testData/testPools/gusdBug.json');
        const amountOut = parseFixed('0.01', 18);
        const swapType = 'swapExactIn';
        const noPools = 4;
        const tokenIn = '0x04df6e4121c27713ed22341e7c7df330f56f289b';
        const tokenOut = '0xdfcea9088c8a88a76ff74892c1457c17dfeef9c1';

        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: noPools,
            SwapAmount: amountOut,
            GasPrice: gasPrice,
            SwapAmountDecimals: 18,
            ReturnAmountDecimals: 18,
        };

        const testData = {
            pools: cloneDeep(allPools.pools),
            tradeInfo,
            v1Result: {} as ResultParsed,
        };

        // This test has rounding differences between V1 and V2 maths that cause it to fail but has been checked by Fernando
        const [, swapInfo] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            testData,
            {
                compareResults: false,
                costOutputTokenOveride: {
                    isOverRide: true,
                    overRideCost: Zero,
                },
            }
        );
        // These test should highlight any changes in maths that may unexpectedly change result
        assert.equal(
            swapInfo.returnAmount.toString(),
            '268916321535',
            'V2 sanity check.'
        );
        assert.equal(swapInfo.swaps.length, 1, 'Should have 1 swap.');
    });
});
