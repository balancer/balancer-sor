import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import {
    sqrt,
    mulUp,
    divUp,
    mulDown,
    divDown,
} from '../gyroHelpers/gyroSignedFixedPoint';

/////////
/// Virtual Parameter calculations
/////////

export function _findVirtualParams(
    invariant: BigNumber,
    sqrtAlpha: BigNumber,
    sqrtBeta: BigNumber
): [BigNumber, BigNumber] {
    return [divDown(invariant, sqrtBeta), mulDown(invariant, sqrtAlpha)];
}

/////////
/// Invariant Calculation
/////////

export function _calculateInvariant(
    balances: BigNumber[], // balances
    sqrtAlpha: BigNumber,
    sqrtBeta: BigNumber
): BigNumber {
    /**********************************************************************************************
        // Calculate with quadratic formula
        // 0 = (1-sqrt(alpha/beta)*L^2 - (y/sqrt(beta)+x*sqrt(alpha))*L - x*y)
        // 0 = a*L^2 + b*L + c
        // here a > 0, b < 0, and c < 0, which is a special case that works well w/o negative numbers
        // taking mb = -b and mc = -c:                            (1/2)
        //                                  mb + (mb^2 + 4 * a * mc)^                   //
        //                   L =    ------------------------------------------          //
        //                                          2 * a                               //
        //                                                                              //
        **********************************************************************************************/
    const [a, mb, bSquare, mc] = _calculateQuadraticTerms(
        balances,
        sqrtAlpha,
        sqrtBeta
    );

    const invariant = _calculateQuadratic(a, mb, bSquare, mc);

    return invariant;
}

export function _calculateQuadraticTerms(
    balances: BigNumber[],
    sqrtAlpha: BigNumber,
    sqrtBeta: BigNumber
): [BigNumber, BigNumber, BigNumber, BigNumber] {
    const a = ONE.sub(divDown(sqrtAlpha, sqrtBeta));
    const bterm0 = divDown(balances[1], sqrtBeta);
    const bterm1 = mulDown(balances[0], sqrtAlpha);
    const mb = bterm0.add(bterm1);
    const mc = mulDown(balances[0], balances[1]);

    // For better fixed point precision, calculate in expanded form w/ re-ordering of multiplications
    // b^2 = x^2 * alpha + x*y*2*sqrt(alpha/beta) + y^2 / beta
    let bSquare = mulDown(
        mulDown(mulDown(balances[0], balances[0]), sqrtAlpha),
        sqrtAlpha
    );
    const bSq2 = divDown(
        mulDown(
            mulDown(mulDown(balances[0], balances[1]), ONE.mul(2)),
            sqrtAlpha
        ),
        sqrtBeta
    );

    const bSq3 = divDown(
        mulDown(balances[1], balances[1]),
        mulUp(sqrtBeta, sqrtBeta)
    );

    bSquare = bSquare.add(bSq2).add(bSq3);

    return [a, mb, bSquare, mc];
}

export function _calculateQuadratic(
    a: BigNumber,
    mb: BigNumber,
    bSquare: BigNumber,
    mc: BigNumber
): BigNumber {
    const denominator = mulUp(a, ONE.mul(2));
    // order multiplications for fixed point precision
    const addTerm = mulDown(mulDown(mc, ONE.mul(4)), a);
    // The minus sign in the radicand cancels out in this special case, so we add
    const radicand = bSquare.add(addTerm);
    const sqrResult = sqrt(radicand, BigNumber.from(5));
    // The minus sign in the numerator cancels out in this special case
    const numerator = mb.add(sqrResult);
    const invariant = divDown(numerator, denominator);

    return invariant;
}

/////////
/// Swap functions
/////////

// SwapType = 'swapExactIn'
export function _calcOutGivenIn(
    balanceIn: BigNumber,
    balanceOut: BigNumber,
    amountIn: BigNumber,
    virtualParamIn: BigNumber,
    virtualParamOut: BigNumber
): BigNumber {
    /**********************************************************************************************
        // Described for X = `in' asset and Y = `out' asset, but equivalent for the other case       //
        // dX = incrX  = amountIn  > 0                                                               //
        // dY = incrY = amountOut < 0                                                                //
        // x = balanceIn             x' = x +  virtualParamX                                         //
        // y = balanceOut            y' = y +  virtualParamY                                         //
        // L  = inv.Liq                   /              L^2            \                            //
        //                   - dy = y' - |   --------------------------  |                           //
        //  x' = virtIn                   \          ( x' + dX)         /                            //
        //  y' = virtOut                                                                             //
        // Note that -dy > 0 is what the trader receives.                                            //
        // We exploit the fact that this formula is symmetric up to virtualParam{X,Y}.               //
        **********************************************************************************************/

    // The factors in total lead to a multiplicative "safety margin" between the employed virtual offsets
    // very slightly larger than 3e-18.
    const virtInOver = balanceIn.add(mulUp(virtualParamIn, ONE.add(2)));
    const virtOutUnder = balanceOut.add(mulDown(virtualParamOut, ONE.sub(1)));

    const amountOut = divDown(
        mulDown(virtOutUnder, amountIn),
        virtInOver.add(amountIn)
    );

    if (amountOut.gt(balanceOut)) throw new Error('ASSET_BOUNDS_EXCEEDED');

    return amountOut;
}
// SwapType = 'swapExactOut'
export function _calcInGivenOut(
    balanceIn: BigNumber,
    balanceOut: BigNumber,
    amountOut: BigNumber,
    virtualParamIn: BigNumber,
    virtualParamOut: BigNumber
): BigNumber {
    /**********************************************************************************************
      // dX = incrX  = amountIn  > 0                                                               //
      // dY = incrY  = amountOut < 0                                                               //
      // x = balanceIn             x' = x +  virtualParamX                                         //
      // y = balanceOut            y' = y +  virtualParamY                                         //
      // x = balanceIn                                                                             //
      // L  = inv.Liq                /              L^2             \                              //
      //                     dx =   |   --------------------------  |  -  x'                       //
      // x' = virtIn                \         ( y' + dy)           /                               //
      // y' = virtOut                                                                              //
      // Note that dy < 0 < dx.                                                                    //
      **********************************************************************************************/

    if (amountOut.gt(balanceOut)) throw new Error('ASSET_BOUNDS_EXCEEDED');

    // The factors in total lead to a multiplicative "safety margin" between the employed virtual offsets
    // very slightly larger than 3e-18.
    const virtInOver = balanceIn.add(mulUp(virtualParamIn, ONE.add(2)));
    const virtOutUnder = balanceOut.add(mulDown(virtualParamOut, ONE.sub(1)));

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
    virtualParamIn: BigNumber,
    virtualParamOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /**********************************************************************************************
        // dX = incrX  = amountIn  > 0                                                               //
        // dY = incrY  = amountOut < 0                                                               //
        // x = balanceIn             x' = x +  virtualParamX                                         //
        // y = balanceOut            y' = y +  virtualParamY                                         //
        // s = swapFee                                                                               //
        // L  = inv.Liq                1   /     x' + (1 - s) * dx        \                          //
        //                     p_y =  --- |   --------------------------  |                          //
        // x' = virtIn                1-s  \         y' + dy              /                          //
        // y' = virtOut                                                                              //
        // Note that dy < 0 < dx.                                                                    //
        **********************************************************************************************/

    const afterFeeMultiplier = ONE.sub(swapFee); // 1 - s
    const virtIn = balances[0].add(virtualParamIn); // x + virtualParamX = x'
    const numerator = virtIn.add(mulDown(afterFeeMultiplier, inAmount)); // x' + (1 - s) * dx
    const virtOut = balances[1].add(virtualParamOut); // y + virtualParamY = y'
    const denominator = mulDown(afterFeeMultiplier, virtOut.sub(outAmount)); // (1 - s) * (y' + dy)
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
    virtualParamOut: BigNumber
): BigNumber {
    /**********************************************************************************************                                                        
        // dy = incrY  = amountOut < 0                                                               //
                                                                                                     //
        // y = balanceOut            y' = y +  virtualParamY = virtOut                               //
        //                                                                                           //
        //                                 /              1               \                          //
        //                  (p_y)' =   2  |   --------------------------  |                          //
        //                                 \           y' + dy            /                          //
        //                                                                                           //
        // Note that dy < 0                                                                          //
        **********************************************************************************************/

    const TWO = BigNumber.from(2).mul(ONE);
    const virtOut = balances[1].add(virtualParamOut); // y' = y + virtualParamY
    const denominator = virtOut.sub(outAmount); // y' + dy

    const derivative = divDown(TWO, denominator);

    return derivative;
}

// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    balances: BigNumber[],
    inAmount: BigNumber,
    outAmount: BigNumber,
    virtualParamIn: BigNumber,
    virtualParamOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /**********************************************************************************************
        // dX = incrX  = amountIn  > 0                                                               //
        // dY = incrY  = amountOut < 0                                                               //
        // x = balanceIn             x' = x +  virtualParamX                                         //
        // y = balanceOut            y' = y +  virtualParamY                                         //
        // s = swapFee                                                                               //
        // L  = inv.Liq                1       /     x' + (1 - s) * dx        \                      //
        //                     p_y =  --- (2) |   --------------------------  |                      //
        // x' = virtIn                1-s      \         (y' + dy)^2          /                      //
        // y' = virtOut                                                                              //
        // Note that dy < 0 < dx.                                                                    //
        **********************************************************************************************/

    const TWO = BigNumber.from(2).mul(ONE);
    const afterFeeMultiplier = ONE.sub(swapFee); // 1 - s
    const virtIn = balances[0].add(virtualParamIn); // x + virtualParamX = x'
    const numerator = virtIn.add(mulDown(afterFeeMultiplier, inAmount)); // x' + (1 - s) * dx
    const virtOut = balances[1].add(virtualParamOut); // y + virtualParamY = y'
    const denominator = mulDown(virtOut.sub(outAmount), virtOut.sub(outAmount)); // (y' + dy)^2
    const factor = divDown(TWO, afterFeeMultiplier); // 2 / (1 - s)

    const derivative = mulDown(factor, divDown(numerator, denominator));

    return derivative;
}

// /////////
// ///  Normalized Liquidity measured with respect to the in-asset.
// /////////
export function _getNormalizedLiquidity(
    balances: BigNumber[],
    virtualParamOut: BigNumber
): BigNumber {
    /**********************************************************************************************
    // x = balanceOut             x' = x +  virtualParamOut                                      //
    // s = swapFee                                                                               //
    //                                                                                           //
    //                             normalizedLiquidity =  0.5 * x'                               //
    //                                                                                           //
    // x' = virtOut                                                                              //
    // Note that balances = [balanceIn, balanceOut].                                             //
    **********************************************************************************************/

    const virtOut = balances[1].add(virtualParamOut);
    return virtOut.div(2);
}
