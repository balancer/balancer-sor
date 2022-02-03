import { BigNumber } from '@ethersproject/bignumber';
import { parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { BZERO } from '../../src/utils/basicOperations';
import { SubgraphPoolBase, SubgraphToken } from '../../src';
import * as WeightedMath from '../../src/pools/weightedPool/weightedMath';
import { isSameAddress } from '../../src/utils';

export type WeightedPoolPairDataBigInt = {
    balanceIn: bigint;
    balanceOut: bigint;
    weightIn: bigint;
    weightOut: bigint;
    amountIn: bigint;
    fee: bigint;
};

export class WeightedPool {
    static getTokenData(
        token: string,
        totalWeight: BigNumber,
        tokens: SubgraphToken[]
    ): {
        balance: bigint;
        weight: bigint;
    } {
        const tI = tokens.find((t) => isSameAddress(t.address, token));
        if (!tI) throw Error('Tokens missing');
        const balance = parseFixed(tI.balance, tI.decimals).toBigInt();
        if (!tI.weight) throw Error('Token does not contain weight');
        const weight = parseFixed(tI.weight, 18)
            .mul(ONE)
            .div(totalWeight)
            .toBigInt();
        return {
            balance,
            weight,
        };
    }

    static parsePoolPairDataBigInt(
        pool: SubgraphPoolBase,
        tokenIn: string,
        tokenOut: string
    ): WeightedPoolPairDataBigInt {
        if (!pool.totalWeight) throw 'Pool does not contain totalWeight';

        const totalWeight = parseFixed(pool.totalWeight, 18);
        const tI = this.getTokenData(tokenIn, totalWeight, pool.tokens);
        const tO = this.getTokenData(tokenOut, totalWeight, pool.tokens);

        const poolPairData: WeightedPoolPairDataBigInt = {
            balanceIn: tI.balance,
            weightIn: tI.weight,
            balanceOut: tO.balance,
            weightOut: tO.weight,
            amountIn: BZERO,
            fee: parseFixed(pool.swapFee, 18).toBigInt(),
        };

        return poolPairData;
    }

    static calcOutGivenIn(
        poolPairData: WeightedPoolPairDataBigInt,
        amountsIn: bigint[]
    ): bigint[] {
        const amountsOut: bigint[] = [];

        amountsIn.forEach((amountIn) => {
            let amt: bigint;
            try {
                amt = WeightedMath._calcOutGivenIn(
                    poolPairData.balanceIn,
                    poolPairData.weightIn,
                    poolPairData.balanceOut,
                    poolPairData.weightOut,
                    amountIn,
                    poolPairData.fee
                );
            } catch (err) {
                amt = BZERO;
            }
            amountsOut.push(amt);
        });

        return amountsOut;
    }

    // Amount should use token scaled amounts i.e. 1USDC => 1e6
    static calcInGivenOut(
        poolPairData: WeightedPoolPairDataBigInt,
        amountsOut: bigint[]
    ): bigint[] {
        const amountsIn: bigint[] = [];

        amountsOut.forEach((amountOut) => {
            let amt: bigint;
            try {
                amt = WeightedMath._calcInGivenOut(
                    poolPairData.balanceIn,
                    poolPairData.weightIn,
                    poolPairData.balanceOut,
                    poolPairData.weightOut,
                    amountOut,
                    poolPairData.fee
                );
            } catch (err) {
                amt = BZERO;
            }
            amountsIn.push(amt);
        });
        return amountsIn;
    }
}
