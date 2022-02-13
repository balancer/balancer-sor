import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import bn from 'bignumber.js';

// Swap limits: amounts swapped may not be larger than this percentage of total balance.

const _MAX_IN_RATIO: BigNumber = parseFixed('0.3', 18);
const _MAX_OUT_RATIO: BigNumber = parseFixed('0.3', 18);

// Helpers
export function _squareRoot(value: BigNumber): BigNumber {
    return BigNumber.from(
        new bn(value.mul(ONE).toString()).sqrt().toFixed().split('.')[0]
    );
}

export function _normalizeBalances(
    balances: BigNumber[],
    decimals: number[]
): BigNumber[] {
    const scalingFactors = decimals.map((d) => parseFixed('1', d));

    return balances.map((bal, index) =>
        bal.mul(ONE).div(scalingFactors[index])
    );
}

/////////
/// Fee calculations
/////////

export function _reduceFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    const feeAmount = amountIn.mul(swapFee).div(ONE);
    return amountIn.sub(feeAmount);
}

export function _addFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    return amountIn.mul(ONE).div(ONE.sub(swapFee));
}

/////////
/// Invariant Calculation
/////////

// Stopping criterion for the Newton iteration that computes the invariant:
// - Stop if the step width doesn't shrink anymore by at least a factor _INVARIANT_SHRINKING_FACTOR_PER_STEP.
// - ... but in any case, make at least _INVARIANT_MIN_ITERATIONS iterations. This is useful to compensate for a
// less-than-ideal starting point, which is important when alpha is small.
const _INVARIANT_SHRINKING_FACTOR_PER_STEP = 10;
const _INVARIANT_MIN_ITERATIONS = 2;

// Invariant is used to collect protocol swap fees by comparing its value between two times.
// So we can round always to the same direction. It is also used to initiate the BPT amount
// and, because there is a minimum BPT, we round down the invariant.
// Argument root3Alpha = cube root of the lower price bound (symmetric across assets)
// Note: all price bounds for the pool are alpha and 1/alpha

export function _calculateInvariant(
    balances: BigNumber[],
    root3Alpha: BigNumber
): BigNumber {
    /**********************************************************************************************
// Calculate root of cubic:
// (1-alpha)L^3 - (x+y+z) * alpha^(2/3) * L^2 - (x*y + y*z + x*z) * alpha^(1/3) * L - x*y*z = 0
// These coefficients are a,b,c,d respectively
// here, a > 0, b < 0, c < 0, and d < 0
// taking mb = -b and mc = -c
/**********************************************************************************************/
    const [a, mb, mc, md] = _calculateCubicTerms(balances, root3Alpha);
    return _calculateCubic(a, mb, mc, md);
}

/** @dev Prepares quadratic terms for input to _calculateCubic
 *  assumes a > 0, b < 0, c <= 0, and d <= 0 and returns a, -b, -c, -d
 *  terms come from cubic in Section 3.1.1
 *  argument root3Alpha = cube root of alpha
 */
export function _calculateCubicTerms(
    balances: BigNumber[],
    root3Alpha: BigNumber
): [BigNumber, BigNumber, BigNumber, BigNumber] {
    const alpha23: BigNumber = root3Alpha.mul(root3Alpha).div(ONE); // alpha to the power of (2/3)
    const alpha = alpha23.mul(root3Alpha).div(ONE);
    const a = ONE.sub(alpha);
    const bterm = balances[0].add(balances[1]).add(balances[2]);
    const mb = bterm.mul(alpha23).div(ONE);
    const cterm = balances[0]
        .mul(balances[1])
        .div(ONE)
        .add(balances[1].mul(balances[2]).div(ONE))
        .add(balances[2].mul(balances[0]).div(ONE));
    const mc = cterm.mul(root3Alpha).div(ONE);
    const md = balances[0].mul(balances[1]).div(ONE).mul(balances[2]).div(ONE);

    return [a, mb, mc, md];
}

/** @dev Calculate the maximal root of the polynomial a L^3 - mb L^2 - mc L - md.
 *   This root is always non-negative, and it is the unique positive root unless mb == mc == md == 0. */
export function _calculateCubic(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber,
    md: BigNumber
): BigNumber {
    let rootEst: BigNumber;
    if (md.isZero()) {
        // lower-order special case
        const radic = mb
            .mul(mb)
            .div(ONE)
            .add(a.mul(mc).div(ONE).mul(BigNumber.from(4)));
        rootEst = mb.add(_squareRoot(radic)).div(BigNumber.from(2).mul(a));
    } else {
        rootEst = _calculateCubicStartingPoint(a, mb, mc);
        rootEst = _runNewtonIteration(a, mb, mc, md, rootEst);
    }

    return rootEst;
}

/** @dev Starting point for Newton iteration. Safe with all cubic polynomials where the coefficients have the appropriate
 *   signs, but calibrated to the particular polynomial for computing the invariant. */
export function _calculateCubicStartingPoint(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber
): BigNumber {
    const radic: BigNumber = mb
        .mul(mb)
        .div(ONE)
        .add(a.mul(mc).div(ONE).mul(BigNumber.from(3)));
    const lmin = mb
        .mul(ONE)
        .div(a.mul(BigNumber.from(3)))
        .add(_squareRoot(radic).mul(ONE).div(BigNumber.from(3).mul(a)));
    // The factor 3/2 is a magic number found experimentally for our invariant. All factors > 1 are safe.
    const l0 = lmin.mul(BigNumber.from(3)).div(BigNumber.from(2));

    return l0;
}

/** @dev Find a root of the given polynomial with the given starting point l.
 *   Safe iff l > the local minimum.
 *   Note that f(l) may be negative for the first iteration and will then be positive (up to rounding errors).
 *   f'(l) is always positive for the range of values we consider.
 *   See write-up, Appendix A. */
export function _runNewtonIteration(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber,
    md: BigNumber,
    rootEst: BigNumber
): BigNumber {
    let deltaAbsPrev = BigNumber.from(0);
    for (let iteration = 0; iteration < 255; ++iteration) {
        // The delta to the next step can be positive or negative, so we represent a positive and a negative part
        // separately. The signed delta is delta_plus - delta_minus, but we only ever consider its absolute value.
        const [deltaAbs, deltaIsPos] = _calcNewtonDelta(a, mb, mc, md, rootEst);
        // ^ Note: If we ever set _INVARIANT_MIN_ITERATIONS=0, the following should include `iteration >= 1`.
        if (
            deltaAbs.isZero() ||
            (iteration >= _INVARIANT_MIN_ITERATIONS && deltaIsPos)
        )
            // Iteration literally stopped or numerical error dominates
            return rootEst;
        if (
            iteration >= _INVARIANT_MIN_ITERATIONS &&
            deltaAbs.gte(
                deltaAbsPrev.div(
                    BigNumber.from(_INVARIANT_SHRINKING_FACTOR_PER_STEP)
                )
            )
        ) {
            // stalled
            // Move one more step to the left to ensure we're underestimating, rather than overestimating, L
            return rootEst.sub(deltaAbs);
        }
        deltaAbsPrev = deltaAbs;
        if (deltaIsPos) rootEst = rootEst.add(deltaAbs);
        else rootEst = rootEst.sub(deltaAbs);
    }

    throw new Error(
        'Gyro3Pool: Newton Method did not converge on required invariant'
    );
}
let first = 0;
// -f(l)/f'(l), represented as an absolute value and a sign. Require that l is sufficiently large so that f is strictly increasing.
export function _calcNewtonDelta(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber,
    md: BigNumber,
    rootEst: BigNumber
): [BigNumber, boolean] {
    const dfRootEst = BigNumber.from(3)
        .mul(a)
        .mul(rootEst)
        .div(ONE)
        .sub(BigNumber.from(2).mul(mb))
        .mul(rootEst)
        .div(ONE)
        .sub(mc); // Does not underflow since rootEst >> 0 by assumption.
    // We know that a rootEst^2 / dfRootEst ~ 1. (this is pretty exact actually, see the Mathematica notebook). We use this
    // multiplication order to prevent overflows that can otherwise occur when computing l^3 for very large
    // reserves.

    let deltaMinus = a.mul(rootEst).div(ONE).mul(rootEst).div(ONE);
    deltaMinus = deltaMinus.mul(ONE).div(dfRootEst).mul(rootEst).div(ONE);
    // use multiple statements to prevent 'stack too deep'. The order of operations is chosen to prevent overflows
    // for very large numbers.
    let deltaPlus = mb.mul(rootEst).div(ONE).add(mc).mul(ONE).div(dfRootEst);
    deltaPlus = deltaPlus.mul(rootEst).div(ONE).add(md.mul(ONE).div(dfRootEst));

    const deltaIsPos = deltaPlus.gte(deltaMinus);
    const deltaAbs = deltaIsPos
        ? deltaPlus.sub(deltaMinus)
        : deltaMinus.sub(deltaPlus);

    return [deltaAbs, deltaIsPos];
}

/////////
/// Swap Amount Calculations
/////////

/** @dev Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
 * current balances and weights.
 * Changed signs compared to original algorithm to account for amountOut < 0.
 * See Proposition 12 in 3.1.4.*/
export function _calcOutGivenIn(
    balanceIn: BigNumber,
    balanceOut: BigNumber,
    amountIn: BigNumber,
    virtualOffsetInOut: BigNumber
): BigNumber {
    /**********************************************************************************************
        // Described for X = `in' asset and Z = `out' asset, but equivalent for the other case       //
        // dX = incrX  = amountIn  > 0                                                               //
        // dZ = incrZ = amountOut < 0                                                                //
        // x = balanceIn             x' = x +  virtualOffset                                         //
        // z = balanceOut            z' = z +  virtualOffset                                         //
        // L  = inv.Liq                   /            x' * z'          \                            //
        //                   - dZ = z' - |   --------------------------  |                           //
        //  x' = virtIn                   \          ( x' + dX)         /                            //
        //  z' = virtOut                                                                             //
        // Note that -dz > 0 is what the trader receives.                                            //
        // We exploit the fact that this formula is symmetric up to virtualParam{X,Y,Z}.             //
        **********************************************************************************************/
    if (amountIn.gt(balanceIn.mul(_MAX_IN_RATIO).div(ONE)))
        throw new Error('Swap Amount In Too Large');

    const virtIn = balanceIn.add(virtualOffsetInOut);
    const virtOut = balanceOut.add(virtualOffsetInOut);
    const denominator = virtIn.add(amountIn);
    const subtrahend = virtIn.mul(virtOut).div(denominator);
    const amountOut = virtOut.sub(subtrahend);

    // Note that this in particular reverts if amountOut > balanceOut, i.e., if the out-amount would be more than
    // the balance.

    if (amountOut.gt(balanceOut.mul(_MAX_OUT_RATIO).div(ONE)))
        throw new Error('Resultant Swap Amount Out Too Large');

    return amountOut;
}

/** @dev Computes how many tokens must be sent to a pool in order to take `amountOut`, given the
 * currhent balances and weights.
 * Similar to the one before but adapting bc negative values (amountOut would be negative).*/
export function _calcInGivenOut(
    balanceIn: BigNumber,
    balanceOut: BigNumber,
    amountOut: BigNumber,
    virtualOffsetInOut: BigNumber
): BigNumber {
    /**********************************************************************************************
        // Described for X = `in' asset and Z = `out' asset, but equivalent for the other case       //
        // dX = incrX  = amountIn  > 0                                                               //
        // dZ = incrZ = amountOut < 0                                                                //
        // x = balanceIn             x' = x +  virtualOffset                                         //
        // z = balanceOut            z' = z +  virtualOffset                                         //
        // L  = inv.Liq            /            x' * z'          \                                   //
        //                   dX = |   --------------------------  | - x'                             //
        //  x' = virtIn            \          ( z' + dZ)         /                                   //
        //  z' = virtOut                                                                             //
        // Note that dz < 0 < dx.                                                                    //
        // We exploit the fact that this formula is symmetric up to virtualParam{X,Y,Z}.             //
        **********************************************************************************************/

    // Note that this in particular reverts if amountOut > balanceOut, i.e., if the trader tries to take more out of
    // the pool than is in it.
    if (amountOut.gt(balanceOut.mul(_MAX_OUT_RATIO).div(ONE)))
        throw new Error('Swap Amount Out Too Large');

    const virtIn = balanceIn.add(virtualOffsetInOut);
    const virtOut = balanceOut.add(virtualOffsetInOut);
    const denominator = virtOut.sub(amountOut);
    const minuend = virtIn.mul(virtOut).div(denominator);

    const amountIn = minuend.sub(virtIn);

    if (amountIn.gt(balanceIn.mul(_MAX_IN_RATIO).div(ONE)))
        throw new Error('Resultant Swap Amount In Too Large');

    return amountIn;
}

// /////////
// ///  Spot price function
// /////////

export function _calculateNewSpotPrice(
    balances: BigNumber[],
    inAmount: BigNumber,
    outAmount: BigNumber,
    virtualOffsetInOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /**********************************************************************************************
        // dX = incrX  = amountIn  > 0                                                               //
        // dZ = incrZ  = amountOut < 0                                                               //
        // x = balanceIn             x' = x +  virtualOffsetInOut                                     //
        // z = balanceOut            z' = z +  virtualOffsetInOut                                     //
        // s = swapFee                                                                               //
        // L  = inv.Liq                1   /     x' + (1 - s) * dx        \                          //
        //                     p_z =  --- |   --------------------------  |                          //
        // x' = virtIn                1-s  \         z' + dz              /                          //
        // z' = virtOut                                                                              //
        // Note that dz < 0 < dx.                                                                    //
        **********************************************************************************************/

    const afterFeeMultiplier = ONE.sub(swapFee); // 1 - s
    const virtIn = balances[0].add(virtualOffsetInOut); // x + virtualOffsetInOut = x'
    const numerator = virtIn.add(afterFeeMultiplier.mul(inAmount).div(ONE)); // x' + (1 - s) * dx

    const virtOut = balances[1].add(virtualOffsetInOut); // z + virtualOffsetInOut = y'
    const denominator = afterFeeMultiplier.mul(virtOut.sub(outAmount)).div(ONE); // (1 - s) * (z' + dz)

    const newSpotPrice = numerator.mul(ONE).div(denominator);

    return newSpotPrice;
}

// /////////
// ///  Derivatives of spotPriceAfterSwap
// /////////

// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    balances: BigNumber[],
    outAmount: BigNumber,
    virtualOffsetInOut: BigNumber
): BigNumber {
    /**********************************************************************************************                                                        
        // dz = incrZ  = amountOut < 0                                                               //
                                                                                                     //
        // z = balanceOut            z' = z +  virtualOffsetInOut = virtOut                          //
        //                                                                                           //
        //                                 /              1               \                          //
        //                  (p_z)' =   2  |   --------------------------  |                          //
        //                                 \           z' + dz            /                          //
        //                                                                                           //
        // Note that dz < 0                                                                          //
        **********************************************************************************************/

    const TWO = BigNumber.from(2).mul(ONE);
    const virtOut = balances[1].add(virtualOffsetInOut); // z' = z + virtualOffsetInOut
    const denominator = virtOut.sub(outAmount); // z' + dz

    const derivative = TWO.mul(ONE).div(denominator);

    return derivative;
}

// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    balances: BigNumber[],
    inAmount: BigNumber,
    outAmount: BigNumber,
    virtualOffsetInOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /**********************************************************************************************
        // dX = incrX  = amountIn  > 0                                                               //
        // dZ = incrZ  = amountOut < 0                                                               //
        // x = balanceIn             x' = x +  virtualOffsetInOut                                    //
        // z = balanceOut            z' = z +  virtualOffsetInOut                                    //
        // s = swapFee                                                                               //
        // L  = inv.Liq                1       /     x' + (1 - s) * dx        \                      //
        //                     p_z =  --- (2) |   --------------------------  |                      //
        // x' = virtIn                1-s      \         (z' + dz)^2          /                      //
        // z' = virtOut                                                                              //
        // Note that dz < 0 < dx.                                                                    //
        **********************************************************************************************/

    const TWO = BigNumber.from(2).mul(ONE);
    const afterFeeMultiplier = ONE.sub(swapFee); // 1 - s
    const virtIn = balances[0].add(virtualOffsetInOut); // x + virtualOffsetInOut = x'
    const numerator = virtIn.add(afterFeeMultiplier.mul(inAmount).div(ONE)); // x' + (1 - s) * dx
    const virtOut = balances[1].add(virtualOffsetInOut); // z + virtualOffsetInOut = z'
    const denominator = virtOut
        .sub(outAmount)
        .mul(virtOut.sub(outAmount))
        .div(ONE); // (z' + dz)^2
    const factor = TWO.mul(ONE).div(afterFeeMultiplier); // 2 / (1 - s)

    const derivative = factor.mul(numerator.mul(ONE).div(denominator)).div(ONE);

    return derivative;
}

// /////////
// ///  Normalized Liquidity
// /////////

export function _getNormalizedLiquidity(
    balances: BigNumber[],
    virtualParamIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /**********************************************************************************************
        // x = balanceIn             x' = x +  virtualParamX                                         //
        // s = swapFee                                                                               //
        //                                                     1                                     //
        //                             normalizedLiquidity =  ---  x'                                //
        //                                                    1-s                                    //
        // x' = virtIn                                                                               //
        **********************************************************************************************/

    const virtIn = balances[0].add(virtualParamIn);

    const afterFeeMultiplier = ONE.sub(swapFee);

    const normalizedLiquidity = virtIn.mul(ONE).div(afterFeeMultiplier);

    return normalizedLiquidity;
}
