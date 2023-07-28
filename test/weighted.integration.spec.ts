// yarn test:only test/weighted.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { SubgraphPoolBase, bnum } from '../src';
import { Network } from './testScripts/constants';
import { formatFixed, parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import {
    WeightedPool,
    WeightedPoolToken,
} from '../src/pools/weightedPool/weightedPool';
import {
    setUp,
    queryJoin,
    queryExit,
    querySingleTokenExit,
    accuracy,
} from './testScripts/utils';

dotenv.config();

// Balancer 50 WBTC 50 WETH
const testPool: SubgraphPoolBase = {
    id: '0xa6f548df93de924d73be7d25dc02554c6bd66db500020000000000000000000e',
    address: '0xa6f548df93de924d73be7d25dc02554c6bd66db5',
    poolType: 'Weighted',
    swapFee: '0.0025',
    swapEnabled: true,
    totalWeight: '1',
    totalShares: '569.975179583636271111',
    tokensList: [
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    ],
    tokens: [
        {
            address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
            balance: '79.07066658',
            decimals: 8,
            priceRate: '1',
            weight: '0.5',
        },
        {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
            balance: '1070.934861851870065442',
            decimals: 18,
            priceRate: '1',
            weight: '0.5',
        },
    ],
};

const networkId = Network.MAINNET;
const jsonRpcUrl = 'https://mainnet.infura.io/v3/' + process.env.INFURA;
const rpcUrl = 'http://127.0.0.1:8545';
const blockNumber = 16447247;
const provider = new JsonRpcProvider(rpcUrl, networkId);
let pool: WeightedPool;
const inaccuracyLimit = 1e-4;

describe('Weighted', () => {
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
        pool = WeightedPool.fromPool(pools[0]);
    });
    context('test joins vs queryJoin', () => {
        context('Join with all tokens', () => {
            it('should calc join with all tokens with max 1 bps inaccuracy', async () => {
                const amountsIn = [
                    parseFixed('0.123', 8),
                    parseFixed('0.456', 18),
                ];
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                const deltas = await queryJoin(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    amountsIn.map((a) => a.toString())
                );
                expect(accuracy(bptOut, deltas.bptOut)).to.be.closeTo(
                    1,
                    inaccuracyLimit
                );
                deltas.amountsIn.forEach((a, i) => {
                    expect(accuracy(amountsIn[i], a)).to.be.closeTo(
                        1,
                        inaccuracyLimit
                    );
                });
            });
        });
        context('Join with single token', () => {
            it('should calc join with single token with max 1 bps inaccuracy', async () => {
                const amountsIn = [parseFixed('0.789', 8), parseFixed('0', 18)];
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                const deltas = await queryJoin(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    amountsIn.map((a) => a.toString())
                );
                expect(accuracy(bptOut, deltas.bptOut)).to.be.closeTo(
                    1,
                    inaccuracyLimit
                );
                deltas.amountsIn.forEach((a, i) => {
                    expect(accuracy(amountsIn[i], a)).to.be.closeTo(
                        1,
                        inaccuracyLimit
                    );
                });
            });
        });
    });
    context('test exits vs queryExit', () => {
        context('Exit to single token', () => {
            before(async function () {
                // Artificially add BPT to the weighted pool
                // Required for single token exit calc on the SOR (_exactTokenInForTokenOut)
                const bptAsToken: WeightedPoolToken = {
                    address: pool.address,
                    balance: formatFixed(pool.totalShares, 18),
                    decimals: 18,
                    weight: '0',
                };
                pool.tokens.push(bptAsToken);
                pool.tokensList.push(pool.address);
            });
            it('should calc exit to single token with max 1 bps inaccuracy', async () => {
                const tokenIndex = 0; // WBTC
                const bptInHuman = '0.123';
                const bptInEvm = parseFixed(bptInHuman, 18);
                const pairData = pool.parsePoolPairData(
                    pool.address,
                    pool.tokensList[tokenIndex]
                );

                const amountOutHuman = pool._exactTokenInForTokenOut(
                    pairData,
                    bnum(bptInHuman)
                );
                const amountOutEvm = parseFixed(
                    amountOutHuman.dp(pairData.decimalsOut).toString(),
                    pairData.decimalsOut
                );

                const deltas = await querySingleTokenExit(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    bptInEvm.toString(),
                    tokenIndex
                );
                expect(accuracy(bptInEvm, deltas.bptIn)).to.be.closeTo(
                    1,
                    inaccuracyLimit
                );
                deltas.amountsOut.forEach((a, i) => {
                    if (i === tokenIndex) {
                        expect(accuracy(amountOutEvm, a)).to.be.closeTo(
                            1,
                            inaccuracyLimit
                        );
                    } else expect(a.toString()).to.eq('0');
                });
            });
            after(async function () {
                // Remove BPT that was artifically added to the pool
                pool.tokens.pop();
                pool.tokensList.pop();
            });
        });
        context('Exit to all tokens', async () => {
            it('should calc exit to all tokens with max 1 bps inaccuracy', async () => {
                const bptIn = parseFixed('0.123', 18);

                const amountsOut = pool._calcTokensOutGivenExactBptIn(bptIn);
                const deltas = await queryExit(
                    provider,
                    testPool.id,
                    testPool.tokensList,
                    bptIn.toString()
                );
                expect(accuracy(bptIn, deltas.bptIn)).to.be.closeTo(
                    1,
                    inaccuracyLimit
                );
                deltas.amountsOut.forEach((a, i) => {
                    expect(accuracy(amountsOut[i], a)).to.be.closeTo(
                        1,
                        inaccuracyLimit
                    );
                });
            });
        });
    });
});
