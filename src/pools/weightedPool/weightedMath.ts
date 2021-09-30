import { formatFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, bnum } from '../../utils/bignumber';
import { WeightedPoolPairData } from './weightedPool';
// All functions came from https://www.wolframcloud.com/obj/fernando.martinel/Published/SOR_equations_published.nb

/////////
/// Swap functions
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _exactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: WeightedPoolPairData
): OldBigNumber {
    const Bi = parseFloat(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const Bo = parseFloat(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
    const wo = parseFloat(formatFixed(poolPairData.weightOut, 18));
    const Ai = amount.toNumber();
    const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
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
export function _tokenInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: WeightedPoolPairData
): OldBigNumber {
    const Bi = parseFloat(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const Bo = parseFloat(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
    const wo = parseFloat(formatFixed(poolPairData.weightOut, 18));
    const Ao = amount.toNumber();
    const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
    return bnum((Bi * (-1 + (Bo / (-Ao + Bo)) ** (wo / wi))) / (1 - f));
    // return Bi.times(
    //     bnum(-1).plus(
    //         Bo.div(Bo.minus(Ao)).toNumber() **
    //             wo.div(wi).toNumber()
    //     )
    // ).div(bnum(1).minus(f));
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactBPTOut(
    amount: OldBigNumber,
    poolPairData: WeightedPoolPairData
): OldBigNumber {
    const Bi = parseFloat(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const Bbpt = parseFloat(formatFixed(poolPairData.balanceOut, 18));
    const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
    const Aobpt = amount.toNumber();
    const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
    return bnum(
        (((Aobpt + Bbpt) / Bbpt) ** (1 / wi) * Bi) /
            ((Aobpt + Bbpt) * (1 + f * (-1 + wi)) * wi)
    );
}

/////////
/// SpotPriceAfterSwap
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: WeightedPoolPairData
): OldBigNumber {
    const Bi = parseFloat(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const Bo = parseFloat(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
    const wo = parseFloat(formatFixed(poolPairData.weightOut, 18));
    const Ai = amount.toNumber();
    const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
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
    amount: OldBigNumber,
    poolPairData: WeightedPoolPairData
): OldBigNumber {
    const Bi = parseFloat(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const Bo = parseFloat(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
    const wo = parseFloat(formatFixed(poolPairData.weightOut, 18));
    const Ao = amount.toNumber();
    const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
    return bnum(
        -(
            (Bi * (Bo / (-Ao + Bo)) ** ((wi + wo) / wi) * wo) /
            (Bo * (-1 + f) * wi)
        )
    );
}

/////////
///  Derivatives of spotPriceAfterSwap
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: WeightedPoolPairData
): OldBigNumber {
    const Bi = parseFloat(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const Bo = parseFloat(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
    const wo = parseFloat(formatFixed(poolPairData.weightOut, 18));
    const Ai = amount.toNumber();
    const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
    return bnum((wi + wo) / (Bo * (Bi / (Ai + Bi - Ai * f)) ** (wi / wo) * wi));
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: WeightedPoolPairData
): OldBigNumber {
    const Bi = parseFloat(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const Bo = parseFloat(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
    const wo = parseFloat(formatFixed(poolPairData.weightOut, 18));
    const Ao = amount.toNumber();
    const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
    return bnum(
        -(
            (Bi * (Bo / (-Ao + Bo)) ** (wo / wi) * wo * (wi + wo)) /
            ((Ao - Bo) ** 2 * (-1 + f) * wi ** 2)
        )
    );
}
