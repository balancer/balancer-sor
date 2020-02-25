import { BigNumber } from './utils/bignumber';
import { Pool } from './types';

export const BONE = new BigNumber(10).pow(18);
export const TWOBONE = BONE.times(new BigNumber(2));

export function bmul(a: BigNumber, b: BigNumber): BigNumber {
    let c0 = a.times(b);
    let c1 = c0.plus(BONE.div(TWOBONE));
    let c2 = c1.idiv(BONE);
    return c2;
}

export function bdiv(a: BigNumber, b: BigNumber): BigNumber {
    let c0 = a.times(BONE);
    let c1 = c0.plus(BONE.div(TWOBONE));
    let c2 = c1.idiv(b);
    return c2;
}

export function getSpotPrice(balancer: Pool): BigNumber {
    let inRatio = bdiv(balancer.balanceIn, balancer.weightIn);
    let outRatio = bdiv(balancer.balanceOut, balancer.weightOut);
    let spotPrice = bdiv(inRatio, bdiv(outRatio, BONE.minus(balancer.swapFee)));
    return spotPrice;
}

export function getSlippageLinearizedSpotPriceAfterSwap(
    balancer: Pool,
    swapType: string
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = balancer;
    if (swapType === 'swapExactIn') {
        return bmul(BONE.minus(swapFee), bdiv(weightIn, weightOut)).plus(
            bdiv(BONE, balanceIn)
        );
    } else {
        return bdiv(weightOut, bmul(BONE.minus(swapFee), weightIn)).plus(
            bdiv(BONE, balanceOut)
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
