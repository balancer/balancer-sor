// yarn test:only test/metaStable.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SubgraphPoolBase, SwapTypes } from '../src';
import { Network, ADDRESSES, vaultAddr } from './testScripts/constants';
import { AddressZero } from '@ethersproject/constants';

import { parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';
import { setUp, queryJoin, queryExit } from './testScripts/utils';
import { Vault__factory } from '@balancer-labs/typechain';
import { closeTo } from './lib/testHelpers';

dotenv.config();

// Balancer USDC-USDT Oracle Stable Pool
const testPool: SubgraphPoolBase = {
    id: '0x9f383f91c89cbd649c700c2bf69c2a828af299aa0002000000000000000003a6',
    address: '0x9f383f91c89cbd649c700c2bf69c2a828af299aa',
    swapEnabled: true,
    poolType: 'MetaStable',
    swapFee: '0.000001',
    totalWeight: '0',
    totalShares: '1.501763384758054657',
    tokensList: [
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
    ],
    tokens: [
        {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
            balance: '1.129827',
            decimals: 6,
            priceRate: '0.9992',
            weight: null,
        },
        {
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
            balance: '0.382611',
            decimals: 6,
            priceRate: '1',
            weight: null,
        },
    ],
};

const networkId = Network.MAINNET;
const jsonRpcUrl = 'https://mainnet.infura.io/v3/' + process.env.INFURA;
const rpcUrl = 'http://127.0.0.1:8545';
const blockNumber = 16447247;
const provider = new JsonRpcProvider(rpcUrl, networkId);
const vault = Vault__factory.connect(vaultAddr, provider);
let pool: MetaStablePool;
const funds = {
    sender: AddressZero,
    recipient: AddressZero,
    fromInternalBalance: false,
    toInternalBalance: false,
};
let sor;

describe('MetaStable', () => {
    beforeEach(async function () {
        sor = await setUp(
            networkId,
            provider,
            [testPool],
            jsonRpcUrl as string,
            blockNumber
        );
        await sor.fetchPools();
        const pools = sor.getPools();
        pool = MetaStablePool.fromPool(pools[0]);
    });
    context('test joins vs queryJoin', () => {
        context('Joins', () => {
            it('Join with many tokens', async () => {
                const amountsIn = [
                    parseFixed('0.0123', 6),
                    parseFixed('0.0456', 6),
                ];
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                const deltas = await queryJoin(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    amountsIn.map((a) => a.toString())
                );
                expect(bptOut.sub(deltas.bptOut).toNumber()).to.closeTo(0, 1);
                expect(deltas.amountsIn.toString()).to.eq(amountsIn.toString());
            });
            it('Join with single token', async () => {
                const amountsIn = [parseFixed('0', 6), parseFixed('0.0789', 6)];
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                const deltas = await queryJoin(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    amountsIn.map((a) => a.toString())
                );
                expect(bptOut.sub(deltas.bptOut).toNumber()).to.closeTo(0, 1);
                expect(deltas.amountsIn.toString()).to.eq(amountsIn.toString());
            });
        });
    });
    context('test exits vs queryExit', () => {
        context('Exits', () => {
            // TODO: pending single token out implementation on metaStable pool
            // it('BPT>token', async () => {
            //     const tokenIndex = 0; // usdc
            //     const bptInHuman = '0.123';
            //     const bptInEvm = parseFixed(bptInHuman, 18);
            //     const pairData = pool.parsePoolPairData(
            //         testPool.address,
            //         pool.tokensList[tokenIndex]
            //     );
            //     const amountOutHuman = pool._exactTokenInForTokenOut(
            //         pairData,
            //         bnum(bptInHuman)
            //     );
            //     const amountOutEvm = parseFixed(
            //         amountOutHuman.toString(),
            //         pairData.decimalsOut
            //     );

            //     const deltas = await querySingleTokenExit(
            //         provider,
            //         testPool.id,
            //         testPool.tokensList,
            //         bptInEvm.toString(),
            //         tokenIndex
            //     );
            //     expect(deltas.bptIn.toString()).to.eq(bptInEvm.toString());
            //     deltas.amountsOut.forEach((a, i) => {
            //         if (i === tokenIndex)
            //             expect(a.toString()).to.eq(amountOutEvm.toString());
            //         else expect(a.toString()).to.eq('0');
            //     });
            // });
            it('BPT>tokens', async () => {
                const bptIn = parseFixed('0.0123', 18);

                const amountOut = pool._calcTokensOutGivenExactBptIn(bptIn);
                const deltas = await queryExit(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    bptIn.toString()
                );
                expect(deltas.bptIn.toString()).to.eq(bptIn.toString());
                deltas.amountsOut.forEach((a, i) => {
                    expect(a.toString()).to.eq(amountOut[i].toString());
                });
            });
        });
    });
    context('swaps', () => {
        it('token>token, ExactIn', async () => {
            const swapType = SwapTypes.SwapExactIn;
            const swapInfo = await sor.getSwaps(
                ADDRESSES[networkId].USDC.address,
                ADDRESSES[networkId].USDT.address,
                swapType,
                parseFixed('0.1', 6)
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
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.returnAmount.toString()
            );
        });
        it('token>token, ExactOut', async () => {
            const swapType = SwapTypes.SwapExactOut;
            const swapInfo = await sor.getSwaps(
                ADDRESSES[networkId].USDC.address,
                ADDRESSES[networkId].USDT.address,
                swapType,
                parseFixed('0.1', 6)
            );
            const queryResult = await vault.callStatic.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                funds
            );
            closeTo(queryResult[0], swapInfo.returnAmount, 1);
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
        });
    });
});
