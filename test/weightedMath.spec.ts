// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/weightedMath.spec.ts
import dotenv from 'dotenv';
import { assert, expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { defaultAbiCoder } from '@ethersproject/abi';
import {
    BalancerHelpers__factory,
    Vault__factory,
    WeightedPool__factory,
    Vault,
} from '@balancer-labs/typechain';
import { BigNumber as OldBigNumber } from '../src/utils/bignumber';
import { bnum } from '../src/utils/bignumber';
import { BAL, WETH, vaultAddr } from './lib/constants';
import singleWeightedPool from './testData/weightedPools/singlePoolWithSwapEnabled.json';
import { WeightedPool } from '../src/pools/weightedPool/weightedPool';
import { AddressZero } from '@ethersproject/constants';

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
                    },
                },
            ]);
        });

        it('Pool with 18 decimal tokens', async () => {
            const poolId =
                '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014';

            const poolInfo = await getPoolOnChain(poolId, vault, provider);
            const EXACT_TOKENS_IN_FOR_BPT_OUT = 1;
            const assets = poolInfo.tokens;
            const amountsIn = ['1000000000000000000', '1000000000000000000'];
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

            console.log(query.toString());
        }).timeout(10000);
    });
});

async function getPoolOnChain(
    poolId: string,
    vault: Vault,
    provider: JsonRpcProvider,
    print = false
): Promise<{
    poolId: string;
    tokens: string[];
    swapFee: string;
    normalizedWeights: string[];
    balances: string[];
    totalSupply: string;
}> {
    const pool = await vault.getPool(poolId);
    const poolContract = WeightedPool__factory.connect(pool[0], provider);
    const swapFee = await poolContract.getSwapFeePercentage();
    const totalSupply = await poolContract.totalSupply();
    const normalizedWeights = await poolContract.getNormalizedWeights();
    const poolTokens = await vault.getPoolTokens(poolId);

    if (print) {
        console.log(poolId);
        console.log(pool[0]);
        console.log(`SwapFee: `, swapFee.toString());
        console.log(`totalSupply: `, totalSupply.toString());
        console.log(`tokens`, poolTokens.tokens.toString());
        console.log(`normalizedWeights: `, normalizedWeights.toString());
        console.log(`balances: `, poolTokens.balances.toString());
    }
    return {
        poolId: poolId,
        tokens: poolTokens.tokens,
        swapFee: swapFee.toString(),
        normalizedWeights: normalizedWeights.map((w) => w.toString()),
        balances: poolTokens.balances.map((b) => b.toString()),
        totalSupply: totalSupply.toString(),
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
