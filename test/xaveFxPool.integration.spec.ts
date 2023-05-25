// yarn test:only test/xaveFxPool.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { bnum, OldBigNumber, SOR, SubgraphPoolBase, SwapTypes } from '../src';
import { ADDRESSES, Network, vaultAddr } from './testScripts/constants';
import { parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { Vault__factory } from '@balancer-labs/typechain';
import { AddressZero } from '@ethersproject/constants';
import { setUp } from './testScripts/utils';
const debug = require('debug')('xave');

const x = bnum('0.000000000000000001');

debug('x', x.toString());
debug('x', (-x).toString());
/*
 * Testing Notes:
 * - Add infura api key on .env
 * - Run  node on terminal: yarn run node
 */

// accuracy test: https://app.warp.dev/block/bcbBMkR8Da96QHQ2phmHZN

dotenv.config();

let sor: SOR;
const networkId = Network.MAINNET;
const jsonRpcUrl = 'https://mainnet.infura.io/v3/' + process.env.INFURA;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, networkId);
const blocknumber = 16797531;

const inaccuracyLimit = 1e-14;

const vault = Vault__factory.connect(vaultAddr, provider);
const SWAP_AMOUNT_IN_NUMERAIRE = '10';

const xaveFxPoolDAI_USDC_MAINNET: SubgraphPoolBase = {
    id: '0x66bb9d104c55861feb3ec3559433f01f6373c9660002000000000000000003cf',
    address: '0x66bb9d104c55861feb3ec3559433f01f6373c966',
    poolType: 'FX',
    swapFee: '0',
    swapEnabled: true,
    totalWeight: '0',
    totalShares: '361.723192785679497072',
    tokensList: [
        '0x6b175474e89094c44da98b954eedeac495271d0f',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    ],
    tokens: [
        {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            balance: '193.74530569386134952',
            decimals: 18,
            priceRate: '1',
            weight: null,
            token: {
                latestFXPrice: '0.99980000', // roundId 92233720368547774306
            },
        },
        {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            balance: '167.890447',
            decimals: 6,
            priceRate: '1',
            weight: null,
            token: {
                latestFXPrice: '1.00019000', // roundId 36893488147419104088
            },
        },
    ],
    alpha: '0.8',
    beta: '0.42',
    lambda: '0.3',
    delta: '0.3',
    epsilon: '0.0015',
};

describe('xaveFxPool: DAI-USDC integration tests', () => {
    context('test swaps vs queryBatchSwap', () => {
        // Setup chain
        before(async function () {
            sor = await setUp(
                networkId,
                provider,
                [xaveFxPoolDAI_USDC_MAINNET],
                jsonRpcUrl as string,
                blocknumber
            );

            await sor.fetchPools();
        });

        const tokenIn = ADDRESSES[Network.MAINNET].USDC.address;
        const tokenOut = ADDRESSES[Network.MAINNET].DAI.address;

        const funds = {
            sender: AddressZero,
            recipient: AddressZero,
            fromInternalBalance: false,
            toInternalBalance: false,
        };

        it('ExactIn', async () => {
            const swapType = SwapTypes.SwapExactIn;
            // swapAmount is tokenIn, expect tokenOut
            const swapAmount = parseFixed(SWAP_AMOUNT_IN_NUMERAIRE, 6);

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

            // this is a correct test
            expect(queryResult[1].abs().toString()).to.be.eq(
                swapInfo.returnAmount.toString()
            );
        });

        it('ExactOut', async () => {
            const swapType = SwapTypes.SwapExactOut;
            // swapAmount is tokenOut, expect tokenIn
            const swapAmount = parseFixed(SWAP_AMOUNT_IN_NUMERAIRE, 18);
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

            expect(queryResult[0].abs().toString()).to.be.eq(
                swapInfo.returnAmount.toString()
            );
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
        });
    });
});
