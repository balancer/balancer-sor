import { BigNumber } from '../../utils/bignumber';
import { bnum } from '../../utils/bignumber';
import { WeightedPoolPairData } from './weightedPool';
// All functions came from https://www.wolframcloud.com/obj/fernando.martinel/Published/SOR_equations_published.nb

/////////
/// Swap functions
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _exactTokenInForTokenOut(
    amount: BigNumber,
    poolPairData: WeightedPoolPairData
): BigNumber {
    const Bi = poolPairData.balanceIn.toNumber();
    const Bo = poolPairData.balanceOut.toNumber();
    const wi = poolPairData.weightIn.toNumber();
    const wo = poolPairData.weightOut.toNumber();
    const Ai = amount.toNumber();
    const f = poolPairData.swapFee.toNumber();
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
    amount: BigNumber,
    poolPairData: WeightedPoolPairData
): BigNumber {
    const Bi = poolPairData.balanceIn.toNumber();
    const Bo = poolPairData.balanceOut.toNumber();
    const wi = poolPairData.weightIn.toNumber();
    const wo = poolPairData.weightOut.toNumber();
    const Ao = amount.toNumber();
    const f = poolPairData.swapFee.toNumber();
    return bnum((Bi * (-1 + (Bo / (-Ao + Bo)) ** (wo / wi))) / (1 - f));
    // return Bi.times(
    //     bnum(-1).plus(
    //         Bo.div(Bo.minus(Ao)).toNumber() **
    //             wo.div(wi).toNumber()
    //     )
    // ).div(bnum(1).minus(f));
}

/////////
/// SpotPriceAfterSwap
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForTokenOut(
    amount: BigNumber,
    poolPairData: WeightedPoolPairData
): BigNumber {
    const Bi = poolPairData.balanceIn.toNumber();
    const Bo = poolPairData.balanceOut.toNumber();
    const wi = poolPairData.weightIn.toNumber();
    const wo = poolPairData.weightOut.toNumber();
    const Ai = amount.toNumber();
    const f = poolPairData.swapFee.toNumber();
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
    amount: BigNumber,
    poolPairData: WeightedPoolPairData
): BigNumber {
    const Bi = poolPairData.balanceIn.toNumber();
    const Bo = poolPairData.balanceOut.toNumber();
    const wi = poolPairData.weightIn.toNumber();
    const wo = poolPairData.weightOut.toNumber();
    const Ao = amount.toNumber();
    const f = poolPairData.swapFee.toNumber();
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
    amount: BigNumber,
    poolPairData: WeightedPoolPairData
): BigNumber {
    const Bi = poolPairData.balanceIn.toNumber();
    const Bo = poolPairData.balanceOut.toNumber();
    const wi = poolPairData.weightIn.toNumber();
    const wo = poolPairData.weightOut.toNumber();
    const Ai = amount.toNumber();
    const f = poolPairData.swapFee.toNumber();
    return bnum((wi + wo) / (Bo * (Bi / (Ai + Bi - Ai * f)) ** (wi / wo) * wi));
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    amount: BigNumber,
    poolPairData: WeightedPoolPairData
): BigNumber {
    const Bi = poolPairData.balanceIn.toNumber();
    const Bo = poolPairData.balanceOut.toNumber();
    const wi = poolPairData.weightIn.toNumber();
    const wo = poolPairData.weightOut.toNumber();
    const Ao = amount.toNumber();
    const f = poolPairData.swapFee.toNumber();
    return bnum(
        -(
            (Bi * (Bo / (-Ao + Bo)) ** (wo / wi) * wo * (wi + wo)) /
            ((Ao - Bo) ** 2 * (-1 + f) * wi ** 2)
        )
    );
}
