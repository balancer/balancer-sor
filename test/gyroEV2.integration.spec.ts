// yarn test:only test/gyroEV2.integration.spec.ts
import dotenv from 'dotenv';
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { parseFixed } from '@ethersproject/bignumber';
import { AddressZero } from '@ethersproject/constants';
import { Vault__factory } from '@balancer-labs/typechain';
import { bnum, SOR, SubgraphPoolBase, SwapTypes } from '../src';
import { ADDRESSES, Network, vaultAddr } from './testScripts/constants';
import { setUp } from './testScripts/utils';

dotenv.config();

const networkId = Network.MAINNET;
const jsonRpcUrl = process.env.RPC_URL_MAINNET ?? '';
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, networkId);
const blocknumber = 21766481;

const vault = Vault__factory.connect(vaultAddr, provider);

const gyroEV2PoolWMATIC_stMATIC_POLYGON: SubgraphPoolBase = {
    id: '0x2191df821c198600499aa1f0031b1a7514d7a7d9000200000000000000000639',
    address: '0x2191df821c198600499aa1f0031b1a7514d7a7d9',
    poolType: 'GyroE',
    poolTypeVersion: 2,
    swapFee: '0.0001',
    swapEnabled: true,
    totalWeight: '0',
    totalShares: '20000012.527099771278999999',
    tokensList: [
        '0x83f20f44975d03b1b09e64809b757c47f942beea',
        '0xe07f9d810a48ab5c3c914ba3ca53af14e4491e8a',
    ],
    tokens: [
        {
            address: '0x83f20f44975d03b1b09e64809b757c47f942beea',
            balance: '4432755.239644201',
            decimals: 18,
            priceRate: '1.142769567047935073',
            weight: null,
        },
        {
            address: '0xe07f9d810a48ab5c3c914ba3ca53af14e4491e8a',
            balance: '15174144.625652788',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
    ],
    alpha: '0.998502246630054917',
    beta: '1.0002000400080016',
    c: '0.707106781186547524',
    s: '0.707106781186547524',
    lambda: '4000',
    tauAlphaX: '-0.9486121281309605728951250557427516',
    tauAlphaY: '0.3164411957423527992645129267756733',
    tauBetaX: '0.3714226953311354953759113134564398',
    tauBetaY: '0.9284638826540074399595774740921852',
    u: '0.6600174117310480333872174599495555',
    v: '0.6224525391981801189063339906029102',
    w: '0.3060113434558273200005891385392101',
    z: '-0.28859471639991253843240999485797747',
    dSq: '0.9999999999999999988662409334210612',
};

describe('gyroEV2: WMATIC-stMATIC integration tests', () => {
    let sor: SOR;
    const funds = {
        sender: AddressZero,
        recipient: AddressZero,
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    // Setup chain
    before(async function () {
        sor = await setUp(
            networkId,
            provider,
            [gyroEV2PoolWMATIC_stMATIC_POLYGON],
            jsonRpcUrl as string,
            blocknumber
        );

        await sor.fetchPools();
    });
    context('ExactIn', async () => {
        const swapType = SwapTypes.SwapExactIn;

        it('should return no swaps when above limit', async () => {
            const tokenIn = ADDRESSES[Network.MAINNET].sDAI.address;
            const tokenOut = ADDRESSES[Network.MAINNET].GYD.address;
            const swapAmount = parseFixed('100000000', 18);
            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmount
            );
            expect(swapInfo.swaps.length).to.eq(0);
            expect(swapInfo.returnAmount.toString()).to.eq('0');
        });
        it('token > LSD, getSwaps result should match queryBatchSwap', async () => {
            const tokenIn = ADDRESSES[Network.MAINNET].sDAI.address;
            const tokenOut = ADDRESSES[Network.MAINNET].GYD.address;
            const swapAmount = parseFixed('1603426', 18);
            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmount
            );

            const queryResult = await vault.callStatic.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                funds
            );

            expect(queryResult[0].toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
            expect(bnum(queryResult[1].abs().toString()).toNumber()).to.eq(
                bnum(swapInfo.returnAmount.toString()).toNumber()
            );
        });
        it('LSD > token, getSwaps result should match queryBatchSwap', async () => {
            const tokenIn = ADDRESSES[Network.MAINNET].GYD.address;
            const tokenOut = ADDRESSES[Network.MAINNET].sDAI.address;
            const swapAmount = parseFixed('160342', 18);
            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmount
            );

            const queryResult = await vault.callStatic.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                funds
            );
            expect(queryResult[0].toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
            expect(bnum(queryResult[1].abs().toString()).toNumber()).to.eq(
                bnum(swapInfo.returnAmount.toString()).toNumber()
            );
        });
    });

    context('ExactOut', async () => {
        const swapType = SwapTypes.SwapExactOut;

        it('should return no swaps when above limit', async () => {
            const tokenIn = ADDRESSES[Network.MAINNET].sDAI.address;
            const tokenOut = ADDRESSES[Network.MAINNET].GYD.address;
            const swapAmount = parseFixed('100000000', 18);
            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmount
            );

            expect(swapInfo.swaps.length).to.eq(0);
            expect(swapInfo.returnAmount.toString()).to.eq('0');
        });
        it('token > LSD, getSwaps result should match queryBatchSwap', async () => {
            const tokenIn = ADDRESSES[Network.MAINNET].sDAI.address;
            const tokenOut = ADDRESSES[Network.MAINNET].GYD.address;
            const swapAmount = parseFixed('1603426', 18);
            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmount
            );

            const queryResult = await vault.callStatic.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                funds
            );
            expect(bnum(queryResult[0].abs().toString()).toNumber()).to.eq(
                bnum(swapInfo.returnAmount.toString()).toNumber()
            );
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
        });
        it('LSD > token, getSwaps result should match queryBatchSwap', async () => {
            const tokenIn = ADDRESSES[Network.MAINNET].GYD.address;
            const tokenOut = ADDRESSES[Network.MAINNET].sDAI.address;
            const swapAmount = parseFixed('1603420', 18);
            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmount
            );

            const queryResult = await vault.callStatic.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                funds
            );
            expect(bnum(queryResult[0].abs().toString()).toNumber()).to.eq(
                bnum(swapInfo.returnAmount.toString()).toNumber()
            );
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
        });
    });
});
