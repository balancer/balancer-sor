// yarn test:only test/stable.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SubgraphPoolBase } from '../src';
import { Network } from './testScripts/constants';
import { parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { StablePool } from '../src/pools/stablePool/stablePool';
import {
    setUp,
    queryJoin,
    queryExit,
    checkInaccuracy,
} from './testScripts/utils';

dotenv.config();

// stabal3 - 'Balancer USD Stable Pool'
const testPool: SubgraphPoolBase = {
    id: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063',
    address: '0x06df3b2bbb68adc8b0e302443692037ed9f91b42',
    poolType: 'Stable',
    swapFee: '0.00005',
    swapEnabled: true,
    totalWeight: '0',
    totalShares: '2379452.16938807774682641',
    tokensList: [
        '0x6b175474e89094c44da98b954eedeac495271d0f',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
    ],
    tokens: [
        {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f', // dai
            balance: '816187.617388549266500637',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // usdc
            balance: '843334.571152',
            decimals: 6,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7', // usdt
            balance: '757349.509194',
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
let pool: StablePool;
const inaccuracyLimit = 1e-2;

describe('Stable', () => {
    before(async function () {
        const sor = await setUp(
            networkId,
            provider,
            [testPool],
            jsonRpcUrl as string,
            blockNumber
        );
        await sor.fetchPools();
        const pools = sor.getPools();
        pool = StablePool.fromPool(pools[0]);
    });
    context('test joins vs queryJoin', () => {
        context('Joins', () => {
            it('Join with many tokens', async () => {
                const amountsIn = [
                    parseFixed('0.123', 18),
                    parseFixed('0.456', 6),
                    parseFixed('0.789', 6),
                ];
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                const deltas = await queryJoin(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    amountsIn.map((a) => a.toString())
                );
                expect(checkInaccuracy(bptOut, deltas.bptOut, inaccuracyLimit))
                    .to.be.true;
                deltas.amountsIn.forEach((a, i) => {
                    expect(checkInaccuracy(amountsIn[i], a, inaccuracyLimit)).to
                        .be.true;
                });
            });
            it('Join with single token', async () => {
                const amountsIn = [
                    parseFixed('0', 18),
                    parseFixed('0', 6),
                    parseFixed('0.789', 6),
                ];
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                const deltas = await queryJoin(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    amountsIn.map((a) => a.toString())
                );
                expect(checkInaccuracy(bptOut, deltas.bptOut, inaccuracyLimit))
                    .to.be.true;
                deltas.amountsIn.forEach((a, i) => {
                    expect(checkInaccuracy(amountsIn[i], a, inaccuracyLimit)).to
                        .be.true;
                });
            });
        });
    });
    context('test exits vs queryExit', () => {
        context('Exits', () => {
            // TODO: pending single token out implementation on stable pool
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
                const bptIn = parseFixed('0.123', 18);

                const amountsOut = pool._calcTokensOutGivenExactBptIn(bptIn);
                const deltas = await queryExit(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    bptIn.toString()
                );
                expect(checkInaccuracy(bptIn, deltas.bptIn, inaccuracyLimit)).to
                    .be.true;
                deltas.amountsOut.forEach((a, i) => {
                    expect(checkInaccuracy(amountsOut[i], a, inaccuracyLimit))
                        .to.be.true;
                });
            });
        });
    });
});
