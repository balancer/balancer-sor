import { BigNumber } from './utils/bignumber';
import { Pool } from './types';
import {
    BONE,
    TWOBONE,
    MAX_IN_RATIO,
    MAX_OUT_RATIO,
    bmul,
    bdiv,
} from './bmath';

export function getLimitAmountSwap(
    balancer: Pool,
    swapType: string
): BigNumber {
    if (swapType === 'swapExactIn') {
        return bmul(balancer.balanceIn, MAX_IN_RATIO);
    } else {
        return bmul(balancer.balanceOut, MAX_OUT_RATIO);
    }
}

export function getSpotPrice(balancer: Pool): BigNumber {
    let inRatio = bdiv(balancer.balanceIn, balancer.weightIn);
    let outRatio = bdiv(balancer.balanceOut, balancer.weightOut);
    let spotPrice = bdiv(bdiv(inRatio, outRatio), BONE.minus(balancer.swapFee));
    return spotPrice;
}

export function getSlippageLinearizedSpotPriceAfterSwap(
    balancer: Pool,
    swapType: string
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = balancer;
    if (swapType === 'swapExactIn') {
        return bdiv(
            bmul(BONE.minus(swapFee), bdiv(weightIn, weightOut)).plus(BONE),
            balanceIn
        );
    } else {
        return bdiv(
            bdiv(weightOut, bmul(BONE.minus(swapFee), weightIn)).plus(BONE),
            balanceOut
        );
    }
}

export function getSlippageLinearizedEffectivePriceSwap(
    balancer: Pool,
    swapType: string
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = balancer;
    if (swapType == 'swapExactIn') {
        return bmul(
            BONE.minus(swapFee),
            bdiv(bdiv(weightIn, weightOut).plus(BONE), bmul(TWOBONE, balanceIn))
        );
    } else {
        return bdiv(
            bdiv(weightOut, weightIn).plus(BONE),
            bmul(TWOBONE, balanceOut)
        );
    }
}

export function getLinearizedOutputAmountSwap(
    balancer: Pool,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let { spotPrice } = balancer;
    let slippageLinearizedEp = getSlippageLinearizedEffectivePriceSwap(
        balancer,
        swapType
    );

    if (swapType == 'swapExactIn') {
        return bdiv(
            amount,
            bmul(spotPrice, BONE.plus(bmul(slippageLinearizedEp, amount)))
        );
    } else {
        return bmul(
            amount,
            bmul(spotPrice, BONE.plus(bmul(slippageLinearizedEp, amount)))
        );
    }
}
