import { getAddress } from '@ethersproject/address';
import { parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { SubgraphPoolBase, SubgraphToken } from '../../src';
import { BZERO } from '../../src/utils/basicOperations';
import {
    upscaleAmounts,
    downscaleDownAmounts,
    downscaleUpAmounts,
    getTokenScalingFactor,
} from './utils';
import * as StableMath from '../../src/pools/stablePool/stableMathBigInt';

export type MetaStablePoolPairDataBigInt = {
    amp: bigint;
    balances: bigint[];
    tokenInPriceRate: bigint;
    tokenOutPriceRate: bigint;
    tokenIndexIn: number;
    tokenIndexOut: number;
    amountIn: bigint;
    fee: bigint;
    tokenInScalingFactor: bigint;
    tokenOutScalingFactor: bigint;
};

export class MetaStablePool {
    static AMP_DECIMALS = 3;

    static getTokenData(
        token: string,
        tokens: SubgraphToken[]
    ): {
        index: number;
        scalingFactor: bigint;
        priceRate: bigint;
    } {
        const index = tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(token)
        );
        if (index < 0) throw Error('Token missing');

        const priceRate = parseFixed(tokens[index].priceRate, 18).toBigInt();
        const scalingFactor = getTokenScalingFactor(tokens[index].decimals);
        return {
            index,
            scalingFactor,
            priceRate,
        };
    }

    static parsePoolPairDataBigInt(
        pool: SubgraphPoolBase,
        tokenIn: string,
        tokenOut: string
    ): MetaStablePoolPairDataBigInt {
        if (!pool.amp) throw 'Pool does not contain Amp';

        // Scale all token balances to 18 decimals (assumed pool.tokens.balances is in human scale)
        // const allBalancesScaled = pool.tokens.map(({ balance }) =>
        //     parseFixed(balance, 18).toBigInt()
        // );
        const allBalancesScaled = pool.tokens.map(({ balance, priceRate }) =>
            parseFixed(balance, 18)
                .mul(parseFixed(priceRate, 18))
                .div(ONE)
                .toBigInt()
        );

        const tI = this.getTokenData(tokenIn, pool.tokens);
        const tO = this.getTokenData(tokenOut, pool.tokens);

        const poolPairData: MetaStablePoolPairDataBigInt = {
            amp: parseFixed(pool.amp, MetaStablePool.AMP_DECIMALS).toBigInt(),
            balances: allBalancesScaled,
            tokenIndexIn: tI.index,
            tokenIndexOut: tO.index,
            amountIn: BZERO,
            fee: parseFixed(pool.swapFee, 18).toBigInt(),
            tokenInScalingFactor: tI.scalingFactor,
            tokenOutScalingFactor: tO.scalingFactor,
            tokenInPriceRate: tI.priceRate,
            tokenOutPriceRate: tO.priceRate,
        };

        return poolPairData;
    }

    // amountsIn should use token scaled amounts i.e. 1USDC => 1e6
    static calcOutGivenIn(
        poolPairData: MetaStablePoolPairDataBigInt,
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
                    const amountInWithRate =
                        (amountIn * poolPairData.tokenInPriceRate) /
                        BigInt(1e18);

                    amt = StableMath._calcOutGivenIn(
                        poolPairData.amp,
                        poolPairData.balances,
                        poolPairData.tokenIndexIn,
                        poolPairData.tokenIndexOut,
                        amountInWithRate,
                        poolPairData.fee,
                        invariant
                    );
                    amt = (amt * BigInt(1e18)) / poolPairData.tokenOutPriceRate;
                } catch (err) {
                    amt = BZERO;
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
        poolPairData: MetaStablePoolPairDataBigInt,
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
                    const amountOutWithRate =
                        (amountOut * poolPairData.tokenOutPriceRate) /
                        BigInt(1e18);

                    amt = StableMath._calcInGivenOut(
                        poolPairData.amp,
                        poolPairData.balances,
                        poolPairData.tokenIndexIn,
                        poolPairData.tokenIndexOut,
                        amountOutWithRate,
                        poolPairData.fee,
                        invariant
                    );
                    amt = (amt * BigInt(1e18)) / poolPairData.tokenInPriceRate;
                } catch (err) {
                    amt = BZERO;
                }
                amountsIn.push(amt);
            }
        );

        // amountIn tokens are entering the Pool, so we round up.
        return downscaleUpAmounts(amountsIn, poolPairData.tokenInScalingFactor);
    }
}
