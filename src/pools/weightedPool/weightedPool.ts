import { getAddress } from '@ethersproject/address';
import { bnum, scale, ZERO, ONE } from '../../bmath';
import { BigNumber } from '../../utils/bignumber';
import * as SDK from '@georgeroman/balancer-v2-pools';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
} from '../../types';
import {
    _exactTokenInForTokenOut,
    _exactTokenInForBPTOut,
    _exactBPTInForTokenOut,
    _tokenInForExactTokenOut,
    _tokenInForExactBPTOut,
    _BPTInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapExactTokenInForBPTOut,
    _spotPriceAfterSwapExactBPTInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _spotPriceAfterSwapTokenInForExactBPTOut,
    _spotPriceAfterSwapBPTInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut,
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut,
} from './weightedMath';

export interface WeightedPoolToken {
    address: string;
    balance: string;
    decimals: string | number;
    weight?: string;
}

export interface WeightedPoolPairData extends PoolPairBase {
    id: string;
    address: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber; // Weights are only defined for weighted pools
    weightOut: BigNumber; // Weights are only defined for weighted pools
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
}

export class WeightedPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Weighted;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: string;
    tokens: WeightedPoolToken[];
    totalWeight: BigNumber;
    tokensList: string[];
    MAX_IN_RATIO = bnum(0.3);
    MAX_OUT_RATIO = bnum(0.3);

    static fromPool(pool: SubgraphPoolBase): WeightedPool {
        return new WeightedPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalWeight,
            pool.totalShares,
            pool.tokens,
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

    setTypeForSwap(type: SwapPairType) {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): WeightedPoolPairData {
        let pairType: PairTypes;
        let tI: WeightedPoolToken;
        let tO: WeightedPoolToken;
        let balanceIn: string;
        let balanceOut: string;
        let decimalsOut: string | number;
        let decimalsIn: string | number;
        let weightIn: BigNumber;
        let weightOut: BigNumber;

        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn == this.address) {
            pairType = PairTypes.BptToToken;
            if (this.totalShares === undefined)
                throw 'Pool missing totalShares field';
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
            weightIn = ONE; // Not used but has to be defined
        } else if (tokenOut == this.address) {
            pairType = PairTypes.TokenToBpt;
            if (this.totalShares === undefined)
                throw 'Pool missing totalShares field';
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
            weightOut = ONE; // Not used but has to be defined
        } else {
            pairType = PairTypes.TokenToToken;
        }

        if (pairType != PairTypes.BptToToken) {
            const tokenIndexIn = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenIn)
            );
            if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
            tI = this.tokens[tokenIndexIn];
            balanceIn = tI.balance;
            decimalsIn = tI.decimals;
            weightIn = bnum(tI.weight).div(this.totalWeight);
        }
        if (pairType != PairTypes.TokenToBpt) {
            const tokenIndexOut = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
            weightOut = bnum(tO.weight).div(this.totalWeight);
        }

        const poolPairData: WeightedPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
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
    getNormalizedLiquidity(poolPairData: WeightedPoolPairData) {
        if (poolPairData.pairType == PairTypes.TokenToToken) {
            return poolPairData.balanceOut
                .times(poolPairData.weightIn)
                .div(poolPairData.weightIn.plus(poolPairData.weightOut));
        } else if (poolPairData.pairType == PairTypes.TokenToBpt) {
            return poolPairData.balanceOut; // Liquidity in tokenOut is totalShares
        } else if (poolPairData.pairType == PairTypes.BptToToken) {
            return poolPairData.balanceOut.div(
                ONE.plus(poolPairData.weightOut)
            ); // Liquidity in tokenOut is Bo/wo
        }
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): BigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            return poolPairData.balanceIn.times(this.MAX_IN_RATIO);
        } else {
            return poolPairData.balanceOut.times(this.MAX_OUT_RATIO);
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (this.address == token) {
            this.totalShares = newBalance.toString();
        } else {
            // token is underlying in the pool
            const T = this.tokens.find(t => t.address === token);
            T.balance = newBalance.toString();
        }
    }

    // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
    // i.e. when using token with 2decimals 0.002 should be returned as 0
    // Uses ROUND_DOWN mode (1)
    _exactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactTokenInForTokenOut(amount, poolPairData).dp(
            poolPairData.decimalsOut,
            1
        );
    }

    _exactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactTokenInForBPTOut(amount, poolPairData);
    }

    _exactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactBPTInForTokenOut(amount, poolPairData);
    }

    // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
    // i.e. when using token with 2decimals 0.002 should be returned as 0
    // Uses ROUND_UP mode (0)
    _tokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _tokenInForExactTokenOut(amount, poolPairData).dp(
            poolPairData.decimalsIn,
            0
        );
    }

    _tokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _tokenInForExactBPTOut(amount, poolPairData);
    }

    _BPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _BPTInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactTokenInForBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactBPTInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapTokenInForExactBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapBPTInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }

    _evmoutGivenIn(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
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

    _evmexactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // balance: BigNumber, normalizedWeight: BigNumber, amountIn: BigNumber, bptTotalSupply: BigNumber, swapFee: BigNumber
            const amt = SDK.WeightedMath._calcBptOutGivenExactTokenIn(
                scale(poolPairData.balanceIn, poolPairData.decimalsIn),
                scale(poolPairData.weightIn, 18),
                scale(amount, poolPairData.decimalsIn),
                scale(poolPairData.balanceOut, 18), // BPT is always 18 decimals
                scale(poolPairData.swapFee, 18)
            );
            // return normalised amount
            return scale(amt, -18); // BPT is always 18 decimals
        } catch (err) {
            return ZERO;
        }
    }

    _evmexactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // poolPair balances are normalised so must be scaled before use
            const amt = SDK.WeightedMath._calcTokenOutGivenExactBptIn(
                scale(poolPairData.balanceOut, poolPairData.decimalsOut),
                scale(poolPairData.weightOut, 18),
                scale(amount, 18), // BPT is always 18 decimals
                scale(poolPairData.balanceIn, 18), // BPT is always 18 decimals
                scale(poolPairData.swapFee, 18)
            );
            // return normalised amount
            return scale(amt, -poolPairData.decimalsOut);
        } catch (err) {
            return ZERO;
        }
    }

    _evminGivenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
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

    _evmtokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // poolPair balances are normalised so must be scaled before use
            const amt = SDK.WeightedMath._calcTokenInGivenExactBptOut(
                scale(poolPairData.balanceIn, poolPairData.decimalsIn),
                scale(poolPairData.weightIn, 18),
                scale(amount, 18),
                scale(poolPairData.balanceOut, 18), // BPT is always 18 decimals
                scale(poolPairData.swapFee, 18)
            );

            // return normalised amount
            return scale(amt, -poolPairData.decimalsIn);
        } catch (err) {
            return ZERO;
        }
    }

    _evmbptInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // poolPair balances are normalised so must be scaled before use
            const amt = SDK.WeightedMath._calcBptInGivenExactTokenOut(
                scale(poolPairData.balanceOut, poolPairData.decimalsOut),
                scale(poolPairData.weightOut, 18),
                scale(amount, poolPairData.decimalsOut),
                scale(poolPairData.balanceIn, 18), // BPT is always 18 decimals
                scale(poolPairData.swapFee, 18)
            );

            // return normalised amount
            return scale(amt, -18); // BPT always 18 decimals
        } catch (err) {
            return ZERO;
        }
    }
}
