import { BigNumber } from './utils/bignumber';
import { Pool, Path } from './types';
import {
    BONE,
    TWOBONE,
    MAX_IN_RATIO,
    MAX_OUT_RATIO,
    bmul,
    bdiv,
    bnum,
    calcOutGivenIn,
    calcInGivenOut,
} from './bmath';

export function getLimitAmountSwap(pool: Pool, swapType: string): BigNumber {
    if (swapType === 'swapExactIn') {
        return bmul(pool.balanceIn, MAX_IN_RATIO);
    } else {
        return bmul(pool.balanceOut, MAX_OUT_RATIO);
    }
}

export function getLimitAmountSwapPath(
    path: Path,
    swapType: string
): BigNumber {
    let pools = path.pools;
    if (pools.length == 1) return getLimitAmountSwap(pools[0], swapType);
    else if (pools.length == 2) {
        if (swapType === 'swapExactIn') {
            return BigNumber.min(
                // The limit is either set by limit_IN of pool 1 or indirectly by limit_IN of pool 2
                getLimitAmountSwap(pools[0], swapType),
                bmul(
                    getLimitAmountSwap(pools[1], swapType),
                    getSpotPrice(pools[0])
                ) // we need to multiply the limit_IN of
                // pool 2 by the spotPrice of pool 1 to get the equivalent in token IN
            );
        } else {
            return BigNumber.min(
                // The limit is either set by limit_OUT of pool 2 or indirectly by limit_OUT of pool 1
                getLimitAmountSwap(pools[1], swapType),
                bdiv(
                    getLimitAmountSwap(pools[0], swapType),
                    getSpotPrice(pools[1])
                ) // we need to divide the limit_OUT of
                // pool 1 by the spotPrice of pool 2 to get the equivalent in token OUT
            );
        }
    } else {
        throw new Error('Path with more than 2 pools not supported');
    }
}

export function getSpotPricePath(path: Path): BigNumber {
    let pools = path.pools;
    if (pools.length == 1) return getSpotPrice(pools[0]);
    else if (pools.length == 2) {
        return bmul(getSpotPrice(pools[0]), getSpotPrice(pools[1]));
    } else {
        throw new Error('Path with more than 2 pools not supported');
    }
}

export function getSpotPrice(pool: Pool): BigNumber {
    let inRatio = bdiv(pool.balanceIn, pool.weightIn);
    let outRatio = bdiv(pool.balanceOut, pool.weightOut);
    if (outRatio.isEqualTo(bnum(0))) {
        return bnum(0);
    } else {
        return bdiv(bdiv(inRatio, outRatio), BONE.minus(pool.swapFee));
    }
}

export function getSlippageLinearizedSpotPriceAfterSwapPath(
    path: Path,
    swapType: string
): BigNumber {
    let pools = path.pools;
    if (pools.length == 1)
        return getSlippageLinearizedSpotPriceAfterSwap(pools[0], swapType);
    else if (pools.length == 2) {
        let p1 = pools[0];
        let p2 = pools[1];
        if (
            p1.balanceIn.isEqualTo(bnum(0)) ||
            p2.balanceIn.isEqualTo(bnum(0))
        ) {
            return bnum(0);
        } else {
            if (swapType === 'swapExactIn') {
                // See formula on https://one.wolframcloud.com/env/fernando.martinel/SOR_multihop_analysis.nb
                let numerator1 = bmul(
                    bmul(
                        bmul(BONE.minus(p1.swapFee), BONE.minus(p2.swapFee)), // In mathematica both terms are the negative (which compensates)
                        p1.balanceOut
                    ),
                    bmul(p1.weightIn, p2.weightIn)
                );

                let numerator2 = bmul(
                    bmul(
                        p1.balanceOut.plus(p2.balanceIn),
                        BONE.minus(p1.swapFee) // In mathematica this is the negative but we add (instead of subtracting) numerator2 to compensate
                    ),
                    bmul(p1.weightIn, p2.weightOut)
                );

                let numerator3 = bmul(
                    p2.balanceIn,
                    bmul(p1.weightOut, p2.weightOut)
                );

                let numerator = numerator1.plus(numerator2).plus(numerator3);

                let denominator = bmul(
                    bmul(p1.balanceIn, p2.balanceIn),
                    bmul(p1.weightOut, p2.weightOut)
                );

                return bdiv(numerator, denominator);
            } else {
                let numerator1 = bmul(
                    bmul(
                        bmul(BONE.minus(p1.swapFee), BONE.minus(p2.swapFee)), // In mathematica both terms are the negative (which compensates)
                        p1.balanceOut
                    ),
                    bmul(p1.weightIn, p2.weightIn)
                );

                let numerator2 = bmul(
                    bmul(
                        p1.balanceOut.plus(p2.balanceIn),
                        BONE.minus(p1.swapFee) // In mathematica this is the negative but we add (instead of subtracting) numerator2 to compensate
                    ),
                    bmul(p1.weightIn, p2.weightOut)
                );

                let numerator3 = bmul(
                    p2.balanceIn,
                    bmul(p1.weightOut, p2.weightOut)
                );

                let numerator = numerator1.plus(numerator2).plus(numerator3);

                let denominator = bmul(
                    bmul(p1.balanceIn, p2.balanceIn),
                    bmul(p1.weightOut, p2.weightOut)
                );

                return bdiv(numerator, denominator);
            }
        }
    } else {
        throw new Error('Path with more than 2 pools not supported');
    }
}

export function getSlippageLinearizedSpotPriceAfterSwap(
    pool: Pool,
    swapType: string
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = pool;
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

export function getOutputAmountSwapPath(
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let pools = path.pools;
    if (pools.length == 1)
        return getOutputAmountSwap(pools[0], swapType, amount);
    else if (pools.length == 2) {
        if (swapType === 'swapExactIn') {
            // The outputAmount is number of tokenOut we receive from the second pool
            return getOutputAmountSwap(
                pools[1],
                swapType,
                getOutputAmountSwap(pools[0], swapType, amount)
            );
        } else {
            // The outputAmount is number of tokenIn we send to the first pool
            return getOutputAmountSwap(
                pools[0],
                swapType,
                getOutputAmountSwap(pools[1], swapType, amount)
            );
        }
    } else {
        throw new Error('Path with more than 2 pools not supported');
    }
}

export function getOutputAmountSwap(
    pool: Pool,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = pool;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return calcOutGivenIn(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                amount,
                swapFee
            );
        }
    } else {
        if (balanceOut.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return calcInGivenOut(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                amount,
                swapFee
            );
        }
    }
}
// Based on the function of same name of file onchain-sor in file: BRegistry.sol
// Normalized liquidity is not used in any calculationf, but instead for comparison between pools only
// so we can find the most liquid pool considering the effect of uneven weigths
export function getNormalizedLiquidity(pool: Pool): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = pool;
    return bdiv(bmul(balanceOut, weightIn), weightIn.plus(weightOut));
}
