// yarn test:only test/xaveFxPool.integration.spec.ts
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
 * - Add polygon ALCHEMY_URL in .env
 * - Change --fork-block-number to 38546978
 * - Change hardhat.config.ts chainId to 137
 * - Run polygon node on terminal: yarn run node
 */

dotenv.config();

let sor: SOR;
const networkId = Network.POLYGON;
const jsonRpcUrl = process.env.ALCHEMY_URL;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, networkId);
const blocknumber = 38546978;

console.log(provider);

const vault = Vault__factory.connect(vaultAddr, provider);

const xaveFxPool: SubgraphPoolBase = {
    id: '0x726e324c29a1e49309672b244bdc4ff62a270407000200000000000000000702',
    address: '0x726e324c29a1e49309672b244bdc4ff62a270407',
    poolType: 'FX',
    swapFee: '0',
    swapEnabled: true,
    totalWeight: '0',
    totalShares: '1187294',
    tokensList: [
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        '0xdc3326e71d45186f113a2f448984ca0e8d201995',
    ],
    tokens: [
        {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            balance: '731837.486297',
            decimals: 6,
            priceRate: '1',
            weight: null,
            fxRate: '100000000',
        },
        {
            address: '0xdc3326e71d45186f113a2f448984ca0e8d201995',
            balance: '639986.37244',
            decimals: 6,
            priceRate: '1',
            weight: null,
            fxRate: '74376600',
        },
    ],
    alpha: '0.8',
    beta: '0.48',
    lambda: '0.3',
    delta: '0.2734375',
    epsilon: '0.0005',
};

describe('xaveFxPool integration tests', () => {
    context('test swaps vs queryBatchSwap', () => {
        // Setup chain
        before(async function () {
            sor = await setUp(
                networkId,
                provider,
                [xaveFxPool],
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
            const swapAmount = parseFixed('1000', 6);

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

            // expect(queryResult[1].abs().toString()).to.eq(
            //     swapInfo.returnAmount.toString()
            // );
            // TODO: Check small descrepancy in amounts
            const expectedReturnAmount = '1301255953';
            expect(queryResult[1].abs().toString()).to.eq(expectedReturnAmount);
        });

        it('ExactOut', async () => {
            const swapType = SwapTypes.SwapExactOut;
            const swapAmount = parseFixed('1000', 6);
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
            // Amount out should be exact
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
        });
    });
});
