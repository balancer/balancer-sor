// yarn test:only test/ComposableStable.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { defaultAbiCoder } from '@ethersproject/abi';
import {
    Vault__factory,
    BalancerHelpers__factory,
} from '@balancer-labs/typechain';
import { vaultAddr } from './testScripts/constants';
import { SubgraphPoolBase, SwapTypes, SOR, bnum } from '../src';
import { Network, ADDRESSES } from './testScripts/constants';
import { AddressZero } from '@ethersproject/constants';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { closeTo } from './lib/testHelpers';
import { ComposableStablePool } from '../src/pools/composableStable/composableStablePool';
import { setUp } from './testScripts/utils';

dotenv.config();

let sor: SOR;
const networkId = Network.MAINNET;
const { ALCHEMY_URL: jsonRpcUrl } = process.env;
const rpcUrl = 'http://127.0.0.1:8545';
const blockNumber = 16447247;
const provider = new JsonRpcProvider(rpcUrl, networkId);
const vault = Vault__factory.connect(vaultAddr, provider);
const bbausdt = ADDRESSES[networkId].bbausdt2.address;
const bbadai = ADDRESSES[networkId].bbadai2.address;
const bpt = ADDRESSES[networkId].bbausd2.address;
const funds = {
    sender: AddressZero,
    recipient: AddressZero,
    fromInternalBalance: false,
    toInternalBalance: false,
};

// bbausd
const testPool: SubgraphPoolBase = {
    id: '0xa13a9247ea42d743238089903570127dda72fe4400000000000000000000035d',
    address: '0xa13a9247ea42d743238089903570127dda72fe44',
    poolType: 'ComposableStable',
    swapFee: '0.00001',
    swapEnabled: true,
    totalShares: '64596326.424409523591670321',
    tokens: [
        {
            address: '0x2f4eb100552ef93840d5adc30560e5513dfffacb',
            balance: '19886024.363497322713220006',
            decimals: 18,
            weight: null,
            priceRate: '1.005556566563028326',
        },
        {
            address: '0x82698aecc9e28e9bb27608bd52cf57f704bd1b83',
            balance: '22661432.733475610301640733',
            decimals: 18,
            weight: null,
            priceRate: '1.001701405807798182',
        },
        {
            address: '0xa13a9247ea42d743238089903570127dda72fe44',
            balance: '2596148352278451.368726075585090202',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0xae37d54ae477268b9997d4161b96b8200755935c',
            balance: '22025447.315652715921042479',
            decimals: 18,
            weight: null,
            priceRate: '1.001877219965246124',
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

export async function queryJoin(
    network: number,
    poolId: string,
    assetsWithBpt: string[],
    amountsInWithBpt: string[],
    bptIndex: number
): Promise<
    [BigNumber, BigNumber[]] & { bptOut: BigNumber; amountsIn: BigNumber[] }
> {
    const helpers = BalancerHelpers__factory.connect(
        ADDRESSES[network].balancerHelpers,
        provider
    );
    const EXACT_TOKENS_IN_FOR_BPT_OUT = 1; // Alternative is: TOKEN_IN_FOR_EXACT_BPT_OUT
    const minimumBPT = '0';
    const abi = ['uint256', 'uint256[]', 'uint256'];
    // ComposableStables must have no value for BPT in user data
    const amountsWithOutBpt = [...amountsInWithBpt];
    amountsWithOutBpt.splice(bptIndex, 1);
    const data = [EXACT_TOKENS_IN_FOR_BPT_OUT, amountsWithOutBpt, minimumBPT];
    const userDataEncoded = defaultAbiCoder.encode(abi, data);
    const joinPoolRequest = {
        assets: assetsWithBpt,
        maxAmountsIn: amountsInWithBpt, // Must include BPT
        userData: userDataEncoded,
        fromInternalBalance: false,
    };
    const query = await helpers.queryJoin(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        joinPoolRequest
    );
    return query;
}

export async function querySingleTokenExit(
    network: number,
    poolId: string,
    assetsWithBpt: string[],
    bptAmountIn: string,
    exitTokenIndex: number
): Promise<
    [BigNumber, BigNumber[]] & { bptIn: BigNumber; amountsOut: BigNumber[] }
> {
    const helpers = BalancerHelpers__factory.connect(
        ADDRESSES[network].balancerHelpers,
        provider
    );
    const EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0; // Alternative is: BPT_IN_FOR_EXACT_TOKENS_OUT (No proportional)
    const abi = ['uint256', 'uint256', 'uint256'];

    const data = [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptAmountIn, exitTokenIndex];
    const userDataEncoded = defaultAbiCoder.encode(abi, data);

    const exitPoolRequest = {
        assets: assetsWithBpt,
        minAmountsOut: assetsWithBpt.map(() => '0'),
        userData: userDataEncoded,
        toInternalBalance: false,
    };
    const query = await helpers.queryExit(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        exitPoolRequest
    );
    return query;
}

describe('ComposableStable', () => {
    // Setup chain
    before(async function () {
        this.timeout(20000);

        sor = await setUp(
            networkId,
            provider,
            [testPool],
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
                    networkId,
                    testPool.id,
                    testPool.tokensList,
                    amountsInWithBpt.map((a) => a.toString()),
                    bptIndex
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
                    networkId,
                    testPool.id,
                    testPool.tokensList,
                    amountsInWithBpt.map((a) => a.toString()),
                    bptIndex
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
                    networkId,
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
            //         networkId,
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

            // ComposableStable V1 does not have this functionality but V2 does
            // it('BPT>tokens', async () => {
            //     const bptIn = parseFixed('77', 18);
            //     const pools = sor.getPools();
            //     const pool = ComposableStablePool.fromPool(pools[0]);
            //     const amountOut = pool._calcTokensOutGivenExactBptIn(bptIn);
            //     console.log(amountOut.toString());
            // }).timeout(10000);
        });
    });
});
