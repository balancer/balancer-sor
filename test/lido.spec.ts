require('dotenv').config();
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
    SOR,
    Lido,
    SubGraphPoolsBase,
    SwapInfo,
    SwapTypes,
    bnum,
    scale,
    getLidoStaticSwaps,
    isLidoSwap,
} from '../src';

const gasPrice = bnum('30000000000');
const maxPools = 4;
const chainId = 1;
const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const USDC = Lido.USDC[chainId];
const DAI = Lido.DAI[chainId];
const USDT = Lido.USDT[chainId];
const WETH = Lido.WETH[chainId];
const STETH = Lido.STETH[chainId];
const wstETH = Lido.WSTETHADDR[chainId];
const poolStaBal = Lido.StaticPools.staBal[chainId];
const poolWethDai = Lido.StaticPools.wethDai[chainId];
const poolLido = Lido.StaticPools.wstEthWeth[chainId];

// This doesn't matter as Lido routes should be static
const poolsFromFile: SubGraphPoolsBase = require('./testData/lido/staticPools.json');

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
            const swapAmt = bnum('1');

            const swapInfo: SwapInfo = await getLidoStaticSwaps(
                poolsFromFile,
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
        it(`Test for Lido Swap`, () => {
            expect(isLidoSwap(chainId, DAI, USDC)).to.be.false;
            expect(isLidoSwap(7, DAI, STETH)).to.be.false;
            expect(isLidoSwap(chainId, DAI, STETH)).to.be.true;
            expect(isLidoSwap(chainId, STETH, USDC)).to.be.true;
            expect(isLidoSwap(chainId, STETH, wstETH)).to.be.true;
            expect(isLidoSwap(chainId, USDT, wstETH)).to.be.true;
            expect(isLidoSwap(chainId, wstETH, DAI)).to.be.true;
        });

        it(`stETH swap should be same as wstETH, stETH In`, async () => {
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfostEth: SwapInfo = await sor.getSwaps(
                STETH,
                DAI,
                swapType,
                swapAmt
            );

            const swapInfowstEth: SwapInfo = await sor.getSwaps(
                wstETH,
                DAI,
                swapType,
                swapAmt
            );

            expect(swapInfostEth.tokenAddresses).to.deep.eq(
                swapInfowstEth.tokenAddresses
            );
            expect(swapInfostEth.swaps).to.deep.eq(swapInfowstEth.swaps);
            // This is pulled from mainnet so needs valid routes
            expect(swapInfostEth.returnAmount.toString()).to.eq(
                swapInfowstEth.returnAmount.toString()
            );
            expect(swapInfostEth.returnAmountConsideringFees.toString()).to.eq(
                swapInfowstEth.returnAmountConsideringFees.toString()
            );
            // TokenIn/Out should be original
            expect(swapInfostEth.tokenIn).to.eq(STETH);
            expect(swapInfostEth.tokenOut).to.eq(DAI);
            expect(swapInfowstEth.tokenIn).to.eq(wstETH);
            expect(swapInfowstEth.tokenOut).to.eq(DAI);
        });

        it(`stETH swap should be same as wstETH, stETH Out`, async () => {
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfostEth: SwapInfo = await sor.getSwaps(
                USDT,
                STETH,
                swapType,
                swapAmt
            );

            const swapInfowstEth: SwapInfo = await sor.getSwaps(
                USDT,
                wstETH,
                swapType,
                swapAmt
            );

            expect(swapInfostEth.tokenAddresses).to.deep.eq(
                swapInfowstEth.tokenAddresses
            );
            expect(swapInfostEth.swaps).to.deep.eq(swapInfowstEth.swaps);
            // This is pulled from mainnet so needs valid routes
            expect(swapInfostEth.returnAmount.toString()).to.eq(
                swapInfowstEth.returnAmount.toString()
            );
            expect(swapInfostEth.returnAmountConsideringFees.toString()).to.eq(
                swapInfowstEth.returnAmountConsideringFees.toString()
            );
            // TokenIn/Out should be original
            expect(swapInfostEth.tokenIn).to.eq(USDT);
            expect(swapInfostEth.tokenOut).to.eq(STETH);
            expect(swapInfowstEth.tokenIn).to.eq(USDT);
            expect(swapInfowstEth.tokenOut).to.eq(wstETH);
        });
    });

    context('DAI/wstETH', () => {
        it(`SwapExactIn, DAI>wstETH`, async () => {
            const tokenIn = DAI;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([DAI, WETH, wstETH]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(2);
            expect(swapInfo.swaps[0].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                scale(swapAmt, 18).toString()
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
        });

        it(`SwapExactOut, DAI>wstETH`, async () => {
            const tokenIn = DAI;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([DAI, WETH, wstETH]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(2);
            expect(swapInfo.swaps[0].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                scale(swapAmt, 18).toString()
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
        });

        it(`SwapExactIn, wstETH>DAI`, async () => {
            const tokenIn = wstETH;
            const tokenOut = DAI;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([wstETH, WETH, DAI]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(2);
            expect(swapInfo.swaps[0].poolId).to.eq(poolLido);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                scale(swapAmt, 18).toString()
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
        });

        it(`SwapExactIn, wstETH>DAI`, async () => {
            const tokenIn = wstETH;
            const tokenOut = DAI;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
            );

            expect(swapInfo.tokenAddresses).to.deep.eq([wstETH, WETH, DAI]);
            expect(swapInfo.tokenIn).to.eq(tokenIn);
            expect(swapInfo.tokenOut).to.eq(tokenOut);
            expect(swapInfo.swaps.length).to.eq(2);
            expect(swapInfo.swaps[0].poolId).to.eq(poolWethDai);
            expect(swapInfo.swaps[0].amount.toString()).to.eq(
                scale(swapAmt, 18).toString()
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
    });

    context('USDC/wstETH', () => {
        it(`SwapExactIn, USDC>wstETH`, async () => {
            const tokenIn = USDC;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
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
                scale(swapAmt, 6).toString()
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
        });

        it(`SwapExactOut, USDC>wstETH`, async () => {
            const tokenIn = USDC;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
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
                scale(swapAmt, 18).toString()
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
        });

        it(`SwapExactIn, wstETH>USDC`, async () => {
            const tokenIn = wstETH;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
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
                scale(swapAmt, 18).toString()
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
        });

        it(`SwapExactOut, wstETH>USDC`, async () => {
            const tokenIn = wstETH;
            const tokenOut = USDC;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
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
                scale(swapAmt, 6).toString()
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
        });
    });

    context('USDT/wstETH', () => {
        it(`SwapExactIn, USDT>wstETH`, async () => {
            const tokenIn = USDT;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
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
                scale(swapAmt, 6).toString()
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
        });

        it(`SwapExactOut, USDT>wstETH`, async () => {
            const tokenIn = USDT;
            const tokenOut = wstETH;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
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
                scale(swapAmt, 18).toString()
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
        });

        it(`SwapExactIn, wstETH>USDT`, async () => {
            const tokenIn = wstETH;
            const tokenOut = USDT;
            const swapType = SwapTypes.SwapExactIn;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
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
                scale(swapAmt, 18).toString()
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
        });

        it(`SwapExactOut, wstETH>USDT`, async () => {
            const tokenIn = wstETH;
            const tokenOut = USDT;
            const swapType = SwapTypes.SwapExactOut;
            const swapAmt = bnum('1');

            const sor = new SOR(
                provider,
                gasPrice,
                maxPools,
                chainId,
                poolsFromFile
            );

            const fetchSuccess = await sor.fetchPools(false);

            const swapInfo: SwapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmt
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
                scale(swapAmt, 6).toString()
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
        });
    });
});
