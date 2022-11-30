import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import {
    _INVARIANT_MIN_ITERATIONS,
    _INVARIANT_SHRINKING_FACTOR_PER_STEP,
} from './constants';
import { _safeLargePow3ADown } from './helpers';
import {
    mulUp,
    divUp,
    mulDown,
    divDown,
    sqrt,
} from '../gyroHelpers/gyroSignedFixedPoint';

/////////
/// Invariant Calculation
/////////

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
    return _calculateCubic(a, mb, mc, md, root3Alpha);
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
    const alpha23: BigNumber = mulDown(root3Alpha, root3Alpha); // alpha to the power of (2/3)
    const alpha = mulDown(alpha23, root3Alpha);
    const a = ONE.sub(alpha);
    const bterm = balances[0].add(balances[1]).add(balances[2]);
    const mb = mulDown(mulDown(bterm, root3Alpha), root3Alpha);
    const cterm = mulDown(balances[0], balances[1])
        .add(mulDown(balances[1], balances[2]))
        .add(mulDown(balances[2], balances[0]));
    const mc = mulDown(cterm, root3Alpha);
    const md = mulDown(mulDown(balances[0], balances[1]), balances[2]);

    return [a, mb, mc, md];
}

/** @dev Calculate the maximal root of the polynomial a L^3 - mb L^2 - mc L - md.
 *   This root is always non-negative, and it is the unique positive root unless mb == mc == md == 0. */
export function _calculateCubic(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber,
    md: BigNumber,
    root3Alpha: BigNumber
): BigNumber {
    let rootEst = _calculateCubicStartingPoint(a, mb, mc);
    rootEst = _runNewtonIteration(a, mb, mc, md, root3Alpha, rootEst);
    return rootEst;
}

/** @dev Starting point for Newton iteration. Safe with all cubic polynomials where the coefficients have the appropriate
 *   signs, but calibrated to the particular polynomial for computing the invariant. */
export function _calculateCubicStartingPoint(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber
): BigNumber {
    const radic = mulUp(mb, mb).add(mulUp(mulUp(a, mc), ONE.mul(3)));
    const lmin = divUp(mb, a.mul(3)).add(
        divUp(sqrt(radic, BigNumber.from(5)), a.mul(3))
    );
    // This formula has been found experimentally. It is exact for alpha -> 1, where the factor is 1.5. All
    // factors > 1 are safe. For small alpha values, it is more efficient to fallback to a larger factor.
    const alpha = ONE.sub(a); // We know that a is in [0, 1].
    const factor = alpha.gte(ONE.div(2)) ? ONE.mul(3).div(2) : ONE.mul(2);
    const l0 = mulUp(lmin, factor);
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
    root3Alpha: BigNumber,
    rootEst: BigNumber
): BigNumber {
    let deltaAbsPrev = BigNumber.from(0);
    for (let iteration = 0; iteration < 255; ++iteration) {
        // The delta to the next step can be positive or negative, so we represent a positive and a negative part
        // separately. The signed delta is delta_plus - delta_minus, but we only ever consider its absolute value.
        const [deltaAbs, deltaIsPos] = _calcNewtonDelta(
            a,
            mb,
            mc,
            md,
            root3Alpha,
            rootEst
        );

        // ^ Note: If we ever set _INVARIANT_MIN_ITERATIONS=0, the following should include `iteration >= 1`.
        if (
            deltaAbs.lte(1) ||
            (iteration >= _INVARIANT_MIN_ITERATIONS && deltaIsPos)
        )
            // This should mathematically never happen. Thus, the numerical error dominates at this point.
            return rootEst;
        if (
            iteration >= _INVARIANT_MIN_ITERATIONS &&
            deltaAbs.gte(
                deltaAbsPrev.div(
                    BigNumber.from(_INVARIANT_SHRINKING_FACTOR_PER_STEP)
                )
            )
        ) {
            // The iteration has stalled and isn't making significant progress anymore.
            return rootEst;
        }
        deltaAbsPrev = deltaAbs;
        if (deltaIsPos) rootEst = rootEst.add(deltaAbs);
        else rootEst = rootEst.sub(deltaAbs);
    }

    throw new Error(
        'Gyro3Pool: Newton Method did not converge on required invariant'
    );
}

// -f(l)/f'(l), represented as an absolute value and a sign. Require that l is sufficiently large so that f is strictly increasing.
export function _calcNewtonDelta(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber,
    md: BigNumber,
    root3Alpha: BigNumber,
    rootEst: BigNumber
): [BigNumber, boolean] {
    // The following is equal to dfRootEst^3 * a but with an order of operations optimized for precision.
    // Subtraction does not underflow since rootEst is chosen so that it's always above the (only) local minimum.
    let dfRootEst = BigNumber.from(0);

    const rootEst2 = mulDown(rootEst, rootEst);
    dfRootEst = rootEst2.mul(3);
    dfRootEst = dfRootEst.sub(
        mulDown(mulDown(mulDown(dfRootEst, root3Alpha), root3Alpha), root3Alpha)
    );
    dfRootEst = dfRootEst.sub(mulDown(rootEst, mb).mul(2)).sub(mc);

    const deltaMinus = _safeLargePow3ADown(rootEst, root3Alpha, dfRootEst);

    // NB: We could order the operations here in much the same way we did above to reduce errors. But tests show
    // that this has no significant effect, and it would lead to more complex code.
    let deltaPlus = mulDown(mulDown(rootEst, rootEst), mb);
    deltaPlus = divDown(deltaPlus.add(mulDown(rootEst, mc)), dfRootEst);
    deltaPlus = deltaPlus.add(divDown(md, dfRootEst));

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
    virtualOffset: BigNumber
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

    // The factors in total lead to a multiplicative "safety margin" between the employed virtual offsets
    // very slightly larger than 3e-18, compensating for the maximum multiplicative error in the invariant
    // computation.

    const virtInOver = balanceIn.add(mulUp(virtualOffset, ONE.add(2)));
    const virtOutUnder = balanceOut.add(mulDown(virtualOffset, ONE.sub(1)));
    const amountOut = virtOutUnder.mul(amountIn).div(virtInOver.add(amountIn));

    if (amountOut.gt(balanceOut)) throw new Error('ASSET_BOUNDS_EXCEEDED');

    return amountOut;
}

/** @dev Computes how many tokens must be sent to a pool in order to take `amountOut`, given the
 * currhent balances and weights.
 * Similar to the one before but adapting bc negative values (amountOut would be negative).*/
export function _calcInGivenOut(
    balanceIn: BigNumber,
    balanceOut: BigNumber,
    amountOut: BigNumber,
    virtualOffset: BigNumber
): BigNumber {
    /**********************************************************************************************
        // Described for X = `in' asset and Z = `out' asset, but equivalent for the other case       //
        // dX = incrX  = amountIn  > 0                                                               //
        // dZ = incrZ = amountOut < 0                                                                //
        // x = balanceIn             x' = x +  virtualOffset                                         //
        // z = balanceOut            z' = z +  virtualOffset                                         //
        // L  = inv.Liq            /            x' * z'          \             x' * dZ               //
        //                   dX = |   --------------------------  | - x' = ---------------           //
        //  x' = virtIn            \          ( z' + dZ)         /             z' - dZ               //
        //  z' = virtOut                                                                             //
        // Note that dz < 0 < dx.                                                                    //
        // We exploit the fact that this formula is symmetric and does not depend on which asset is  //
        // which.
        // We assume that the virtualOffset carries a relative +/- 3e-18 error due to the invariant  //
        // calculation add an appropriate safety margin.                                             //
        **********************************************************************************************/

    // Note that this in particular reverts if amountOut > balanceOut, i.e., if the trader tries to take more out of
    // the pool than is in it.
    if (amountOut.gt(balanceOut)) throw new Error('ASSET_BOUNDS_EXCEEDED');

    // The factors in total lead to a multiplicative "safety margin" between the employed virtual offsets
    // very slightly larger than 3e-18, compensating for the maximum multiplicative error in the invariant
    // computation.
    const virtInOver = balanceIn.add(mulUp(virtualOffset, ONE.add(2)));
    const virtOutUnder = balanceOut.add(mulDown(virtualOffset, ONE.sub(1)));

    const amountIn = divUp(
        mulUp(virtInOver, amountOut),
        virtOutUnder.sub(amountOut)
    );

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
    const numerator = virtIn.add(mulDown(afterFeeMultiplier, inAmount)); // x' + (1 - s) * dx

    const virtOut = balances[1].add(virtualOffsetInOut); // z + virtualOffsetInOut = y'
    const denominator = mulDown(afterFeeMultiplier, virtOut.sub(outAmount)); // (1 - s) * (z' + dz)

    const newSpotPrice = divDown(numerator, denominator);

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

    const derivative = divDown(TWO, denominator);

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
    const numerator = virtIn.add(mulDown(afterFeeMultiplier, inAmount)); // x' + (1 - s) * dx
    const virtOut = balances[1].add(virtualOffsetInOut); // z + virtualOffsetInOut = z'
    const denominator = mulDown(virtOut.sub(outAmount), virtOut.sub(outAmount));
    // (z' + dz)^2
    const factor = divDown(TWO, afterFeeMultiplier); // 2 / (1 - s)

    const derivative = mulDown(factor, divDown(numerator, denominator));

    return derivative;
}

// /////////
// ///  Normalized Liquidity measured with respect to the out-asset.
// ///  NB This is the same function as for the 2-CLP because the marginal trading curve of the 3-CLP
// ///  is a 2-CLP curve. We use different virtual offsets, of course.
// /////////
export function _getNormalizedLiquidity(
    balances: BigNumber[],
    virtualParamOut: BigNumber
): BigNumber {
    /**********************************************************************************************
    // x = balanceOut             x' = x +  virtualParamOut                                      //
    // s = swapFee                                                                               //
    //                                                                                           //
    //                             normalizedLiquidity = 0.5 * x'                                //
    //                                                                                           //
    // x' = virtOut                                                                              //
    // Note that balances = [balanceIn, balanceOut, balanceTertiary].                            //
    **********************************************************************************************/

    const virtOut = balances[1].add(virtualParamOut);
    return virtOut.div(2);
}
