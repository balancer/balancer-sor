import { BigNumber } from '../../utils/bignumber';
import { bnum } from '../../utils/bignumber';
import { formatFixed } from '@ethersproject/bignumber';

import { LinearPoolPairData } from './linearPool';

/////////
/// Swap functions
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _exactTokenInForTokenOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    // This is not expected to be used by SOR
    // but could still be implemented
    throw new Error('Function not implemented.');
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _tokenInForExactTokenOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    // This is not expected to be used by SOR
    // but could still be implemented
    throw new Error('Function not implemented.');
}

// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
export function _exactMainTokenInForBPTOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    const mainIn = bnum(amount.toString());
    const mainBalance = bnum(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const wrappedBalance = bnum(
        formatFixed(
            poolPairData.wrappedBalance.toString(),
            poolPairData.wrappedDecimals
        )
    );
    const virtualBptSupply = bnum(
        formatFixed(poolPairData.virtualBptSupply, 18)
    );
    const params: BigNumber[] = [
        bnum(formatFixed(poolPairData.swapFee, 18)),
        bnum(formatFixed(poolPairData.rate.toString(), 18)),
        bnum(formatFixed(poolPairData.lowerTarget.toString(), 18)),
        bnum(formatFixed(poolPairData.upperTarget.toString(), 18)),
    ];

    if (virtualBptSupply.eq(0)) {
        return toNominal(mainIn, params);
    }

    const previousNominalMain = toNominal(mainBalance, params);
    const afterNominalMain = toNominal(mainBalance.plus(mainIn), params);
    const deltaNominalMain = afterNominalMain.minus(previousNominalMain);
    const invariant = calcInvariant(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const bptOut = virtualBptSupply.times(deltaNominalMain).div(invariant);
    return bptOut;
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _mainTokenInForExactBPTOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    const bptOut = bnum(amount.toString());
    const virtualBptSupply = bnum(
        formatFixed(poolPairData.virtualBptSupply, 18)
    );
    const mainBalance = bnum(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const wrappedBalance = bnum(
        formatFixed(
            poolPairData.wrappedBalance.toString(),
            poolPairData.wrappedDecimals
        )
    );
    const params: BigNumber[] = [
        bnum(formatFixed(poolPairData.swapFee, 18)),
        bnum(formatFixed(poolPairData.rate.toString(), 18)),
        bnum(formatFixed(poolPairData.lowerTarget.toString(), 18)),
        bnum(formatFixed(poolPairData.upperTarget.toString(), 18)),
    ];

    if (virtualBptSupply.eq(0)) {
        return fromNominal(bptOut, params);
    }
    const previousNominalMain = toNominal(mainBalance, params);
    const invariant = calcInvariant(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const deltaNominalMain = bptOut.times(invariant).div(virtualBptSupply);
    const afterNominalMain = previousNominalMain.plus(deltaNominalMain);
    const newMainBalance = fromNominal(afterNominalMain, params);
    const mainIn = newMainBalance.minus(mainBalance);
    return mainIn;
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _BPTInForExactMainTokenOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    const mainOut = bnum(amount.toString());
    const mainBalance = bnum(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wrappedBalance = bnum(
        formatFixed(
            poolPairData.wrappedBalance.toString(),
            poolPairData.wrappedDecimals
        )
    );
    const virtualBptSupply = bnum(
        formatFixed(poolPairData.virtualBptSupply, 18)
    );
    const params: BigNumber[] = [
        bnum(formatFixed(poolPairData.swapFee, 18)),
        bnum(formatFixed(poolPairData.rate.toString(), 18)),
        bnum(formatFixed(poolPairData.lowerTarget.toString(), 18)),
        bnum(formatFixed(poolPairData.upperTarget.toString(), 18)),
    ];

    const previousNominalMain = toNominal(mainBalance, params);
    const afterNominalMain = toNominal(mainBalance.minus(mainOut), params);
    const deltaNominalMain = previousNominalMain.minus(afterNominalMain);
    const invariant = calcInvariant(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const bptIn = virtualBptSupply.times(deltaNominalMain.div(invariant));
    return bptIn;
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _exactBPTInForMainTokenOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    const bptIn = bnum(amount.toString());
    const mainBalance = bnum(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wrappedBalance = bnum(
        formatFixed(
            poolPairData.wrappedBalance.toString(),
            poolPairData.wrappedDecimals
        )
    );
    const virtualBptSupply = bnum(
        formatFixed(poolPairData.virtualBptSupply, 18)
    );
    const params: BigNumber[] = [
        bnum(formatFixed(poolPairData.swapFee, 18)),
        bnum(formatFixed(poolPairData.rate.toString(), 18)),
        bnum(formatFixed(poolPairData.lowerTarget.toString(), 18)),
        bnum(formatFixed(poolPairData.upperTarget.toString(), 18)),
    ];

    const previousNominalMain = toNominal(mainBalance, params);
    const invariant = calcInvariant(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const deltaNominalMain = invariant.times(bptIn).div(virtualBptSupply);
    const afterNominalMain = previousNominalMain.minus(deltaNominalMain);
    const newMainBalance = fromNominal(afterNominalMain, params);
    const mainOut = mainBalance.minus(newMainBalance);
    return mainOut;
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
    // This is not expected to be used by SOR
    // but could still be implemented
    throw new Error('Function not implemented.');
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactTokenOut(
    amount,
    poolPairData
): BigNumber {
    // This is not expected to be used by SOR
    // but could still be implemented
    throw new Error('Function not implemented.');
}

// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForBPTOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    const mainIn = bnum(amount.toString());
    const mainBalance = bnum(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const finalMainBalance = mainIn.plus(mainBalance);
    const wrappedBalance = bnum(
        formatFixed(
            poolPairData.wrappedBalance.toString(),
            poolPairData.wrappedDecimals
        )
    );
    const virtualBptSupply = bnum(
        formatFixed(poolPairData.virtualBptSupply, 18)
    );
    const params: BigNumber[] = [
        bnum(formatFixed(poolPairData.swapFee, 18)),
        bnum(formatFixed(poolPairData.rate.toString(), 18)),
        bnum(formatFixed(poolPairData.lowerTarget.toString(), 18)),
        bnum(formatFixed(poolPairData.upperTarget.toString(), 18)),
    ];

    const previousNominalMain = toNominal(mainBalance, params);
    const invariant = calcInvariant(
        previousNominalMain,
        wrappedBalance,
        params
    );
    let poolFactor = bnum(1);
    if (!virtualBptSupply.eq(0)) {
        poolFactor = invariant.div(virtualBptSupply);
    }
    return poolFactor.div(rightDerivativeToNominal(finalMainBalance, params));
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactBPTOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    const bptOut = bnum(amount.toString());
    const virtualBptSupply = bnum(
        formatFixed(poolPairData.virtualBptSupply, 18)
    );
    const mainBalance = bnum(
        formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
    );
    const wrappedBalance = bnum(
        formatFixed(
            poolPairData.wrappedBalance.toString(),
            poolPairData.wrappedDecimals
        )
    );
    const params: BigNumber[] = [
        bnum(formatFixed(poolPairData.swapFee, 18)),
        bnum(formatFixed(poolPairData.rate.toString(), 18)),
        bnum(formatFixed(poolPairData.lowerTarget.toString(), 18)),
        bnum(formatFixed(poolPairData.upperTarget.toString(), 18)),
    ];

    const previousNominalMain = toNominal(mainBalance, params);
    const invariant = calcInvariant(
        previousNominalMain,
        wrappedBalance,
        params
    );
    let poolFactor = bnum(1);
    if (!virtualBptSupply.eq(0)) {
        poolFactor = invariant.div(virtualBptSupply);
    }
    const deltaNominalMain = bptOut.times(poolFactor);
    const afterNominalMain = previousNominalMain.plus(deltaNominalMain);
    return poolFactor.times(
        rightDerivativeFromNominal(afterNominalMain, params)
    );
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactBPTInForTokenOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    const bptIn = bnum(amount.toString());
    const mainBalance = bnum(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wrappedBalance = bnum(
        formatFixed(
            poolPairData.wrappedBalance.toString(),
            poolPairData.wrappedDecimals
        )
    );
    const virtualBptSupply = bnum(
        formatFixed(poolPairData.virtualBptSupply, 18)
    );
    const params: BigNumber[] = [
        bnum(formatFixed(poolPairData.swapFee, 18)),
        bnum(formatFixed(poolPairData.rate.toString(), 18)),
        bnum(formatFixed(poolPairData.lowerTarget.toString(), 18)),
        bnum(formatFixed(poolPairData.upperTarget.toString(), 18)),
    ];

    const previousNominalMain = toNominal(mainBalance, params);
    const invariant = calcInvariant(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const poolFactor = invariant.div(virtualBptSupply);
    const deltaNominalMain = bptIn.times(poolFactor);
    const afterNominalMain = previousNominalMain.minus(deltaNominalMain);
    return bnum(1).div(
        poolFactor.times(leftDerivativeFromNominal(afterNominalMain, params))
    );
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapBPTInForExactTokenOut(
    amount: BigNumber,
    poolPairData: LinearPoolPairData
): BigNumber {
    const mainOut = bnum(amount.toString());
    const mainBalance = bnum(
        formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
    );
    const wrappedBalance = bnum(
        formatFixed(
            poolPairData.wrappedBalance.toString(),
            poolPairData.wrappedDecimals
        )
    );
    const virtualBptSupply = bnum(
        formatFixed(poolPairData.virtualBptSupply, 18)
    );
    const finalMainBalance = mainBalance.minus(mainOut);
    const params: BigNumber[] = [
        bnum(formatFixed(poolPairData.swapFee, 18)),
        bnum(formatFixed(poolPairData.rate.toString(), 18)),
        bnum(formatFixed(poolPairData.lowerTarget.toString(), 18)),
        bnum(formatFixed(poolPairData.upperTarget.toString(), 18)),
    ];

    const previousNominalMain = toNominal(mainBalance, params);
    const invariant = calcInvariant(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const poolFactor = invariant.div(virtualBptSupply);
    return leftDerivativeToNominal(finalMainBalance, params).div(poolFactor);
}

/////////
///  Derivatives of spotPriceAfterSwap
/////////

// Derivative of spot price is always zero, except at the target break points,
// where it is infinity in some sense. But we ignore this pathology, return zero
// and expect good behaviour at the optimization of amounts algorithm.

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    amount,
    poolPairData
): BigNumber {
    // This is not expected to be used by SOR
    // but could still be implemented
    throw new Error('Function not implemented.');
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    amount,
    poolPairData
): BigNumber {
    // This is not expected to be used by SOR
    // but could still be implemented
    throw new Error('Function not implemented.');
}

// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
    amount,
    poolPairData
): BigNumber {
    return bnum(0);
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
    amount,
    poolPairData
): BigNumber {
    return bnum(0);
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
    amount,
    poolPairData
): BigNumber {
    return bnum(0);
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
    amount,
    poolPairData
): BigNumber {
    return bnum(0);
}

function calcInvariant(
    nominalMainBalance: BigNumber,
    wrappedBalance: BigNumber,
    params: BigNumber[]
): BigNumber {
    const rate = params[1];
    return nominalMainBalance.plus(wrappedBalance.times(rate));
}

function toNominal(amount: BigNumber, params: BigNumber[]): BigNumber {
    const fee = params[0];
    const lowerTarget = params[2];
    const upperTarget = params[3];
    if (amount.lt(lowerTarget)) {
        const fees = lowerTarget.minus(amount).times(fee);
        const result = amount.minus(fees);
        if (result.lt(0)) {
            console.log('negative nominal balance');
            return bnum(0).minus(result);
        }
        return result;
    } else if (amount.lt(upperTarget)) {
        return amount;
    } else {
        const fees = amount.minus(upperTarget).times(fee);
        return amount.minus(fees);
    }
}
function leftDerivativeToNominal(
    amount: BigNumber,
    params: BigNumber[]
): BigNumber {
    const fee = params[0];
    const lowerTarget = params[2];
    const upperTarget = params[3];
    const oneMinusFee = bnum(1).minus(fee);
    const onePlusFee = bnum(1).plus(fee);
    if (amount.lte(lowerTarget)) {
        return onePlusFee;
    } else if (amount.lte(upperTarget)) {
        return bnum(1);
    } else {
        return oneMinusFee;
    }
}

function rightDerivativeToNominal(
    amount: BigNumber,
    params: BigNumber[]
): BigNumber {
    const fee = params[0];
    const lowerTarget = params[2];
    const upperTarget = params[3];
    const oneMinusFee = bnum(1).minus(fee);
    const onePlusFee = bnum(1).plus(fee);
    if (amount.lt(lowerTarget)) {
        return onePlusFee;
    } else if (amount.lt(upperTarget)) {
        return bnum(1);
    } else {
        return oneMinusFee;
    }
}
function fromNominal(nominal: BigNumber, params: BigNumber[]): BigNumber {
    const fee = params[0];
    const lowerTarget = params[2];
    const upperTarget = params[3];
    const oneMinusFee = bnum(1).minus(fee);
    const onePlusFee = bnum(1).plus(fee);
    if (nominal.lt(lowerTarget)) {
        return nominal.plus(lowerTarget.times(fee)).div(onePlusFee);
    } else if (nominal.lt(upperTarget)) {
        return nominal;
    } else {
        return nominal.minus(upperTarget.times(fee)).div(oneMinusFee);
    }
}
function leftDerivativeFromNominal(
    amount: BigNumber,
    params: BigNumber[]
): BigNumber {
    const fee = params[0];
    const lowerTarget = params[2];
    const upperTarget = params[3];
    const oneMinusFee = bnum(1).minus(fee);
    const onePlusFee = bnum(1).plus(fee);
    if (amount.lte(lowerTarget)) {
        return bnum(1).div(onePlusFee);
    } else if (amount.lte(upperTarget)) {
        return bnum(1);
    } else {
        return bnum(1).div(oneMinusFee);
    }
}

function rightDerivativeFromNominal(
    amount: BigNumber,
    params: BigNumber[]
): BigNumber {
    const fee = params[0];
    const lowerTarget = params[2];
    const upperTarget = params[3];
    const oneMinusFee = bnum(1).minus(fee);
    const onePlusFee = bnum(1).plus(fee);
    if (amount.lt(lowerTarget)) {
        return bnum(1).div(onePlusFee);
    } else if (amount.lt(upperTarget)) {
        return bnum(1);
    } else {
        return bnum(1).div(oneMinusFee);
    }
}
