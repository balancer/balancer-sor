import { getAddress } from '@ethersproject/address';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { SubgraphPoolBase, SubgraphToken } from '../../src';
import { BZERO } from '../../src/utils/basicOperations';
import { isSameAddress } from '../../src/utils';
import {
    upscaleAmounts,
    downscaleDownAmounts,
    getTokenScalingFactor,
} from './utils';
import * as StableMath from '../../src/pools/stablePool/stableMathBigInt';

export type PhantomStablePoolPairDataBigInt = {
    amp: bigint;
    balances: bigint[];
    tokenIndexIn: number;
    tokenInPriceRate: bigint;
    tokenIndexOut: number;
    tokenOutPriceRate: bigint;
    amountIn: bigint;
    fee: bigint;
    virtualBptSupply: bigint;
    bptIndex: number;
    pairType: PairTypes;
    tokenInScalingFactor: bigint;
    tokenOutScalingFactor: bigint;
};

enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

export class PhantomStablePool {
    static AMP_DECIMALS = 3;
    static MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');

    // Remove BPT from Balances and update indices
    static removeBPT(
        poolPairData: PhantomStablePoolPairDataBigInt
    ): PhantomStablePoolPairDataBigInt {
        const bptIndex = poolPairData.bptIndex;
        if (bptIndex != -1) {
            poolPairData.balances.splice(bptIndex, 1);
            if (bptIndex < poolPairData.tokenIndexIn)
                poolPairData.tokenIndexIn -= 1;
            if (bptIndex < poolPairData.tokenIndexOut)
                poolPairData.tokenIndexOut -= 1;
        }
        return poolPairData;
    }

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
    ): PhantomStablePoolPairDataBigInt {
        if (!pool.amp) throw 'Pool does not contain amp';

        const tI = this.getTokenData(tokenIn, pool.tokens);
        const tO = this.getTokenData(tokenOut, pool.tokens);

        // Get all token balances
        const allBalancesScaled = pool.tokens.map(({ balance, priceRate }) =>
            parseFixed(balance, 18)
                .mul(parseFixed(priceRate, 18))
                .div(ONE)
                .toBigInt()
        );

        // Phantom pools allow trading between token and pool BPT
        let pairType: PairTypes;
        if (isSameAddress(tokenIn, pool.address)) {
            pairType = PairTypes.BptToToken;
        } else if (isSameAddress(tokenOut, pool.address)) {
            pairType = PairTypes.TokenToBpt;
        } else {
            pairType = PairTypes.TokenToToken;
        }

        const bptIndex = pool.tokensList.indexOf(pool.address);

        // VirtualBPTSupply must be used for the maths
        const virtualBptSupply = PhantomStablePool.MAX_TOKEN_BALANCE.sub(
            allBalancesScaled[bptIndex]
        ).toBigInt();

        const poolPairData: PhantomStablePoolPairDataBigInt = {
            amp: parseFixed(
                pool.amp,
                PhantomStablePool.AMP_DECIMALS
            ).toBigInt(),
            balances: allBalancesScaled,
            tokenIndexIn: tI.index,
            tokenIndexOut: tO.index,
            amountIn: BZERO,
            fee: parseFixed(pool.swapFee, 18).toBigInt(),
            virtualBptSupply,
            tokenInPriceRate: tI.priceRate,
            tokenOutPriceRate: tO.priceRate,
            bptIndex,
            pairType,
            tokenInScalingFactor: tI.scalingFactor,
            tokenOutScalingFactor: tO.scalingFactor,
        };

        return PhantomStablePool.removeBPT(poolPairData);
    }

    // amountsIn should use token scaled amounts i.e. 1USDC => 1e6
    static calcOutGivenIn(
        poolPairData: PhantomStablePoolPairDataBigInt,
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
                    const amountInWithFee =
                        (StableMath.subtractFee(amountIn, poolPairData.fee) *
                            poolPairData.tokenInPriceRate) /
                        BigInt(1e18);

                    if (poolPairData.pairType === PairTypes.TokenToToken) {
                        amt = StableMath._calcOutGivenIn(
                            poolPairData.amp,
                            poolPairData.balances,
                            poolPairData.tokenIndexIn,
                            poolPairData.tokenIndexOut,
                            amountInWithFee,
                            BZERO,
                            invariant
                        );
                    } else if (poolPairData.pairType === PairTypes.TokenToBpt) {
                        const amountsInBigInt = Array(
                            poolPairData.balances.length
                        ).fill(BZERO);
                        amountsInBigInt[poolPairData.tokenIndexIn] =
                            amountInWithFee;

                        amt = StableMath._calcBptOutGivenExactTokensIn(
                            poolPairData.amp,
                            poolPairData.balances,
                            amountsInBigInt,
                            poolPairData.virtualBptSupply,
                            BZERO,
                            invariant
                        );
                    } else if (poolPairData.pairType === PairTypes.BptToToken) {
                        amt = StableMath._calcTokenOutGivenExactBptIn(
                            poolPairData.amp,
                            poolPairData.balances,
                            poolPairData.tokenIndexOut,
                            amountInWithFee,
                            poolPairData.virtualBptSupply,
                            BZERO,
                            invariant
                        );
                    } else {
                        return BZERO;
                    }
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
        poolPairData: PhantomStablePoolPairDataBigInt,
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
                    const amtOut =
                        (amountOut * poolPairData.tokenOutPriceRate) /
                        BigInt(1e18);

                    if (poolPairData.pairType === PairTypes.TokenToToken) {
                        amt = StableMath._calcInGivenOut(
                            poolPairData.amp,
                            poolPairData.balances,
                            poolPairData.tokenIndexIn,
                            poolPairData.tokenIndexOut,
                            amtOut,
                            BZERO,
                            invariant
                        );
                    } else if (poolPairData.pairType === PairTypes.TokenToBpt) {
                        amt = StableMath._calcTokenInGivenExactBptOut(
                            poolPairData.amp,
                            poolPairData.balances,
                            poolPairData.tokenIndexIn,
                            amtOut,
                            poolPairData.virtualBptSupply,
                            BZERO,
                            invariant
                        );
                    } else if (poolPairData.pairType === PairTypes.BptToToken) {
                        const amountsOutBigInt = Array(
                            poolPairData.balances.length
                        ).fill(BZERO);
                        amountsOutBigInt[poolPairData.tokenIndexOut] = amtOut;

                        amt = StableMath._calcBptInGivenExactTokensOut(
                            poolPairData.amp,
                            poolPairData.balances,
                            amountsOutBigInt,
                            poolPairData.virtualBptSupply,
                            BZERO,
                            invariant
                        );
                    } else return BZERO;

                    // In Phantom Pools every time there is a swap (token per token, bpt per token or token per bpt), we substract the fee from the amount in
                    const returnEvmWithRate =
                        (amt * BigInt(1e18)) / poolPairData.tokenInPriceRate;

                    amt = StableMath.addFee(
                        returnEvmWithRate,
                        poolPairData.fee
                    );
                } catch (err) {
                    amt = BZERO;
                }
                amountsIn.push(amt);
            }
        );

        return downscaleDownAmounts(
            amountsIn,
            poolPairData.tokenInScalingFactor
        );
    }
}
