import { getAddress } from '@ethersproject/address';
import {
    BigNumber as OldBigNumber,
    bnum,
    scale,
    ZERO,
} from '../../utils/bignumber';
import { isSameAddress } from '../../utils';
import {
    PoolBase,
    PoolTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
    NoNullableField,
} from '../../types';
import {
    _calcOutGivenIn,
    _calcInGivenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _calcBptOutGivenExactTokensIn,
    _calcTokenOutGivenExactBptIn,
    _calcTokenInGivenExactBptOut,
    _calcBptInGivenExactTokensOut,
    _spotPriceAfterSwapExactTokenInForBPTOut,
    _spotPriceAfterSwapExactBPTInForTokenOut,
    _spotPriceAfterSwapTokenInForExactBPTOut,
    _spotPriceAfterSwapBPTInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
} from './managedMath';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { takeToPrecision18 } from '../../router/helpersClass';
import { MathSol } from '../../utils/basicOperations';
import { max } from 'lodash';
import { filterPoolsByType } from 'routeProposal/filtering';

enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

export type ManagedPoolToken = Pick<
    NoNullableField<SubgraphToken>,
    'address' | 'balance' | 'decimals' | 'weight'
>;

export type ManagedPoolPairData = PoolPairBase & {
    pairType: PairTypes;
    weightIn: BigNumber;
    weightOut: BigNumber;
};

export class ManagedPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Managed;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: ManagedPoolToken[];
    totalWeight: BigNumber;
    tokensList: string[];
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);
    referenceBptPrices: number[];
    lowerBreakerRatio: number;
    upperBreakerRatio: number;

    static fromPool(pool: SubgraphPoolBase): ManagedPool {
        if (!pool.totalWeight)
            throw new Error('ManagedPool missing totalWeight');
        if (!pool.referenceBptPrices)
            throw new Error('ManagedPool missing referenceBptPrices');
        if (!pool.lowerBreakerRatio)
            throw new Error('ManagedPool missing lowerBreakerRatio');
        if (!pool.upperBreakerRatio)
            throw new Error('ManagedPool missing upperBreakerRatio');

        const managedPool = new ManagedPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalWeight,
            pool.totalShares,
            pool.tokens as ManagedPoolToken[],
            pool.tokensList,
            pool.referenceBptPrices,
            pool.lowerBreakerRatio,
            pool.upperBreakerRatio
        );
        return managedPool;
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalWeight: string,
        totalShares: string,
        tokens: ManagedPoolToken[],
        tokensList: string[],
        referenceBptPrices: number[],
        lowerBreakerRatio: number,
        upperBreakerRatio: number
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.totalWeight = parseFixed(totalWeight, 18);
        this.referenceBptPrices = referenceBptPrices;
        this.lowerBreakerRatio = lowerBreakerRatio;
        this.upperBreakerRatio = upperBreakerRatio;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): ManagedPoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const decimalsIn = tI.decimals;
        let balanceIn = parseFixed(tI.balance, decimalsIn);
        const weightIn = parseFixed(tI.weight, 18)
            .mul(ONE)
            .div(this.totalWeight);

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const decimalsOut = tO.decimals;
        let balanceOut = parseFixed(tO.balance, decimalsOut);
        const weightOut = parseFixed(tO.weight, 18)
            .mul(ONE)
            .div(this.totalWeight);

        let pairType: PairTypes;
        if (tokenIn == this.address) {
            pairType = PairTypes.BptToToken;
            balanceIn = this.totalShares;
        } else if (tokenOut == this.address) {
            pairType = PairTypes.TokenToBpt;
            balanceOut = this.totalShares;
        } else {
            pairType = PairTypes.TokenToToken;
        }

        const poolPairData: ManagedPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: balanceIn,
            balanceOut: balanceOut,
            pairType: pairType,
            weightIn: weightIn,
            weightOut: weightOut,
            swapFee: this.swapFee,
        };

        return poolPairData;
    }

    // Normalized liquidity is an abstract term that can be thought of the
    // inverse of the slippage. It is proportional to the token balances in the
    // pool but also depends on the shape of the invariant curve.
    // As a standard, we define normalized liquidity in tokenOut
    getNormalizedLiquidity(poolPairData: ManagedPoolPairData): OldBigNumber {
        // this should be different if tokenIn or tokenOut are the BPT
        return bnum(
            formatFixed(
                poolPairData.balanceOut
                    .mul(poolPairData.weightIn)
                    .div(poolPairData.weightIn.add(poolPairData.weightOut)),
                poolPairData.decimalsOut
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: ManagedPoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        const isExactIn = swapType == SwapTypes.SwapExactIn;
        let maxByBalanceRatio: OldBigNumber;
        let maxByCircuitBreaker: OldBigNumber = bnum(Infinity);
        // Compute maxByBalanceRatio
        if (swapType === SwapTypes.SwapExactIn) {
            maxByBalanceRatio = bnum(
                formatFixed(
                    poolPairData.balanceIn.mul(this.MAX_IN_RATIO).div(ONE),
                    poolPairData.decimalsIn
                )
            );
        } else {
            maxByBalanceRatio = bnum(
                formatFixed(
                    poolPairData.balanceOut.mul(this.MAX_OUT_RATIO).div(ONE),
                    poolPairData.decimalsOut
                )
            );
        }
        // Compute maxByCircuitBreaker
        // retrieve balances
        const balances = this.tokens.map((token) => bnum(token.balance));
        const balanceIn = bnum(
            formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
        );
        const balanceOut = bnum(
            formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
        );
        // Note: it might be good to work with "vault balance" for BPT
        // retrieve BPT balance
        // Maybe: determine the input token
        const n = this.tokens.length;
        const lowerPriceLimits: number[] = [];
        const upperPriceLimits: number[] = [];
        const totalWeight = this.totalWeight.div(ONE).toNumber();
        const S = bnum(formatFixed(this.totalShares, 18));
        // For each token
        // This assumes that BPT is at position 0
        const limitAmounts: OldBigNumber[] = [];
        for (let i = 1; i < n; i++) {
            const isTokenIn = this.tokens[i].address == poolPairData.tokenIn;
            const isTokenOut = this.tokens[i].address == poolPairData.tokenOut;
            const w = Number(this.tokens[i].weight) / totalWeight;
            //// compute price limits: lowerPriceLimit, upperPriceLimit
            const lowerPriceLimit =
                this.referenceBptPrices[i - 1] *
                this.lowerBreakerRatio ** (1 - w);
            const upperPriceLimit =
                this.referenceBptPrices[i - 1] *
                this.upperBreakerRatio ** (1 - w);
            lowerPriceLimits.push(lowerPriceLimit);
            upperPriceLimits.push(upperPriceLimit);
            let limitAmount: OldBigNumber = bnum(Infinity);

            let balanceUpperLimit,
                balanceLowerLimit,
                supplyUpperLimit,
                supplyLowerLimit,
                limitAmountIn,
                limitAmountOut: OldBigNumber;
            if (poolPairData.pairType == PairTypes.TokenToToken) {
                if (isTokenIn) {
                    balanceUpperLimit = S.times(w).div(lowerPriceLimit);
                    limitAmountIn = balanceUpperLimit.minus(balanceIn);
                    if (isExactIn) {
                        limitAmount = limitAmountIn;
                    } else {
                        limitAmount = this._exactTokenInForTokenOut(
                            poolPairData,
                            limitAmountIn
                        );
                    }
                } else if (isTokenOut) {
                    balanceLowerLimit = S.times(w).div(upperPriceLimit);
                    limitAmountOut = balanceOut.minus(balanceLowerLimit);
                    if (isExactIn) {
                        limitAmount = this._tokenInForExactTokenOut(
                            poolPairData,
                            limitAmountOut
                        );
                    } else {
                        limitAmount = limitAmountOut;
                    }
                }
            } else {
                // It is joinswap or exitswap
                if (isTokenIn) {
                    // case 3, joinswap
                    if (isExactIn) {
                        // limit is given by balance upper limit according to:
                        // B_l^{1-w} = w * S / (B^w * L)
                        balanceUpperLimit = solveEquationA(
                            w,
                            S,
                            balanceIn,
                            lowerPriceLimit
                        );
                        limitAmount = balanceUpperLimit.minus(balanceIn);
                    } else {
                        // we have to compute BPT supply upper limit
                        // S_l^{1/w - 1} = w \frac{S^{1/w}}{LB}
                        supplyUpperLimit = solveEquationB(
                            w,
                            S,
                            balanceIn,
                            lowerPriceLimit
                        );
                        limitAmountOut = supplyUpperLimit.minus(S);
                        limitAmount = limitAmountOut;
                    }
                } else if (isTokenOut) {
                    // case 3, exitswap
                    if (isExactIn) {
                        // we have to compute BPT supply lower limit
                        // S_l^{1/w - 1} = w \frac{S^{1/w}}{LB}
                        supplyLowerLimit = solveEquationB(
                            w,
                            S,
                            balanceOut,
                            upperPriceLimit
                        );
                        limitAmountIn = S.minus(supplyLowerLimit);
                        limitAmount = limitAmountIn;
                        limitAmountOut = this._exactTokenInForTokenOut(
                            poolPairData,
                            limitAmountIn
                        );
                        balanceLowerLimit = balanceOut.minus(limitAmountOut);
                    } else {
                        // limit is given by balance lower limit according to:
                        // B_l^{1-w} = w * S / (B^w * L)
                        balanceLowerLimit = solveEquationA(
                            w,
                            S,
                            balanceOut,
                            upperPriceLimit
                        );
                        limitAmount = balanceOut.minus(balanceLowerLimit);
                    }
                } else {
                    // This is case 2: the token is not being swapped
                    if (poolPairData.pairType == PairTypes.BptToToken) {
                        // exitSwap
                        supplyLowerLimit = balances[i]
                            .times(lowerPriceLimit)
                            .div(w);
                        limitAmountIn = S.minus(supplyLowerLimit);
                        if (isExactIn) {
                            limitAmount = limitAmountIn;
                        } else {
                            limitAmount = this._exactTokenInForTokenOut(
                                poolPairData,
                                limitAmountIn
                            );
                        }
                    }
                    if (poolPairData.pairType == PairTypes.TokenToBpt) {
                        // joinSwap
                        supplyUpperLimit = balances[i]
                            .times(upperPriceLimit)
                            .div(w);
                        limitAmountOut = supplyUpperLimit.minus(S);
                        if (isExactIn) {
                            limitAmount = this._tokenInForExactTokenOut(
                                poolPairData,
                                limitAmountOut
                            );
                        } else {
                            limitAmount = limitAmountOut;
                        }
                    }
                }
            }
            limitAmounts.push(limitAmount);
        }
        maxByCircuitBreaker = OldBigNumber.min(...limitAmounts).times(0.99);
        // Multiplication by 0.99 to avoid possible errors
        // due to rounding and fees.
        return OldBigNumber.min(maxByBalanceRatio, maxByCircuitBreaker);
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (this.address == token) {
            this.totalShares = newBalance;
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => isSameAddress(t.address, token));
            if (!T) throw Error('Pool does not contain this token');
            T.balance = formatFixed(newBalance, T.decimals);
        }
    }

    // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
    // i.e. when using token with 2decimals 0.002 should be returned as 0
    // Uses ROUND_DOWN mode (1)
    // calcOutGivenIn
    _exactTokenInForTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (amount.isNaN()) return amount;
        const amountIn = parseFixed(amount.dp(18, 1).toString(), 18).toBigInt();
        const decimalsIn = poolPairData.decimalsIn;
        const decimalsOut = poolPairData.decimalsOut;
        const balanceIn = takeToPrecision18(
            poolPairData.balanceIn,
            decimalsIn
        ).toBigInt();
        const balanceOut = takeToPrecision18(
            poolPairData.balanceOut,
            decimalsOut
        ).toBigInt();
        const normalizedWeightIn = poolPairData.weightIn.toBigInt();
        const normalizedWeightOut = poolPairData.weightOut.toBigInt();
        const swapFee = poolPairData.swapFee.toBigInt();
        let returnAmt: bigint;
        try {
            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                returnAmt = _calcBptOutGivenExactTokensIn(
                    [balanceIn, BigInt(1)],
                    [normalizedWeightIn, MathSol.ONE - normalizedWeightIn],
                    [amountIn, BigInt(0)],
                    this.totalShares.toBigInt(),
                    swapFee
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                returnAmt = _calcTokenOutGivenExactBptIn(
                    balanceOut,
                    normalizedWeightOut,
                    amountIn,
                    balanceIn,
                    swapFee
                );
            } else {
                returnAmt = _calcOutGivenIn(
                    balanceIn,
                    normalizedWeightIn,
                    balanceOut,
                    normalizedWeightOut,
                    amountIn,
                    swapFee
                );
            }
            // return human scaled
            return scale(bnum(returnAmt.toString()), -18);
        } catch (err) {
            return ZERO;
        }
    }

    // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
    // i.e. when using token with 2decimals 0.002 should be returned as 0
    // Uses ROUND_UP mode (0)
    // calcInGivenOut
    _tokenInForExactTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (amount.isNaN()) return amount;
        const amountOut = parseFixed(
            amount.dp(18, 1).toString(),
            18
        ).toBigInt();
        const decimalsIn = poolPairData.decimalsIn;
        const decimalsOut = poolPairData.decimalsOut;
        const balanceIn = takeToPrecision18(
            poolPairData.balanceIn,
            decimalsIn
        ).toBigInt();
        const balanceOut = takeToPrecision18(
            poolPairData.balanceOut,
            decimalsOut
        ).toBigInt();
        const normalizedWeightIn = poolPairData.weightIn.toBigInt();
        const normalizedWeightOut = poolPairData.weightOut.toBigInt();
        const swapFee = poolPairData.swapFee.toBigInt();
        let returnAmt: bigint;
        try {
            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                returnAmt = _calcTokenInGivenExactBptOut(
                    balanceIn,
                    normalizedWeightIn,
                    amountOut,
                    balanceOut,
                    swapFee
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                returnAmt = _calcBptInGivenExactTokensOut(
                    [balanceOut, BigInt(1)],
                    [normalizedWeightOut, MathSol.ONE - normalizedWeightOut],
                    [amountOut, BigInt(0)],
                    balanceIn,
                    swapFee
                );
            } else {
                returnAmt = _calcInGivenOut(
                    balanceIn,
                    normalizedWeightIn,
                    balanceOut,
                    normalizedWeightOut,
                    amountOut,
                    swapFee
                );
            }
            // return human scaled
            return scale(bnum(returnAmt.toString()), -18);
        } catch (err) {
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return _spotPriceAfterSwapExactTokenInForBPTOut(
                amount,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return _spotPriceAfterSwapExactBPTInForTokenOut(
                amount,
                poolPairData
            );
        } else {
            return _spotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                poolPairData
            );
        }
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return _spotPriceAfterSwapTokenInForExactBPTOut(
                amount,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return _spotPriceAfterSwapBPTInForExactTokenOut(
                amount,
                poolPairData
            );
        } else {
            return _spotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                poolPairData
            );
        }
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                amount,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                amount,
                poolPairData
            );
        } else {
            return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                poolPairData
            );
        }
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}

// Apparently there is no exponential function for real-valued exponents in BigNumber.js
// That is why we need this auxiliary function
function bnumPow(base: OldBigNumber, exponent: number): OldBigNumber {
    const ten_pow_eighteen = bnum(10).pow(18);
    const bigintBase = BigInt(
        base.times(ten_pow_eighteen).integerValue().toString()
    );
    const bigIntExponent = BigInt(
        bnum(exponent).times(ten_pow_eighteen).integerValue().toString()
    );
    const bigIntResult = MathSol.powUpFixed(bigintBase, bigIntExponent);
    return bnum(bigIntResult.toString()).div(ten_pow_eighteen);
}

function solveEquationA(
    w: number,
    S: OldBigNumber,
    B: OldBigNumber,
    L: number
) {
    return bnumPow(S.times(w).div(bnumPow(B, w).times(L)), 1 / (1 - w));
}

function solveEquationB(
    w: number,
    S: OldBigNumber,
    B: OldBigNumber,
    L: number
) {
    return bnumPow(
        bnumPow(S, 1 / w)
            .times(w)
            .div(B.times(L)),
        w / (1 - w)
    );
}
