import { BigNumber } from '../utils/bignumber';
import { bnum } from '../bmath';
// All functions came from https://www.wolframcloud.com/obj/fernando.martinel/Published/SOR_equations_published.nb

/////////
/// Swap functions
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _exactTokenInForTokenOut(amount, poolPairData): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(Bo * (1 - (Bi / (Bi + Ai * (1 - f))) ** (wi / wo)));
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

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _tokenInForExactTokenOut(amount, poolPairData): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum((Bi * (-1 + (Bo / (-Ao + Bo)) ** (wo / wi))) / (1 - f));
    // return Bi.times(
    //     bnum(-1).plus(
    //         Bo.div(Bo.minus(Ao)).toNumber() **
    //             wo.div(wi).toNumber()
    //     )
    // ).div(bnum(1).minus(f));
}

// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
export function _exactTokenInForBPTOut(amount, poolPairData): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(Bbpt * (-1 + (1 + (Ai * (1 - f * (1 - wi))) / Bi) ** wi));
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _tokenInForExactBPTOut(amount, poolPairData): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Aobpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        ((-1 + (1 + Aobpt / Bbpt) ** (1 / wi)) * Bi) / (1 - f * (1 - wi))
    );
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _BPTInForExactTokenOut(amount, poolPairData): BigNumber {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Aibpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        ((1 - (1 - Aibpt / Bbpt) ** (1 / wo)) * Bo) / (1 - f * (1 - wo))
    );
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _exactBPTInForTokenOut(amount, poolPairData): BigNumber {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(Bbpt * (1 - (1 - (Ao * (1 - f * (1 - wo))) / Bo) ** wo));
}

/////////
/// SpotPriceAfterSwap
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForTokenOut(
    amount,
    poolPairData
): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        -(
            (Bi * wo) /
            (Bo * (-1 + f) * (Bi / (Ai + Bi - Ai * f)) ** ((wi + wo) / wo) * wi)
        )
    );
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactTokenOut(
    amount,
    poolPairData
): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        -(
            (Bi * (Bo / (-Ao + Bo)) ** ((wi + wo) / wi) * wo) /
            (Bo * (-1 + f) * wi)
        )
    );
}

// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForBPTOut(
    amount,
    poolPairData
): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        (Bi * ((Ai + Bi + Ai * f * (-1 + wi)) / Bi) ** (1 - wi)) /
            (Bbpt * (1 + f * (-1 + wi)) * wi)
    );
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactBPTOut(
    amount,
    poolPairData
): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Aobpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        (((Aobpt + Bbpt) / Bbpt) ** (1 / wi) * Bi) /
            ((Aobpt + Bbpt) * (1 + f * (-1 + wi)) * wi)
    );
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactBPTInForTokenOut(
    amount,
    poolPairData
): BigNumber {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Aibpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        ((1 - Aibpt / Bbpt) ** ((-1 + wo) / wo) *
            Bbpt *
            (1 + f * (-1 + wo)) *
            wo) /
            Bo
    );
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapBPTInForExactTokenOut(
    amount,
    poolPairData
): BigNumber {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        (Bbpt *
            (1 + f * (-1 + wo)) *
            wo *
            (1 + (Ao * (-1 + f - f * wo)) / Bo) ** (-1 + wo)) /
            Bo
    );
}

/////////
///  Derivatives of spotPriceAfterSwap
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    amount,
    poolPairData
): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum((wi + wo) / (Bo * (Bi / (Ai + Bi - Ai * f)) ** (wi / wo) * wi));
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    amount,
    poolPairData
): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        -(
            (Bi * (Bo / (-Ao + Bo)) ** (wo / wi) * wo * (wi + wo)) /
            ((Ao - Bo) ** 2 * (-1 + f) * wi ** 2)
        )
    );
}

// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
    amount,
    poolPairData
): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Ai = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        -((-1 + wi) / (Bbpt * ((Ai + Bi + Ai * f * (-1 + wi)) / Bi) ** wi * wi))
    );
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
    amount,
    poolPairData
): BigNumber {
    let Bi = poolPairData.balanceIn.toNumber();
    let Bbpt = poolPairData.balanceOut.toNumber();
    let wi = poolPairData.weightIn.toNumber();
    let Aobpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        -(
            (((Aobpt + Bbpt) / Bbpt) ** (1 / wi) * Bi * (-1 + wi)) /
            ((Aobpt + Bbpt) ** 2 * (1 + f * (-1 + wi)) * wi ** 2)
        )
    );
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
    amount,
    poolPairData
): BigNumber {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Aibpt = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        -(
            ((1 + f * (-1 + wo)) * (-1 + wo)) /
            ((1 - Aibpt / Bbpt) ** (1 / wo) * Bo)
        )
    );
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
    amount,
    poolPairData
): BigNumber {
    let Bbpt = poolPairData.balanceIn.toNumber();
    let Bo = poolPairData.balanceOut.toNumber();
    let wo = poolPairData.weightOut.toNumber();
    let Ao = amount.toNumber();
    let f = poolPairData.swapFee.toNumber();
    return bnum(
        -(
            (Bbpt *
                (1 + f * (-1 + wo)) ** 2 *
                (-1 + wo) *
                wo *
                (1 + (Ao * (-1 + f - f * wo)) / Bo) ** (-2 + wo)) /
            Bo ** 2
        )
    );
}
