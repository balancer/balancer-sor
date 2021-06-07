'use strict';
var __importStar =
    (this && this.__importStar) ||
    function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result['default'] = mod;
        return result;
    };
Object.defineProperty(exports, '__esModule', { value: true });
const address_1 = require('@ethersproject/address');
const bmath_1 = require('../../bmath');
const weightedSolidity = __importStar(require('./weightedMathEvm'));
const FixedPointNumber_1 = require('../../math/FixedPointNumber');
const types_1 = require('../../types');
const weightedMath_1 = require('./weightedMath');
class WeightedPool {
    constructor(id, swapFee, totalWeight, totalShares, tokens, tokensList) {
        this.poolType = types_1.PoolTypes.Weighted;
        this.id = id;
        this.swapFee = swapFee;
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.totalWeight = totalWeight;
    }
    setTypeForSwap(type) {
        this.swapPairType = type;
    }
    parsePoolPairData(tokenIn, tokenOut) {
        let pairType;
        let tI;
        let tO;
        let balanceIn;
        let balanceOut;
        let decimalsOut;
        let decimalsIn;
        let weightIn;
        let weightOut;
        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn == this.id) {
            pairType = types_1.PairTypes.BptToToken;
            if (this.totalShares === undefined)
                throw 'Pool missing totalShares field';
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
            weightIn = bmath_1.bnum(1); // Not used but has to be defined
        } else if (tokenOut == this.id) {
            pairType = types_1.PairTypes.TokenToBpt;
            if (this.totalShares === undefined)
                throw 'Pool missing totalShares field';
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
            weightOut = bmath_1.bnum(1); // Not used but has to be defined
        } else {
            pairType = types_1.PairTypes.TokenToToken;
        }
        if (pairType != types_1.PairTypes.BptToToken) {
            let tokenIndexIn = this.tokens.findIndex(
                t =>
                    address_1.getAddress(t.address) ===
                    address_1.getAddress(tokenIn)
            );
            if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
            tI = this.tokens[tokenIndexIn];
            balanceIn = tI.balance;
            decimalsIn = tI.decimals;
            weightIn = bmath_1
                .bnum(tI.weight)
                .div(bmath_1.bnum(this.totalWeight));
        }
        if (pairType != types_1.PairTypes.TokenToBpt) {
            let tokenIndexOut = this.tokens.findIndex(
                t =>
                    address_1.getAddress(t.address) ===
                    address_1.getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
            weightOut = bmath_1
                .bnum(tO.weight)
                .div(bmath_1.bnum(this.totalWeight));
        }
        const poolPairData = {
            id: this.id,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: bmath_1.bnum(balanceIn),
            balanceOut: bmath_1.bnum(balanceOut),
            weightIn: weightIn,
            weightOut: weightOut,
            swapFee: bmath_1.bnum(this.swapFee),
        };
        return poolPairData;
    }
    // Normalized liquidity is an abstract term that can be thought of the
    // inverse of the slippage. It is proportional to the token balances in the
    // pool but also depends on the shape of the invariant curve.
    // As a standard, we define normalized liquidity in tokenOut
    getNormalizedLiquidity(poolPairData) {
        if (poolPairData.pairType == types_1.PairTypes.TokenToToken) {
            return poolPairData.balanceOut
                .times(poolPairData.weightIn)
                .div(poolPairData.weightIn.plus(poolPairData.weightOut));
        } else if (poolPairData.pairType == types_1.PairTypes.TokenToBpt) {
            return poolPairData.balanceOut; // Liquidity in tokenOut is totalShares
        } else if (poolPairData.pairType == types_1.PairTypes.BptToToken) {
            return poolPairData.balanceOut.div(
                bmath_1.bnum(1).plus(poolPairData.weightOut)
            ); // Liquidity in tokenOut is Bo/wo
        }
    }
    getLimitAmountSwap(poolPairData, swapType) {
        const MAX_IN_RATIO = bmath_1.bnum(0.3);
        const MAX_OUT_RATIO = bmath_1.bnum(0.3);
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            return poolPairData.balanceIn.times(MAX_IN_RATIO);
        } else {
            return poolPairData.balanceOut.times(MAX_OUT_RATIO);
        }
    }
    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token, newBalance) {
        // token is BPT
        if (this.id == token) {
            this.totalShares = newBalance.toString();
        } else {
            // token is underlying in the pool
            const T = this.tokens.find(t => t.address === token);
            T.balance = newBalance.toString();
        }
    }
    _exactTokenInForTokenOut(poolPairData, amount) {
        return weightedMath_1._exactTokenInForTokenOut(amount, poolPairData);
    }
    _exactTokenInForBPTOut(poolPairData, amount) {
        return weightedMath_1._exactTokenInForBPTOut(amount, poolPairData);
    }
    _exactBPTInForTokenOut(poolPairData, amount) {
        return weightedMath_1._exactBPTInForTokenOut(amount, poolPairData);
    }
    _tokenInForExactTokenOut(poolPairData, amount) {
        return weightedMath_1._tokenInForExactTokenOut(amount, poolPairData);
    }
    _tokenInForExactBPTOut(poolPairData, amount) {
        return weightedMath_1._tokenInForExactBPTOut(amount, poolPairData);
    }
    _BPTInForExactTokenOut(poolPairData, amount) {
        return weightedMath_1._BPTInForExactTokenOut(amount, poolPairData);
    }
    _spotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount) {
        return weightedMath_1._spotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapExactTokenInForBPTOut(poolPairData, amount) {
        return weightedMath_1._spotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapExactBPTInForTokenOut(poolPairData, amount) {
        return weightedMath_1._spotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount) {
        return weightedMath_1._spotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapTokenInForExactBPTOut(poolPairData, amount) {
        return weightedMath_1._spotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapBPTInForExactTokenOut(poolPairData, amount) {
        return weightedMath_1._spotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount) {
        return weightedMath_1._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(poolPairData, amount) {
        return weightedMath_1._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(poolPairData, amount) {
        return weightedMath_1._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount) {
        return weightedMath_1._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(poolPairData, amount) {
        return weightedMath_1._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(poolPairData, amount) {
        return weightedMath_1._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _evmoutGivenIn(poolPairData, amount) {
        const amt = weightedSolidity._exactTokenInForTokenOut(
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceIn, poolPairData.decimalsIn)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.weightIn, 18)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceOut, poolPairData.decimalsOut)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.weightOut, 18)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(amount, poolPairData.decimalsIn)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.swapFee, 18)
            )
        );
        return bmath_1.bnum(amt.toString());
    }
    _evmexactTokenInForBPTOut(poolPairData, amount) {
        const amt = weightedSolidity._exactTokenInForBPTOut(
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceIn, poolPairData.decimalsIn)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.weightIn, 18)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(amount, poolPairData.decimalsIn)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceOut, 18)
            ), // BPT is always 18 decimals
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.swapFee, 18)
            )
        );
        return bmath_1.bnum(amt.toString());
    }
    _evmexactBPTInForTokenOut(poolPairData, amount) {
        const amt = weightedSolidity._exactBPTInForTokenOut(
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceOut, poolPairData.decimalsOut)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.weightOut, 18)
            ),
            new FixedPointNumber_1.FixedPointNumber(bmath_1.scale(amount, 18)), // BPT is always 18 decimals
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceIn, 18)
            ), // BPT is always 18 decimals
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.swapFee, 18)
            )
        );
        return bmath_1.bnum(amt.toString());
    }
    _evminGivenOut(poolPairData, amount) {
        const amt = weightedSolidity._tokenInForExactTokenOut(
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceIn, poolPairData.decimalsIn)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.weightIn, 18)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceOut, poolPairData.decimalsOut)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.weightOut, 18)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(amount, poolPairData.decimalsOut)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.swapFee, 18)
            )
        );
        return bmath_1.bnum(amt.toString());
    }
    _evmtokenInForExactBPTOut(poolPairData, amount) {
        const amt = weightedSolidity._tokenInForExactBPTOut(
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceIn, poolPairData.decimalsIn)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.weightIn, 18)
            ),
            new FixedPointNumber_1.FixedPointNumber(bmath_1.scale(amount, 18)),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceOut, 18)
            ), // BPT is always 18 decimals
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.swapFee, 18)
            )
        );
        return bmath_1.bnum(amt.toString());
    }
    _evmbptInForExactTokenOut(poolPairData, amount) {
        const amt = weightedSolidity._bptInForExactTokenOut(
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceOut, poolPairData.decimalsOut)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.weightOut, 18)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(amount, poolPairData.decimalsOut)
            ),
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.balanceIn, 18)
            ), // BPT is always 18 decimals
            new FixedPointNumber_1.FixedPointNumber(
                bmath_1.scale(poolPairData.swapFee, 18)
            )
        );
        return bmath_1.bnum(amt.toString());
    }
}
exports.WeightedPool = WeightedPool;
