import { getAddress } from '@ethersproject/address';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { SubgraphPoolBase, SubgraphToken } from '../../src/';
import { isSameAddress } from '../../src/utils';
import {
    upscaleAmounts,
    downscaleDownAmounts,
    downscaleUpAmounts,
    getTokenScalingFactor,
} from './utils';
import * as LinearMath from '../../src/pools/linearPool/linearMath';

export type LinearPoolPairDataBigInt = {
    pairType: PairTypes;
    balances: bigint[];
    amountIn: bigint;
    fee: bigint;
    wrappedBalance: bigint;
    mainBalance: bigint;
    virtualBptSupply: bigint;
    lowerTarget: bigint;
    upperTarget: bigint;
    rate: bigint;
    tokenInScalingFactor: bigint;
    tokenOutScalingFactor: bigint;
};

export enum PairTypes {
    BptToMainToken,
    MainTokenToBpt,
    MainTokenToWrappedToken,
    WrappedTokenToMainToken,
    BptToWrappedToken,
    WrappedTokenToBpt,
}

export class LinearPool {
    static MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');

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

        const scalingFactor = getTokenScalingFactor(tokens[index].decimals);

        const priceRate = parseFixed(tokens[index].priceRate, 18).toBigInt();
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
    ): LinearPoolPairDataBigInt {
        let pairType: PairTypes;

        if (!pool.wrappedIndex)
            throw Error(`Pool does not contain wrappedIndex`);

        if (!pool.upperTarget) throw Error(`Pool does not contain upperTarget`);

        if (!pool.lowerTarget) throw Error(`Pool does not contain lowerTarget`);

        if (!pool.mainIndex) throw Error(`Pool does not contain mainIndex`);

        const tI = this.getTokenData(tokenIn, pool.tokens);
        const tO = this.getTokenData(tokenOut, pool.tokens);

        /* 
        Linear pools allow trading between:
        wrappedToken <> mainToken
        wrappedToken <> BPT
        mainToken <> BPT
        */
        if (isSameAddress(tokenIn, pool.address)) {
            if (isSameAddress(tokenOut, pool.tokens[pool.wrappedIndex].address))
                pairType = PairTypes.BptToWrappedToken;
            else pairType = PairTypes.BptToMainToken;
        } else if (isSameAddress(tokenOut, pool.address)) {
            if (isSameAddress(tokenIn, pool.tokens[pool.wrappedIndex].address))
                pairType = PairTypes.WrappedTokenToBpt;
            else pairType = PairTypes.MainTokenToBpt;
        } else {
            if (isSameAddress(tokenIn, pool.tokens[pool.wrappedIndex].address))
                pairType = PairTypes.WrappedTokenToMainToken;
            else pairType = PairTypes.MainTokenToWrappedToken;
        }

        const bptIndex = pool.tokensList.indexOf(pool.address);

        // Get all token balances scaled to 18
        const allBalancesScaled = pool.tokens.map(({ balance }) =>
            parseFixed(balance, 18).toBigInt()
        );
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/88a14eb623f6a22ef3f1afc5a8c49ebfa7eeceed/pkg/pool-linear/contracts/LinearPool.sol#L247
        // VirtualBPTSupply must be used for the maths
        const bptBalanceScaled = allBalancesScaled[bptIndex];
        const virtualBptSupply =
            LinearPool.MAX_TOKEN_BALANCE.sub(bptBalanceScaled).toBigInt();

        const poolPairData: LinearPoolPairDataBigInt = {
            pairType,
            balances: allBalancesScaled,
            amountIn: BigInt(0),
            fee: parseFixed(pool.swapFee, 18).toBigInt(),
            wrappedBalance: allBalancesScaled[pool.wrappedIndex],
            mainBalance: allBalancesScaled[pool.mainIndex],
            virtualBptSupply,
            lowerTarget: parseFixed(pool.lowerTarget, 18).toBigInt(),
            upperTarget: parseFixed(pool.upperTarget, 18).toBigInt(),
            rate: parseFixed(
                pool.tokens[pool.wrappedIndex].priceRate,
                18
            ).toBigInt(),
            tokenInScalingFactor: tI.scalingFactor,
            tokenOutScalingFactor: tO.scalingFactor,
        };

        return poolPairData;
    }

    // amountsIn should use token scaled amounts i.e. 1USDC => 1e6
    static calcOutGivenIn(
        poolPairData: LinearPoolPairDataBigInt,
        amountsIn: bigint[]
    ): bigint[] {
        const amountsOut: bigint[] = [];

        // TO DO - make params?
        // TO DO - Optimise
        // const invariant = StableMath._calculateInvariant(
        //     poolPairData.amp,
        //     poolPairData.balances,
        //     true
        // );

        upscaleAmounts(amountsIn, poolPairData.tokenInScalingFactor).forEach(
            (amountIn) => {
                let amt: bigint;
                try {
                    if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
                        amt = LinearPool._exactMainTokenInForBPTOut(
                            poolPairData,
                            amountIn
                        );
                    } else if (
                        poolPairData.pairType === PairTypes.BptToMainToken
                    ) {
                        amt = LinearPool._exactBPTInForMainTokenOut(
                            poolPairData,
                            amountIn
                        );
                        // TO DO - Add these in if useful
                        // } else if (poolPairData.pairType === PairTypes.WrappedTokenToBpt) {
                        //     amt = LinearPool._exactWrappedTokenInForBPTOut(poolPairData, amount);
                        // } else if (poolPairData.pairType === PairTypes.BptToWrappedToken) {
                        //     amt = LinearPool._exactBPTInForWrappedTokenOut(poolPairData, amount);
                        // } else if (
                        //     poolPairData.pairType === PairTypes.MainTokenToWrappedToken
                        // ) {
                        //     amt = LinearPool._exactMainTokenInForWrappedOut(poolPairData, amount);
                        // } else if (
                        //     poolPairData.pairType === PairTypes.WrappedTokenToMainToken
                        // ) {
                        //     amt = LinearPool._exactWrappedTokenInForMainOut(poolPairData, amount);
                    } else amt = BigInt(0);
                } catch (err) {
                    amt = BigInt(0);
                }
                amountsOut.push(amt);
            }
        );
        // amountOut tokens are exiting the Pool, so we round down.
        return downscaleDownAmounts(
            amountsOut,
            poolPairData.tokenOutScalingFactor
        );
    }

    // amountsOut should use token scaled amounts i.e. 1USDC => 1e6
    static calcInGivenOut(
        poolPairData: LinearPoolPairDataBigInt,
        amountsOut: bigint[]
    ): bigint[] {
        const amountsIn: bigint[] = [];

        // TO DO - Optimise
        // const invariant = StableMath._calculateInvariant(
        //     poolPairData.amp,
        //     poolPairData.balances,
        //     true
        // );

        upscaleAmounts(amountsOut, poolPairData.tokenOutScalingFactor).forEach(
            (amountOut) => {
                let amt: bigint;
                try {
                    if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
                        amt = LinearPool._mainTokenInForExactBPTOut(
                            poolPairData,
                            amountOut
                        );
                    } else if (
                        poolPairData.pairType === PairTypes.BptToMainToken
                    ) {
                        amt = LinearPool._BPTInForExactMainTokenOut(
                            poolPairData,
                            amountOut
                        );
                    } else amt = BigInt(0);
                } catch (err) {
                    amt = BigInt(0);
                }
                amountsIn.push(amt);
            }
        );
        // amountIn tokens are entering the Pool, so we round up.
        return downscaleUpAmounts(amountsIn, poolPairData.tokenInScalingFactor);
    }

    static _exactMainTokenInForBPTOut(
        poolPairData: LinearPoolPairDataBigInt,
        amount: bigint
    ): bigint {
        try {
            return LinearMath._calcBptOutPerMainIn(
                amount,
                poolPairData.mainBalance,
                poolPairData.wrappedBalance,
                poolPairData.virtualBptSupply,
                {
                    fee: poolPairData.fee,
                    lowerTarget: poolPairData.lowerTarget,
                    upperTarget: poolPairData.upperTarget,
                    rate: poolPairData.rate,
                }
            );
        } catch (err) {
            return BigInt(0);
        }
    }

    static _exactBPTInForMainTokenOut(
        poolPairData: LinearPoolPairDataBigInt,
        amount: bigint
    ): bigint {
        try {
            return LinearMath._calcMainOutPerBptIn(
                amount,
                poolPairData.mainBalance,
                poolPairData.wrappedBalance,
                poolPairData.virtualBptSupply,
                {
                    fee: poolPairData.fee,
                    lowerTarget: poolPairData.lowerTarget,
                    upperTarget: poolPairData.upperTarget,
                    rate: poolPairData.rate,
                }
            );
        } catch (err) {
            return BigInt(0);
        }
    }

    static _mainTokenInForExactBPTOut(
        poolPairData: LinearPoolPairDataBigInt,
        amount: bigint
    ): bigint {
        try {
            return LinearMath._calcMainInPerBptOut(
                amount,
                poolPairData.mainBalance,
                poolPairData.wrappedBalance,
                poolPairData.virtualBptSupply,
                {
                    fee: poolPairData.fee,
                    lowerTarget: poolPairData.lowerTarget,
                    upperTarget: poolPairData.upperTarget,
                    rate: poolPairData.rate,
                }
            );
        } catch (err) {
            return BigInt(0);
        }
    }

    static _BPTInForExactMainTokenOut(
        poolPairData: LinearPoolPairDataBigInt,
        amount: bigint
    ): bigint {
        try {
            return LinearMath._calcBptInPerMainOut(
                amount,
                poolPairData.mainBalance,
                poolPairData.wrappedBalance,
                poolPairData.virtualBptSupply,
                {
                    fee: poolPairData.fee,
                    lowerTarget: poolPairData.lowerTarget,
                    upperTarget: poolPairData.upperTarget,
                    rate: poolPairData.rate,
                }
            );
        } catch (err) {
            return BigInt(0);
        }
    }
}
