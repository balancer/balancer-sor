'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bmath_1 = require('../bmath');
function getLimitAmountSwap(balancer, swapType) {
    if (swapType === 'swapExactIn') {
        return bmath_1.bmul(balancer.balanceIn, bmath_1.MAX_IN_RATIO);
    } else {
        return bmath_1.bmul(balancer.balanceOut, bmath_1.MAX_OUT_RATIO);
    }
}
exports.getLimitAmountSwap = getLimitAmountSwap;
function getSpotPrice(balancer) {
    let inRatio = bmath_1.bdiv(balancer.balanceIn, balancer.weightIn);
    let outRatio = bmath_1.bdiv(balancer.balanceOut, balancer.weightOut);
    if (outRatio.isEqualTo(bmath_1.bnum(0))) {
        return bmath_1.bnum(0);
    } else {
        return bmath_1.bdiv(
            bmath_1.bdiv(inRatio, outRatio),
            bmath_1.BONE.minus(balancer.swapFee)
        );
    }
}
exports.getSpotPrice = getSpotPrice;
function getSlippageLinearizedSpotPriceAfterSwap(balancer, swapType) {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = balancer;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bmath_1.bnum(0))) {
            return bmath_1.bnum(0);
        } else {
            return bmath_1.bdiv(
                bmath_1
                    .bmul(
                        bmath_1.BONE.minus(swapFee),
                        bmath_1.bdiv(weightIn, weightOut)
                    )
                    .plus(bmath_1.BONE),
                balanceIn
            );
        }
    } else {
        if (balanceOut.isEqualTo(bmath_1.bnum(0))) {
            return bmath_1.bnum(0);
        } else {
            return bmath_1.bdiv(
                bmath_1
                    .bdiv(
                        weightOut,
                        bmath_1.bmul(bmath_1.BONE.minus(swapFee), weightIn)
                    )
                    .plus(bmath_1.BONE),
                balanceOut
            );
        }
    }
}
exports.getSlippageLinearizedSpotPriceAfterSwap = getSlippageLinearizedSpotPriceAfterSwap;
function getSlippageLinearizedEffectivePriceSwap(balancer, swapType) {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = balancer;
    if (swapType == 'swapExactIn') {
        if (balanceIn.isEqualTo(bmath_1.bnum(0))) {
            return bmath_1.bnum(0);
        } else {
            return bmath_1.bmul(
                bmath_1.BONE.minus(swapFee),
                bmath_1.bdiv(
                    bmath_1.bdiv(weightIn, weightOut).plus(bmath_1.BONE),
                    bmath_1.bmul(bmath_1.TWOBONE, balanceIn)
                )
            );
        }
    } else {
        if (balanceOut.isEqualTo(bmath_1.bnum(0))) {
            return bmath_1.bnum(0);
        } else {
            return bmath_1.bdiv(
                bmath_1.bdiv(weightOut, weightIn).plus(bmath_1.BONE),
                bmath_1.bmul(bmath_1.TWOBONE, balanceOut)
            );
        }
    }
}
exports.getSlippageLinearizedEffectivePriceSwap = getSlippageLinearizedEffectivePriceSwap;
function getLinearizedOutputAmountSwap(balancer, swapType, amount) {
    let { spotPrice } = balancer;
    let slippageLinearizedEp = getSlippageLinearizedEffectivePriceSwap(
        balancer,
        swapType
    );
    if (swapType == 'swapExactIn') {
        return bmath_1.bdiv(
            amount,
            bmath_1.bmul(
                spotPrice,
                bmath_1.BONE.plus(bmath_1.bmul(slippageLinearizedEp, amount))
            )
        );
    } else {
        return bmath_1.bmul(
            amount,
            bmath_1.bmul(
                spotPrice,
                bmath_1.BONE.plus(bmath_1.bmul(slippageLinearizedEp, amount))
            )
        );
    }
}
exports.getLinearizedOutputAmountSwap = getLinearizedOutputAmountSwap;
