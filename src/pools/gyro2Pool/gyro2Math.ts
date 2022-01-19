import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';

// Swap limits: amounts swapped may not be larger than this percentage of total balance.
const _MAX_IN_RATIO: BigNumber = BigNumber.from(0.3);
const _MAX_OUT_RATIO: BigNumber = BigNumber.from(0.3);

// Helpers
function _squareRoot(input: BigNumber): BigNumber {
    return input.pow(BigNumber.from(1).div(BigNumber.from(2)));
}

/////////
/// Fee calculations
/////////

export function _reduceFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    const feeAmount = amountIn.mul(swapFee);
    return amountIn.sub(feeAmount);
}

export function _addFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    return amountIn.div(ONE.sub(swapFee));
}

/////////
/// Virtual Parameter calculations
/////////

export function _findVirtualParams(
    invariant: BigNumber,
    sqrtAlpha: BigNumber,
    sqrtBeta: BigNumber
): [BigNumber, BigNumber] {
    return [invariant.div(sqrtBeta), invariant.mul(sqrtAlpha)];
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
        // 0 = (1-sqrt(alhpa/beta)*L^2 - (y/sqrt(beta)+x*sqrt(alpha))*L - x*y)
        // 0 = a*L^2 + b*L + c
        // here a > 0, b < 0, and c < 0, which is a special case that works well w/o negative numbers
        // taking mb = -b and mc = -c:                            (1/2)
        //                                  mb + (mb^2 + 4 * a * mc)^                   //
        //                   L =    ------------------------------------------          //
        //                                          2 * a                               //
        //                                                                              //
        **********************************************************************************************/
    const [a, mb, mc] = _calculateQuadraticTerms(balances, sqrtAlpha, sqrtBeta);

    return _calculateQuadratic(a, mb, mc);
}

function _calculateQuadraticTerms(
    balances: BigNumber[],
    sqrtAlpha: BigNumber,
    sqrtBeta: BigNumber
): [BigNumber, BigNumber, BigNumber] {
    const a = BigNumber.from(1).sub(sqrtAlpha.div(sqrtBeta));
    const bterm0 = balances[1].div(sqrtBeta);
    const bterm1 = balances[0].mul(sqrtAlpha);
    const mb = bterm0.add(bterm1);
    const mc = balances[0].mul(balances[1]);

    return [a, mb, mc];
}

function _calculateQuadratic(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber
): BigNumber {
    const denominator = a.mul(BigNumber.from(2));
    const bSquare = mb.mul(mb);
    const addTerm = a.mul(mc.mul(BigNumber.from(4)));
    // The minus sign in the radicand cancels out in this special case, so we add
    const radicand = bSquare.add(addTerm);
    const sqrResult = _squareRoot(radicand);
    // The minus sign in the numerator cancels out in this special case
    const numerator = mb.add(sqrResult);
    const invariant = numerator.div(denominator);

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
    virtualParamOut: BigNumber,
    currentInvariant: BigNumber
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
    if (amountIn.gt(balanceIn.mul(_MAX_IN_RATIO)))
        throw new Error('Swap Amount Too Large');

    const virtIn = balanceIn.add(virtualParamIn);
    const denominator = virtIn.add(amountIn);
    const invSquare = currentInvariant.mul(currentInvariant);
    const subtrahend = invSquare.div(denominator);
    const virtOut = balanceOut.add(virtualParamOut);
    return virtOut.sub(subtrahend);
}

// SwapType = 'swapExactOut'
export function _calcInGivenOut(
    balanceIn: BigNumber,
    balanceOut: BigNumber,
    amountOut: BigNumber,
    virtualParamIn: BigNumber,
    virtualParamOut: BigNumber,
    currentInvariant: BigNumber
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

    if (amountOut.gt(balanceOut.mul(_MAX_OUT_RATIO)))
        throw new Error('Swap Amount Too Large');

    const virtOut = balanceOut.add(virtualParamOut);
    const denominator = virtOut.sub(amountOut);
    const invSquare = currentInvariant.mul(currentInvariant);
    const term = invSquare.div(denominator);
    const virtIn = balanceIn.add(virtualParamIn);
    return term.sub(virtIn);
}

// /////////
// ///  Spot price function
// /////////

export function _calculateNewSpotPrice(
    newBalances: BigNumber[],
    sqrtAlpha: BigNumber,
    sqrtBeta: BigNumber
): BigNumber {
    // Re-compute the liquidity invariant L based on these new balances.
    // The invariant will be larger slightly larger than before because there are fees.
    const newInvariant = _calculateInvariant(newBalances, sqrtAlpha, sqrtBeta);

    // Compute the offsets a and b based on the new liquidity invariant.
    const [newVirtualParameterIn, newVirtualParameterOut] = _findVirtualParams(
        newInvariant,
        sqrtAlpha,
        sqrtBeta
    );

    //  Now compute (x + a) / (y + b) for the marginal price of asset y (out) denoted in units of asset x (in)
    const numerator = newBalances[0].add(newVirtualParameterIn);
    const denominator = newBalances[1].add(newVirtualParameterOut);
    const newSpotPrice = numerator.div(denominator);

    return newSpotPrice;
}

// /////////
// ///  Derivatives of spotPriceAfterSwap
// /////////

// // PairType = 'token->token'
// // SwapType = 'swapExactIn'
// export function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
//     amount: OldBigNumber,
//     poolPairData: WeightedPoolPairData
// ): OldBigNumber {
//     const Bi = parseFloat(
//         formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
//     );
//     const Bo = parseFloat(
//         formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
//     );
//     const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
//     const wo = parseFloat(formatFixed(poolPairData.weightOut, 18));
//     const Ai = amount.toNumber();
//     const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
//     return bnum((wi + wo) / (Bo * (Bi / (Ai + Bi - Ai * f)) ** (wi / wo) * wi));
// }

// // PairType = 'token->token'
// // SwapType = 'swapExactOut'
// export function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
//     amount: OldBigNumber,
//     poolPairData: WeightedPoolPairData
// ): OldBigNumber {
//     const Bi = parseFloat(
//         formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
//     );
//     const Bo = parseFloat(
//         formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
//     );
//     const wi = parseFloat(formatFixed(poolPairData.weightIn, 18));
//     const wo = parseFloat(formatFixed(poolPairData.weightOut, 18));
//     const Ao = amount.toNumber();
//     const f = parseFloat(formatFixed(poolPairData.swapFee, 18));
//     return bnum(
//         -(
//             (Bi * (Bo / (-Ao + Bo)) ** (wo / wi) * wo * (wi + wo)) /
//             ((Ao - Bo) ** 2 * (-1 + f) * wi ** 2)
//         )
//     );
// }
