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
const SDK = __importStar(require('@georgeroman/balancer-v2-pools'));
const types_1 = require('../../types');
const linearMath_1 = require('./linearMath');
class LinearPool {
    constructor(
        id,
        address,
        swapFee,
        totalShares,
        tokens,
        tokensList,
        rate,
        target1,
        target2
    ) {
        this.poolType = types_1.PoolTypes.Linear;
        this.MAX_IN_RATIO = bmath_1.bnum(0.3); // ?
        this.MAX_OUT_RATIO = bmath_1.bnum(0.3); // ?
        this.id = id;
        this.address = address;
        this.swapFee = bmath_1.bnum(swapFee);
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.rate = bmath_1.bnum(rate);
        this.target1 = bmath_1.bnum(target1);
        this.target2 = bmath_1.bnum(target2);
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
        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn == this.address) {
            pairType = types_1.PairTypes.BptToToken;
            if (this.totalShares === undefined)
                throw 'Pool missing totalShares field';
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
        } else if (tokenOut == this.address) {
            pairType = types_1.PairTypes.TokenToBpt;
            if (this.totalShares === undefined)
                throw 'Pool missing totalShares field';
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
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
        }
        const poolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: bmath_1.bnum(balanceIn),
            balanceOut: bmath_1.bnum(balanceOut),
            swapFee: this.swapFee,
            rate: this.rate,
            target1: this.target1,
            target2: this.target2,
        };
        return poolPairData;
    }
    getNormalizedLiquidity(poolPairData) {
        return bmath_1.bnum(0);
    }
    getLimitAmountSwap(poolPairData, swapType) {
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            return poolPairData.balanceIn.times(this.MAX_IN_RATIO);
        } else {
            return poolPairData.balanceOut.times(this.MAX_OUT_RATIO);
        }
    }
    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token, newBalance) {
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
    _exactTokenInForTokenOut(poolPairData, amount) {
        return linearMath_1
            ._exactTokenInForTokenOut(amount, poolPairData)
            .dp(poolPairData.decimalsOut, 1);
    }
    _exactTokenInForBPTOut(poolPairData, amount) {
        return linearMath_1._exactTokenInForBPTOut(amount, poolPairData);
    }
    _exactBPTInForTokenOut(poolPairData, amount) {
        return linearMath_1._exactBPTInForTokenOut(amount, poolPairData);
    }
    // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
    // i.e. when using token with 2decimals 0.002 should be returned as 0
    // Uses ROUND_UP mode (0)
    _tokenInForExactTokenOut(poolPairData, amount) {
        return linearMath_1
            ._tokenInForExactTokenOut(amount, poolPairData)
            .dp(poolPairData.decimalsIn, 0);
    }
    _tokenInForExactBPTOut(poolPairData, amount) {
        return linearMath_1._tokenInForExactBPTOut(amount, poolPairData);
    }
    _BPTInForExactTokenOut(poolPairData, amount) {
        return linearMath_1._BPTInForExactTokenOut(amount, poolPairData);
    }
    _spotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount) {
        return linearMath_1._spotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapExactTokenInForBPTOut(poolPairData, amount) {
        return linearMath_1._spotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapExactBPTInForTokenOut(poolPairData, amount) {
        return linearMath_1._spotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount) {
        return linearMath_1._spotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapTokenInForExactBPTOut(poolPairData, amount) {
        return linearMath_1._spotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapBPTInForExactTokenOut(poolPairData, amount) {
        return linearMath_1._spotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount) {
        return linearMath_1._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(poolPairData, amount) {
        return linearMath_1._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(poolPairData, amount) {
        return linearMath_1._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount) {
        return linearMath_1._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(poolPairData, amount) {
        return linearMath_1._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(poolPairData, amount) {
        return linearMath_1._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _evmoutGivenIn(poolPairData, amount) {
        try {
            // poolPair balances are normalised so must be scaled before use
            const amt = SDK.WeightedMath._calcOutGivenIn(
                bmath_1.scale(poolPairData.balanceIn, poolPairData.decimalsIn),
                bmath_1.bnum(1),
                bmath_1.scale(
                    poolPairData.balanceOut,
                    poolPairData.decimalsOut
                ),
                bmath_1.bnum(1),
                bmath_1.scale(amount, poolPairData.decimalsIn),
                bmath_1.scale(poolPairData.swapFee, 18)
            );
            // return normalised amount
            return bmath_1.scale(amt, -poolPairData.decimalsOut);
        } catch (err) {
            return bmath_1.ZERO;
        }
    }
    _evmexactTokenInForBPTOut(poolPairData, amount) {
        try {
            // balance: BigNumber, normalizedWeight: BigNumber, amountIn: BigNumber, bptTotalSupply: BigNumber, swapFee: BigNumber
            const amt = SDK.WeightedMath._calcBptOutGivenExactTokenIn(
                bmath_1.scale(poolPairData.balanceIn, poolPairData.decimalsIn),
                bmath_1.bnum(1),
                bmath_1.scale(amount, poolPairData.decimalsIn),
                bmath_1.scale(poolPairData.balanceOut, 18), // BPT is always 18 decimals
                bmath_1.scale(poolPairData.swapFee, 18)
            );
            // return normalised amount
            return bmath_1.scale(amt, -18); // BPT is always 18 decimals
        } catch (err) {
            return bmath_1.ZERO;
        }
    }
    _evmexactBPTInForTokenOut(poolPairData, amount) {
        try {
            // poolPair balances are normalised so must be scaled before use
            const amt = SDK.WeightedMath._calcTokenOutGivenExactBptIn(
                bmath_1.scale(
                    poolPairData.balanceOut,
                    poolPairData.decimalsOut
                ),
                bmath_1.bnum(1),
                bmath_1.scale(amount, 18), // BPT is always 18 decimals
                bmath_1.scale(poolPairData.balanceIn, 18), // BPT is always 18 decimals
                bmath_1.scale(poolPairData.swapFee, 18)
            );
            // return normalised amount
            return bmath_1.scale(amt, -poolPairData.decimalsOut);
        } catch (err) {
            return bmath_1.ZERO;
        }
    }
    _evminGivenOut(poolPairData, amount) {
        try {
            // poolPair balances are normalised so must be scaled before use
            const amt = SDK.WeightedMath._calcInGivenOut(
                bmath_1.scale(poolPairData.balanceIn, poolPairData.decimalsIn),
                bmath_1.bnum(1),
                bmath_1.scale(
                    poolPairData.balanceOut,
                    poolPairData.decimalsOut
                ),
                bmath_1.bnum(1),
                bmath_1.scale(amount, poolPairData.decimalsOut),
                bmath_1.scale(poolPairData.swapFee, 18)
            );
            // return normalised amount
            return bmath_1.scale(amt, -poolPairData.decimalsIn);
        } catch (err) {
            return bmath_1.ZERO;
        }
    }
    _evmtokenInForExactBPTOut(poolPairData, amount) {
        try {
            // poolPair balances are normalised so must be scaled before use
            const amt = SDK.WeightedMath._calcTokenInGivenExactBptOut(
                bmath_1.scale(poolPairData.balanceIn, poolPairData.decimalsIn),
                bmath_1.bnum(1),
                bmath_1.scale(amount, 18),
                bmath_1.scale(poolPairData.balanceOut, 18), // BPT is always 18 decimals
                bmath_1.scale(poolPairData.swapFee, 18)
            );
            // return normalised amount
            return bmath_1.scale(amt, -poolPairData.decimalsIn);
        } catch (err) {
            return bmath_1.ZERO;
        }
    }
    _evmbptInForExactTokenOut(poolPairData, amount) {
        try {
            // poolPair balances are normalised so must be scaled before use
            const amt = SDK.WeightedMath._calcBptInGivenExactTokenOut(
                bmath_1.scale(
                    poolPairData.balanceOut,
                    poolPairData.decimalsOut
                ),
                bmath_1.bnum(1),
                bmath_1.scale(amount, poolPairData.decimalsOut),
                bmath_1.scale(poolPairData.balanceIn, 18), // BPT is always 18 decimals
                bmath_1.scale(poolPairData.swapFee, 18)
            );
            // return normalised amount
            return bmath_1.scale(amt, -18); // BPT always 18 decimals
        } catch (err) {
            return bmath_1.ZERO;
        }
    }
}
exports.LinearPool = LinearPool;
