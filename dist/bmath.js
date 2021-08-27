"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_1 = require("./utils/bignumber");
exports.ZERO = bnum(0);
exports.ONE = bnum(1);
exports.INFINITY = bnum('Infinity');
exports.BONE = new bignumber_1.BigNumber(10).pow(18);
exports.TWOBONE = exports.BONE.times(new bignumber_1.BigNumber(2));
const BPOW_PRECISION = exports.BONE.idiv(new bignumber_1.BigNumber(10).pow(10));
function scale(input, decimalPlaces) {
    const scalePow = new bignumber_1.BigNumber(decimalPlaces.toString());
    const scaleMul = new bignumber_1.BigNumber(10).pow(scalePow);
    return input.times(scaleMul);
}
exports.scale = scale;
function bnum(val) {
    return new bignumber_1.BigNumber(val.toString());
}
exports.bnum = bnum;
function calcOutGivenIn(tokenBalanceIn, tokenWeightIn, tokenBalanceOut, tokenWeightOut, tokenAmountIn, swapFee) {
    let weightRatio = bdiv(tokenWeightIn, tokenWeightOut);
    let adjustedIn = exports.BONE.minus(swapFee);
    adjustedIn = bmul(tokenAmountIn, adjustedIn);
    let y = bdiv(tokenBalanceIn, tokenBalanceIn.plus(adjustedIn));
    let foo = bpow(y, weightRatio);
    let bar = exports.BONE.minus(foo);
    let tokenAmountOut = bmul(tokenBalanceOut, bar);
    return tokenAmountOut;
}
exports.calcOutGivenIn = calcOutGivenIn;
function calcInGivenOut(tokenBalanceIn, tokenWeightIn, tokenBalanceOut, tokenWeightOut, tokenAmountOut, swapFee) {
    let weightRatio = bdiv(tokenWeightOut, tokenWeightIn);
    let diff = tokenBalanceOut.minus(tokenAmountOut);
    let y = bdiv(tokenBalanceOut, diff);
    let foo = bpow(y, weightRatio);
    foo = foo.minus(exports.BONE);
    let tokenAmountIn = exports.BONE.minus(swapFee);
    tokenAmountIn = bdiv(bmul(tokenBalanceIn, foo), tokenAmountIn);
    return tokenAmountIn;
}
exports.calcInGivenOut = calcInGivenOut;
function calcSpotPrice(tokenBalanceIn, tokenWeightIn, tokenBalanceOut, tokenWeightOut, swapFee) {
    const numer = bdiv(tokenBalanceIn, tokenWeightIn);
    const denom = bdiv(tokenBalanceOut, tokenWeightOut);
    const ratio = bdiv(numer, denom);
    const scale = bdiv(exports.BONE, bsubSign(exports.BONE, swapFee).res);
    return bmul(ratio, scale);
}
exports.calcSpotPrice = calcSpotPrice;
function bmul(a, b) {
    let c0 = a.times(b);
    let c1 = c0.plus(exports.BONE.div(new bignumber_1.BigNumber(2)));
    let c2 = c1.idiv(exports.BONE);
    return c2;
}
exports.bmul = bmul;
function bdiv(a, b) {
    let c0 = a.times(exports.BONE);
    let c1 = c0.plus(b.div(new bignumber_1.BigNumber(2)));
    let c2 = c1.idiv(b);
    return c2;
}
exports.bdiv = bdiv;
function btoi(a) {
    return a.idiv(exports.BONE);
}
exports.btoi = btoi;
function bfloor(a) {
    return btoi(a).times(exports.BONE);
}
exports.bfloor = bfloor;
function bsubSign(a, b) {
    if (a.gte(b)) {
        let res = a.minus(b);
        let bool = false;
        return { res, bool };
    }
    else {
        let res = b.minus(a);
        let bool = true;
        return { res, bool };
    }
}
exports.bsubSign = bsubSign;
function bpowi(a, n) {
    let z = !n.modulo(new bignumber_1.BigNumber(2)).eq(new bignumber_1.BigNumber(0)) ? a : exports.BONE;
    for (n = n.idiv(new bignumber_1.BigNumber(2)); !n.eq(new bignumber_1.BigNumber(0)); n = n.idiv(new bignumber_1.BigNumber(2))) {
        a = bmul(a, a);
        if (!n.modulo(new bignumber_1.BigNumber(2)).eq(new bignumber_1.BigNumber(0))) {
            z = bmul(z, a);
        }
    }
    return z;
}
function bpow(base, exp) {
    let whole = bfloor(exp);
    let remain = exp.minus(whole);
    let wholePow = bpowi(base, btoi(whole));
    if (remain.eq(new bignumber_1.BigNumber(0))) {
        return wholePow;
    }
    let partialResult = bpowApprox(base, remain, BPOW_PRECISION);
    return bmul(wholePow, partialResult);
}
exports.bpow = bpow;
function bpowApprox(base, exp, precision) {
    let a = exp;
    let { res: x, bool: xneg } = bsubSign(base, exports.BONE);
    let term = exports.BONE;
    let sum = term;
    let negative = false;
    for (let i = 1; term.gte(precision); i++) {
        let bigK = new bignumber_1.BigNumber(i).times(exports.BONE);
        let { res: c, bool: cneg } = bsubSign(a, bigK.minus(exports.BONE));
        term = bmul(term, bmul(c, x));
        term = bdiv(term, bigK);
        if (term.eq(new bignumber_1.BigNumber(0)))
            break;
        if (xneg)
            negative = !negative;
        if (cneg)
            negative = !negative;
        if (negative) {
            sum = sum.minus(term);
        }
        else {
            sum = sum.plus(term);
        }
    }
    return sum;
}
