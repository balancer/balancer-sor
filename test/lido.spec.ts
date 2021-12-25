// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { sorConfigEth } from './lib/constants';
import { MockPoolDataService } from './lib/mockPoolDataService';
import { mockTokenPriceService } from './lib/mockTokenPriceService';
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { AddressZero, WeiPerEther as ONE } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR, SwapInfo, SwapTypes, SubgraphPoolBase } from '../src';
import { Lido, getLidoStaticSwaps, isLidoStableSwap } from '../src/pools/lido';
import { getStEthRate } from '../src/pools/lido';
import { parseFixed } from '@ethersproject/bignumber';

const gasPrice = parseFixed('30', 9);
const maxPools = 4;
const chainId = 1;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const USDC = Lido.USDC[chainId];
const DAI = Lido.DAI[chainId];
const USDT = Lido.USDT[chainId];
const WETH = Lido.WETH[chainId];
const stETH = Lido.stETH[chainId];
const wstETH = Lido.wstETH[chainId];
const poolStaBal = Lido.StaticPools.staBal[chainId];
const poolWethDai = Lido.StaticPools.wethDai[chainId];
const poolLido = Lido.StaticPools.wstEthWeth[chainId];

const {
    pools,
}: {
    pools: SubgraphPoolBase[];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
} = require('./testData/lido/staticPools.json');

// npx mocha -r ts-node/register test/lido.spec.ts
describe(`Tests for Lido USD routes.`, () => {
    /*
    06/08/21 - 
    As initial roll out for Lido, until phantom BPTs are ready, we are using single wstETH/WETH pool.
    Because current SOR doesn't support more than one hop we hard code the following pairs/routes:
    DAI/wstETH: DAI > WETH > wstETH
    USDC/wstETH: USDC > DAI > WETH > wstETH
    USDT/wstETH: USDT > DAI > WETH > wstETH
    */
    context('Non Lido', () => {
        it(`Should return no swaps for in/out not Lido`, async () => {
            const tokenIn = DAI;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);

            const swapInfo: SwapInfo = await getLidoStaticSwaps(
                pools,
                chainId,
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                provider
            );

            expect(swapInfo.swaps.length).to.eq(0);
            expect(swapInfo.tokenAddresses.length).to.eq(0);
            expect(swapInfo.returnAmount.toString()).to.eq('0');
            expect(swapInfo.returnAmountConsideringFees.toString()).to.eq('0');
        });
    });

    context('Handle stETH as input/output', async () => {
        it(`Test for Lido Stable Swap`, () => {
            expect(isLidoStableSwap(chainId, DAI, USDC)).to.be.false;
            expect(isLidoStableSwap(chainId, stETH, AddressZero)).to.be.false;
            expect(isLidoStableSwap(chainId, wstETH, AddressZero)).to.be.false;
            expect(isLidoStableSwap(chainId, stETH, wstETH)).to.be.false;
            expect(isLidoStableSwap(7, DAI, stETH)).to.be.false;
            expect(isLidoStableSwap(chainId, DAI, stETH)).to.be.true;
            expect(isLidoStableSwap(chainId, stETH, USDC)).to.be.true;
            expect(isLidoStableSwap(chainId, USDT, wstETH)).to.be.true;
            expect(isLidoStableSwap(chainId, wstETH, DAI)).to.be.true;
        });

        it(`stETH swap should be same as wstETH with priceRate allowance, SwapExactIn, stETH In`, async () => {
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);
            const priceRate = await getStEthRate(provider, chainId);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfostEth: SwapInfo = await sor.getSwaps(
                stETH,
                DAI,
                swapType,
                swapAmt,
                {
                    gasPrice,
                    maxPools,
                }
            );

            // Not sure why but if we don't make a copy the result gets overwritten by next call.
            const testSwapInfo = cloneDeep(swapInfostEth);

            const swapInfowstEth: SwapInfo = await sor.getSwaps(
                wstETH,
                DAI,
                swapType,
                swapAmt.mul(priceRate).div(ONE),
                {
                    gasPrice,
                    maxPools,
                }
            );

            // Swaps for both should be the same
            expect(testSwapInfo.tokenAddresses).to.deep.eq(
                swapInfowstEth.tokenAddresses
            );
            expect(testSwapInfo.swaps).to.deep.eq(swapInfowstEth.swaps);
            // TokenIn/Out should be original
            expect(testSwapInfo.tokenIn).to.eq(stETH);
            expect(testSwapInfo.tokenOut).to.eq(DAI);
            expect(swapInfowstEth.tokenIn).to.eq(wstETH);
            expect(swapInfowstEth.tokenOut).to.eq(DAI);
            // SwapAmount should be original amount scaled
            expect(testSwapInfo.swapAmount.toString()).to.eq(
                swapAmt.toString()
            );
            // The swapAmountForSwaps for stETH should be using exchangeRate allowance, i.e. same as wstETH amount
            expect(testSwapInfo.swapAmountForSwaps?.toString()).to.eq(
                swapInfowstEth.swapAmount.toString()
            );
            // These should be same as no rate difference
            expect(swapInfowstEth.swapAmount.toString()).to.eq(
                swapInfowstEth.swapAmountForSwaps?.toString()
            );
            // This is pulled from mainnet so needs valid routes - will be 0 if not
            expect(testSwapInfo.returnAmount.toString()).to.eq(
                swapInfowstEth.returnAmount.toString()
            );
            expect(testSwapInfo.returnAmountConsideringFees.toString()).to.eq(
                swapInfowstEth.returnAmountConsideringFees.toString()
            );
            // These should be same as no rate difference
            expect(testSwapInfo.returnAmountFromSwaps?.toString()).to.eq(
                testSwapInfo.returnAmount.toString()
            );
        }).timeout(100000);

        it(`stETH swap should be same as wstETH with priceRate allowance, SwapExactIn, stETH Out`, async () => {
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 6);
            const priceRate = await getStEthRate(provider, chainId);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfostEth: SwapInfo = await sor.getSwaps(
                USDT,
                stETH,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            // Not sure why but if we don't make a copy the result gets overwritten by next call.
            const testSwapInfo = cloneDeep(swapInfostEth);

            const swapInfowstEth: SwapInfo = await sor.getSwaps(
                USDT,
                wstETH,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            // Swaps for both should be same
            expect(testSwapInfo.tokenAddresses).to.deep.eq(
                swapInfowstEth.tokenAddresses
            );
            expect(testSwapInfo.swaps).to.deep.eq(swapInfowstEth.swaps);
            // TokenIn/Out should be original
            expect(testSwapInfo.tokenIn).to.eq(USDT);
            expect(testSwapInfo.tokenOut).to.eq(stETH);
            expect(swapInfowstEth.tokenIn).to.eq(USDT);
            expect(swapInfowstEth.tokenOut).to.eq(wstETH);
            // SwapAmount should be original amount scaled
            expect(testSwapInfo.swapAmount.toString()).to.eq(
                swapAmt.toString()
            );
            // These should be same as no rate difference for input token
            expect(testSwapInfo.swapAmountForSwaps?.toString()).to.eq(
                testSwapInfo.swapAmount.toString()
            );
            // These should be same as no rate difference
            expect(swapInfowstEth.swapAmount.toString()).to.eq(
                swapInfowstEth.swapAmountForSwaps?.toString()
            );
            // This is pulled from mainnet so needs valid routes - will be 0 if not
            // returnAmount for stETH should be using exchangeRate
            expect(testSwapInfo.returnAmount.toString()).to.eq(
                swapInfowstEth.returnAmount.mul(ONE).div(priceRate).toString()
            );
            expect(testSwapInfo.returnAmountConsideringFees.toString()).to.eq(
                swapInfowstEth.returnAmountConsideringFees
                    .mul(ONE)
                    .div(priceRate)
                    .toString()
            );
            // return amounts for swaps should be same
            expect(testSwapInfo.returnAmountFromSwaps?.toString()).to.eq(
                swapInfowstEth.returnAmount.toString()
            );
        }).timeout(100000);

        it(`stETH swap should be same as wstETH with priceRate allowance, SwapExactOut, stETH In`, async () => {
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 18);
            const priceRate = await getStEthRate(provider, chainId);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfostEth: SwapInfo = await sor.getSwaps(
                stETH,
                DAI,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            // Not sure why but if we don't make a copy the result gets overwritten by next call.
            const testSwapInfo = cloneDeep(swapInfostEth);

            const swapInfowstEth: SwapInfo = await sor.getSwaps(
                wstETH,
                DAI,
                swapType,
                swapAmt,
                {
                    gasPrice,
                    maxPools,
                }
            );

            // Swaps for both should be the same
            expect(testSwapInfo.tokenAddresses).to.deep.eq(
                swapInfowstEth.tokenAddresses
            );
            expect(testSwapInfo.swaps).to.deep.eq(swapInfowstEth.swaps);
            // TokenIn/Out should be original
            expect(testSwapInfo.tokenIn).to.eq(stETH);
            expect(testSwapInfo.tokenOut).to.eq(DAI);
            expect(swapInfowstEth.tokenIn).to.eq(wstETH);
            expect(swapInfowstEth.tokenOut).to.eq(DAI);
            // SwapAmount should be original amount scaled
            expect(testSwapInfo.swapAmount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(testSwapInfo.swapAmount.toString()).to.eq(
                swapInfowstEth.swapAmount.toString()
            );
            // The swapAmountForSwaps for both should be same as using DAI with no rate difference
            expect(testSwapInfo.swapAmountForSwaps?.toString()).to.eq(
                testSwapInfo.swapAmount.toString()
            );
            // This is pulled from mainnet so needs valid routes - will be 0 if not
            // returnAmount (amount of input stETH) should be using exchangeRate
            expect(testSwapInfo.returnAmount.toString()).to.eq(
                swapInfowstEth.returnAmount.mul(ONE).div(priceRate).toString()
            );
            expect(testSwapInfo.returnAmountConsideringFees.toString()).to.eq(
                swapInfowstEth.returnAmountConsideringFees
                    .mul(ONE)
                    .div(priceRate)
                    .toString()
            );
        }).timeout(100000);

        it(`stETH swap should be same as wstETH with priceRate allowance, SwapExactOut, stETH Out`, async () => {
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 18);
            const priceRate = await getStEthRate(provider, chainId);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfostEth: SwapInfo = await sor.getSwaps(
                USDT,
                stETH,
                swapType,
                swapAmt,
                {
                    gasPrice,
                    maxPools,
                }
            );

            // Not sure why but if we don't make a copy the result gets overwritten by next call.
            const testSwapInfo = cloneDeep(swapInfostEth);

            const swapInfowstEth: SwapInfo = await sor.getSwaps(
                USDT,
                wstETH,
                swapType,
                swapAmt.mul(priceRate).div(ONE),
                { gasPrice, maxPools }
            );

            // Swaps for both should be same
            expect(testSwapInfo.tokenAddresses).to.deep.eq(
                swapInfowstEth.tokenAddresses
            );
            expect(testSwapInfo.swaps).to.deep.eq(swapInfowstEth.swaps);
            // TokenIn/Out should be original
            expect(testSwapInfo.tokenIn).to.eq(USDT);
            expect(testSwapInfo.tokenOut).to.eq(stETH);
            expect(swapInfowstEth.tokenIn).to.eq(USDT);
            expect(swapInfowstEth.tokenOut).to.eq(wstETH);
            // SwapAmount should be original amount scaled
            expect(testSwapInfo.swapAmount.toString()).to.eq(
                swapAmt.toString()
            );
            // The swapAmountForSwaps for stETH should be using exchangeRate allowance, i.e. same as wstETH amount
            expect(testSwapInfo.swapAmountForSwaps?.toString()).to.eq(
                swapInfowstEth.swapAmount.toString()
            );
            // These should be same as no rate difference
            expect(swapInfowstEth.swapAmount.toString()).to.eq(
                swapInfowstEth.swapAmountForSwaps?.toString()
            );
            // This is pulled from mainnet so needs valid routes - will be 0 if not
            // returnAmount is amount of USDT in so no rate
            expect(testSwapInfo.returnAmount.toString()).to.eq(
                swapInfowstEth.returnAmount.toString()
            );
            expect(testSwapInfo.returnAmountConsideringFees.toString()).to.eq(
                swapInfowstEth.returnAmountConsideringFees.toString()
            );
            // These should be same as no rate difference
            expect(testSwapInfo.returnAmountFromSwaps?.toString()).to.eq(
                testSwapInfo.returnAmount.toString()
            );
        }).timeout(100000);
    }).timeout(100000);

    context('DAI/wstETH', () => {
        it(`SwapExactIn, DAI>wstETH`, async () => {
            const tokenIn = DAI;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([DAI, WETH, wstETH]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(2);
            expect(swapInfo.swaps[0].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('1');
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactOut, DAI>wstETH`, async () => {
            const tokenIn = DAI;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                {
                    gasPrice,
                    maxPools,
                }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([DAI, WETH, wstETH]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(2);
            expect(swapInfo.swaps[0].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('1');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactIn, wstETH>DAI`, async () => {
            const tokenIn = wstETH;
            const tokenOut = DAI;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([wstETH, WETH, DAI]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(2);
            expect(swapInfo.swaps[0].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('1');
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactIn, wstETH>DAI`, async () => {
            const tokenIn = wstETH;
            const tokenOut = DAI;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([wstETH, WETH, DAI]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(2);
            expect(swapInfo.swaps[0].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[1].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('1');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        });
    }).timeout(100000);

    context('USDC/wstETH', () => {
        it(`SwapExactIn, USDC>wstETH`, async () => {
            const tokenIn = USDC;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 6);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([
                USDC,
                DAI,
                WETH,
                wstETH,
            ]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(3);
            expect(swapInfo.swaps[0].poolId).to.eq(poolStaBal);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('1');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[2].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[2].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[2].assetInIndex).to.eq('2');
            expect(swapInfo.swaps[2].assetOutIndex).to.eq('3');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactOut, USDC>wstETH`, async () => {
            const tokenIn = USDC;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([
                USDC,
                DAI,
                WETH,
                wstETH,
            ]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(3);
            expect(swapInfo.swaps[0].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('2');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('3');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[2].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[2].poolId).to.eq(poolStaBal);
            expect(swapInfo.swaps[2].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[2].assetOutIndex).to.eq('1');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactIn, wstETH>USDC`, async () => {
            const tokenIn = wstETH;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([
                wstETH,
                WETH,
                DAI,
                USDC,
            ]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(3);
            expect(swapInfo.swaps[0].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('1');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[2].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[2].poolId).to.eq(poolStaBal);
            expect(swapInfo.swaps[2].assetInIndex).to.eq('2');
            expect(swapInfo.swaps[2].assetOutIndex).to.eq('3');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactOut, wstETH>USDC`, async () => {
            const tokenIn = wstETH;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 6);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([
                wstETH,
                WETH,
                DAI,
                USDC,
            ]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(3);
            expect(swapInfo.swaps[0].poolId).to.eq(poolStaBal);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('2');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('3');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[2].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[2].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[2].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[2].assetOutIndex).to.eq('1');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);
    });

    context('USDT/wstETH', () => {
        it(`SwapExactIn, USDT>wstETH`, async () => {
            const tokenIn = USDT;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 6);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([
                USDT,
                DAI,
                WETH,
                wstETH,
            ]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(3);
            expect(swapInfo.swaps[0].poolId).to.eq(poolStaBal);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('1');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[2].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[2].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[2].assetInIndex).to.eq('2');
            expect(swapInfo.swaps[2].assetOutIndex).to.eq('3');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactOut, USDT>wstETH`, async () => {
            const tokenIn = USDT;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([
                USDT,
                DAI,
                WETH,
                wstETH,
            ]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(3);
            expect(swapInfo.swaps[0].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('2');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('3');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[2].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[2].poolId).to.eq(poolStaBal);
            expect(swapInfo.swaps[2].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[2].assetOutIndex).to.eq('1');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactIn, wstETH>USDT`, async () => {
            const tokenIn = wstETH;
            const tokenOut = USDT;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = parseFixed('1', 18);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );

            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                { gasPrice, maxPools }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([
                wstETH,
                WETH,
                DAI,
                USDT,
            ]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(3);
            expect(swapInfo.swaps[0].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('1');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[2].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[2].poolId).to.eq(poolStaBal);
            expect(swapInfo.swaps[2].assetInIndex).to.eq('2');
            expect(swapInfo.swaps[2].assetOutIndex).to.eq('3');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);

        it(`SwapExactOut, wstETH>USDT`, async () => {
            const tokenIn = wstETH;
            const tokenOut = USDT;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = parseFixed('1', 6);

            const sor = new SOR(
                provider,
                sorConfigEth,
                new MockPoolDataService(pools),
                mockTokenPriceService
            );
            const fetchSuccess = await sor.fetchPools();
            expect(fetchSuccess).to.be.true;

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt,
                {
                    gasPrice,
                    maxPools,
                }
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([
                wstETH,
                WETH,
                DAI,
                USDT,
            ]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(3);
            expect(swapInfo.swaps[0].poolId).to.eq(poolStaBal);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                swapAmt.toString()
            );
            expect(swapInfo.swaps[0].assetInIndex).to.eq('2');
            expect(swapInfo.swaps[0].assetOutIndex).to.eq('3');
            expect(swapInfo.swaps[1].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[1].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[1].assetInIndex).to.eq('1');
            expect(swapInfo.swaps[1].assetOutIndex).to.eq('2');
            expect(swapInfo.swaps[2].amount.toString()).to.eq('0');
            expect(swapInfo.swaps[2].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[2].assetInIndex).to.eq('0');
            expect(swapInfo.swaps[2].assetOutIndex).to.eq('1');
            // This is pulled from mainnet so needs valid routes
            expect(swapInfo.returnAmount.gt(0)).to.be.true;
            expect(swapInfo.returnAmountConsideringFees.gt(0)).to.be.true;
        }).timeout(100000);
    });
});
