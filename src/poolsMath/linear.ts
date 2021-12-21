// functions translated from
// https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pkg/pool-linear/contracts/LinearMath.sol
import { MathSol, BZERO } from './basicOperations';

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
    return MathSol.divDownFixed(
        MathSol.mulDownFixed(bptSupply, deltaNominalMain),
        invariant
    );
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
    return MathSol.divUpFixed(
        MathSol.mulUpFixed(bptSupply, deltaNominalMain),
        invariant
    );
}

export function _calcWrappedOutPerMainIn(
    mainIn: bigint,
    mainBalance: bigint,
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
    const deltaNominalMain = MathSol.divUpFixed(
        MathSol.mulUpFixed(invariant, bptOut),
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
    const deltaNominalMain = MathSol.divDownFixed(
        MathSol.mulDownFixed(invariant, bptIn),
        bptSupply
    );
    const afterNominalMain = previousNominalMain - deltaNominalMain;
    const newMainBalance = _fromNominal(afterNominalMain, params);
    return mainBalance - newMainBalance;
}

export function _calcMainOutPerWrappedIn(
    wrappedIn: bigint,
    mainBalance: bigint,
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
    const newBptBalance = MathSol.divDownFixed(
        MathSol.mulDownFixed(bptSupply, newInvariant),
        previousInvariant
    );
    return newBptBalance - bptSupply;
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
    const newBptBalance = MathSol.divDownFixed(
        MathSol.mulDownFixed(bptSupply, newInvariant),
        previousInvariant
    );
    return bptSupply - newBptBalance;
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
        MathSol.mulUpFixed(
            MathSol.divUpFixed(newBptBalance, bptSupply),
            previousInvariant
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
        MathSol.mulUpFixed(
            MathSol.divUpFixed(newBptBalance, bptSupply),
            previousInvariant
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
    let amountsOut: bigint[] = new Array(balances.length);
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

// PairType = 'token->BPT'
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

// PairType = 'token->BPT'
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

// PairType = 'BPT->token'
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

// PairType = 'BPT->token'
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
