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
const types_1 = require('../../types');
const address_1 = require('@ethersproject/address');
const bmath_1 = require('../../bmath');
const fixedPoint_1 = require('../../math/lib/fixedPoint');
const stableSolidity = __importStar(require('./stableMathEvm'));
const stableMath_1 = require('./stableMath');
class StablePool {
    constructor(id, address, amp, swapFee, totalShares, tokens, tokensList) {
        this.poolType = types_1.PoolTypes.Stable;
        this.id = id;
        this.address = address;
        this.amp = amp;
        this.swapFee = swapFee;
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
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
        if (tokenIn === this.address) {
            pairType = types_1.PairTypes.BptToToken;
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
        } else if (tokenOut === this.address) {
            pairType = types_1.PairTypes.TokenToBpt;
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
        } else {
            pairType = types_1.PairTypes.TokenToToken;
        }
        if (pairType !== types_1.PairTypes.BptToToken) {
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
        if (pairType !== types_1.PairTypes.TokenToBpt) {
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
        // Get all token balances
        let allBalances = [];
        for (let i = 0; i < this.tokens.length; i++) {
            allBalances.push(bmath_1.bnum(this.tokens[i].balance));
        }
        let inv = stableMath_1._invariant(bmath_1.bnum(this.amp), allBalances);
        const poolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: bmath_1.bnum(balanceIn),
            balanceOut: bmath_1.bnum(balanceOut),
            invariant: inv,
            swapFee: bmath_1.bnum(this.swapFee),
            allBalances: allBalances,
            amp: bmath_1.bnum(this.amp),
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
        };
        return poolPairData;
    }
    getNormalizedLiquidity(poolPairData) {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return poolPairData.balanceOut.times(poolPairData.amp);
    }
    getLimitAmountSwap(poolPairData, swapType) {
        const MAX_IN_RATIO = bmath_1.bnum(0.3);
        const MAX_OUT_RATIO = bmath_1.bnum(0.3);
        // We multiply ratios by 10**-18 because we are in normalized space
        // so 0.5 should be 0.5 and not 500000000000000000
        // TODO: update bmath to use everything normalized
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            return poolPairData.balanceIn.times(MAX_IN_RATIO);
        } else {
            return poolPairData.balanceOut.times(MAX_OUT_RATIO);
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
    _exactTokenInForTokenOut(poolPairData, amount) {
        // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
        // i.e. when using token with 2decimals 0.002 should be returned as 0
        // Uses ROUND_DOWN mode (1)
        return stableMath_1
            ._exactTokenInForTokenOut(amount, poolPairData)
            .dp(poolPairData.decimalsOut, 1);
    }
    _exactTokenInForBPTOut(poolPairData, amount) {
        return stableMath_1._exactTokenInForBPTOut(amount, poolPairData);
    }
    _exactBPTInForTokenOut(poolPairData, amount) {
        return stableMath_1._exactBPTInForTokenOut(amount, poolPairData);
    }
    _tokenInForExactTokenOut(poolPairData, amount) {
        // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
        // i.e. when using token with 2decimals 0.002 should be returned as 0
        // Uses ROUND_UP mode (0)
        return stableMath_1
            ._tokenInForExactTokenOut(amount, poolPairData)
            .dp(poolPairData.decimalsIn, 0);
    }
    _tokenInForExactBPTOut(poolPairData, amount) {
        return stableMath_1._tokenInForExactBPTOut(amount, poolPairData);
    }
    _BPTInForExactTokenOut(poolPairData, amount) {
        return stableMath_1._BPTInForExactTokenOut(amount, poolPairData);
    }
    _spotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount) {
        return stableMath_1._spotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapExactTokenInForBPTOut(poolPairData, amount) {
        return stableMath_1._spotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapExactBPTInForTokenOut(poolPairData, amount) {
        return stableMath_1._spotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount) {
        return stableMath_1._spotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapTokenInForExactBPTOut(poolPairData, amount) {
        return stableMath_1._spotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }
    _spotPriceAfterSwapBPTInForExactTokenOut(poolPairData, amount) {
        return stableMath_1._spotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount) {
        return stableMath_1._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(poolPairData, amount) {
        return stableMath_1._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(poolPairData, amount) {
        return stableMath_1._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount) {
        return stableMath_1._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(poolPairData, amount) {
        return stableMath_1._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(poolPairData, amount) {
        return stableMath_1._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }
    _evmoutGivenIn(poolPairData, amount) {
        // TO DO - Tidy this by adding scaled allBalances to poolPairData?
        // Taken directly from V2 repo.
        // We don't have access to all token decimals info to scale allBalances correctly
        // so manually normalise everything to 18 decimals and scale back after
        // i.e. 1USDC => 1e18 not 1e6
        // Amp is non-scaled so can be used directly from SG
        const balancesScaled = poolPairData.allBalances.map(bal =>
            fixedPoint_1.fnum(bmath_1.scale(bal, 18))
        );
        const amtScaled = bmath_1.scale(amount, 18);
        const swapFeeScaled = bmath_1.scale(poolPairData.swapFee, 18);
        const result = stableSolidity._exactTokenInForTokenOut(
            balancesScaled,
            fixedPoint_1.fnum(poolPairData.amp),
            poolPairData.tokenIndexIn,
            poolPairData.tokenIndexOut,
            fixedPoint_1.fnum(amtScaled),
            fixedPoint_1.fnum(swapFeeScaled)
        );
        // const norm = scale(result, -18);
        // return scale(norm, poolPairData.decimalsOut);
        // Scaling to correct decimals and removing any extra non-integer
        // const scaledResult = scale(result, -18 + poolPairData.decimalsOut)
        //     .toString()
        //     .split('.')[0];
        // return new BigNumber(scaledResult);
        return bmath_1.scale(result, -18 + poolPairData.decimalsOut);
    }
    _evminGivenOut(poolPairData, amount) {
        // TO DO - Tidy this by adding scaled allBalances to poolPairData?
        // Taken directly from V2 repo.
        // We don't have access to all token decimals info to scale allBalances correctly
        // so manually normalise everything to 18 decimals and scale back after
        // i.e. 1USDC => 1e18 not 1e6
        // Amp is non-scaled so can be used directly from SG
        const balancesScaled = poolPairData.allBalances.map(bal =>
            fixedPoint_1.fnum(bmath_1.scale(bal, 18))
        );
        const amtScaled = bmath_1.scale(amount, 18);
        const swapFeeScaled = bmath_1.scale(poolPairData.swapFee, 18);
        const result = stableSolidity._tokenInForExactTokenOut(
            balancesScaled,
            fixedPoint_1.fnum(poolPairData.amp),
            poolPairData.tokenIndexIn,
            poolPairData.tokenIndexOut,
            fixedPoint_1.fnum(amtScaled),
            fixedPoint_1.fnum(swapFeeScaled)
        );
        // const norm = scale(result, -18);
        // return scale(norm, poolPairData.decimalsOut);
        // Scaling to correct decimals and removing any extra non-integer
        // const scaledResult = scale(result, -18 + poolPairData.decimalsIn)
        //     .toString()
        //     .split('.')[0];
        // return new BigNumber(scaledResult);
        return bmath_1.scale(result, -18 + poolPairData.decimalsIn);
    }
    _evmexactTokenInForBPTOut(poolPairData, amount) {
        // TO DO - Tidy this by adding scaled allBalances to poolPairData?
        // Taken directly from V2 repo.
        // We don't have access to all token decimals info to scale allBalances correctly
        // so manually normalise everything to 18 decimals and scale back after
        // i.e. 1USDC => 1e18 not 1e6
        // Amp is non-scaled so can be used directly from SG
        const balancesScaled = poolPairData.allBalances.map(bal =>
            fixedPoint_1.fnum(bmath_1.scale(bal, 18))
        );
        // amountsIn must have same length as balances. Only need value for token in.
        const amountsIn = poolPairData.allBalances.map((bal, i) => {
            if (i === poolPairData.tokenIndexIn)
                return fixedPoint_1.fnum(bmath_1.scale(amount, 18));
            else return fixedPoint_1.fnum(0);
        });
        const bptTotalSupplyScaled = bmath_1.scale(poolPairData.balanceOut, 18);
        const swapFeeScaled = bmath_1.scale(poolPairData.swapFee, 18);
        const result = stableSolidity._exactTokensInForBPTOut(
            balancesScaled,
            fixedPoint_1.fnum(poolPairData.amp),
            amountsIn,
            fixedPoint_1.fnum(bptTotalSupplyScaled),
            fixedPoint_1.fnum(swapFeeScaled)
        );
        return result;
    }
    _evmexactBPTInForTokenOut(poolPairData, amount) {
        // TO DO - Tidy this?
        // Taken directly from V2 repo and requires normalised scaled balances
        // i.e. 1USDC => 1e18 not 1e6
        // Amp is non-scaled so can be used directly from SG
        const balancesScaled = poolPairData.allBalances.map(bal =>
            fixedPoint_1.fnum(bmath_1.scale(bal, 18))
        );
        const bptAmountInScaled = bmath_1.scale(amount, 18);
        const bptTotalSupply = bmath_1.scale(poolPairData.balanceIn, 18);
        const swapFeeScaled = bmath_1.scale(poolPairData.swapFee, 18);
        const result = stableSolidity._exactBPTInForTokenOut(
            poolPairData.tokenIndexOut,
            balancesScaled,
            fixedPoint_1.fnum(poolPairData.amp),
            fixedPoint_1.fnum(bptAmountInScaled),
            fixedPoint_1.fnum(bptTotalSupply),
            fixedPoint_1.fnum(swapFeeScaled)
        );
        return result;
    }
    _evmtokenInForExactBPTOut(poolPairData, amount) {
        // TO DO - Tidy this?
        // Taken directly from V2 repo and requires normalised scaled balances
        // i.e. 1USDC => 1e18 not 1e6
        // Amp is non-scaled so can be used directly from SG
        const balancesScaled = poolPairData.allBalances.map(bal =>
            fixedPoint_1.fnum(bmath_1.scale(bal, 18))
        );
        const bptAmountOutScaled = bmath_1.scale(amount, 18);
        const bptTotalSupply = bmath_1.scale(poolPairData.balanceOut, 18);
        const swapFeeScaled = bmath_1.scale(poolPairData.swapFee, 18);
        const result = stableSolidity._tokenInForExactBPTOut(
            poolPairData.tokenIndexIn,
            balancesScaled,
            fixedPoint_1.fnum(poolPairData.amp),
            fixedPoint_1.fnum(bptAmountOutScaled),
            fixedPoint_1.fnum(bptTotalSupply),
            fixedPoint_1.fnum(swapFeeScaled)
        );
        return result;
    }
    _evmbptInForExactTokenOut(poolPairData, amount) {
        // TO DO - Tidy this?
        // Taken directly from V2 repo and requires normalised scaled balances
        // i.e. 1USDC => 1e18 not 1e6
        // Amp is non-scaled so can be used directly from SG
        const balancesScaled = poolPairData.allBalances.map(bal =>
            fixedPoint_1.fnum(bmath_1.scale(bal, 18))
        );
        // amountsOut must have same length as balances. Only need value for token out.
        const amountsOut = poolPairData.allBalances.map((bal, i) => {
            if (i === poolPairData.tokenIndexOut)
                return fixedPoint_1.fnum(bmath_1.scale(amount, 18));
            else return fixedPoint_1.fnum(0);
        });
        const bptTotalSupply = bmath_1.scale(poolPairData.balanceIn, 18);
        const swapFeeScaled = bmath_1.scale(poolPairData.swapFee, 18);
        const result = stableSolidity._bptInForExactTokensOut(
            balancesScaled,
            fixedPoint_1.fnum(poolPairData.amp),
            amountsOut,
            fixedPoint_1.fnum(bptTotalSupply),
            fixedPoint_1.fnum(swapFeeScaled)
        );
        return result;
    }
}
exports.StablePool = StablePool;
