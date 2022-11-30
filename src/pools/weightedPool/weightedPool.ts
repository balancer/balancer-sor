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
    _calcTokensOutGivenExactBptIn,
} from './weightedMath';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { takeToPrecision18 } from '../../router/helpersClass';
import { MathSol } from '../../utils/basicOperations';

enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

export type WeightedPoolToken = Pick<
    NoNullableField<SubgraphToken>,
    'address' | 'balance' | 'decimals' | 'weight'
>;

export type WeightedPoolPairData = PoolPairBase & {
    pairType: PairTypes;
    weightIn: BigNumber;
    weightOut: BigNumber;
};

export class WeightedPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Weighted;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: WeightedPoolToken[];
    totalWeight: BigNumber;
    tokensList: string[];
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);
    isLBP = false;

    static fromPool(pool: SubgraphPoolBase, isLBP?: boolean): WeightedPool {
        if (!pool.totalWeight)
            throw new Error('WeightedPool missing totalWeight');
        const weightedPool = new WeightedPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalWeight,
            pool.totalShares,
            pool.tokens as WeightedPoolToken[],
            pool.tokensList
        );
        if (isLBP) weightedPool.isLBP = true;
        return weightedPool;
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalWeight: string,
        totalShares: string,
        tokens: WeightedPoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.totalWeight = parseFixed(totalWeight, 18);
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): WeightedPoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;
        const weightIn = parseFixed(tI.weight, 18)
            .mul(ONE)
            .div(this.totalWeight);

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;
        const weightOut = parseFixed(tO.weight, 18)
            .mul(ONE)
            .div(this.totalWeight);

        let pairType: PairTypes;
        if (tokenIn == this.address) {
            pairType = PairTypes.BptToToken;
        } else if (tokenOut == this.address) {
            pairType = PairTypes.TokenToBpt;
        } else {
            pairType = PairTypes.TokenToToken;
        }

        const poolPairData: WeightedPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            pairType: pairType,
            weightIn: weightIn,
            weightOut: weightOut,
            swapFee: this.swapFee,
        };

        return poolPairData;
    }

    getNormalizedWeights(): bigint[] {
        return this.tokens.map((t) =>
            parseFixed(t.weight, 18).mul(ONE).div(this.totalWeight).toBigInt()
        );
    }

    // Normalized liquidity is an abstract term that can be thought of the
    // inverse of the slippage. It is proportional to the token balances in the
    // pool but also depends on the shape of the invariant curve.
    // As a standard, we define normalized liquidity in tokenOut
    getNormalizedLiquidity(poolPairData: WeightedPoolPairData): OldBigNumber {
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
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            return bnum(
                formatFixed(
                    poolPairData.balanceIn.mul(this.MAX_IN_RATIO).div(ONE),
                    poolPairData.decimalsIn
                )
            );
        } else {
            return bnum(
                formatFixed(
                    poolPairData.balanceOut.mul(this.MAX_OUT_RATIO).div(ONE),
                    poolPairData.decimalsOut
                )
            );
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (isSameAddress(this.address, token)) {
            this.totalShares = newBalance;
        }
        // token is underlying in the pool
        const T = this.tokens.find((t) => isSameAddress(t.address, token));
        if (!T) throw Error('Pool does not contain this token');
        T.balance = formatFixed(newBalance, T.decimals);
    }

    // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
    // i.e. when using token with 2decimals 0.002 should be returned as 0
    // Uses ROUND_DOWN mode (1)
    // calcOutGivenIn
    _exactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
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
                    balanceOut,
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
        poolPairData: WeightedPoolPairData,
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

    /**
     * _calcTokensOutGivenExactBptIn
     * @param bptAmountIn EVM scale.
     * @returns EVM scale.
     */
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // token balances are stored in human scale and must be EVM for maths
        const balancesEvm = this.tokens
            .filter((t) => !isSameAddress(t.address, this.address))
            .map((t) => parseFixed(t.balance, t.decimals).toBigInt());
        let returnAmt: bigint[];
        try {
            returnAmt = _calcTokensOutGivenExactBptIn(
                balancesEvm,
                bptAmountIn.toBigInt(),
                this.totalShares.toBigInt()
            );
            return returnAmt.map((a) => BigNumber.from(a.toString()));
        } catch (err) {
            return new Array(balancesEvm.length).fill(ZERO);
        }
    }

    /**
     * _calcBptOutGivenExactTokensIn
     * @param amountsIn EVM Scale
     * @returns EVM Scale
     */
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        try {
            // token balances are stored in human scale and must be EVM for maths
            const balancesEvm = this.tokens
                .filter((t) => !isSameAddress(t.address, this.address))
                .map((t) => parseFixed(t.balance, t.decimals).toBigInt());
            const bptAmountOut = _calcBptOutGivenExactTokensIn(
                balancesEvm,
                this.getNormalizedWeights(),
                amountsIn.map((a) => a.toBigInt()),
                this.totalShares.toBigInt(),
                this.swapFee.toBigInt()
            );
            return BigNumber.from(bptAmountOut.toString());
        } catch (err) {
            return Zero;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
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
        poolPairData: WeightedPoolPairData,
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
        poolPairData: WeightedPoolPairData,
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
        poolPairData: WeightedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}
