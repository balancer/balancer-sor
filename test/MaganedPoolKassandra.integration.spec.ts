import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SOR, SubgraphPoolBase, SwapTypes } from '../src';
import { Network, vaultAddr } from './testScripts/constants';
import { formatFixed, parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { MaganedPoolKassandra } from '../src/pools/managedPools/MaganedPoolKassandra';
import { setUp } from './testScripts/utils';
import { WeightedPoolToken } from '../src/pools/weightedPool/weightedPool';
import { Vault, Vault__factory } from '@balancer-labs/typechain';
import { AddressZero } from '@ethersproject/constants';

dotenv.config();

const testPool: SubgraphPoolBase = {
    id: '0x107cb7c6d67ad745c50d7d4627335c1c6a684003000100000000000000000c37',
    address: '0x107cb7c6d67ad745c50d7d4627335c1c6a684003',
    poolType: 'Managed',
    swapFee: '0.003',
    swapEnabled: true,
    totalWeight: '0',
    totalShares: '587.155942710616273381',
    tokensList: [
        '0x107cb7c6d67ad745c50d7d4627335c1c6a684003',
        '0x172370d5cd63279efa6d502dab29171933a610af',
        '0x1a3acf6d19267e2d3e7f898f42803e90c9219062',
        '0x50b728d8d964fd00c2d0aad81718b71311fef68a',
        '0x6f7c932e7684666c9fd1d44527765433e01ff61d',
        '0x8505b9d2254a7ae468c0e9dd10ccea3a837aef5c',
        '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3',
        '0xb33eaad8d922b1083446dc23f610c2567fb5180f',
        '0xc3c7d422809852031b44ab29eec9f1eff2a58756',
        '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
    ],
    tokens: [
        {
            address: '0x172370d5cd63279efa6d502dab29171933a610af',
            balance: '396.136772427774719658',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0x1a3acf6d19267e2d3e7f898f42803e90c9219062',
            balance: '32.15685999953081616',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0x50b728d8d964fd00c2d0aad81718b71311fef68a',
            balance: '128.635643494144033617',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0x6f7c932e7684666c9fd1d44527765433e01ff61d',
            balance: '0.376577387336367528',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0x8505b9d2254a7ae468c0e9dd10ccea3a837aef5c',
            balance: '3.075712849360558397',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3',
            balance: '22.14930620288425309',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0xb33eaad8d922b1083446dc23f610c2567fb5180f',
            balance: '300.69117873097954205',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0xc3c7d422809852031b44ab29eec9f1eff2a58756',
            balance: '331.466141781162778932',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
        {
            address: '0xd6df932a45c0f255f85145f286ea0b292b21c90b',
            balance: '4.675112151574476223',
            decimals: 18,
            priceRate: '1',
            weight: null,
        },
    ],
};

const networkId = Network.POLYGON;
const jsonRpcUrl = process.env.RPC_URL_POLYGON;
const rpcUrl = 'http://127.0.0.1:8137';
const blockNumber = 50629622;
const provider = new JsonRpcProvider(rpcUrl, networkId);
let pool: MaganedPoolKassandra;
let sor: SOR;
let vault: Vault;

const funds = {
    sender: AddressZero,
    recipient: AddressZero,
    fromInternalBalance: false,
    toInternalBalance: false,
};

describe('Managed', () => {
    before(async function () {
        sor = await setUp(
            networkId,
            provider,
            [testPool],
            jsonRpcUrl as string,
            blockNumber
        );
        await sor.fetchPools();
        const pools = sor.getPools();
        pool = MaganedPoolKassandra.fromPool(pools[0]);
        vault = Vault__factory.connect(vaultAddr, provider);
    });
    context('test swaps vs querySwap', () => {
        context('single swap', () => {
            context('exact in', () => {
                it('should calc swap amount out CRV -> FXS', async () => {
                    const amountIn = parseFixed('1', 18);

                    const swapInfo = await sor.getSwaps(
                        testPool.tokensList[1],
                        testPool.tokensList[2],
                        SwapTypes.SwapExactIn,
                        amountIn
                    );

                    const response = await vault.callStatic.queryBatchSwap(
                        SwapTypes.SwapExactIn,
                        swapInfo.swaps,
                        swapInfo.tokenAddresses,
                        funds
                    );
                    expect(swapInfo.swapAmount.toString()).eq(
                        response[0].toString()
                    );
                    expect(swapInfo.returnAmount.toString()).eq(
                        response[1].abs().toString()
                    );
                });

                it('should calc swap amount out BAL -> UNI', async () => {
                    const amountIn = parseFixed('0.1', 18);

                    const swapInfo = await sor.getSwaps(
                        testPool.tokensList[6],
                        testPool.tokensList[7],
                        SwapTypes.SwapExactIn,
                        amountIn
                    );

                    const response = await vault.callStatic.queryBatchSwap(
                        SwapTypes.SwapExactIn,
                        swapInfo.swaps,
                        swapInfo.tokenAddresses,
                        funds
                    );
                    expect(swapInfo.swapAmount.toString()).eq(
                        response[0].toString()
                    );
                    expect(swapInfo.returnAmount.toString()).eq(
                        response[1].abs().toString()
                    );
                });
            });

            context('exact out', () => {
                it('should calc swap amout in CRV -> FXS', async () => {
                    const amountIn = parseFixed('1', 18);

                    const swapInfo = await sor.getSwaps(
                        testPool.tokensList[1],
                        testPool.tokensList[2],
                        SwapTypes.SwapExactOut,
                        amountIn
                    );

                    const response = await vault.callStatic.queryBatchSwap(
                        SwapTypes.SwapExactOut,
                        swapInfo.swaps,
                        swapInfo.tokenAddresses,
                        funds
                    );
                    expect(swapInfo.swapAmount.toString()).eq(
                        response[1].abs().toString()
                    );
                    expect(swapInfo.returnAmount.toString()).eq(
                        response[0].abs().toString()
                    );
                });

                it('should calc swap amount in BAL -> UNI', async () => {
                    const amountIn = parseFixed('1', 18);

                    const swapInfo = await sor.getSwaps(
                        testPool.tokensList[6],
                        testPool.tokensList[7],
                        SwapTypes.SwapExactOut,
                        amountIn
                    );

                    const response = await vault.callStatic.queryBatchSwap(
                        SwapTypes.SwapExactOut,
                        swapInfo.swaps,
                        swapInfo.tokenAddresses,
                        funds
                    );
                    expect(swapInfo.swapAmount.toString()).eq(
                        response[1].abs().toString()
                    );
                    expect(swapInfo.returnAmount.toString()).eq(
                        response[0].abs().toString()
                    );
                });
            });
        });
    });
    context('test joins vs queryJoin', () => {
        context('join with all tokens', () => {
            it('should return zero in calc join call with all tokens', async () => {
                const amountsIn = [
                    parseFixed('0', 18),
                    parseFixed('0.123', 18),
                    parseFixed('0.456', 18),
                    parseFixed('0.123', 18),
                    parseFixed('0.456', 18),
                    parseFixed('0.123', 18),
                    parseFixed('0.456', 18),
                    parseFixed('0.123', 18),
                    parseFixed('0.456', 18),
                    parseFixed('0.123', 18),
                ];
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);
                expect(bptOut.toString()).to.eq('0');
            });
        });
        context('join with single token', () => {
            it('should returns zero in calc join call with single token', async () => {
                const amountsIn = [parseFixed('0.789', 8), parseFixed('0', 18)];
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                expect(bptOut.toString()).to.eq('0');
            });
        });
    });
    context('test exits vs queryExit', () => {
        context('exit to single token', () => {
            before(async function () {
                const bptAsToken: WeightedPoolToken = {
                    address: pool.address,
                    balance: formatFixed(pool.totalShares, 18),
                    decimals: 18,
                    weight: '0',
                };

                pool.tokens.push(bptAsToken);
                pool.tokensList.push(pool.address);
            });
            it('should throw when token is BPT', async () => {
                const tokenIndex = 0;

                const response = () =>
                    pool.parsePoolPairData(
                        pool.address,
                        pool.tokensList[tokenIndex]
                    );

                expect(response).throws('Token cannot be BPT');
            });
            after(async function () {
                // Remove BPT that was artifically added to the pool
                pool.tokens.pop();
                pool.tokensList.pop();
            });
        });
        context('exit to all tokens', async () => {
            it('should return zero when calling calc exit with all tokens', async () => {
                const bptIn = parseFixed('0.123', 18);

                const amountsOut = pool._calcTokensOutGivenExactBptIn(bptIn);

                amountsOut.forEach((amount) => {
                    expect(amount.toString()).to.eq('0');
                });
            });
        });
    });
});
