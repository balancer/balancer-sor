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
    decimalsIn: number,
    decimalsOut: number
): BigNumber[] {
    const scalingFactors = [
        parseFixed('1', decimalsIn),
        parseFixed('1', decimalsOut),
    ];

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
/// Virtual Parameter calculations
/////////

export function _findVirtualParams(
    invariant: BigNumber,
    sqrtAlpha: BigNumber,
    sqrtBeta: BigNumber
): [BigNumber, BigNumber] {
    return [
        invariant.mul(ONE).div(sqrtBeta),
        invariant.mul(sqrtAlpha).div(ONE),
    ];
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
    const [a, mb, mc] = _calculateQuadraticTerms(balances, sqrtAlpha, sqrtBeta);

    const invariant = _calculateQuadratic(a, mb, mc);

    return invariant;
}

export function _calculateQuadraticTerms(
    balances: BigNumber[],
    sqrtAlpha: BigNumber,
    sqrtBeta: BigNumber
): [BigNumber, BigNumber, BigNumber] {
    const a = ONE.sub(sqrtAlpha.mul(ONE).div(sqrtBeta));
    const bterm0 = balances[1].mul(ONE).div(sqrtBeta);
    const bterm1 = balances[0].mul(sqrtAlpha).div(ONE);
    const mb = bterm0.add(bterm1);
    const mc = balances[0].mul(balances[1]).div(ONE);

    return [a, mb, mc];
}

export function _calculateQuadratic(
    a: BigNumber,
    mb: BigNumber,
    mc: BigNumber
): BigNumber {
    const denominator = a.mul(BigNumber.from(2));
    const bSquare = mb.mul(mb).div(ONE);
    const addTerm = a.mul(mc.mul(BigNumber.from(4))).div(ONE);
    // The minus sign in the radicand cancels out in this special case, so we add
    const radicand = bSquare.add(addTerm);
    const sqrResult = _squareRoot(radicand);
    // The minus sign in the numerator cancels out in this special case
    const numerator = mb.add(sqrResult);
    const invariant = numerator.mul(ONE).div(denominator);

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
    if (amountIn.gt(balanceIn.mul(_MAX_IN_RATIO).div(ONE)))
        throw new Error('Swap Amount Too Large');

    const virtIn = balanceIn.add(virtualParamIn);
    const denominator = virtIn.add(amountIn);
    const invSquare = currentInvariant.mul(currentInvariant).div(ONE);
    const subtrahend = invSquare.mul(ONE).div(denominator);
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

    if (amountOut.gt(balanceOut.mul(_MAX_OUT_RATIO).div(ONE)))
        throw new Error('Swap Amount Too Large');

    const virtOut = balanceOut.add(virtualParamOut);
    const denominator = virtOut.sub(amountOut);
    const invSquare = currentInvariant.mul(currentInvariant).div(ONE);
    const term = invSquare.mul(ONE).div(denominator);
    const virtIn = balanceIn.add(virtualParamIn);
    return term.sub(virtIn);
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
    const numerator = virtIn.add(afterFeeMultiplier.mul(inAmount).div(ONE)); // x' + (1 - s) * dx
    const virtOut = balances[1].add(virtualParamOut); // y + virtualParamY = y'
    const denominator = afterFeeMultiplier.mul(virtOut.sub(outAmount)).div(ONE); // (1 - s) * (y' + dy)
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

    const derivative = TWO.mul(ONE).div(denominator);

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
    const numerator = virtIn.add(afterFeeMultiplier.mul(inAmount).div(ONE)); // x' + (1 - s) * dx
    const virtOut = balances[1].add(virtualParamOut); // y + virtualParamY = y'
    const denominator = virtOut
        .sub(outAmount)
        .mul(virtOut.sub(outAmount))
        .div(ONE); // (y' + dy)^2
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
