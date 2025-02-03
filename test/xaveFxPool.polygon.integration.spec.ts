// yarn test:only test/xaveFxPool.polygon.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR, SubgraphPoolBase, SwapTypes } from '../src';
import { ADDRESSES, Network, vaultAddr } from './testScripts/constants';
import { parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { Vault__factory } from '@balancer-labs/typechain';
import { AddressZero } from '@ethersproject/constants';
import { setUp } from './testScripts/utils';

/*
 * Testing Notes:
 * - Add polygon RPC_URL
 * - Change hardhat chain id to 137 when testing
 * - Run node on terminal: yarn run node-polygon
 */

dotenv.config();

let sor: SOR;
const networkId = Network.POLYGON;
const jsonRpcUrl = process.env.RPC_URL_POLYGON;
const rpcUrl = 'http://127.0.0.1:8137';
const provider = new JsonRpcProvider(rpcUrl, networkId);
const blocknumber = 43667355;

const vault = Vault__factory.connect(vaultAddr, provider);
// const SWAP_AMOUNT_IN_NUMERAIRE = '400000';
const SWAP_AMOUNT_IN_NUMERAIRE = '600000';

const xaveFxPoolXSGD_USDC_POLYGON: SubgraphPoolBase = {
    id: '0x726e324c29a1e49309672b244bdc4ff62a270407000200000000000000000702',
    address: '0x726e324c29a1e49309672b244bdc4ff62a270407',
    poolType: 'FX',
    swapFee: '0',
    swapEnabled: true,
    totalWeight: '0',
    totalShares: '1860106.756724251739208277', // subgraph blocknumber 43667355
    tokensList: [
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        '0xdc3326e71d45186f113a2f448984ca0e8d201995',
    ],
    tokens: [
        {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            balance: '640405.311822',
            decimals: 6,
            priceRate: '1',
            weight: null,
            token: {
                latestFXPrice: '0.99997703',
                fxOracleDecimals: 8,
            },
        },
        {
            address: '0xdc3326e71d45186f113a2f448984ca0e8d201995',
            balance: '1533442.592483',
            decimals: 6,
            priceRate: '1',
            weight: null,
            token: {
                latestFXPrice: '0.74226380',
                fxOracleDecimals: 8,
            },
        },
    ],
    alpha: '0.8',
    beta: '0.48',
    lambda: '0.3',
    delta: '0.2734375',
    epsilon: '0.0005',
};

describe.skip('xaveFxPool: DAI-USDC integration (Polygon) tests', () => {
    context('test swaps vs queryBatchSwap', () => {
        // Setup chain
        before(async function () {
            sor = await setUp(
                networkId,
                provider,
                [xaveFxPoolXSGD_USDC_POLYGON],
                jsonRpcUrl as string,
                blocknumber
            );

            await sor.fetchPools();
        });

        const tokenIn = ADDRESSES[Network.POLYGON].USDC.address;
        const tokenOut = ADDRESSES[Network.POLYGON].XSGD.address;

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

            expect(queryResult[1].abs().toString()).to.be.eq(
                swapInfo.returnAmount.toString()
            );
        });

        it('ExactOut', async () => {
            const swapType = SwapTypes.SwapExactOut;
            // swapAmount is tokenOut, expect tokenIn
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

            expect(queryResult[0].abs().toString()).to.be.eq(
                swapInfo.returnAmount.toString()
            );
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
        });
    });
});
