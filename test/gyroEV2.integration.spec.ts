// yarn test:only test/gyroEV2.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { bnum, SOR, SubgraphPoolBase, SwapTypes } from '../src';
import { ADDRESSES, Network, vaultAddr } from './testScripts/constants';
import { parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { Vault__factory } from '@balancer-labs/typechain';
import { AddressZero } from '@ethersproject/constants';
import { setUp } from './testScripts/utils';
import { scale } from '../src/utils/bignumber';

/*
 * Testing Notes:
 * - Run  node on terminal: npx hardhat node --tsconfig tsconfig.testing.json --fork https://polygon-rpc.com --fork-block-number 42173266
 */

// accuracy test: https://app.warp.dev/block/bcbBMkR8Da96QHQ2phmHZN

dotenv.config();

let sor: SOR;
const networkId = Network.POLYGON;
const jsonRpcUrl = 'https://polygon-rpc.com';
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, networkId);
const blocknumber = 42173266;

const inaccuracyLimit = 1e-14;

const vault = Vault__factory.connect(vaultAddr, provider);
const SWAP_AMOUNT_IN_NUMERAIRE = '0.1';

const gyroEV2PoolWMATIC_stMATIC_POLYGON: SubgraphPoolBase = {
    id: '0xf0ad209e2e969eaaa8c882aac71f02d8a047d5c2000200000000000000000b49',
    address: '0xf0ad209e2e969eaaa8c882aac71f02d8a047d5c2',
    poolType: 'GyroE',
    swapFee: '0.0002',
    swapEnabled: true,
    totalWeight: '0',
    totalShares: '5.366644050391084161',
    tokensList: [
        '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
        '0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4',
    ],
    tokens: [
        {
            address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
            balance: '1.123393517620917161',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4',
            balance: '3.973745355066743187',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
    ],
    alpha: '0.997',
    beta: '1.00300902708124',
    c: '0.707106781186547524',
    s: '0.707106781186547524',
    lambda: '2000',
    tauAlphaX: '-0.9488255257963911869756698523798861',
    tauAlphaY: '0.3158007625025655333984021158671054',
    tauBetaX: '0.9488255257962740264038592402880117',
    tauBetaY: '0.3158007625029175431284287745394428',
    u: '0.948825525796332605614025003860828',
    v: '0.3158007625027415379053734674832487',
    w: '0.00000000000017600486501332933596912057',
    z: '-0.00000000000005858028590530604587080878',
    dSq: '0.9999999999999999988662409334210612',
};

describe('gyroEV2: WMATIC-stMATIC integration tests', () => {
    context('test swaps vs queryBatchSwap', () => {
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

        const tokenIn = ADDRESSES[Network.POLYGON].WMATIC.address;
        const tokenOut = ADDRESSES[Network.POLYGON].stMATIC.address;

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

            expect(
                bnum(queryResult[1].abs().toString()).toNumber()
            ).to.be.closeTo(
                bnum(swapInfo.returnAmount.toString()).toNumber(),
                scale(bnum(inaccuracyLimit), 18).toNumber()
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

            expect(
                bnum(queryResult[0].abs().toString()).toNumber()
            ).to.be.closeTo(
                bnum(swapInfo.returnAmount.toString()).toNumber(),
                scale(bnum(inaccuracyLimit), 6).toNumber()
            );
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
        });
    });
});
