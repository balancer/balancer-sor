// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/joinAndExit.spec.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { assert, expect } from 'chai';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';

import { SOR, SwapTypes, SwapInfo, PoolFilter } from '../src';
import { mockTokenPriceService } from './lib/mockTokenPriceService';
import { MockPoolDataService } from './lib/mockPoolDataService';
import { sorConfigTest, DAI, USDT, BAL, WETH, USDC } from './lib/constants';
import { getActions, orderActions } from './joinAndExit/joinAndExit';

import poolsList from './testData/weightedPools/joinExitPools.json';

const pool1Bpt = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56';

describe(`Paths with join and exits.`, () => {
    context('getActions', () => {
        it('token->BPT, exact in', async () => {
            const tokenIn = DAI.address;
            const tokenOut = USDT.address;
            const swapType = SwapTypes.SwapExactIn;
            const pools = cloneDeep(poolsList.pools);
            const swapAmount = parseFixed('1280000', 18);
            const swapWithJoinExit = await getSwapInfo(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                swapAmount,
                true
            );
            const actions = getActions(
                tokenIn,
                tokenOut,
                swapWithJoinExit.swaps,
                swapWithJoinExit.tokenAddresses,
                swapWithJoinExit.returnAmount.toString()
            );
            expect(actions.length).to.eq(swapWithJoinExit.swaps.length);
            expect(actions[0].type).to.eq('swap');
            expect(actions[0].opRef.length).to.eq(0);
            expect(actions[0].minOut).to.eq(
                swapWithJoinExit.returnAmount.toString()
            );
            expect(actions[1].type).to.eq('join');
            expect(actions[1].opRef[0].index).to.eq(
                actions[1].swaps[0].assetOutIndex
            );
            expect(actions[1].minOut).to.eq('0');
            expect(actions[2].type).to.eq('swap');
            expect(actions[2].opRef.length).to.eq(0);
            expect(actions[2].swaps[0].amount).to.eq(
                actions[1].opRef[0].key.toString()
            );
            expect(actions[2].minOut).to.eq(
                swapWithJoinExit.returnAmount.toString()
            );
        });
        it('BPT->token, exact in', async () => {
            const tokenIn = USDT.address;
            const tokenOut = DAI.address;
            const swapType = SwapTypes.SwapExactIn;
            const pools = cloneDeep(poolsList.pools);
            pools.splice(1, 1); // removes the stable pool
            const swapAmount = parseFixed('100000', 6);
            const swapWithJoinExit = await getSwapInfo(
                tokenIn,
                tokenOut,
                swapType,
                pools,
                swapAmount,
                true
            );
            const actions = getActions(
                tokenIn,
                tokenOut,
                swapWithJoinExit.swaps,
                swapWithJoinExit.tokenAddresses,
                swapWithJoinExit.returnAmount.toString()
            );
            expect(actions.length).to.eq(swapWithJoinExit.swaps.length);
            expect(actions.length).to.eq(swapWithJoinExit.swaps.length);
            expect(actions[0].type).to.eq('swap');
            expect(actions[0].opRef[0].index).to.eq(1);
            expect(actions[0].minOut).to.eq('0');
            expect(actions[1].type).to.eq('exit');
            expect(actions[1].opRef.length).to.eq(0);
            expect(actions[1].swaps[0].amount).to.eq(
                actions[0].opRef[0].key.toString()
            );
            expect(actions[1].minOut).to.eq(
                swapWithJoinExit.returnAmount.toString()
            );
        });
    });
    context('orderActions', () => {
        it('exact in, join', async () => {
            const tokenIn = DAI.address;
            const tokenOut = pool1Bpt;
            const swapAmount = parseFixed('1280000', 18);
            const swaps = [
                {
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 0,
                    assetOutIndex: 1,
                    amount: swapAmount.toString(),
                    userData: '0x',
                },
            ];
            const assets = [
                '0x6b175474e89094c44da98b954eedeac495271d0f',
                '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56',
            ];
            const returnAmount = '639359779510000000000000';
            const actions = getActions(
                tokenIn,
                tokenOut,
                swaps,
                assets,
                returnAmount
            );
            const orderedActions = orderActions(
                actions,
                tokenIn,
                tokenOut,
                assets
            );
            expect(orderedActions.length).to.eq(actions.length);
            expect(orderedActions[0].type).to.eq('join');
            expect(orderedActions[0].opRef.length).to.eq(0);
            expect(orderedActions[0].swaps[0].amount).to.eq(
                swapAmount.toString()
            );
            expect(orderedActions[0].minOut).to.eq(returnAmount);
        });
        it('exact in, exit', async () => {
            const tokenIn = pool1Bpt;
            const tokenOut = DAI.address;
            const swapAmount = '1280000000000000000000000';
            const swaps = [
                {
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 0,
                    assetOutIndex: 1,
                    amount: swapAmount,
                    userData: '0x',
                },
            ];
            const assets = [
                '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56',
                '0x6b175474e89094c44da98b954eedeac495271d0f',
            ];
            const returnAmount = '2557439736413850000000000';
            const actions = getActions(
                tokenIn,
                tokenOut,
                swaps,
                assets,
                returnAmount
            );
            const orderedActions = orderActions(
                actions,
                tokenIn,
                tokenOut,
                assets
            );
            expect(orderedActions.length).to.eq(actions.length);
            expect(orderedActions[0].type).to.eq('exit');
            expect(orderedActions[0].opRef.length).to.eq(0);
            expect(orderedActions[0].swaps[0].amount).to.eq(swapAmount);
            expect(orderedActions[0].minOut).to.eq(returnAmount);
        });
        it('exact in, join>swap and swap', async () => {
            const tokenIn = DAI.address;
            const tokenOut = USDT.address;
            const swaps = [
                {
                    // swap
                    poolId: '0xc45d42f801105e861e86658648e3678ad7aa70f900010000000000000000011e',
                    assetInIndex: 0,
                    assetOutIndex: 1,
                    amount: '1279699403356512142192771',
                    userData: '0x',
                },
                {
                    // join
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 0,
                    assetOutIndex: 2,
                    amount: '300596643487857807229',
                    userData: '0x',
                },
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000375',
                    assetInIndex: 2,
                    assetOutIndex: 1,
                    amount: '0',
                    userData: '0x',
                },
            ];
            const assets = [
                '0x6b175474e89094c44da98b954eedeac495271d0f',
                '0xdac17f958d2ee523a2206206994597c13d831ec7',
                '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56',
            ];
            const returnAmount = '1264585520968';
            const actions = getActions(
                tokenIn,
                tokenOut,
                swaps,
                assets,
                returnAmount
            );
            const orderedActions = orderActions(
                actions,
                tokenIn,
                tokenOut,
                assets
            );
            expect(orderedActions.length).to.eq(2);
            expect(orderedActions[0].type).to.eq('join');
            expect(orderedActions[0].opRef[0].index).to.eq(2);
            expect(orderedActions[0].minOut).to.eq('0');
            expect(orderedActions[1].type).to.eq('batchswap');
            expect(orderedActions[1].opRef.length).to.eq(0);
            expect(orderedActions[1].minOut).to.eq(returnAmount);
            expect(orderedActions[1].swaps.length).to.eq(2);
            expect(orderedActions[1].swaps[0].amount).to.eq(
                '1279699403356512142192771'
            );
            expect(orderedActions[1].swaps[1].amount).to.eq(
                orderedActions[0].opRef[0].key.toString()
            );
        });
        it('exact in, swap>exit', async () => {
            const tokenIn = USDT.address;
            const tokenOut = DAI.address;
            const swaps = [
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000375',
                    assetInIndex: 0,
                    assetOutIndex: 1,
                    amount: '100000000000',
                    userData: '0x',
                },
                {
                    // exit
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 1,
                    assetOutIndex: 2,
                    amount: '0',
                    userData: '0x',
                },
            ];
            const assets = [
                '0xdac17f958d2ee523a2206206994597c13d831ec7',
                '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56',
                '0x6b175474e89094c44da98b954eedeac495271d0f',
            ];
            const returnAmount = '94961515248180000000000';
            const actions = getActions(
                tokenIn,
                tokenOut,
                swaps,
                assets,
                returnAmount
            );
            const orderedActions = orderActions(
                actions,
                tokenIn,
                tokenOut,
                assets
            );
            expect(orderedActions.length).to.eq(2);
            expect(orderedActions[0].type).to.eq('batchswap');
            expect(orderedActions[0].opRef[0].index).to.eq(1);
            expect(orderedActions[0].minOut).to.eq('0');
            expect(orderedActions[0].swaps.length).to.eq(1);
            expect(orderedActions[0].swaps[0].amount).to.eq('100000000000');
            expect(orderedActions[1].type).to.eq('exit');
            expect(orderedActions[1].opRef.length).to.eq(0);
            expect(orderedActions[1].minOut).to.eq(returnAmount);
            expect(orderedActions[1].swaps[0].amount).to.eq(
                orderedActions[0].opRef[0].key.toString()
            );
        });
        it('exact in, swap>join>swap', async () => {
            // e.g.
            //    USDT[swap]DAI
            //    DAI[join]BPT
            //    BPT[swap]USDC
            const tokenIn = USDT.address;
            const tokenOut = USDC.address;
            const swaps = [
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000375',
                    assetInIndex: 0,
                    assetOutIndex: 1,
                    amount: '100000000000',
                    userData: '0x',
                },
                {
                    // join
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 1,
                    assetOutIndex: 2,
                    amount: '0',
                    userData: '0x',
                },
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000376',
                    assetInIndex: 2,
                    assetOutIndex: 3,
                    amount: '0',
                    userData: '0x',
                },
            ];
            const assets = [tokenIn, DAI.address, pool1Bpt, USDC.address];
            const returnAmount = '94961515248180000000000';
            const actions = getActions(
                tokenIn,
                tokenOut,
                swaps,
                assets,
                returnAmount
            );
            const orderedActions = orderActions(
                actions,
                tokenIn,
                tokenOut,
                assets
            );
            expect(orderedActions.length).to.eq(3);
            expect(orderedActions[0].type).to.eq('batchswap');
            expect(orderedActions[0].minOut).to.eq('0');
            expect(orderedActions[0].opRef.length).to.eq(1);
            expect(orderedActions[0].opRef[0].index).to.eq(1);
            expect(orderedActions[0].swaps.length).to.eq(1);
            expect(orderedActions[0].swaps[0].amount).to.eq('100000000000');
            expect(orderedActions[1].type).to.eq('join');
            expect(orderedActions[1].minOut).to.eq('0');
            expect(orderedActions[1].opRef.length).to.eq(1);
            expect(orderedActions[1].opRef[0].index).to.eq(2);
            expect(orderedActions[1].swaps.length).to.eq(1);
            expect(orderedActions[1].swaps[0].amount).to.eq(
                orderedActions[0].opRef[0].key.toString()
            );
            expect(orderedActions[2].type).to.eq('batchswap');
            expect(orderedActions[2].opRef.length).to.eq(0);
            expect(orderedActions[2].swaps.length).to.eq(1);
            expect(orderedActions[2].swaps[0].amount).to.eq(
                orderedActions[1].opRef[0].key.toString()
            );
            expect(orderedActions[2].minOut).to.eq(returnAmount);
        });
        it('exact in, swap>exit>swap', async () => {
            // e.g.
            //    USDT[swap]BPT
            //    BPT[exit]DAI
            //    DAI[swap]USDC
            const tokenIn = USDT.address;
            const tokenOut = USDC.address;
            const swaps = [
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000375',
                    assetInIndex: 0,
                    assetOutIndex: 1,
                    amount: '100000000000',
                    userData: '0x',
                },
                {
                    // exit
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 1,
                    assetOutIndex: 2,
                    amount: '0',
                    userData: '0x',
                },
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000376',
                    assetInIndex: 2,
                    assetOutIndex: 3,
                    amount: '0',
                    userData: '0x',
                },
            ];
            const assets = [tokenIn, pool1Bpt, DAI.address, USDC.address];
            const returnAmount = '94961515248180000000000';
            const actions = getActions(
                tokenIn,
                tokenOut,
                swaps,
                assets,
                returnAmount
            );
            const orderedActions = orderActions(
                actions,
                tokenIn,
                tokenOut,
                assets
            );
            expect(orderedActions.length).to.eq(3);
            expect(orderedActions[0].type).to.eq('batchswap');
            expect(orderedActions[0].minOut).to.eq('0');
            expect(orderedActions[0].opRef.length).to.eq(1);
            expect(orderedActions[0].opRef[0].index).to.eq(1);
            expect(orderedActions[0].swaps.length).to.eq(1);
            expect(orderedActions[0].swaps[0].amount).to.eq('100000000000');
            expect(orderedActions[1].type).to.eq('exit');
            expect(orderedActions[1].minOut).to.eq('0');
            expect(orderedActions[1].opRef.length).to.eq(1);
            expect(orderedActions[1].opRef[0].index).to.eq(2);
            expect(orderedActions[1].swaps.length).to.eq(1);
            expect(orderedActions[1].swaps[0].amount).to.eq(
                orderedActions[0].opRef[0].key.toString()
            );
            expect(orderedActions[2].type).to.eq('batchswap');
            expect(orderedActions[2].opRef.length).to.eq(0);
            expect(orderedActions[2].swaps.length).to.eq(1);
            expect(orderedActions[2].swaps[0].amount).to.eq(
                orderedActions[1].opRef[0].key.toString()
            );
            expect(orderedActions[2].minOut).to.eq(returnAmount);
        });
        it('exact in, ending in two joins', async () => {
            // e.g.
            //    USDT[swap]DAI
            //    DAI[join]BPT
            //    USDT[swap]USDC
            //    USDC[join]BPT
            //    Need minOut for both which equals total
            const tokenIn = USDT.address;
            const tokenOut = pool1Bpt;
            const swaps = [
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000375',
                    assetInIndex: 0,
                    assetOutIndex: 1,
                    amount: '100000000000',
                    userData: '0x',
                },
                {
                    // join
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 1,
                    assetOutIndex: 2,
                    amount: '0',
                    userData: '0x',
                },
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000375',
                    assetInIndex: 0,
                    assetOutIndex: 3,
                    amount: '200000000000',
                    userData: '0x',
                },
                {
                    // join
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 3,
                    assetOutIndex: 2,
                    amount: '0',
                    userData: '0x',
                },
            ];
            const assets = [tokenIn, DAI.address, tokenOut, BAL.address];
            const returnAmount = '94961515248180000000000';
            const actions = getActions(
                tokenIn,
                tokenOut,
                swaps,
                assets,
                returnAmount
            );
            const orderedActions = orderActions(
                actions,
                tokenIn,
                tokenOut,
                assets
            );
            expect(orderedActions.length).to.eq(3);
            expect(orderedActions[0].type).to.eq('batchswap');
            expect(orderedActions[0].minOut).to.eq('0');
            expect(orderedActions[0].opRef.length).to.eq(2);
            expect(orderedActions[0].opRef[0].index).to.eq(1);
            expect(orderedActions[0].opRef[1].index).to.eq(3);
            expect(orderedActions[0].swaps.length).to.eq(2);
            expect(orderedActions[0].swaps[0].amount).to.eq('100000000000');
            expect(orderedActions[0].swaps[1].amount).to.eq('200000000000');
            expect(orderedActions[1].type).to.eq('join');
            expect(orderedActions[1].opRef.length).to.eq(0);
            expect(orderedActions[1].swaps.length).to.eq(1);
            expect(orderedActions[1].swaps[0].amount).to.eq(
                orderedActions[0].opRef[0].key.toString()
            );
            expect(orderedActions[2].type).to.eq('join');
            expect(orderedActions[2].opRef.length).to.eq(0);
            expect(orderedActions[2].swaps.length).to.eq(1);
            expect(orderedActions[2].swaps[0].amount).to.eq(
                orderedActions[0].opRef[1].key.toString()
            );
            expect(orderedActions[1].minOut).to.not.eq(
                orderedActions[2].minOut
            ); // TODO - Can't be same for both
        });
        it('exact in, ending in two exits', async () => {
            // e.g.
            //    USDT[swap]DAI
            //    DAI[swap]BPT
            //    BPT[exit]weth
            //    USDT[swap]USDC
            //    USDC[swap]BPT
            //    BPT[exit]weth
            //    Need minOut for both which equals total
            const tokenIn = USDT.address;
            const tokenOut = WETH.address;
            const swaps = [
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000375',
                    assetInIndex: 0,
                    assetOutIndex: 1,
                    amount: '100000000000',
                    userData: '0x',
                },
                {
                    // swap
                    poolId: '0x4626d81b3a1711beb79f4cecff2413886d461677000200000000000000000011',
                    assetInIndex: 1,
                    assetOutIndex: 2,
                    amount: '0',
                    userData: '0x',
                },
                {
                    // exit
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 2,
                    assetOutIndex: 3,
                    amount: '0',
                    userData: '0x',
                },
                {
                    // swap
                    poolId: '0xf88278315a1d5ace3aaa41712f60602e069208e6000200000000000000000375',
                    assetInIndex: 0,
                    assetOutIndex: 4,
                    amount: '100000000000',
                    userData: '0x',
                },
                {
                    // swap
                    poolId: '0x4626d81b3a1711beb79f4cecff2413886d461677000200000000000000000011',
                    assetInIndex: 4,
                    assetOutIndex: 2,
                    amount: '0',
                    userData: '0x',
                },
                {
                    // exit
                    poolId: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
                    assetInIndex: 2,
                    assetOutIndex: 3,
                    amount: '0',
                    userData: '0x',
                },
            ];
            const assets = [
                tokenIn,
                DAI.address,
                pool1Bpt,
                tokenOut,
                USDC.address,
            ];
            const returnAmount = '94961515248180000000000';
            const actions = getActions(
                tokenIn,
                tokenOut,
                swaps,
                assets,
                returnAmount
            );
            const orderedActions = orderActions(
                actions,
                tokenIn,
                tokenOut,
                assets
            );
            expect(orderedActions.length).to.eq(3);
            expect(orderedActions[0].type).to.eq('batchswap');
            expect(orderedActions[0].minOut).to.eq('0');
            expect(orderedActions[0].opRef.length).to.eq(4);
            expect(orderedActions[0].opRef[0].index).to.eq(1);
            expect(orderedActions[0].opRef[1].index).to.eq(2);
            expect(orderedActions[0].opRef[2].index).to.eq(4);
            expect(orderedActions[0].opRef[3].index).to.eq(2);
            expect(orderedActions[0].swaps[0].amount).to.eq('100000000000');
            expect(orderedActions[0].swaps[1].amount).to.eq('0');
            expect(orderedActions[0].swaps[2].amount).to.eq('100000000000');
            expect(orderedActions[0].swaps[3].amount).to.eq('0');

            expect(orderedActions[1].type).to.eq('exit');
            expect(orderedActions[1].opRef.length).to.eq(0);
            expect(orderedActions[1].swaps.length).to.eq(1);
            expect(orderedActions[1].swaps[0].amount).to.eq(
                orderedActions[0].opRef[1].key.toString()
            );
            expect(orderedActions[2].type).to.eq('exit');
            expect(orderedActions[2].opRef.length).to.eq(0);
            expect(orderedActions[2].swaps.length).to.eq(1);
            expect(orderedActions[2].swaps[0].amount).to.eq(
                orderedActions[0].opRef[3].key.toString()
            );
            expect(orderedActions[1].minOut).to.not.eq(
                orderedActions[2].minOut
            ); // TODO - Can't be same for both
            expect(orderedActions[2].minOut).to.eq('94961515248180000000000');
            expect(orderedActions[5].minOut).to.eq('94961515248180000000000');
        });
    });
});

async function getSwapInfo(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools: any,
    swapAmount: BigNumber,
    useBpts?: boolean
) {
    const provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );
    const maxPools = 4;
    const gasPrice = BigNumber.from('0');
    const sor = new SOR(
        provider,
        sorConfigTest,
        new MockPoolDataService(pools),
        mockTokenPriceService
    );
    const isFetched = await sor.fetchPools();
    assert(isFetched, 'Pools should be fetched in wrapper');
    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        swapAmount,
        {
            gasPrice,
            maxPools,
            timestamp: 0,
            poolTypeFilter: PoolFilter.All,
        },
        useBpts
    );
    return swapInfo;
}
