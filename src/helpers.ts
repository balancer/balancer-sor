import { BigNumber } from './utils/bignumber';
import { Pool } from './types';
import {
    BONE,
    TWOBONE,
    MAX_IN_RATIO,
    MAX_OUT_RATIO,
    bmul,
    bdiv,
    bnum,
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
    if (outRatio.isEqualTo(bnum(0))) {
        return bnum(0);
    } else {
        return bdiv(bdiv(inRatio, outRatio), BONE.minus(balancer.swapFee));
    }
}

export function getSlippageLinearizedSpotPriceAfterSwap(
    balancer: Pool,
    swapType: string
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = balancer;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return bdiv(
                bmul(BONE.minus(swapFee), bdiv(weightIn, weightOut)).plus(BONE),
                balanceIn
            );
        }
    } else {
        if (balanceOut.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return bdiv(
                bdiv(weightOut, bmul(BONE.minus(swapFee), weightIn)).plus(BONE),
                balanceOut
            );
        }
    }
}

export function getSlippageLinearizedEffectivePriceSwap(
    balancer: Pool,
    swapType: string
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = balancer;
    if (swapType == 'swapExactIn') {
        if (balanceIn.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return bmul(
                BONE.minus(swapFee),
                bdiv(
                    bdiv(weightIn, weightOut).plus(BONE),
                    bmul(TWOBONE, balanceIn)
                )
            );
        }
    } else {
        if (balanceOut.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return bdiv(
                bdiv(weightOut, weightIn).plus(BONE),
                bmul(TWOBONE, balanceOut)
            );
        }
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
