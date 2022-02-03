import { getAddress } from '@ethersproject/address';
import { parseFixed } from '@ethersproject/bignumber';
import { SubgraphPoolBase, SubgraphToken } from '../../src/';
import {
    upscaleAmounts,
    downscaleDownAmounts,
    downscaleUpAmounts,
    getTokenScalingFactor,
} from './utils';
import * as StableMath from '../../src/pools/stablePool/stableMathBigInt';

export type StablePoolPairDataBigInt = {
    amp: bigint;
    balances: bigint[];
    tokenIndexIn: number;
    tokenIndexOut: number;
    amountIn: bigint;
    fee: bigint;
    tokenInScalingFactor: bigint;
    tokenOutScalingFactor: bigint;
};

export class StablePool {
    static AMP_DECIMALS = 3;

    static getTokenData(
        token: string,
        tokens: SubgraphToken[]
    ): {
        index: number;
        scalingFactor: bigint;
    } {
        const index = tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(token)
        );
        if (index < 0) throw Error('Token missing');

        const scalingFactor = getTokenScalingFactor(tokens[index].decimals);
        return {
            index,
            scalingFactor,
        };
    }

    static parsePoolPairDataBigInt(
        pool: SubgraphPoolBase,
        tokenIn: string,
        tokenOut: string
    ): StablePoolPairDataBigInt {
        if (!pool.amp) throw 'Pool does not contain Amp';

        // Scale all token balances to 18 decimals (assumed pool.tokens.balances is in human scale)
        const allBalancesScaled = pool.tokens.map(({ balance }) =>
            parseFixed(balance, 18).toBigInt()
        );

        const tI = this.getTokenData(tokenIn, pool.tokens);
        const tO = this.getTokenData(tokenOut, pool.tokens);

        const poolPairData: StablePoolPairDataBigInt = {
            amp: parseFixed(pool.amp, StablePool.AMP_DECIMALS).toBigInt(),
            balances: allBalancesScaled,
            tokenIndexIn: tI.index,
            tokenIndexOut: tO.index,
            amountIn: BigInt(0),
            fee: parseFixed(pool.swapFee, 18).toBigInt(),
            tokenInScalingFactor: tI.scalingFactor,
            tokenOutScalingFactor: tO.scalingFactor,
        };

        return poolPairData;
    }

    // amountsIn should use token scaled amounts i.e. 1USDC => 1e6
    static calcOutGivenIn(
        poolPairData: StablePoolPairDataBigInt,
        amountsIn: bigint[]
    ): bigint[] {
        const amountsOut: bigint[] = [];

        const invariant = StableMath._calculateInvariant(
            poolPairData.amp,
            poolPairData.balances,
            true
        );

        upscaleAmounts(amountsIn, poolPairData.tokenInScalingFactor).forEach(
            (amountIn) => {
                let amt: bigint;
                try {
                    amt = StableMath._calcOutGivenIn(
                        poolPairData.amp,
                        poolPairData.balances,
                        poolPairData.tokenIndexIn,
                        poolPairData.tokenIndexOut,
                        amountIn,
                        poolPairData.fee,
                        invariant
                    );
                } catch (err) {
                    amt = BigInt(0);
                }
                amountsOut.push(amt);
            }
        );

        return downscaleDownAmounts(
            amountsOut,
            poolPairData.tokenOutScalingFactor
        );
    }

    // amountsOut should use token scaled amounts i.e. 1USDC => 1e6
    static calcInGivenOut(
        poolPairData: StablePoolPairDataBigInt,
        amountsOut: bigint[]
    ): bigint[] {
        const amountsIn: bigint[] = [];

        const invariant = StableMath._calculateInvariant(
            poolPairData.amp,
            poolPairData.balances,
            true
        );

        upscaleAmounts(amountsOut, poolPairData.tokenOutScalingFactor).forEach(
            (amountOut) => {
                let amt: bigint;
                try {
                    amt = StableMath._calcInGivenOut(
                        poolPairData.amp,
                        poolPairData.balances,
                        poolPairData.tokenIndexIn,
                        poolPairData.tokenIndexOut,
                        amountOut,
                        poolPairData.fee,
                        invariant
                    );
                } catch (err) {
                    amt = BigInt(0);
                }
                amountsIn.push(amt);
            }
        );

        // amountIn tokens are entering the Pool, so we round up.
        return downscaleUpAmounts(amountsIn, poolPairData.tokenInScalingFactor);
    }
}
