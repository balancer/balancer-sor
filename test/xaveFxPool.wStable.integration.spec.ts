// yarn test:only test/xaveFxPool.wStable.integration.spec.ts
import dotenv from 'dotenv';
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { AddressZero } from '@ethersproject/constants';
import { Vault__factory } from '@balancer-labs/typechain';

import { SOR, SubgraphPoolBase, SwapTypes } from '../src';

import { ADDRESSES, Network, vaultAddr } from './testScripts/constants';
import { setUp } from './testScripts/utils';

dotenv.config();

let sor: SOR;
const networkId = Network.MAINNET;
const jsonRpcUrl = 'https://mainnet.infura.io/v3/' + process.env.INFURA;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, networkId);
const blocknumber = 17129117;
const gasPrice = BigNumber.from('14000000000');
const maxPools = 4;

const stablePool: SubgraphPoolBase[] = [
    {
        id: '0x79c58f70905f734641735bc61e45c19dd9ad60bc0000000000000000000004e7',
        address: '0x79c58f70905f734641735bc61e45c19dd9ad60bc',
        poolType: 'ComposableStable',
        swapFee: '0.00005',
        totalShares: '7651512.416461224268218705',
        tokens: [
            {
                address: '0x6b175474e89094c44da98b954eedeac495271d0f',
                balance: '2701150.521361511914031515',
                decimals: 18,
                weight: null,
                priceRate: '1',
                token: {
                    latestFXPrice: '0.9999',
                    fxOracleDecimals: 8,
                },
            },
            {
                address: '0x79c58f70905f734641735bc61e45c19dd9ad60bc',
                balance: '2596148429287188.592625712831077281',
                decimals: 18,
                weight: null,
                priceRate: '1',
                token: {
                    latestFXPrice: undefined,
                    fxOracleDecimals: 18,
                },
            },
            {
                address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                balance: '2875806.872139',
                decimals: 6,
                weight: null,
                priceRate: '1',
                token: {
                    latestFXPrice: '1.00012638',
                    fxOracleDecimals: 8,
                },
            },
            {
                address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                balance: '2076136.817258',
                decimals: 6,
                weight: null,
                priceRate: '1',
                token: {
                    latestFXPrice: undefined,
                    fxOracleDecimals: 8,
                },
            },
        ],
        tokensList: [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0x79c58f70905f734641735bc61e45c19dd9ad60bc',
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            '0xdac17f958d2ee523a2206206994597c13d831ec7',
        ],
        totalWeight: '0',
        amp: '2000',
        expiryTime: undefined,
        unitSeconds: undefined,
        principalToken: undefined,
        baseToken: undefined,
        swapEnabled: true,
        wrappedIndex: undefined,
        mainIndex: undefined,
        lowerTarget: undefined,
        upperTarget: undefined,
        sqrtAlpha: undefined,
        sqrtBeta: undefined,
        root3Alpha: undefined,
        alpha: undefined,
        beta: undefined,
        c: undefined,
        s: undefined,
        lambda: undefined,
        delta: undefined,
        epsilon: undefined,
        tauAlphaX: undefined,
        tauAlphaY: undefined,
        tauBetaX: undefined,
        tauBetaY: undefined,
        u: undefined,
        v: undefined,
        w: undefined,
        z: undefined,
        dSq: undefined,
    },
];

const xavePool: SubgraphPoolBase[] = [
    {
        id: '0x66bb9d104c55861feb3ec3559433f01f6373c9660002000000000000000003cf',
        address: '0x66bb9d104c55861feb3ec3559433f01f6373c966',
        poolType: 'FX',
        swapFee: '0',
        totalShares: '361.723192785679497072',
        tokens: [
            {
                address: '0x6b175474e89094c44da98b954eedeac495271d0f',
                balance: '259.784438376175039967',
                decimals: 18,
                weight: null,
                priceRate: '1',
                token: {
                    latestFXPrice: '0.99999000',
                    fxOracleDecimals: 8,
                },
            },
            {
                address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                balance: '105.392447',
                decimals: 6,
                weight: null,
                priceRate: '1',
                token: {
                    latestFXPrice: '1.00012638',
                    fxOracleDecimals: 8,
                },
            },
        ],
        tokensList: [
            '0x6b175474e89094c44da98b954eedeac495271d0f',
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        ],
        totalWeight: '0',
        amp: undefined,
        expiryTime: undefined,
        unitSeconds: undefined,
        principalToken: undefined,
        baseToken: undefined,
        swapEnabled: true,
        wrappedIndex: undefined,
        mainIndex: undefined,
        lowerTarget: undefined,
        upperTarget: undefined,
        sqrtAlpha: undefined,
        sqrtBeta: undefined,
        root3Alpha: undefined,
        alpha: '0.8',
        beta: '0.42',
        c: undefined,
        s: undefined,
        lambda: '0.3',
        delta: '0.3',
        epsilon: '0.0015',
        tauAlphaX: undefined,
        tauAlphaY: undefined,
        tauBetaX: undefined,
        tauBetaY: undefined,
        u: undefined,
        v: undefined,
        w: undefined,
        z: undefined,
        dSq: undefined,
    },
];

const tokenIn = ADDRESSES[Network.MAINNET].DAI.address;
const tokenOut = ADDRESSES[Network.MAINNET].USDC.address;
const swapType = SwapTypes.SwapExactIn;
const swapAmount = parseFixed('10', 18);

describe('xaveFxPool: Stable Pool + FX Pool integration (Mainnet), DAI-USDC', () => {
    context('Stable pool only', () => {
        before(async function () {
            sor = await setUp(
                networkId,
                provider,
                stablePool,
                jsonRpcUrl as string,
                blocknumber
            );

            await sor.fetchPools();
        });

        it('should return swap', async () => {
            await testSwap();
        });
    });

    context('Stable + FX pools', () => {
        before(async function () {
            sor = await setUp(
                networkId,
                provider,
                [...stablePool, ...xavePool],
                jsonRpcUrl as string,
                blocknumber
            );

            await sor.fetchPools();
        });

        it('should return swap', async () => {
            await testSwap();
        });
    });
});

async function testSwap(): Promise<void> {
    const vault = Vault__factory.connect(vaultAddr, provider);

    const funds = {
        sender: AddressZero,
        recipient: AddressZero,
        fromInternalBalance: false,
        toInternalBalance: false,
    };
    const swapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        swapAmount,
        { gasPrice, maxPools }
    );

    const queryResult = await vault.callStatic.queryBatchSwap(
        swapType,
        swapInfo.swaps,
        swapInfo.tokenAddresses,
        funds
    );

    expect(swapInfo.returnAmount.gt(0)).to.be.true;
    expect(queryResult[0].toString()).to.eq(swapInfo.swapAmount.toString());
    expect(queryResult[1].abs().toString()).to.eq(
        swapInfo.returnAmount.toString()
    );
}
