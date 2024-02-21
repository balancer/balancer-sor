// yarn test:only test/gyro2V2.integration.spec.ts
import dotenv from 'dotenv';
dotenv.config();

import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { parseFixed } from '@ethersproject/bignumber';
import { AddressZero } from '@ethersproject/constants';
import { Vault__factory } from '@balancer-labs/typechain';

import { SOR, SubgraphPoolBase, SwapTypes } from '../src';
import { ADDRESSES, Network, vaultAddr } from './testScripts/constants';
import { setUp } from './testScripts/utils';

const networkId = Network.MAINNET;
const jsonRpcUrl = process.env.RPC_URL_MAINNET ?? '';
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, networkId);
const blocknumber = 19269440;

const vault = Vault__factory.connect(vaultAddr, provider);

const WETH = ADDRESSES[networkId].WETH;
const wSTETH = ADDRESSES[networkId].wSTETH;

const gyro2V2_WSTETH_WETH: SubgraphPoolBase = {
    id: '0xc6853f0539f7d4926c719326d60bd84a752bbb8f00020000000000000000065e',
    address: '0xc6853f0539f7d4926c719326d60bd84a752bbb8f',
    poolType: 'Gyro2',
    poolTypeVersion: 2,
    swapFee: '0.0001',
    swapEnabled: true,
    totalWeight: '0',
    totalShares: '0.000026367631539116',
    tokensList: [
        '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    ],
    tokens: [
        {
            address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            balance: '0.000005508044603265',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            balance: '0.000019999999999999',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
    ],
    sqrtAlpha: '0.998348636499294268',
    sqrtBeta: '1.001249219725039286',
};

const ROUNDING_ERROR_TOLERANCE = 2; // in wei

describe('gyro2V2: WETH-wSTETH integration tests', () => {
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
            [gyro2V2_WSTETH_WETH],
            jsonRpcUrl as string,
            blocknumber
        );

        await sor.fetchPools();
    });
    context('ExactIn', async () => {
        const swapType = SwapTypes.SwapExactIn;

        it('should return no swaps when above limit', async () => {
            const tokenIn = WETH.address;
            const tokenOut = wSTETH.address;
            const swapAmount = parseFixed('1', WETH.decimals);
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
            const tokenIn = WETH.address;
            const tokenOut = wSTETH.address;
            const swapAmount = parseFixed('0.000000001', WETH.decimals);
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

            expect(queryResult[0].toNumber()).to.be.closeTo(
                swapInfo.swapAmount.toNumber(),
                ROUNDING_ERROR_TOLERANCE
            );
            expect(queryResult[1].toNumber() * -1).to.be.closeTo(
                swapInfo.returnAmount.toNumber(),
                ROUNDING_ERROR_TOLERANCE
            );
        });
        it('LSD > token, getSwaps result should match queryBatchSwap', async () => {
            const tokenIn = wSTETH.address;
            const tokenOut = WETH.address;
            const swapAmount = parseFixed('0.000000001', wSTETH.decimals);
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

            expect(queryResult[0].toNumber()).to.be.closeTo(
                swapInfo.swapAmount.toNumber(),
                ROUNDING_ERROR_TOLERANCE
            );
            expect(queryResult[1].toNumber() * -1).to.be.closeTo(
                swapInfo.returnAmount.toNumber(),
                ROUNDING_ERROR_TOLERANCE
            );
        });
    });

    context('ExactOut', async () => {
        const swapType = SwapTypes.SwapExactOut;

        it('should return no swaps when above limit', async () => {
            const tokenIn = WETH.address;
            const tokenOut = wSTETH.address;
            const swapAmount = parseFixed('1', wSTETH.decimals);
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
            const tokenIn = WETH.address;
            const tokenOut = wSTETH.address;
            const swapAmount = parseFixed('0.000000001', wSTETH.decimals);
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
            expect(queryResult[0].toNumber()).to.be.closeTo(
                swapInfo.returnAmount.toNumber(),
                ROUNDING_ERROR_TOLERANCE
            );
            expect(queryResult[1].toNumber() * -1).to.be.closeTo(
                swapInfo.swapAmount.toNumber(),
                ROUNDING_ERROR_TOLERANCE
            );
        });
        it('LSD > token, getSwaps result should match queryBatchSwap', async () => {
            const tokenIn = wSTETH.address;
            const tokenOut = WETH.address;
            const swapAmount = parseFixed('0.000000001', WETH.decimals);
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
            expect(queryResult[0].toNumber()).to.be.closeTo(
                swapInfo.returnAmount.toNumber(),
                ROUNDING_ERROR_TOLERANCE
            );
            expect(queryResult[1].toNumber() * -1).to.be.closeTo(
                swapInfo.swapAmount.toNumber(),
                ROUNDING_ERROR_TOLERANCE
            );
        });
    });
});
