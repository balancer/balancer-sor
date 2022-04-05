import { bnum } from '../../utils/bignumber';
import { MathSol } from '../../utils/basicOperations';

type Params = {
    fee: bigint;
    rate: bigint;
    lowerTarget: bigint;
    upperTarget: bigint;
};

export function _calcBptOutPerMainIn(
    mainIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount out, so we round down overall.

    if (bptSupply == BigInt(0)) {
        return _toNominal(mainIn, params);
    }

    const previousNominalMain = _toNominal(mainBalance, params);
    const afterNominalMain = _toNominal(mainBalance + mainIn, params);
    const deltaNominalMain = afterNominalMain - previousNominalMain;
    const invariant = _calcInvariantUp(
        previousNominalMain,
        wrappedBalance,
        params
    );
    return MathSol.divDown(MathSol.mul(bptSupply, deltaNominalMain), invariant);
}

export function _calcBptInPerMainOut(
    mainOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount in, so we round up overall.
    const previousNominalMain = _toNominal(mainBalance, params);
    const afterNominalMain = _toNominal(mainBalance - mainOut, params);
    const deltaNominalMain = previousNominalMain - afterNominalMain;
    const invariant = _calcInvariantDown(
        previousNominalMain,
        wrappedBalance,
        params
    );
    return MathSol.divUp(MathSol.mul(bptSupply, deltaNominalMain), invariant);
}

export function _calcBptInPerWrappedOut(
    wrappedOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount in, so we round up overall.
    const nominalMain = _toNominal(mainBalance, params);
    const previousInvariant = _calcInvariantUp(
        nominalMain,
        wrappedBalance,
        params
    );
    const newWrappedBalance = wrappedBalance - wrappedOut;
    const newInvariant = _calcInvariantDown(
        nominalMain,
        newWrappedBalance,
        params
    );
    const newBptBalance = MathSol.divDown(
        MathSol.mul(bptSupply, newInvariant),
        previousInvariant
    );
    return bptSupply - newBptBalance;
}

export function _calcWrappedOutPerMainIn(
    mainIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount out, so we round down overall.
    const previousNominalMain = _toNominal(mainBalance, params);
    const afterNominalMain = _toNominal(mainBalance + mainIn, params);
    const deltaNominalMain = afterNominalMain - previousNominalMain;
    return MathSol.divDownFixed(deltaNominalMain, params.rate);
}

export function _calcWrappedInPerMainOut(
    mainOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount in, so we round up overall.
    const previousNominalMain = _toNominal(mainBalance, params);
    const afterNominalMain = _toNominal(mainBalance - mainOut, params);
    const deltaNominalMain = previousNominalMain - afterNominalMain;
    return MathSol.divUpFixed(deltaNominalMain, params.rate);
}

export function _calcMainInPerBptOut(
    bptOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount in, so we round up overall.
    if (bptSupply == BigInt(0)) {
        return _fromNominal(bptOut, params);
    }
    const previousNominalMain = _toNominal(mainBalance, params);
    const invariant = _calcInvariantUp(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const deltaNominalMain = MathSol.divUp(
        MathSol.mul(invariant, bptOut),
        bptSupply
    );
    const afterNominalMain = previousNominalMain + deltaNominalMain;
    const newMainBalance = _fromNominal(afterNominalMain, params);
    return newMainBalance - mainBalance;
}

export function _calcMainOutPerBptIn(
    bptIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount out, so we round down overall.
    const previousNominalMain = _toNominal(mainBalance, params);
    const invariant = _calcInvariantDown(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const deltaNominalMain = MathSol.divDown(
        MathSol.mul(invariant, bptIn),
        bptSupply
    );
    const afterNominalMain = previousNominalMain - deltaNominalMain;
    const newMainBalance = _fromNominal(afterNominalMain, params);
    return mainBalance - newMainBalance;
}

export function _calcMainOutPerWrappedIn(
    wrappedIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount out, so we round down overall.
    const previousNominalMain = _toNominal(mainBalance, params);
    const deltaNominalMain = MathSol.mulDownFixed(wrappedIn, params.rate);
    const afterNominalMain = previousNominalMain - deltaNominalMain;
    const newMainBalance = _fromNominal(afterNominalMain, params);
    return mainBalance - newMainBalance;
}

export function _calcMainInPerWrappedOut(
    wrappedOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount in, so we round up overall.
    const previousNominalMain = _toNominal(mainBalance, params);
    const deltaNominalMain = MathSol.mulUpFixed(wrappedOut, params.rate);
    const afterNominalMain = previousNominalMain + deltaNominalMain;
    const newMainBalance = _fromNominal(afterNominalMain, params);
    return newMainBalance - mainBalance;
}

export function _calcBptOutPerWrappedIn(
    wrappedIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount out, so we round down overall.
    if (bptSupply == BigInt(0)) {
        // Return nominal DAI
        return MathSol.mulDownFixed(wrappedIn, params.rate);
    }

    const nominalMain = _toNominal(mainBalance, params);
    const previousInvariant = _calcInvariantUp(
        nominalMain,
        wrappedBalance,
        params
    );
    const newWrappedBalance = wrappedBalance + wrappedIn;
    const newInvariant = _calcInvariantDown(
        nominalMain,
        newWrappedBalance,
        params
    );
    const newBptBalance = MathSol.divDown(
        MathSol.mul(bptSupply, newInvariant),
        previousInvariant
    );
    return newBptBalance - bptSupply;
}

export function _calcWrappedInPerBptOut(
    bptOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount in, so we round up overall.
    if (bptSupply == BigInt(0)) {
        // Return nominal DAI
        return MathSol.divUpFixed(bptOut, params.rate);
    }

    const nominalMain = _toNominal(mainBalance, params);
    const previousInvariant = _calcInvariantUp(
        nominalMain,
        wrappedBalance,
        params
    );
    const newBptBalance = bptSupply + bptOut;
    const newWrappedBalance = MathSol.divUpFixed(
        MathSol.divUp(
            MathSol.mul(newBptBalance, previousInvariant),
            bptSupply
        ) - nominalMain,
        params.rate
    );

    return newWrappedBalance - wrappedBalance;
}

export function _calcWrappedOutPerBptIn(
    bptIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    // Amount out, so we round down overall.
    const nominalMain = _toNominal(mainBalance, params);
    const previousInvariant = _calcInvariantUp(
        nominalMain,
        wrappedBalance,
        params
    );
    const newBptBalance = bptSupply - bptIn;
    const newWrappedBalance = MathSol.divUpFixed(
        MathSol.divUp(
            MathSol.mul(newBptBalance, previousInvariant),
            bptSupply
        ) - nominalMain,
        params.rate
    );

    return wrappedBalance - newWrappedBalance;
}

function _calcInvariantUp(
    nominalMainBalance: bigint,
    wrappedBalance: bigint,
    params: Params
): bigint {
    return nominalMainBalance + MathSol.mulUpFixed(wrappedBalance, params.rate);
}

function _calcInvariantDown(
    nominalMainBalance: bigint,
    wrappedBalance: bigint,
    params: Params
): bigint {
    return (
        nominalMainBalance + MathSol.mulDownFixed(wrappedBalance, params.rate)
    );
}

function _toNominal(real: bigint, params: Params): bigint {
    // Fees are always rounded down: either direction would work but we need to be consistent, and rounding down
    // uses less gas.
    if (real < params.lowerTarget) {
        const fees = MathSol.mulDownFixed(
            params.lowerTarget - real,
            params.fee
        );
        return MathSol.sub(real, fees);
    } else if (real <= params.upperTarget) {
        return real;
    } else {
        const fees = MathSol.mulDownFixed(
            real - params.upperTarget,
            params.fee
        );
        return MathSol.sub(real, fees);
    }
}

function _fromNominal(nominal: bigint, params: Params): bigint {
    // Since real = nominal + fees, rounding down fees is equivalent to rounding down real.
    if (nominal < params.lowerTarget) {
        return MathSol.divDownFixed(
            nominal + MathSol.mulDownFixed(params.fee, params.lowerTarget),
            MathSol.ONE + params.fee
        );
    } else if (nominal <= params.upperTarget) {
        return nominal;
    } else {
        return MathSol.divDownFixed(
            nominal - MathSol.mulDownFixed(params.fee, params.upperTarget),
            MathSol.ONE - params.fee
        );
    }
}

function leftDerivativeToNominal(amount: bigint, params: Params): bigint {
    const oneMinusFee = MathSol.complementFixed(params.fee);
    const onePlusFee = MathSol.ONE + params.fee;
    if (amount <= params.lowerTarget) {
        return onePlusFee;
    } else if (amount <= params.upperTarget) {
        return MathSol.ONE;
    } else {
        return oneMinusFee;
    }
}

function rightDerivativeToNominal(amount: bigint, params: Params): bigint {
    const oneMinusFee = MathSol.complementFixed(params.fee);
    const onePlusFee = MathSol.ONE + params.fee;
    if (amount < params.lowerTarget) {
        return onePlusFee;
    } else if (amount < params.upperTarget) {
        return MathSol.ONE;
    } else {
        return oneMinusFee;
    }
}

function leftDerivativeFromNominal(amount: bigint, params: Params): bigint {
    const oneMinusFee = MathSol.complementFixed(params.fee);
    const onePlusFee = MathSol.ONE + params.fee;
    if (amount <= params.lowerTarget) {
        return MathSol.divUpFixed(MathSol.ONE, onePlusFee);
    } else if (amount <= params.upperTarget) {
        return MathSol.ONE;
    } else {
        return MathSol.divUpFixed(MathSol.ONE, oneMinusFee);
    }
}

function rightDerivativeFromNominal(amount: bigint, params: Params): bigint {
    const oneMinusFee = MathSol.complementFixed(params.fee);
    const onePlusFee = MathSol.ONE + params.fee;
    if (amount < params.lowerTarget) {
        return MathSol.divUpFixed(MathSol.ONE, onePlusFee);
    } else if (amount < params.upperTarget) {
        return MathSol.ONE;
    } else {
        return MathSol.divUpFixed(MathSol.ONE, oneMinusFee);
    }
}

export function _calcTokensOutGivenExactBptIn(
    balances: bigint[],
    bptAmountIn: bigint,
    bptTotalSupply: bigint,
    bptIndex: number
): bigint[] {
    /**********************************************************************************************
    // exactBPTInForTokensOut                                                                    //
    // (per token)                                                                               //
    // aO = tokenAmountOut             /        bptIn         \                                  //
    // b = tokenBalance      a0 = b * | ---------------------  |                                 //
    // bptIn = bptAmountIn             \     bptTotalSupply    /                                 //
    // bpt = bptTotalSupply                                                                      //
    **********************************************************************************************/

    // Since we're computing an amount out, we round down overall. This means rounding down on both the
    // multiplication and division.

    const bptRatio = MathSol.divDownFixed(bptAmountIn, bptTotalSupply);
    const amountsOut: bigint[] = new Array(balances.length);
    for (let i = 0; i < balances.length; i++) {
        // BPT is skipped as those tokens are not the LPs, but rather the preminted and undistributed amount.
        if (i != bptIndex) {
            amountsOut[i] = MathSol.mulDownFixed(balances[i], bptRatio);
        }
    }
    return amountsOut;
}

/////////
/// SpotPriceAfterSwap
/////////

// PairType = 'main->BPT'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapBptOutPerMainIn(
    mainIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const finalMainBalance = mainIn + mainBalance;
    const previousNominalMain = _toNominal(mainBalance, params);
    const invariant = _calcInvariantDown(
        previousNominalMain,
        wrappedBalance,
        params
    );
    let poolFactor = MathSol.ONE;
    if (bptSupply != BigInt(0)) {
        poolFactor = MathSol.divUpFixed(invariant, bptSupply);
    }
    return MathSol.divUpFixed(
        poolFactor,
        rightDerivativeToNominal(finalMainBalance, params)
    );
}

// PairType = 'main->BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapMainInPerBptOut(
    bptOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const previousNominalMain = _toNominal(mainBalance, params);
    const invariant = _calcInvariantDown(
        previousNominalMain,
        wrappedBalance,
        params
    );
    let poolFactor = MathSol.ONE;
    if (bptSupply != BigInt(0)) {
        poolFactor = MathSol.divUpFixed(invariant, bptSupply);
    }
    const deltaNominalMain = MathSol.mulUpFixed(bptOut, poolFactor);
    const afterNominalMain = previousNominalMain + deltaNominalMain;
    return MathSol.mulUpFixed(
        poolFactor,
        rightDerivativeFromNominal(afterNominalMain, params)
    );
}

// PairType = 'BPT->main'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapMainOutPerBptIn(
    bptIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const previousNominalMain = _toNominal(mainBalance, params);
    const invariant = _calcInvariantDown(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const poolFactor = MathSol.divDownFixed(invariant, bptSupply);
    const deltaNominalMain = MathSol.mulDownFixed(bptIn, poolFactor);
    const afterNominalMain = MathSol.sub(previousNominalMain, deltaNominalMain);
    return MathSol.divUpFixed(
        MathSol.ONE,
        MathSol.mulUpFixed(
            poolFactor,
            leftDerivativeFromNominal(afterNominalMain, params)
        )
    );
}

// PairType = 'BPT->main'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapBptInPerMainOut(
    mainOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const finalMainBalance = MathSol.sub(mainBalance, mainOut);
    const previousNominalMain = _toNominal(mainBalance, params);
    const invariant = _calcInvariantDown(
        previousNominalMain,
        wrappedBalance,
        params
    );
    const poolFactor = MathSol.divUpFixed(invariant, bptSupply);
    return MathSol.divUpFixed(
        leftDerivativeToNominal(finalMainBalance, params),
        poolFactor
    );
}

// PairType = 'main->wrapped'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapMainInPerWrappedOut(
    wrappedOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const previousNominalMain = _toNominal(mainBalance, params);
    const deltaNominalMain = MathSol.mulUpFixed(wrappedOut, params.rate);
    const afterNominalMain = previousNominalMain + deltaNominalMain;
    return MathSol.mulUpFixed(
        rightDerivativeFromNominal(afterNominalMain, params),
        params.rate
    );
}

// PairType = 'wrapped->main'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapWrappedInPerMainOut(
    mainOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const afterMain = mainBalance - mainOut;
    return MathSol.divUpFixed(
        leftDerivativeToNominal(afterMain, params),
        params.rate
    );
}

// PairType = 'main->wrapped'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapWrappedOutPerMainIn(
    mainIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    return MathSol.divDownFixed(
        params.rate,
        rightDerivativeToNominal(mainBalance + mainIn, params)
    );
}

// PairType = 'wrapped->main'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapMainOutPerWrappedIn(
    wrappedIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const previousNominalMain = _toNominal(mainBalance, params);
    const deltaNominalMain = MathSol.mulDownFixed(wrappedIn, params.rate);
    const afterNominalMain = previousNominalMain - deltaNominalMain;
    const inversePrice = MathSol.mulUpFixed(
        leftDerivativeFromNominal(afterNominalMain, params),
        params.rate
    );
    return MathSol.divUpFixed(MathSol.ONE, inversePrice);
}

// PairType = 'wrapped->BPT'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapBptOutPerWrappedIn(
    wrappedIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    if (bptSupply == BigInt(0)) {
        return params.rate;
    }
    const nominalMain = _toNominal(mainBalance, params);
    const previousInvariant = _calcInvariantUp(
        nominalMain,
        wrappedBalance,
        params
    );
    return MathSol.divUpFixed(
        previousInvariant,
        MathSol.mulUpFixed(bptSupply, params.rate)
    );
}

// PairType = 'BPT->wrapped'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapWrappedOutPerBptIn(
    bptIn: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const nominalMain = _toNominal(mainBalance, params);
    const previousInvariant = _calcInvariantUp(
        nominalMain,
        wrappedBalance,
        params
    );
    return MathSol.divUp(
        MathSol.mul(bptSupply, params.rate),
        previousInvariant
    );
}

// PairType = 'wrapped->BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapWrappedInPerBptOut(
    bptOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    if (bptSupply == BigInt(0)) {
        return MathSol.divUpFixed(MathSol.ONE, params.rate);
    }

    const nominalMain = _toNominal(mainBalance, params);
    const previousInvariant = _calcInvariantUp(
        nominalMain,
        wrappedBalance,
        params
    );
    return MathSol.divUpFixed(
        previousInvariant,
        MathSol.mul(bptSupply, params.rate)
    );
}

// PairType = 'BPT->wrapped'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapBptInPerWrappedOut(
    wrappedOut: bigint,
    mainBalance: bigint,
    wrappedBalance: bigint,
    bptSupply: bigint,
    params: Params
): bigint {
    const nominalMain = _toNominal(mainBalance, params);
    const previousInvariant = _calcInvariantUp(
        nominalMain,
        wrappedBalance,
        params
    );
    return MathSol.divDown(
        MathSol.mul(bptSupply, params.rate),
        previousInvariant
    );
}

/////////
///  Derivatives of spotPriceAfterSwap
/////////

// Derivative of spot price is always zero, except at the target break points,
// where it is infinity in some sense. But we ignore this pathology, return zero
// and expect good behaviour at the optimization of amounts algorithm.
