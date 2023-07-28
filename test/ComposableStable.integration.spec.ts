// yarn test:only test/composableStable.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Vault__factory } from '@balancer-labs/typechain';
import { vaultAddr } from './testScripts/constants';
import { SubgraphPoolBase, SwapTypes, SOR, bnum } from '../src';
import { Network, ADDRESSES } from './testScripts/constants';
import { AddressZero } from '@ethersproject/constants';
import { parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { closeTo } from './lib/testHelpers';
import { ComposableStablePool } from '../src/pools/composableStable/composableStablePool';
import { setUp, queryJoin, querySingleTokenExit } from './testScripts/utils';
import { queryExit } from './testScripts/utils';

dotenv.config();

let sor: SOR;
const networkId = Network.MAINNET;
const jsonRpcUrl = 'https://mainnet.infura.io/v3/' + process.env.INFURA;
const rpcUrl = 'http://127.0.0.1:8545';
const blockNumber = 16990000;
const provider = new JsonRpcProvider(rpcUrl, networkId);
const vault = Vault__factory.connect(vaultAddr, provider);
const bbausdt = ADDRESSES[networkId].bbausdt.address;
const bbadai = ADDRESSES[networkId].bbadai.address;
const bpt = ADDRESSES[networkId].bbausd.address;
const funds = {
    sender: AddressZero,
    recipient: AddressZero,
    fromInternalBalance: false,
    toInternalBalance: false,
};

// bbausd @ 16990000
const testPool: SubgraphPoolBase = {
    id: '0xa13a9247ea42d743238089903570127dda72fe4400000000000000000000035d',
    address: '0xa13a9247ea42d743238089903570127dda72fe44',
    poolType: 'ComposableStable',
    swapFee: '0.00001',
    swapEnabled: true,
    totalShares: '44932059.875228056705169881',
    tokens: [
        {
            address: '0x2f4eb100552ef93840d5adc30560e5513dfffacb',
            balance: '11320218.4542653482060962',
            decimals: 18,
            weight: null,
            priceRate: '1.008907049994305145',
        },
        {
            address: '0x82698aecc9e28e9bb27608bd52cf57f704bd1b83',
            balance: '16511760.493782176032607228',
            decimals: 18,
            weight: null,
            priceRate: '1.003255006836090536',
        },
        {
            address: '0xa13a9247ea42d743238089903570127dda72fe44',
            balance: '2596148361607118.360575356706891466',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0xae37d54ae477268b9997d4161b96b8200755935c',
            balance: '17104601.130227607634969653',
            decimals: 18,
            weight: null,
            priceRate: '1.002588724317365782',
        },
    ],
    tokensList: [
        '0x2f4eb100552ef93840d5adc30560e5513dfffacb',
        '0x82698aecc9e28e9bb27608bd52cf57f704bd1b83',
        '0xa13a9247ea42d743238089903570127dda72fe44',
        '0xae37d54ae477268b9997d4161b96b8200755935c',
    ],
    amp: '1472',
};
// wstETH-rETH-sfrxETH @ 16990000
const testPool1: SubgraphPoolBase = {
    id: '0x5aee1e99fe86960377de9f88689616916d5dcabe000000000000000000000467',
    address: '0x5aee1e99fe86960377de9f88689616916d5dcabe',
    poolType: 'ComposableStable',
    swapFee: '0.0004',
    swapEnabled: true,
    totalShares: '21247.444534559295227932',
    tokens: [
        {
            address: '0x5aee1e99fe86960377de9f88689616916d5dcabe',
            balance: '2596148429265403.127032833448903301',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            balance: '7051.391254798909416156',
            decimals: 18,
            weight: null,
            priceRate: '1.117688527755347286',
        },
        {
            address: '0xac3e018457b222d93114458476f3e3416abbe38f',
            balance: '7252.664978235535296556',
            decimals: 18,
            weight: null,
            priceRate: '1.032699398192610799',
        },
        {
            address: '0xae78736cd615f374d3085123a210448e74fc6393',
            balance: '5625.21808010082984482',
            decimals: 18,
            weight: null,
            priceRate: '1.065201248378856766',
        },
    ],
    tokensList: [
        '0x5aee1e99fe86960377de9f88689616916d5dcabe',
        '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
        '0xac3e018457b222d93114458476f3e3416abbe38f',
        '0xae78736cd615f374d3085123a210448e74fc6393',
    ],
    amp: '105',
};

describe('ComposableStable', () => {
    // Setup chain
    before(async function () {
        this.timeout(20000);

        sor = await setUp(
            networkId,
            provider,
            [testPool, testPool1],
            jsonRpcUrl as string,
            blockNumber
        );
        await sor.fetchPools();
    });
    context('test swaps vs queryBatchSwap', () => {
        context('ExactIn', () => {
            it('token>token', async () => {
                const swapType = SwapTypes.SwapExactIn;

                const swapInfo = await sor.getSwaps(
                    bbausdt,
                    bbadai,
                    swapType,
                    parseFixed('2301.456', 18)
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
                closeTo(queryResult[1].abs(), swapInfo.returnAmount, 1);
            }).timeout(10000);
            it('token>bpt', async () => {
                const swapType = SwapTypes.SwapExactIn;

                const swapInfo = await sor.getSwaps(
                    bbausdt,
                    bpt,
                    swapType,
                    parseFixed('2301.456', 18)
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
            }).timeout(10000);
            it('bpt>token', async () => {
                const swapType = SwapTypes.SwapExactIn;

                const swapInfo = await sor.getSwaps(
                    bpt,
                    bbausdt,
                    swapType,
                    parseFixed('2301.456', 18)
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
            }).timeout(10000);
        });

        context('ExactOut', () => {
            const swapType = SwapTypes.SwapExactOut;

            it('token>token', async () => {
                const swapInfo = await sor.getSwaps(
                    bbadai,
                    bbausdt,
                    swapType,
                    parseFixed('0.1', 18)
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
                closeTo(queryResult[0].abs(), swapInfo.returnAmount, 1);
            }).timeout(10000);
            it('token>bpt', async () => {
                const swapInfo = await sor.getSwaps(
                    bbadai,
                    bpt,
                    swapType,
                    parseFixed('1234.5678', 18)
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
                closeTo(queryResult[0].abs(), swapInfo.returnAmount, 1);
            }).timeout(10000);
            it('bpt>token', async () => {
                const swapInfo = await sor.getSwaps(
                    bpt,
                    bbadai,
                    swapType,
                    parseFixed('987.2345', 18)
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
                expect(queryResult[0].toString()).to.eq(
                    swapInfo.returnAmount.toString()
                );
            }).timeout(10000);
        });
    });
    context('test joins vs queryJoin', () => {
        context('Joins', () => {
            it('Join with many tokens', async () => {
                const bptIndex = 2;
                const amountsInWithBpt = [
                    parseFixed('2301.456', 18),
                    parseFixed('201.45697', 18),
                    parseFixed('0', 18), // BPT Token
                    parseFixed('0.10', 18),
                ];
                const amountsWithOutBpt = [...amountsInWithBpt];
                amountsWithOutBpt.splice(bptIndex, 1);

                const pools = sor.getPools();
                const pool = ComposableStablePool.fromPool(pools[0]);
                const bptCalculated =
                    pool._calcBptOutGivenExactTokensIn(amountsWithOutBpt);

                const deltas = await queryJoin(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    amountsInWithBpt.map((a) => a.toString())
                );
                expect(bptCalculated.toString()).to.eq(
                    deltas.bptOut.toString()
                );
                expect(deltas.amountsIn.toString()).to.eq(
                    amountsInWithBpt.toString()
                );
            }).timeout(10000);
            it('Join with single token', async () => {
                const bptIndex = 2;
                const amountsInWithBpt = [
                    parseFixed('0', 18),
                    parseFixed('777.777', 18),
                    parseFixed('0', 18), // BPT Token
                    parseFixed('0', 18),
                ];
                const amountsWithOutBpt = [...amountsInWithBpt];
                amountsWithOutBpt.splice(bptIndex, 1);

                const pools = sor.getPools();
                const pool = ComposableStablePool.fromPool(pools[0]);
                const bptCalculated =
                    pool._calcBptOutGivenExactTokensIn(amountsWithOutBpt);

                const deltas = await queryJoin(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    amountsInWithBpt.map((a) => a.toString())
                );
                expect(bptCalculated.toString()).to.eq(
                    deltas.bptOut.toString()
                );
                expect(deltas.amountsIn.toString()).to.eq(
                    amountsInWithBpt.toString()
                );
            }).timeout(10000);
        });
    });
    context('test exits vs queryExit', () => {
        context('Exits', () => {
            it('BPT>token', async () => {
                const tokenIndex = 0;
                const bptInHuman = '977.234';
                const bptInEvm = parseFixed(bptInHuman, 18);
                const pools = sor.getPools();
                const pool = ComposableStablePool.fromPool(pools[0]);
                const pairData = pool.parsePoolPairData(
                    testPool.address,
                    pool.tokensList[tokenIndex]
                );
                const amountOutHuman = pool._exactTokenInForTokenOut(
                    pairData,
                    bnum(bptInHuman)
                );
                const amountOutEvm = parseFixed(
                    amountOutHuman.toString(),
                    pairData.decimalsOut
                );

                const deltas = await querySingleTokenExit(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    bptInEvm.toString(),
                    tokenIndex
                );
                expect(deltas.bptIn.toString()).to.eq(bptInEvm.toString());
                deltas.amountsOut.forEach((a, i) => {
                    if (i === tokenIndex)
                        expect(a.toString()).to.eq(amountOutEvm.toString());
                    else expect(a.toString()).to.eq('0');
                });
            }).timeout(10000);
            // At the moment there is no ComposableStable pool containing a token with less than 18 decimals to test against
            // it('BPT>token with less than 18 decimals', async () => {
            //     const tokenIndex = 2; // usdc
            //     const bptInHuman = '10.10';
            //     const bptInEvm = parseFixed(bptInHuman, 18);
            //     const pools = sor.getPools();
            //     const pool = ComposableStablePool.fromPool(pools[1]);
            //     const pairData = pool.parsePoolPairData(
            //         pool.address,
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
            //         pool.id,
            //         pool.tokensList,
            //         bptInEvm.toString(),
            //         tokenIndex
            //     );
            //     expect(deltas.bptIn.toString()).to.eq(bptInEvm.toString());
            //     deltas.amountsOut.forEach((a, i) => {
            //         if (i === tokenIndex)
            //             expect(a.toString()).to.eq(amountOutEvm.toString());
            //         else expect(a.toString()).to.eq('0');
            //     });
            // }).timeout(20000);

            it('BPT>tokens', async () => {
                const bptInEvm = parseFixed('10', 18);
                const pools = sor.getPools();
                const pool = ComposableStablePool.fromPool(pools[1]);
                const amountsOutEvm =
                    pool._calcTokensOutGivenExactBptIn(bptInEvm);

                const { bptIn, amountsOut } = await queryExit(
                    provider,
                    pool.id,
                    pool.tokensList,
                    bptInEvm.toString(),
                    true
                );
                const amountsOutWithoutBpt = [...amountsOut];
                amountsOutWithoutBpt.splice(
                    pool.tokensList.indexOf(pool.address),
                    1
                ); // remove BPT amount

                expect(bptIn.toString()).to.eq(bptInEvm.toString());
                amountsOutEvm.forEach((a, i) => {
                    closeTo(a, amountsOutWithoutBpt[i], 1e14); // accuracy of 1e4 - is not an exact match due to protocol fees not being considered on calculations
                });
            }).timeout(10000);
        });
    });
});
