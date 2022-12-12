// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/weightedMath.spec.ts
import dotenv from 'dotenv';
import { assert } from 'chai';
import { BigNumber as OldBigNumber } from '../src/utils/bignumber';
import { bnum } from '../src/utils/bignumber';
import { BAL, WETH } from './lib/constants';
import singleWeightedPool from './testData/weightedPools/singlePoolWithSwapEnabled.json';
import {
    WeightedPool,
    WeightedPoolPairData,
} from '../src/pools/weightedPool/weightedPool';

dotenv.config();

// mainnet balancer helpers contract

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

    // context('_calcBptOutGivenExactTokensIn', () => {
    //     // Setup chain
    //     before(async function () {
    //         this.timeout(20000);

    //         await provider.send('hardhat_reset', [
    //             {
    //                 forking: {
    //                     jsonRpcUrl,
    //                     blockNumber: 14828550,
    //                 },
    //             },
    //         ]);
    //     });

    //     function compareToSdk(
    //         scalingFactors: bigint[],
    //         balances: bigint[],
    //         normalizedWeights: bigint[],
    //         amountsIn: bigint[],
    //         totalSupply: bigint,
    //         swapFee: bigint
    //     ) {
    //         const amountsInScaled = _upscaleArray(
    //             amountsIn.map((a) => BigInt(a)),
    //             scalingFactors
    //         );
    //         const balancesScaled = _upscaleArray(balances, scalingFactors);
    //         const sdkResult = SDK.WeightedMath._calcBptOutGivenExactTokensIn(
    //             balancesScaled.map((a) => bnum(a.toString())),
    //             normalizedWeights.map((a) => bnum(a.toString())),
    //             amountsInScaled.map((a) => bnum(a.toString())),
    //             bnum(totalSupply.toString()),
    //             bnum(swapFee.toString())
    //         );
    //         const calculatedBptOut = _calcBptOutGivenExactTokensIn(
    //             balancesScaled,
    //             normalizedWeights,
    //             amountsInScaled,
    //             totalSupply,
    //             swapFee
    //         );
    //         expect(sdkResult.gt(0)).to.be.true;
    //         expect(sdkResult.toString()).to.eq(calculatedBptOut.toString());
    //     }

    //     // UI was previously using GeorgesSDK so we should at least match this
    //     context('testing against original SDK maths', () => {
    //         it('Pool with 18 decimal tokens', async () => {
    //             const poolId =
    //                 '0x90291319f1d4ea3ad4db0dd8fe9e12baf749e84500020000000000000000013c';
    //             const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //             const scalingFactors = [
    //                 BigInt('1000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             const amountsIn = [
    //                 BigInt('7000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             compareToSdk(
    //                 scalingFactors,
    //                 poolInfo.balances,
    //                 poolInfo.normalizedWeights,
    //                 amountsIn,
    //                 poolInfo.totalSupply,
    //                 poolInfo.swapFee
    //             );
    //         }).timeout(10000);

    //         it('Pool with 6 decimal tokens', async () => {
    //             // USDC/WETH
    //             const poolId =
    //                 '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
    //             const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //             const scalingFactors = [
    //                 BigInt('1000000000000000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             const amountsIn = [
    //                 BigInt('1234000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             compareToSdk(
    //                 scalingFactors,
    //                 poolInfo.balances,
    //                 poolInfo.normalizedWeights,
    //                 amountsIn,
    //                 poolInfo.totalSupply,
    //                 poolInfo.swapFee
    //             );
    //         }).timeout(10000);
    //     });

    //     /*
    //     Testing maths against a queryJoin is failing.
    //     Needs further investigation but possible related to protocol fees which this has some initial code.
    //     */
    //     // context('testing with protocol fee', () => {
    //     //     it('Pool with 6 decimal tokens', async () => {
    //     //         // USDC/WETH
    //     //         const poolId =
    //     //             '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
    //     //         const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //     //         const assets = poolInfo.tokens;
    //     //         const scalingFactors = [
    //     //             '1000000000000000000000000000000',
    //     //             '1000000000000000000',
    //     //         ];
    //     //         const amountsIn = ['1234000000', '1000000000000000000'];
    //     //         const amountsInScaled: bigint[] = amountsIn.map(
    //     //             (a, i) =>
    //     //                 (BigInt(a) * BigInt(scalingFactors[i])) / BigInt(1e18)
    //     //         );
    //     //         const scaledBalances = poolInfo.balances.map(
    //     //             (a, i) =>
    //     //                 (BigInt(a) * BigInt(scalingFactors[i])) / BigInt(1e18)
    //     //         );
    //     //         // https://etherscan.io/address/0xce88686553686DA562CE7Cea497CE749DA109f9F#readContract
    //     //         // getSwapFeePercentage
    //     //         const protocolSwapFeePercentage = BigInt('500000000000000000');

    //     //         // _beforeJoinExit
    //     //         // Same as getInvariant
    //     //         const preJoinExitInvariant = _calculateInvariant(
    //     //             poolInfo.normalizedWeights,
    //     //             scaledBalances
    //     //         );
    //     //         const toMint = _calcDueProtocolSwapFeeBptAmount(
    //     //             poolInfo.totalSupply,
    //     //             poolInfo.lastInvariant,
    //     //             preJoinExitInvariant,
    //     //             protocolSwapFeePercentage
    //     //         );
    //     //         const calculatedBptOut = _calcBptOutGivenExactTokensIn(
    //     //             scaledBalances,
    //     //             poolInfo.normalizedWeights,
    //     //             amountsInScaled,
    //     //             poolInfo.totalSupply + toMint,
    //     //             poolInfo.swapFee
    //     //         );
    //     //         // queryJoin against local fork
    //     //         const query = await queryJoin(
    //     //             poolId,
    //     //             amountsIn,
    //     //             assets,
    //     //             balancerHelpers
    //     //         );
    //     //         expect(query.amountsIn.toString()).to.eq(amountsIn.toString());
    //     //         expect(query.bptOut.toString()).to.eq(
    //     //             calculatedBptOut.toString()
    //     //         );
    //     //     }).timeout(10000);

    //     //     it('Pool with 18 decimal tokens', async () => {
    //     //         const poolId =
    //     //             '0x90291319f1d4ea3ad4db0dd8fe9e12baf749e84500020000000000000000013c';
    //     //         const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //     //         const assets = poolInfo.tokens;
    //     //         const amountsIn = [
    //     //             '7000000000000000000',
    //     //             '1000000000000000000',
    //     //         ];
    //     //         // https://etherscan.io/address/0xce88686553686DA562CE7Cea497CE749DA109f9F#readContract
    //     //         // getSwapFeePercentage
    //     //         const protocolSwapFeePercentage = BigInt('500000000000000000');

    //     //         // _beforeJoinExit
    //     //         // Same as getInvariant
    //     //         const preJoinExitInvariant = _calculateInvariant(
    //     //             poolInfo.normalizedWeights,
    //     //             poolInfo.balances
    //     //         );
    //     //         const toMint = _calcDueProtocolSwapFeeBptAmount(
    //     //             poolInfo.totalSupply,
    //     //             poolInfo.lastInvariant,
    //     //             preJoinExitInvariant,
    //     //             protocolSwapFeePercentage
    //     //         );
    //     //         const calculatedBptOut = _calcBptOutGivenExactTokensIn(
    //     //             poolInfo.balances,
    //     //             poolInfo.normalizedWeights,
    //     //             amountsIn.map((a) => BigInt(a)),
    //     //             poolInfo.totalSupply + toMint,
    //     //             poolInfo.swapFee
    //     //         );
    //     //         // queryJoin against local fork
    //     //         const query = await queryJoin(
    //     //             poolId,
    //     //             amountsIn,
    //     //             assets,
    //     //             balancerHelpers
    //     //         );
    //     //         expect(query.amountsIn.toString()).to.eq(amountsIn.toString());
    //     //         expect(query.bptOut.gt(0)).to.be.true;
    //     //         expect(query.bptOut.toString()).to.eq(
    //     //             calculatedBptOut.toString()
    //     //         );
    //     //     }).timeout(10000);
    //     // });
    // });

    // context('_calcTokensOutGivenExactBptIn', () => {
    //     // Setup chain
    //     before(async function () {
    //         this.timeout(20000);

    //         await provider.send('hardhat_reset', [
    //             {
    //                 forking: {
    //                     jsonRpcUrl,
    //                     blockNumber: 14828550,
    //                 },
    //             },
    //         ]);
    //     });

    //     function compareToSdk(
    //         scalingFactors: bigint[],
    //         balances: bigint[],
    //         amountBptIn: bigint,
    //         totalSupply: bigint
    //     ) {
    //         const balancesScaled = _upscaleArray(balances, scalingFactors);
    //         const sdkResult = SDK.WeightedMath._calcTokensOutGivenExactBptIn(
    //             balancesScaled.map((a) => bnum(a.toString())),
    //             bnum(amountBptIn.toString()),
    //             bnum(totalSupply.toString())
    //         );

    //         const calculatedTokensOut = _calcTokensOutGivenExactBptIn(
    //             balancesScaled,
    //             amountBptIn,
    //             totalSupply
    //         );
    //         expect(sdkResult[0].gt(0)).to.be.true;
    //         expect(sdkResult.toString()).to.eq(calculatedTokensOut.toString());
    //     }

    //     context('testing against original maths', () => {
    //         it('Pool with 18 decimal tokens', async () => {
    //             const poolId =
    //                 '0x90291319f1d4ea3ad4db0dd8fe9e12baf749e84500020000000000000000013c';
    //             const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //             const scalingFactors = [
    //                 BigInt('1000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             const amountBptIn = BigInt('7000000000000000000');
    //             compareToSdk(
    //                 scalingFactors,
    //                 poolInfo.balances,
    //                 amountBptIn,
    //                 poolInfo.totalSupply
    //             );
    //         }).timeout(10000);

    //         it('Pool with 6 decimal tokens', async () => {
    //             // USDC/WETH
    //             const poolId =
    //                 '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
    //             const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //             const scalingFactors = [
    //                 BigInt('1000000000000000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             const amountBptIn = BigInt('1234000000000000000000');
    //             compareToSdk(
    //                 scalingFactors,
    //                 poolInfo.balances,
    //                 amountBptIn,
    //                 poolInfo.totalSupply
    //             );
    //         }).timeout(10000);
    //     });
    // });

    // context('_calcTokenOutGivenExactBptIn', () => {
    //     // Setup chain
    //     before(async function () {
    //         this.timeout(20000);

    //         await provider.send('hardhat_reset', [
    //             {
    //                 forking: {
    //                     jsonRpcUrl,
    //                     blockNumber: 14828550,
    //                 },
    //             },
    //         ]);
    //     });

    //     function compareToSdk(
    //         scalingFactor: bigint,
    //         balance: bigint,
    //         normalizedWeight: bigint,
    //         bptAmountIn: bigint,
    //         totalSupply: bigint,
    //         swapFee: bigint
    //     ) {
    //         const balanceScaled = _upscale(balance, scalingFactor);
    //         const sdkResult = SDK.WeightedMath._calcTokenOutGivenExactBptIn(
    //             bnum(balanceScaled.toString()),
    //             bnum(normalizedWeight.toString()),
    //             bnum(bptAmountIn.toString()),
    //             bnum(totalSupply.toString()),
    //             bnum(swapFee.toString())
    //         );

    //         const tokenOut = _calcTokenOutGivenExactBptIn(
    //             balanceScaled,
    //             normalizedWeight,
    //             bptAmountIn,
    //             totalSupply,
    //             swapFee
    //         );
    //         expect(sdkResult.gt(0)).to.be.true;
    //         expect(sdkResult.toString()).to.eq(tokenOut.toString());
    //     }

    //     context('testing against original maths', () => {
    //         it('Pool with 18 decimal tokens', async () => {
    //             const poolId =
    //                 '0x90291319f1d4ea3ad4db0dd8fe9e12baf749e84500020000000000000000013c';
    //             const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //             const scalingFactors = [
    //                 BigInt('1000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             const bptIn = BigInt('7000000000000000000');
    //             compareToSdk(
    //                 scalingFactors[0],
    //                 poolInfo.balances[0],
    //                 poolInfo.normalizedWeights[0],
    //                 bptIn,
    //                 poolInfo.totalSupply,
    //                 poolInfo.swapFee
    //             );
    //         }).timeout(10000);

    //         it('Pool with 6 decimal tokens', async () => {
    //             // USDC/WETH
    //             const poolId =
    //                 '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
    //             const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //             const scalingFactors = [
    //                 BigInt('1000000000000000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             const bptIn = BigInt('123000000000000000000');
    //             compareToSdk(
    //                 scalingFactors[0],
    //                 poolInfo.balances[0],
    //                 poolInfo.normalizedWeights[0],
    //                 bptIn,
    //                 poolInfo.totalSupply,
    //                 poolInfo.swapFee
    //             );
    //         }).timeout(10000);
    //     });
    // });

    // context('_calcBptInGivenExactTokensOut', () => {
    //     // Setup chain
    //     before(async function () {
    //         this.timeout(20000);

    //         await provider.send('hardhat_reset', [
    //             {
    //                 forking: {
    //                     jsonRpcUrl,
    //                     blockNumber: 14828550,
    //                 },
    //             },
    //         ]);
    //     });

    //     function compareToSdk(
    //         scalingFactors: bigint[],
    //         balances: bigint[],
    //         normalizedWeights: bigint[],
    //         amountsOut: bigint[],
    //         totalSupply: bigint,
    //         swapFee: bigint
    //     ) {
    //         const balancesScaled = _upscaleArray(balances, scalingFactors);
    //         const amountsOutScaled = _upscaleArray(
    //             amountsOut.map((a) => BigInt(a)),
    //             scalingFactors
    //         );
    //         const sdkResult = SDK.WeightedMath._calcBptInGivenExactTokensOut(
    //             balancesScaled.map((a) => bnum(a.toString())),
    //             normalizedWeights.map((a) => bnum(a.toString())),
    //             amountsOutScaled.map((a) => bnum(a.toString())),
    //             bnum(totalSupply.toString()),
    //             bnum(swapFee.toString())
    //         );
    //         const calculatedBptIn = _calcBptInGivenExactTokensOut(
    //             balancesScaled,
    //             normalizedWeights,
    //             amountsOutScaled,
    //             totalSupply,
    //             swapFee
    //         );
    //         expect(sdkResult.gt(0)).to.be.true;
    //         expect(sdkResult.toString()).to.eq(calculatedBptIn.toString());
    //     }

    //     context('testing against original maths', () => {
    //         it('Pool with 18 decimal tokens', async () => {
    //             const poolId =
    //                 '0x90291319f1d4ea3ad4db0dd8fe9e12baf749e84500020000000000000000013c';
    //             const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //             const scalingFactors = [
    //                 BigInt('1000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             const amountsOut = [
    //                 BigInt('7000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             compareToSdk(
    //                 scalingFactors,
    //                 poolInfo.balances,
    //                 poolInfo.normalizedWeights,
    //                 amountsOut,
    //                 poolInfo.totalSupply,
    //                 poolInfo.swapFee
    //             );
    //         }).timeout(10000);

    //         it('Pool with 6 decimal tokens', async () => {
    //             // USDC/WETH
    //             const poolId =
    //                 '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019';
    //             const poolInfo = await getPoolOnChain(poolId, vault, provider);
    //             const scalingFactors = [
    //                 BigInt('1000000000000000000000000000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             const amountsOut = [
    //                 BigInt('1234000000'),
    //                 BigInt('1000000000000000000'),
    //             ];
    //             compareToSdk(
    //                 scalingFactors,
    //                 poolInfo.balances,
    //                 poolInfo.normalizedWeights,
    //                 amountsOut,
    //                 poolInfo.totalSupply,
    //                 poolInfo.swapFee
    //             );
    //         }).timeout(10000);
    //     });
    // });
});

function checkDerivative(
    fn: (
        poolPairData: WeightedPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ) => OldBigNumber,
    der: (
        poolPairData: WeightedPoolPairData,
        amount: OldBigNumber
    ) => OldBigNumber,
    poolPairData: WeightedPoolPairData,
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
