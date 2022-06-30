// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/weightedMath.spec.ts
import dotenv from 'dotenv';
import { assert, expect } from 'chai';
import * as SDK from '@georgeroman/balancer-v2-pools';
import { AddressZero } from '@ethersproject/constants';
import { JsonRpcProvider } from '@ethersproject/providers';
import { defaultAbiCoder } from '@ethersproject/abi';
import {
    BalancerHelpers__factory,
    BalancerHelpers,
    Vault__factory,
    WeightedPool__factory,
    Vault,
} from '@balancer-labs/typechain';
import { BigNumber as OldBigNumber } from '../src/utils/bignumber';
import { bnum } from '../src/utils/bignumber';
import { BAL, WETH, vaultAddr } from './lib/constants';
import singleWeightedPool from './testData/weightedPools/singlePoolWithSwapEnabled.json';
import { WeightedPool } from '../src/pools/weightedPool/weightedPool';
import {
    _calcBptOutGivenExactTokensIn,
    _calculateInvariant,
    _calcDueProtocolSwapFeeBptAmount,
} from '../src/pools/weightedPool/weightedMath';
import { Contract } from '@ethersproject/contracts';

dotenv.config();

describe('weightedMath tests', () => {
    // TO DO: add items using checkOutcome function
    context('spot prices', () => {
        const weightedPool = WeightedPool.fromPool(singleWeightedPool.pools[0]);
        const weightedPoolPairData = weightedPool.parsePoolPairData(
            WETH.address,
            BAL.address
        );
        it('weighted _spotPriceAfterSwapExactTokenInForTokenOut', () => {
            checkDerivative(
                weightedPool._exactTokenInForTokenOut,
                weightedPool._spotPriceAfterSwapExactTokenInForTokenOut,
                weightedPoolPairData,
                1,
                0.001,
                0.00000001,
                true
            );
        });
        it('weighted _spotPriceAfterSwapTokenInForExactTokenOut', () => {
            checkDerivative(
                weightedPool._tokenInForExactTokenOut,
                weightedPool._spotPriceAfterSwapTokenInForExactTokenOut,
                weightedPoolPairData,
                10,
                0.01,
                0.00000001,
                false
            );
        });
        it('weighted _derivativeSpotPriceAfterSwapExactTokenInForTokenOut', () => {
            checkDerivative(
                weightedPool._spotPriceAfterSwapExactTokenInForTokenOut,
                weightedPool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
                weightedPoolPairData,
                1,
                0.001,
                0.0000001,
                false
            );
        });
    });

    context('_calcBptOutGivenExactTokensIn', () => {
        const { ALCHEMY_URL: jsonRpcUrl } = process.env;
        const rpcUrl = 'http://127.0.0.1:8545';
        const provider = new JsonRpcProvider(rpcUrl, 1);
        const vault = Vault__factory.connect(vaultAddr, provider);
        // mainnet balancer helpers contract
        const balancerHelpers = BalancerHelpers__factory.connect(
            '0x5aDDCCa35b7A0D07C74063c48700C8590E87864E',
            provider
        );
        // Setup chain
        before(async function () {
            this.timeout(20000);

            await provider.send('hardhat_reset', [
                {
                    forking: {
                        jsonRpcUrl,
                        blockNumber: 14828550,
                    },
                },
            ]);
        });

        context('testing against original maths', () => {
            it('Pool with 18 decimal tokens', async () => {
                const poolId =
                    '0x90291319f1d4ea3ad4db0dd8fe9e12baf749e84500020000000000000000013c';
                const poolInfo = await getPoolOnChain(poolId, vault, provider);
                const amountsIn = [
                    '7000000000000000000',
                    '1000000000000000000',
                ];
                // UI was originally using this
                const sdkResult =
                    SDK.WeightedMath._calcBptOutGivenExactTokensIn(
                        poolInfo.balances.map((a) => bnum(a.toString())),
                        poolInfo.normalizedWeights.map((a) =>
                            bnum(a.toString())
                        ),
                        amountsIn.map((a) => bnum(a)),
                        bnum(poolInfo.totalSupply.toString()),
                        bnum(poolInfo.swapFee.toString())
                    );
                // bigint version of maths
                const calculatedBptOut = _calcBptOutGivenExactTokensIn(
                    poolInfo.balances,
                    poolInfo.normalizedWeights,
                    amountsIn.map((a) => BigInt(a)),
                    poolInfo.totalSupply,
                    poolInfo.swapFee
                );
                expect(sdkResult.gt(0)).to.be.true;
                expect(sdkResult.toString()).to.eq(calculatedBptOut.toString());

                // queryJoin against local fork
                // This is failing, probably related to ProtocolFees (see below)
                // const query = await queryJoin(
                //     poolId,
                //     amountsIn,
                //     poolInfo.tokens,
                //     balancerHelpers
                // );
                // expect(query.amountsIn.toString()).to.eq(amountsIn.toString());
                // expect(query.bptOut.gt(0)).to.be.true;
                // expect(query.bptOut.toString()).to.eq(
                //     calculatedBptOut.toString()
                // );
            }).timeout(10000);

            it('Pool with 6 decimal tokens', async () => {
                // USDC/WETH
                const poolId =
                    '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
                const poolInfo = await getPoolOnChain(poolId, vault, provider);
                const scalingFactors = [
                    '1000000000000000000000000000000',
                    '1000000000000000000',
                ];
                const amountsIn = ['1234000000', '1000000000000000000'];
                const amountsInScaled: bigint[] = amountsIn.map(
                    (a, i) =>
                        (BigInt(a) * BigInt(scalingFactors[i])) / BigInt(1e18)
                );
                const scaledBalances = poolInfo.balances.map(
                    (a, i) =>
                        (BigInt(a) * BigInt(scalingFactors[i])) / BigInt(1e18)
                );
                // UI was originally using this
                const sdkResult =
                    SDK.WeightedMath._calcBptOutGivenExactTokensIn(
                        poolInfo.balances.map((a) => bnum(a.toString())),
                        poolInfo.normalizedWeights.map((a) =>
                            bnum(a.toString())
                        ),
                        amountsIn.map((a) => bnum(a)),
                        bnum(poolInfo.totalSupply.toString()),
                        bnum(poolInfo.swapFee.toString())
                    );
                const calculatedBptOut = _calcBptOutGivenExactTokensIn(
                    scaledBalances,
                    poolInfo.normalizedWeights,
                    amountsInScaled,
                    poolInfo.totalSupply,
                    poolInfo.swapFee
                );
                expect(sdkResult.gt(0)).to.be.true;
                expect(sdkResult.toString()).to.eq(calculatedBptOut.toString());

                // queryJoin against local fork
                // This is failing, probably related to ProtocolFees (see below)
                // const query = await queryJoin(
                //     poolId,
                //     amountsIn,
                //     poolInfo.tokens,
                //     balancerHelpers
                // );
                // expect(query.amountsIn.toString()).to.eq(amountsIn.toString());
                // expect(query.bptOut.gt(0)).to.be.true;
                // expect(query.bptOut.toString()).to.eq(
                //     calculatedBptOut.toString()
                // );
            }).timeout(10000);
        });

        /*
        Testing maths against a queryJoin is failing.
        Needs further investigation but possible related to protocol fees.
        */
        // context('testing with protocol fee', () => {
        //     it('Pool with 6 decimal tokens', async () => {
        //         // USDC/WETH
        //         const poolId =
        //             '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
        //         const poolInfo = await getPoolOnChain(poolId, vault, provider);
        //         const assets = poolInfo.tokens;
        //         const scalingFactors = [
        //             '1000000000000000000000000000000',
        //             '1000000000000000000',
        //         ];
        //         const amountsIn = ['1234000000', '1000000000000000000'];
        //         const amountsInScaled: bigint[] = amountsIn.map(
        //             (a, i) =>
        //                 (BigInt(a) * BigInt(scalingFactors[i])) / BigInt(1e18)
        //         );
        //         const scaledBalances = poolInfo.balances.map(
        //             (a, i) =>
        //                 (BigInt(a) * BigInt(scalingFactors[i])) / BigInt(1e18)
        //         );
        //         // https://etherscan.io/address/0xce88686553686DA562CE7Cea497CE749DA109f9F#readContract
        //         // getSwapFeePercentage
        //         const protocolSwapFeePercentage = BigInt('500000000000000000');

        //         // _beforeJoinExit
        //         // Same as getInvariant
        //         const preJoinExitInvariant = _calculateInvariant(
        //             poolInfo.normalizedWeights,
        //             scaledBalances
        //         );
        //         const toMint = _calcDueProtocolSwapFeeBptAmount(
        //             poolInfo.totalSupply,
        //             poolInfo.lastInvariant,
        //             preJoinExitInvariant,
        //             protocolSwapFeePercentage
        //         );
        //         const calculatedBptOut = _calcBptOutGivenExactTokensIn(
        //             scaledBalances,
        //             poolInfo.normalizedWeights,
        //             amountsInScaled,
        //             poolInfo.totalSupply + toMint,
        //             poolInfo.swapFee
        //         );
        //         // queryJoin against local fork
        //         const query = await queryJoin(
        //             poolId,
        //             amountsIn,
        //             assets,
        //             balancerHelpers
        //         );
        //         expect(query.amountsIn.toString()).to.eq(amountsIn.toString());
        //         expect(query.bptOut.toString()).to.eq(
        //             calculatedBptOut.toString()
        //         );
        //     }).timeout(10000);

        //     it('Pool with 18 decimal tokens', async () => {
        //         const poolId =
        //             '0x90291319f1d4ea3ad4db0dd8fe9e12baf749e84500020000000000000000013c';
        //         const poolInfo = await getPoolOnChain(poolId, vault, provider);
        //         const assets = poolInfo.tokens;
        //         const amountsIn = [
        //             '7000000000000000000',
        //             '1000000000000000000',
        //         ];
        //         // https://etherscan.io/address/0xce88686553686DA562CE7Cea497CE749DA109f9F#readContract
        //         // getSwapFeePercentage
        //         const protocolSwapFeePercentage = BigInt('500000000000000000');

        //         // _beforeJoinExit
        //         // Same as getInvariant
        //         const preJoinExitInvariant = _calculateInvariant(
        //             poolInfo.normalizedWeights,
        //             poolInfo.balances
        //         );
        //         const toMint = _calcDueProtocolSwapFeeBptAmount(
        //             poolInfo.totalSupply,
        //             poolInfo.lastInvariant,
        //             preJoinExitInvariant,
        //             protocolSwapFeePercentage
        //         );
        //         const calculatedBptOut = _calcBptOutGivenExactTokensIn(
        //             poolInfo.balances,
        //             poolInfo.normalizedWeights,
        //             amountsIn.map((a) => BigInt(a)),
        //             poolInfo.totalSupply + toMint,
        //             poolInfo.swapFee
        //         );
        //         // queryJoin against local fork
        //         const query = await queryJoin(
        //             poolId,
        //             amountsIn,
        //             assets,
        //             balancerHelpers
        //         );
        //         expect(query.amountsIn.toString()).to.eq(amountsIn.toString());
        //         expect(query.bptOut.gt(0)).to.be.true;
        //         expect(query.bptOut.toString()).to.eq(
        //             calculatedBptOut.toString()
        //         );
        //     }).timeout(10000);
        // });
    });
});

async function queryJoin(
    poolId: string,
    amountsIn: string[],
    assets: string[],
    balancerHelpers: BalancerHelpers
) {
    const EXACT_TOKENS_IN_FOR_BPT_OUT = 1;
    const minimumBPT = '0';
    const abi = ['uint256', 'uint256[]', 'uint256'];
    const data = [EXACT_TOKENS_IN_FOR_BPT_OUT, amountsIn, minimumBPT];
    const userDataEncoded = defaultAbiCoder.encode(abi, data);
    const joinPoolRequest = {
        assets,
        maxAmountsIn: amountsIn,
        userData: userDataEncoded,
        fromInternalBalance: false,
    };
    const query = await balancerHelpers.queryJoin(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        joinPoolRequest
    );
    return query;
}

async function getPoolOnChain(
    poolId: string,
    vault: Vault,
    provider: JsonRpcProvider,
    print = false
): Promise<{
    poolId: string;
    tokens: string[];
    swapFee: bigint;
    normalizedWeights: bigint[];
    balances: bigint[];
    totalSupply: bigint;
    lastInvariant: bigint;
}> {
    const pool = await vault.getPool(poolId);
    const poolContract = WeightedPool__factory.connect(pool[0], provider);
    const swapFee = await poolContract.getSwapFeePercentage();
    const totalSupply = await poolContract.totalSupply();
    const normalizedWeights = await poolContract.getNormalizedWeights();
    const lastInvariant = await poolContract.getLastInvariant();
    // const scalingFactors = await poolContract.getScalingFactors();
    const poolTokens = await vault.getPoolTokens(poolId);
    const feeCollectorAbi = [
        'function getSwapFeePercentage() public view returns (uint256)',
    ];
    const feesCollector = new Contract(
        '0xce88686553686DA562CE7Cea497CE749DA109f9F',
        feeCollectorAbi,
        provider
    );
    const protocolSwapFee = await feesCollector.getSwapFeePercentage();

    if (print) {
        console.log(poolId);
        console.log(pool[0]);
        console.log(`SwapFee: `, swapFee.toString());
        console.log(`totalSupply: `, totalSupply.toString());
        console.log(`tokens`, poolTokens.tokens.toString());
        console.log(`normalizedWeights: `, normalizedWeights.toString());
        console.log(`balances: `, poolTokens.balances.toString());
        console.log(`lastInvariant`, lastInvariant.toString());
        console.log(`${protocolSwapFee.toString()}, protocolSwapFeePercentage`);
    }

    return {
        poolId: poolId,
        tokens: poolTokens.tokens,
        swapFee: swapFee.toBigInt(),
        normalizedWeights: normalizedWeights.map((w) => w.toBigInt()),
        balances: poolTokens.balances.map((b) => b.toBigInt()),
        totalSupply: totalSupply.toBigInt(),
        lastInvariant: lastInvariant.toBigInt(),
    };
}

function checkDerivative(
    fn: (
        poolPairData: any,
        amount: OldBigNumber,
        exact: boolean
    ) => OldBigNumber,
    der: (poolPairData: any, amount: OldBigNumber) => OldBigNumber,
    poolPairData: any,
    amount: number,
    delta: number,
    error: number,
    inverse = false
) {
    const x = bnum(amount);
    let incrementalQuotient = fn(poolPairData, x.plus(delta), true)
        .minus(fn(poolPairData, x, true))
        .div(delta);
    if (inverse) incrementalQuotient = bnum(1).div(incrementalQuotient);
    const der_ans = der(poolPairData, x);
    assert.approximately(
        incrementalQuotient.div(der_ans).toNumber(),
        1,
        error,
        'wrong result'
    );
}
