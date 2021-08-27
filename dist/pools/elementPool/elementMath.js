"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bmath_1 = require("../../bmath");
// calc_out_given_in (swap)
function _exactTokenInForTokenOut(amount, poolPairData) {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero())
        return amount;
    let f = poolPairData.swapFee.toNumber();
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let t = getTimeTillExpiry(poolPairData.expiryTime, poolPairData.currentBlockTimestamp, poolPairData.unitSeconds);
    let Ai = amount.toNumber();
    return bmath_1.bnum(Bo -
        Math.pow((Math.pow(Bi, (1 - t)) - Math.pow((Ai + Bi), (1 - t)) + Math.pow(Bo, (1 - t))), (1 / (1 - t))) -
        Math.abs(Ai -
            Bo +
            Math.pow((Math.pow(Bi, (1 - t)) - Math.pow((Ai + Bi), (1 - t)) + Math.pow(Bo, (1 - t))), (1 / (1 - t)))) *
            f);
}
exports._exactTokenInForTokenOut = _exactTokenInForTokenOut;
// calc_in_given_out (swap)
function _tokenInForExactTokenOut(amount, poolPairData) {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero())
        return amount;
    let f = poolPairData.swapFee.toNumber();
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let t = getTimeTillExpiry(poolPairData.expiryTime, poolPairData.currentBlockTimestamp, poolPairData.unitSeconds);
    let Ao = amount.toNumber();
    return bmath_1.bnum(-Bi +
        Math.pow((Math.pow(Bi, (1 - t)) + Math.pow(Bo, (1 - t)) - Math.pow((-Ao + Bo), (1 - t))), (1 / (1 - t))) +
        Math.abs(-Ao -
            Bi +
            Math.pow((Math.pow(Bi, (1 - t)) + Math.pow(Bo, (1 - t)) - Math.pow((-Ao + Bo), (1 - t))), (1 / (1 - t)))) *
            f);
}
exports._tokenInForExactTokenOut = _tokenInForExactTokenOut;
/////////
/// SpotPriceAfterSwap
/////////
// PairType = 'token->token'
// SwapType = 'swapExactIn'
function _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData) {
    let f = poolPairData.swapFee.toNumber();
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let t = getTimeTillExpiry(poolPairData.expiryTime, poolPairData.currentBlockTimestamp, poolPairData.unitSeconds);
    let Ai = amount.toNumber();
    return bmath_1.bnum(1 /
        (Math.pow((Math.pow(Bi, (1 - t)) - Math.pow((Ai + Bi), (1 - t)) + Math.pow(Bo, (1 - t))), (-1 + 1 / (1 - t))) /
            Math.pow((Ai + Bi), t) -
            Math.abs(1 -
                Math.pow((Math.pow(Bi, (1 - t)) -
                    Math.pow((Ai + Bi), (1 - t)) +
                    Math.pow(Bo, (1 - t))), (-1 + 1 / (1 - t))) /
                    Math.pow((Ai + Bi), t)) *
                f));
}
exports._spotPriceAfterSwapExactTokenInForTokenOut = _spotPriceAfterSwapExactTokenInForTokenOut;
// PairType = 'token->token'
// SwapType = 'swapExactOut'
function _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData) {
    let f = poolPairData.swapFee.toNumber();
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let t = getTimeTillExpiry(poolPairData.expiryTime, poolPairData.currentBlockTimestamp, poolPairData.unitSeconds);
    let Ao = amount.toNumber();
    return bmath_1.bnum(Math.pow((Math.pow(Bi, (1 - t)) + Math.pow(Bo, (1 - t)) - Math.pow((-Ao + Bo), (1 - t))), (-1 + 1 / (1 - t))) /
        Math.pow((-Ao + Bo), t) +
        Math.abs(-1 +
            Math.pow((Math.pow(Bi, (1 - t)) + Math.pow(Bo, (1 - t)) - Math.pow((-Ao + Bo), (1 - t))), (-1 + 1 / (1 - t))) /
                Math.pow((-Ao + Bo), t)) *
            f);
}
exports._spotPriceAfterSwapTokenInForExactTokenOut = _spotPriceAfterSwapTokenInForExactTokenOut;
/////////
///  Derivatives of spotPriceAfterSwap
/////////
// PairType = 'token->token'
// SwapType = 'swapExactIn'
function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData) {
    let f = poolPairData.swapFee.toNumber();
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let t = getTimeTillExpiry(poolPairData.expiryTime, poolPairData.currentBlockTimestamp, poolPairData.unitSeconds);
    let Ai = amount.toNumber();
    return bmath_1.bnum(-((-((Math.pow((Math.pow(Bi, (1 - t)) - Math.pow((Ai + Bi), (1 - t)) + Math.pow(Bo, (1 - t))), (-2 + 1 / (1 - t))) *
        (-1 + 1 / (1 - t)) *
        (1 - t)) /
        Math.pow((Ai + Bi), (2 * t))) -
        Math.pow((Ai + Bi), (-1 - t)) *
            Math.pow((Math.pow(Bi, (1 - t)) - Math.pow((Ai + Bi), (1 - t)) + Math.pow(Bo, (1 - t))), (-1 + 1 / (1 - t))) *
            t -
        f *
            Math.abs((Math.pow((Math.pow(Bi, (1 - t)) -
                Math.pow((Ai + Bi), (1 - t)) +
                Math.pow(Bo, (1 - t))), (-2 + 1 / (1 - t))) *
                (-1 + 1 / (1 - t)) *
                (1 - t)) /
                Math.pow((Ai + Bi), (2 * t)) +
                Math.pow((Ai + Bi), (-1 - t)) *
                    Math.pow((Math.pow(Bi, (1 - t)) -
                        Math.pow((Ai + Bi), (1 - t)) +
                        Math.pow(Bo, (1 - t))), (-1 + 1 / (1 - t))) *
                    t)) /
        Math.pow((Math.pow((Math.pow(Bi, (1 - t)) - Math.pow((Ai + Bi), (1 - t)) + Math.pow(Bo, (1 - t))), (-1 + 1 / (1 - t))) /
            Math.pow((Ai + Bi), t) -
            Math.abs(1 -
                Math.pow((Math.pow(Bi, (1 - t)) -
                    Math.pow((Ai + Bi), (1 - t)) +
                    Math.pow(Bo, (1 - t))), (-1 + 1 / (1 - t))) /
                    Math.pow((Ai + Bi), t)) *
                f), 2)));
}
exports._derivativeSpotPriceAfterSwapExactTokenInForTokenOut = _derivativeSpotPriceAfterSwapExactTokenInForTokenOut;
// PairType = 'token->token'
// SwapType = 'swapExactOut'
function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData) {
    let f = poolPairData.swapFee.toNumber();
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let t = getTimeTillExpiry(poolPairData.expiryTime, poolPairData.currentBlockTimestamp, poolPairData.unitSeconds);
    let Ao = amount.toNumber();
    return bmath_1.bnum((Math.pow((Math.pow(Bi, (1 - t)) + Math.pow(Bo, (1 - t)) - Math.pow((-Ao + Bo), (1 - t))), (-2 + 1 / (1 - t))) *
        (-1 + 1 / (1 - t)) *
        (1 - t)) /
        Math.pow((-Ao + Bo), (2 * t)) +
        Math.pow((-Ao + Bo), (-1 - t)) *
            Math.pow((Math.pow(Bi, (1 - t)) + Math.pow(Bo, (1 - t)) - Math.pow((-Ao + Bo), (1 - t))), (-1 + 1 / (1 - t))) *
            t +
        f *
            Math.abs((Math.pow((Math.pow(Bi, (1 - t)) + Math.pow(Bo, (1 - t)) - Math.pow((-Ao + Bo), (1 - t))), (-2 + 1 / (1 - t))) *
                (-1 + 1 / (1 - t)) *
                (1 - t)) /
                Math.pow((-Ao + Bo), (2 * t)) +
                Math.pow((-Ao + Bo), (-1 - t)) *
                    Math.pow((Math.pow(Bi, (1 - t)) +
                        Math.pow(Bo, (1 - t)) -
                        Math.pow((-Ao + Bo), (1 - t))), (-1 + 1 / (1 - t))) *
                    t));
}
exports._derivativeSpotPriceAfterSwapTokenInForExactTokenOut = _derivativeSpotPriceAfterSwapTokenInForExactTokenOut;
function getTimeTillExpiry(expiryTime, currentBlockTimestamp, unitSeconds) {
    let t = currentBlockTimestamp < expiryTime
        ? expiryTime - currentBlockTimestamp
        : 0;
    t = t / unitSeconds;
    return t;
}
exports.getTimeTillExpiry = getTimeTillExpiry;
