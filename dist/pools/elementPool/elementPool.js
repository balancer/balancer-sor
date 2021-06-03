'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const types_1 = require('../../types');
const address_1 = require('@ethersproject/address');
const bmath_1 = require('../../bmath');
const elementMath_1 = require('./elementMath');
class ElementPool {
    constructor(
        id,
        swapFee,
        totalShares,
        tokens,
        tokensList,
        expiryTime,
        unitSeconds,
        principalToken,
        baseToken
    ) {
        this.poolType = types_1.PoolTypes.Element;
        this.id = id;
        this.swapFee = swapFee;
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.expiryTime = expiryTime;
        this.unitSeconds = unitSeconds;
        this.principalToken = principalToken;
        this.baseToken = baseToken;
        this.currentBlockTimestamp = 0;
    }
    setCurrentBlockTimestamp(timestamp) {
        this.currentBlockTimestamp = timestamp;
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
        let tokenIndexIn;
        let tokenIndexOut;
        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn == this.id) {
            pairType = types_1.PairTypes.BptToToken;
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
        } else if (tokenOut == this.id) {
            pairType = types_1.PairTypes.TokenToBpt;
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
        } else {
            pairType = types_1.PairTypes.TokenToToken;
        }
        if (pairType != types_1.PairTypes.BptToToken) {
            tokenIndexIn = this.tokens.findIndex(
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
            tokenIndexOut = this.tokens.findIndex(
                t =>
                    address_1.getAddress(t.address) ===
                    address_1.getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
        }
        // We already add the virtual LP shares to the right balance
        let bnumBalanceIn = bmath_1.bnum(balanceIn);
        let bnumBalanceOut = bmath_1.bnum(balanceOut);
        if (tokenIn == this.principalToken) {
            bnumBalanceIn = bnumBalanceIn.plus(bmath_1.bnum(this.totalShares));
        } else if (tokenOut == this.principalToken) {
            bnumBalanceOut = bnumBalanceOut.plus(
                bmath_1.bnum(this.totalShares)
            );
        }
        const poolPairData = {
            id: this.id,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            principalToken: this.principalToken,
            baseToken: this.baseToken,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: bnumBalanceIn,
            balanceOut: bnumBalanceOut,
            swapFee: bmath_1.bnum(this.swapFee),
            totalShares: bmath_1.bnum(this.totalShares),
            expiryTime: this.expiryTime,
            unitSeconds: this.unitSeconds,
            currentBlockTimestamp: this.currentBlockTimestamp,
        };
        return poolPairData;
    }
    // Normalized liquidity is an abstract term that can be thought of the
    // inverse of the slippage. It is proportional to the token balances in the
    // pool but also depends on the shape of the invariant curve.
    // As a standard, we define normalized liquidity in tokenOut
    getNormalizedLiquidity(poolPairData) {
        // This could be refined by using the inverse of the slippage, but
        // in practice this won't have a big impact in path selection for
        // multi-hops so not a big priority
        return poolPairData.balanceOut;
    }
    getLimitAmountSwap(poolPairData, swapType) {
        const MAX_OUT_RATIO = bmath_1.bnum(0.3);
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            // "Ai < (Bi**(1-t)+Bo**(1-t))**(1/(1-t))-Bi" must hold in order for
            // base of root to be non-negative
            let Bi = poolPairData.balanceIn.toNumber();
            let Bo = poolPairData.balanceOut.toNumber();
            let t = elementMath_1.getTimeTillExpiry(
                this.expiryTime,
                this.currentBlockTimestamp,
                this.unitSeconds
            );
            return bmath_1.bnum(
                Math.pow(
                    Math.pow(Bi, 1 - t) + Math.pow(Bo, 1 - t),
                    1 / (1 - t)
                ) - Bi
            );
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
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return elementMath_1._exactTokenInForTokenOut(amount, poolPairData);
    }
    _exactTokenInForBPTOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _exactBPTInForTokenOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _tokenInForExactTokenOut(poolPairData, amount) {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return elementMath_1._tokenInForExactTokenOut(amount, poolPairData);
    }
    _tokenInForExactBPTOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _BPTInForExactTokenOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _spotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount) {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return elementMath_1._spotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapExactTokenInForBPTOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _spotPriceAfterSwapExactBPTInForTokenOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _spotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount) {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return elementMath_1._spotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapTokenInForExactBPTOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _spotPriceAfterSwapBPTInForExactTokenOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount) {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return elementMath_1._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount) {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return elementMath_1._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(poolPairData, amount) {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bmath_1.bnum(-1);
    }
}
exports.ElementPool = ElementPool;
