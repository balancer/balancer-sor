'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bmath_1 = require('../../bmath');
// All functions came from https://www.wolframcloud.com/obj/fernando.martinel/Published/SOR_equations_published.nb
/////////
/// Swap functions
/////////
// PairType = 'token->token'
// SwapType = 'swapExactIn'
function _exactTokenInForTokenOut(amount, poolPairData) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(Bo * (1 - Math.pow(Bi / (Bi + Ai * (1 - f)), wi / wo)));
    // return Bo.times(
    //     bnum(1).minus(
    //         bnum(
    //             Bi.div(
    //                 Bi.plus(Ai.times(bnum(1).minus(f)))
    //             ).toNumber() ** wi.div(wo).toNumber()
    //         )
    //     )
    // )
}
exports._exactTokenInForTokenOut = _exactTokenInForTokenOut;
// PairType = 'token->token'
// SwapType = 'swapExactOut'
function _tokenInForExactTokenOut(amount, poolPairData) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        (Bi * (-1 + Math.pow(Bo / (-Ao + Bo), wo / wi))) / (1 - f)
    );
    // return Bi.times(
    //     bnum(-1).plus(
    //         Bo.div(Bo.minus(Ao)).toNumber() **
    //             wo.div(wi).toNumber()
    //     )
    // ).div(bnum(1).minus(f));
}
exports._tokenInForExactTokenOut = _tokenInForExactTokenOut;
// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
function _exactTokenInForBPTOut(amount, poolPairData) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        Bbpt * (-1 + Math.pow(1 + (Ai * (1 - f * (1 - wi))) / Bi, wi))
    );
}
exports._exactTokenInForBPTOut = _exactTokenInForBPTOut;
// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
function _tokenInForExactBPTOut(amount, poolPairData) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Aobpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        ((-1 + Math.pow(1 + Aobpt / Bbpt, 1 / wi)) * Bi) / (1 - f * (1 - wi))
    );
}
exports._tokenInForExactBPTOut = _tokenInForExactBPTOut;
// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
function _BPTInForExactTokenOut(amount, poolPairData) {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Aibpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        ((1 - Math.pow(1 - Aibpt / Bbpt, 1 / wo)) * Bo) / (1 - f * (1 - wo))
    );
}
exports._BPTInForExactTokenOut = _BPTInForExactTokenOut;
// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
function _exactBPTInForTokenOut(amount, poolPairData) {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        Bbpt * (1 - Math.pow(1 - (Ao * (1 - f * (1 - wo))) / Bo, wo))
    );
}
exports._exactBPTInForTokenOut = _exactBPTInForTokenOut;
/////////
/// SpotPriceAfterSwap
/////////
// PairType = 'token->token'
// SwapType = 'swapExactIn'
function _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        -(
            (Bi * wo) /
            (Bo *
                (-1 + f) *
                Math.pow(Bi / (Ai + Bi - Ai * f), (wi + wo) / wo) *
                wi)
        )
    );
}
exports._spotPriceAfterSwapExactTokenInForTokenOut =
    _spotPriceAfterSwapExactTokenInForTokenOut;
// PairType = 'token->token'
// SwapType = 'swapExactOut'
function _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        -(
            (Bi * Math.pow(Bo / (-Ao + Bo), (wi + wo) / wi) * wo) /
            (Bo * (-1 + f) * wi)
        )
    );
}
exports._spotPriceAfterSwapTokenInForExactTokenOut =
    _spotPriceAfterSwapTokenInForExactTokenOut;
// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
function _spotPriceAfterSwapExactTokenInForBPTOut(amount, poolPairData) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        (Bi * Math.pow((Ai + Bi + Ai * f * (-1 + wi)) / Bi, 1 - wi)) /
            (Bbpt * (1 + f * (-1 + wi)) * wi)
    );
}
exports._spotPriceAfterSwapExactTokenInForBPTOut =
    _spotPriceAfterSwapExactTokenInForBPTOut;
// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
function _spotPriceAfterSwapTokenInForExactBPTOut(amount, poolPairData) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Aobpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        (Math.pow((Aobpt + Bbpt) / Bbpt, 1 / wi) * Bi) /
            ((Aobpt + Bbpt) * (1 + f * (-1 + wi)) * wi)
    );
}
exports._spotPriceAfterSwapTokenInForExactBPTOut =
    _spotPriceAfterSwapTokenInForExactBPTOut;
// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
function _spotPriceAfterSwapExactBPTInForTokenOut(amount, poolPairData) {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Aibpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        (Math.pow(1 - Aibpt / Bbpt, (-1 + wo) / wo) *
            Bbpt *
            (1 + f * (-1 + wo)) *
            wo) /
            Bo
    );
}
exports._spotPriceAfterSwapExactBPTInForTokenOut =
    _spotPriceAfterSwapExactBPTInForTokenOut;
// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
function _spotPriceAfterSwapBPTInForExactTokenOut(amount, poolPairData) {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        (Bbpt *
            (1 + f * (-1 + wo)) *
            wo *
            Math.pow(1 + (Ao * (-1 + f - f * wo)) / Bo, -1 + wo)) /
            Bo
    );
}
exports._spotPriceAfterSwapBPTInForExactTokenOut =
    _spotPriceAfterSwapBPTInForExactTokenOut;
/////////
///  Derivatives of spotPriceAfterSwap
/////////
// PairType = 'token->token'
// SwapType = 'swapExactIn'
function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    amount,
    poolPairData
) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        (wi + wo) / (Bo * Math.pow(Bi / (Ai + Bi - Ai * f), wi / wo) * wi)
    );
}
exports._derivativeSpotPriceAfterSwapExactTokenInForTokenOut =
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut;
// PairType = 'token->token'
// SwapType = 'swapExactOut'
function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    amount,
    poolPairData
) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        -(
            (Bi * Math.pow(Bo / (-Ao + Bo), wo / wi) * wo * (wi + wo)) /
            (Math.pow(Ao - Bo, 2) * (-1 + f) * Math.pow(wi, 2))
        )
    );
}
exports._derivativeSpotPriceAfterSwapTokenInForExactTokenOut =
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut;
// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
function _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
    amount,
    poolPairData
) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        -(
            (-1 + wi) /
            (Bbpt * Math.pow((Ai + Bi + Ai * f * (-1 + wi)) / Bi, wi) * wi)
        )
    );
}
exports._derivativeSpotPriceAfterSwapExactTokenInForBPTOut =
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut;
// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
function _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
    amount,
    poolPairData
) {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Aobpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        -(
            (Math.pow((Aobpt + Bbpt) / Bbpt, 1 / wi) * Bi * (-1 + wi)) /
            (Math.pow(Aobpt + Bbpt, 2) * (1 + f * (-1 + wi)) * Math.pow(wi, 2))
        )
    );
}
exports._derivativeSpotPriceAfterSwapTokenInForExactBPTOut =
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut;
// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
function _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
    amount,
    poolPairData
) {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Aibpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        -(
            ((1 + f * (-1 + wo)) * (-1 + wo)) /
            (Math.pow(1 - Aibpt / Bbpt, 1 / wo) * Bo)
        )
    );
}
exports._derivativeSpotPriceAfterSwapExactBPTInForTokenOut =
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut;
// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
function _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
    amount,
    poolPairData
) {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bmath_1.bnum(
        -(
            (Bbpt *
                Math.pow(1 + f * (-1 + wo), 2) *
                (-1 + wo) *
                wo *
                Math.pow(1 + (Ao * (-1 + f - f * wo)) / Bo, -2 + wo)) /
            Math.pow(Bo, 2)
        )
    );
}
exports._derivativeSpotPriceAfterSwapBPTInForExactTokenOut =
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut;
