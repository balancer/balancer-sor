import { getAddress } from '@ethersproject/address';
import {
    BigNumber as OldBigNumber,
    bnum,
    scale,
    ZERO,
} from '../../utils/bignumber';
import * as SDK from '@georgeroman/balancer-v2-pools';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
    NoNullableField,
} from '../../types';
import {
    _exactTokenInForTokenOut,
    _tokenInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from './weightedMath';

export type WeightedPoolToken = Pick<
    NoNullableField<SubgraphToken>,
    'address' | 'balance' | 'decimals' | 'weight'
>;

export type WeightedPoolPairData = PoolPairBase & {
    weightIn: OldBigNumber;
    weightOut: OldBigNumber;
};

export class WeightedPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Weighted;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    swapFee: OldBigNumber;
    totalShares: string;
    tokens: WeightedPoolToken[];
    totalWeight: OldBigNumber;
    tokensList: string[];
    MAX_IN_RATIO = bnum(0.3);
    MAX_OUT_RATIO = bnum(0.3);

    static fromPool(pool: SubgraphPoolBase): WeightedPool {
        if (!pool.totalWeight)
            throw new Error('WeightedPool missing totalWeight');
        return new WeightedPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalWeight,
            pool.totalShares,
            pool.tokens as WeightedPoolToken[],
            pool.tokensList
        );
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
        this.swapFee = bnum(swapFee);
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.totalWeight = bnum(totalWeight);
    }

    setTypeForSwap(type: SwapPairType): void {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): WeightedPoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;
        const weightIn = bnum(tI.weight).div(this.totalWeight);

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;
        const weightOut = bnum(tO.weight).div(this.totalWeight);

        const poolPairData: WeightedPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: bnum(balanceIn),
            balanceOut: bnum(balanceOut),
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
    getNormalizedLiquidity(poolPairData: WeightedPoolPairData): OldBigNumber {
        return poolPairData.balanceOut
            .times(poolPairData.weightIn)
            .div(poolPairData.weightIn.plus(poolPairData.weightOut));
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            return poolPairData.balanceIn.times(this.MAX_IN_RATIO);
        } else {
            return poolPairData.balanceOut.times(this.MAX_OUT_RATIO);
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: OldBigNumber): void {
        // token is BPT
        if (this.address == token) {
            this.totalShares = newBalance.toString();
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => t.address === token);
            if (!T) throw Error('Pool does not contain this token');
            T.balance = newBalance.toString();
        }
    }

    // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
    // i.e. when using token with 2decimals 0.002 should be returned as 0
    // Uses ROUND_DOWN mode (1)
    _exactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // poolPair balances are normalised so must be scaled before use
                const amt = SDK.WeightedMath._calcOutGivenIn(
                    scale(poolPairData.balanceIn, poolPairData.decimalsIn),
                    scale(poolPairData.weightIn, 18),
                    scale(poolPairData.balanceOut, poolPairData.decimalsOut),
                    scale(poolPairData.weightOut, 18),
                    scale(amount, poolPairData.decimalsIn),
                    scale(poolPairData.swapFee, 18)
                );
                // return normalised amount
                return scale(amt, -poolPairData.decimalsOut);
            } catch (err) {
                return ZERO;
            }
        }
        return _exactTokenInForTokenOut(amount, poolPairData).dp(
            poolPairData.decimalsOut,
            1
        );
    }

    // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
    // i.e. when using token with 2decimals 0.002 should be returned as 0
    // Uses ROUND_UP mode (0)
    _tokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // poolPair balances are normalised so must be scaled before use
                const amt = SDK.WeightedMath._calcInGivenOut(
                    scale(poolPairData.balanceIn, poolPairData.decimalsIn),
                    scale(poolPairData.weightIn, 18),
                    scale(poolPairData.balanceOut, poolPairData.decimalsOut),
                    scale(poolPairData.weightOut, 18),
                    scale(amount, poolPairData.decimalsOut),
                    scale(poolPairData.swapFee, 18)
                );

                // return normalised amount
                return scale(amt, -poolPairData.decimalsIn);
            } catch (err) {
                return ZERO;
            }
        }
        return _tokenInForExactTokenOut(amount, poolPairData).dp(
            poolPairData.decimalsIn,
            0
        );
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
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
