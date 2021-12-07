import { MathSol, BZERO } from './basicOperations';

const AMP_PRECISION = BigInt(1e3);

function _calculateInvariant(
    amp: bigint,
    balances: bigint[],
    roundUp: boolean
): bigint {
    /**********************************************************************************************
      // invariant                                                                                 //
      // D = invariant                                                  D^(n+1)                    //
      // A = amplification coefficient      A  n^n S + D = A D n^n + -----------                   //
      // S = sum of balances                                             n^n P                     //
      // P = product of balances                                                                   //
      // n = number of tokens                                                                      //
      *********x************************************************************************************/

    // We support rounding up or down.

    let sum = BZERO;
    const numTokens = balances.length;
    for (let i = 0; i < numTokens; i++) {
        sum = sum + balances[i];
    }
    if (sum == BZERO) {
        return BZERO;
    }

    let prevInvariant = BZERO;
    let invariant = sum;
    const ampTimesTotal = amp * BigInt(numTokens);

    for (let i = 0; i < 255; i++) {
        let P_D = balances[0] * BigInt(numTokens);
        for (let j = 1; j < numTokens; j++) {
            P_D = MathSol.div(
                MathSol.mul(MathSol.mul(P_D, balances[j]), BigInt(numTokens)),
                invariant,
                roundUp
            );
        }
        prevInvariant = invariant;
        invariant = MathSol.div(
            MathSol.mul(MathSol.mul(BigInt(numTokens), invariant), invariant) +
                MathSol.div(
                    MathSol.mul(MathSol.mul(ampTimesTotal, sum), P_D),
                    AMP_PRECISION,
                    roundUp
                ),
            MathSol.mul(BigInt(numTokens + 1), invariant) +
                // No need to use checked arithmetic for the amp precision, the amp is guaranteed to be at least 1
                MathSol.div(
                    MathSol.mul(ampTimesTotal - AMP_PRECISION, P_D),
                    AMP_PRECISION,
                    !roundUp
                ),
            roundUp
        );

        if (invariant > prevInvariant) {
            if (invariant - prevInvariant <= 1) {
                return invariant;
            }
        } else if (prevInvariant - invariant <= 1) {
            return invariant;
        }
    }

    throw new Error('Errors.STABLE_INVARIANT_DIDNT_CONVERGE');
}

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _calcOutGivenIn(
    amp: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    amountIn: bigint,
    fee: bigint
): bigint {
    amountIn = subtractFee(amountIn, fee);
    // Given that we need to have a greater final balance out, the invariant needs to be rounded up
    const invariant = _calculateInvariant(amp, balances, true);

    const initBalance = balances[tokenIndexIn];
    balances[tokenIndexIn] = initBalance + amountIn;
    const finalBalanceOut = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        amp,
        balances,
        invariant,
        tokenIndexOut
    );
    return balances[tokenIndexOut] - finalBalanceOut - BigInt(1);
}

export function _calcInGivenOut(
    amp: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    amountOut: bigint,
    fee: bigint
): bigint {
    const invariant = _calculateInvariant(amp, balances, true);
    balances[tokenIndexOut] = MathSol.sub(balances[tokenIndexOut], amountOut);

    const finalBalanceIn = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        amp,
        balances,
        invariant,
        tokenIndexIn
    );

    let amountIn = MathSol.add(
        MathSol.sub(finalBalanceIn, balances[tokenIndexIn]),
        BigInt(1)
    );
    amountIn = addFee(amountIn, fee);
    return amountIn;
}

export function _calcBptOutGivenExactTokensIn(
    amp: bigint,
    balances: bigint[],
    amountsIn: bigint[],
    bptTotalSupply: bigint,
    swapFeePercentage: bigint
): bigint {
    // BPT out, so we round down overall.

    // First loop calculates the sum of all token balances, which will be used to calculate
    // the current weights of each token, relative to this sum
    let sumBalances = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances + balances[i];
    }

    // Calculate the weighted balance ratio without considering fees
    let balanceRatiosWithFee: bigint[] = new Array(amountsIn.length);
    // The weighted sum of token balance ratios with fee
    let invariantRatioWithFees = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        let currentWeight = MathSol.divDownFixed(balances[i], sumBalances);
        balanceRatiosWithFee[i] = MathSol.divDownFixed(
            balances[i] + amountsIn[i],
            balances[i]
        );
        invariantRatioWithFees =
            invariantRatioWithFees +
            MathSol.mulDownFixed(balanceRatiosWithFee[i], currentWeight);
    }

    // Second loop calculates new amounts in, taking into account the fee on the percentage excess
    let newBalances: bigint[] = new Array(balances.length);
    for (let i = 0; i < balances.length; i++) {
        let amountInWithoutFee: bigint;

        // Check if the balance ratio is greater than the ideal ratio to charge fees or not
        if (balanceRatiosWithFee[i] > invariantRatioWithFees) {
            const nonTaxableAmount = MathSol.mulDownFixed(
                balances[i],
                invariantRatioWithFees - MathSol.ONE
            );
            const taxableAmount = amountsIn[i] - nonTaxableAmount;
            // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
            amountInWithoutFee =
                nonTaxableAmount +
                MathSol.mulDownFixed(
                    taxableAmount,
                    MathSol.ONE - swapFeePercentage
                );
        } else {
            amountInWithoutFee = amountsIn[i];
        }
        newBalances[i] = balances[i] + amountInWithoutFee;
    }

    // Get current and new invariants, taking swap fees into account
    const currentInvariant = _calculateInvariant(amp, balances, true);
    const newInvariant = _calculateInvariant(amp, newBalances, false);
    const invariantRatio = MathSol.divDownFixed(newInvariant, currentInvariant);

    // If the invariant didn't increase for any reason, we simply don't mint BPT
    if (invariantRatio > MathSol.ONE) {
        return MathSol.mulDownFixed(
            bptTotalSupply,
            invariantRatio - MathSol.ONE
        );
    } else {
        return BigInt(0);
    }
}

export function _calcTokenInGivenExactBptOut(
    amp: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    bptAmountOut: bigint,
    bptTotalSupply: bigint,
    fee: bigint
): bigint {
    // Token in, so we round up overall.
    const currentInvariant = _calculateInvariant(amp, balances, true);
    const newInvariant = MathSol.mulUpFixed(
        MathSol.divUpFixed(
            MathSol.add(bptTotalSupply, bptAmountOut),
            bptTotalSupply
        ),
        currentInvariant
    );

    // Calculate amount in without fee.
    const newBalanceTokenIndex =
        _getTokenBalanceGivenInvariantAndAllOtherBalances(
            amp,
            balances,
            newInvariant,
            tokenIndexIn
        );
    const amountInWithoutFee = MathSol.sub(
        newBalanceTokenIndex,
        balances[tokenIndexIn]
    );

    // First calculate the sum of all token balances, which will be used to calculate
    // the current weight of each token
    let sumBalances = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = MathSol.add(sumBalances, balances[i]);
    }

    // We can now compute how much extra balance is being deposited
    // and used in virtual swaps, and charge swap fees accordingly.
    const currentWeight = MathSol.divDownFixed(
        balances[tokenIndexIn],
        sumBalances
    );
    const taxablePercentage = MathSol.complementFixed(currentWeight);
    const taxableAmount = MathSol.mulUpFixed(
        amountInWithoutFee,
        taxablePercentage
    );
    const nonTaxableAmount = MathSol.sub(amountInWithoutFee, taxableAmount);

    return MathSol.add(
        nonTaxableAmount,
        MathSol.divUpFixed(taxableAmount, MathSol.sub(MathSol.ONE, fee))
    );
}

/*
Flow of calculations:
amountsTokenOut -> amountsOutProportional ->
amountOutPercentageExcess -> amountOutBeforeFee -> newInvariant -> amountBPTIn
*/
export function _calcBptInGivenExactTokensOut(
    amp: bigint,
    balances: bigint[],
    amountsOut: bigint[],
    bptTotalSupply: bigint,
    swapFeePercentage: bigint
): bigint {
    // BPT in, so we round up overall.

    // First loop calculates the sum of all token balances, which will be used to calculate
    // the current weights of each token relative to this sum
    let sumBalances = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances + balances[i];
    }

    // Calculate the weighted balance ratio without considering fees
    let balanceRatiosWithoutFee: bigint[] = new Array(amountsOut.length);
    let invariantRatioWithoutFees = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        const currentWeight = MathSol.divUpFixed(balances[i], sumBalances);
        balanceRatiosWithoutFee[i] = MathSol.divUpFixed(
            balances[i] - amountsOut[i],
            balances[i]
        );
        invariantRatioWithoutFees =
            invariantRatioWithoutFees +
            MathSol.mulUpFixed(balanceRatiosWithoutFee[i], currentWeight);
    }

    // Second loop calculates new amounts in, taking into account the fee on the percentage excess
    let newBalances: bigint[] = new Array(balances.length);
    for (let i = 0; i < balances.length; i++) {
        // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it to
        // 'token out'. This results in slightly larger price impact.

        let amountOutWithFee: bigint;
        if (invariantRatioWithoutFees > balanceRatiosWithoutFee[i]) {
            const nonTaxableAmount = MathSol.mulDownFixed(
                balances[i],
                MathSol.complementFixed(invariantRatioWithoutFees)
            );
            const taxableAmount = amountsOut[i] - nonTaxableAmount;
            // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
            amountOutWithFee =
                nonTaxableAmount +
                MathSol.divUpFixed(
                    taxableAmount,
                    MathSol.ONE - swapFeePercentage
                );
        } else {
            amountOutWithFee = amountsOut[i];
        }
        newBalances[i] = balances[i] - amountOutWithFee;
    }

    // Get current and new invariants, taking into account swap fees
    const currentInvariant = _calculateInvariant(amp, balances, true);
    const newInvariant = _calculateInvariant(amp, newBalances, false);
    const invariantRatio = MathSol.divUpFixed(newInvariant, currentInvariant);

    // return amountBPTIn
    return MathSol.mulUpFixed(
        bptTotalSupply,
        MathSol.complementFixed(invariantRatio)
    );
}

export function _calcTokenOutGivenExactBptIn(
    amp: bigint,
    balances: bigint[],
    tokenIndex: number,
    bptAmountIn: bigint,
    bptTotalSupply: bigint,
    swapFeePercentage: bigint
): bigint {
    // Token out, so we round down overall.

    // Get the current and new invariants. Since we need a bigger new invariant, we round the current one up.
    const currentInvariant = _calculateInvariant(amp, balances, true);
    const newInvariant = MathSol.mulUpFixed(
        MathSol.divUpFixed(bptTotalSupply - bptAmountIn, bptTotalSupply),
        currentInvariant
    );

    // Calculate amount out without fee
    const newBalanceTokenIndex =
        _getTokenBalanceGivenInvariantAndAllOtherBalances(
            amp,
            balances,
            newInvariant,
            tokenIndex
        );
    const amountOutWithoutFee = balances[tokenIndex] - newBalanceTokenIndex;

    // First calculate the sum of all token balances, which will be used to calculate
    // the current weight of each token
    let sumBalances = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances + balances[i];
    }

    // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
    // in swap fees.
    const currentWeight = MathSol.divDownFixed(
        balances[tokenIndex],
        sumBalances
    );
    const taxablePercentage = MathSol.complementFixed(currentWeight);

    // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
    // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
    const taxableAmount = MathSol.mulUpFixed(
        amountOutWithoutFee,
        taxablePercentage
    );
    const nonTaxableAmount = amountOutWithoutFee - taxableAmount;

    // No need to use checked arithmetic for the swap fee, it is guaranteed to be lower than 50%
    return (
        nonTaxableAmount +
        MathSol.mulDownFixed(taxableAmount, MathSol.ONE - swapFeePercentage)
    );
}

export function _calcTokensOutGivenExactBptIn(
    balances: bigint[],
    bptAmountIn: bigint,
    bptTotalSupply: bigint
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
        amountsOut[i] = MathSol.mulDownFixed(balances[i], bptRatio);
    }

    return amountsOut;
}

function _getTokenBalanceGivenInvariantAndAllOtherBalances(
    amp: bigint,
    balances: bigint[],
    invariant: bigint,
    tokenIndex: number
): bigint {
    // Rounds result up overall

    const ampTimesTotal = amp * BigInt(balances.length);
    let sum = balances[0];
    let P_D = balances[0] * BigInt(balances.length);
    for (let j = 1; j < balances.length; j++) {
        P_D = MathSol.divDown(
            MathSol.mul(MathSol.mul(P_D, balances[j]), BigInt(balances.length)),
            invariant
        );
        sum = sum + balances[j];
    }
    // No need to use safe math, based on the loop above `sum` is greater than or equal to `balances[tokenIndex]`
    sum = sum - balances[tokenIndex];

    const inv2 = MathSol.mul(invariant, invariant);
    // We remove the balance fromm c by multiplying it
    const c = MathSol.mul(
        MathSol.mul(
            MathSol.divUp(inv2, MathSol.mul(ampTimesTotal, P_D)),
            AMP_PRECISION
        ),
        balances[tokenIndex]
    );
    const b =
        sum +
        MathSol.mul(MathSol.divDown(invariant, ampTimesTotal), AMP_PRECISION);

    // We iterate to find the balance
    let prevTokenBalance = BZERO;
    // We multiply the first iteration outside the loop with the invariant to set the value of the
    // initial approximation.
    let tokenBalance = MathSol.divUp(inv2 + c, invariant + b);

    for (let i = 0; i < 255; i++) {
        prevTokenBalance = tokenBalance;

        tokenBalance = MathSol.divUp(
            MathSol.mul(tokenBalance, tokenBalance) + c,
            MathSol.mul(tokenBalance, BigInt(2)) + b - invariant
        );

        if (tokenBalance > prevTokenBalance) {
            if (tokenBalance - prevTokenBalance <= 1) {
                return tokenBalance;
            }
        } else if (prevTokenBalance - tokenBalance <= 1) {
            return tokenBalance;
        }
    }
    throw new Error('Errors.STABLE_GET_BALANCE_DIDNT_CONVERGE');
}

function subtractFee(amount: bigint, fee: bigint): bigint {
    const feeAmount = MathSol.mulUpFixed(amount, fee);
    return amount - feeAmount;
}

function addFee(amount: bigint, fee: bigint): bigint {
    return MathSol.divUpFixed(amount, MathSol.complementFixed(fee));
}

/////////
/// SpotPriceAfterSwap
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForTokenOut(
    amp: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    amountIn: bigint,
    fee: bigint
): bigint {
    const feeComplement = MathSol.complementFixed(fee);
    const balancesCopy = [...balances];
    balances[tokenIndexIn] = MathSol.add(
        balances[tokenIndexIn],
        MathSol.mulUpFixed(amountIn, feeComplement)
    );
    balances[tokenIndexOut] = MathSol.sub(
        balances[tokenIndexOut],
        _calcOutGivenIn(
            amp,
            balancesCopy,
            tokenIndexIn,
            tokenIndexOut,
            amountIn,
            fee
        )
    );
    let ans = _poolDerivatives(
        amp,
        balances,
        tokenIndexIn,
        tokenIndexOut,
        true,
        false
    );
    ans = MathSol.divDownFixed(
        MathSol.ONE,
        MathSol.mulDownFixed(ans, feeComplement)
    );
    return ans;
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactTokenOut(
    amp: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    amountOut: bigint,
    fee: bigint
): BigInt {
    const balancesCopy = [...balances];
    let _in = _calcInGivenOut(
        amp,
        balancesCopy,
        tokenIndexIn,
        tokenIndexOut,
        amountOut,
        fee
    );
    balances[tokenIndexIn] = balances[tokenIndexIn] + _in;
    balances[tokenIndexOut] = MathSol.sub(balances[tokenIndexOut], amountOut);
    let ans = _poolDerivatives(
        amp,
        balances,
        tokenIndexIn,
        tokenIndexOut,
        true,
        true
    );
    const feeComplement = MathSol.complementFixed(fee);
    ans = MathSol.divUpFixed(
        MathSol.ONE,
        MathSol.mulUpFixed(ans, feeComplement)
    );
    return ans;
}

export function _poolDerivatives(
    amp: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    is_first_derivative: boolean,
    wrt_out: boolean
): bigint {
    let totalCoins = balances.length;
    let D = _calculateInvariant(amp, balances, true);
    let S = BigInt(0);
    for (let i = 0; i < totalCoins; i++) {
        if (i != tokenIndexIn && i != tokenIndexOut) {
            S += balances[i];
        }
    }
    let x = balances[tokenIndexIn];
    let y = balances[tokenIndexOut];
    let a = amp * BigInt(totalCoins);
    let b = a * (S - D) + D * AMP_PRECISION;
    let twoaxy = BigInt(2) * a * x * y;
    let partial_x = twoaxy + a * y * y + b * y;
    let partial_y = twoaxy + a * x * x + b * x;
    let ans: bigint;
    if (is_first_derivative) {
        ans = MathSol.divUpFixed(partial_x, partial_y);
    } else {
        // Untested case:
        let partial_xx = BigInt(2) * a * y;
        let partial_yy = BigInt(2) * a * x;
        let partial_xy = partial_xx + partial_yy + b; // AMP_PRECISION missing
        let numerator: bigint;
        numerator =
            BigInt(2) * partial_x * partial_y * partial_xy -
            partial_xx * partial_y * partial_y +
            partial_yy * partial_x * partial_x;
        let denominator = partial_x * partial_x * partial_y;
        ans = MathSol.divUpFixed(numerator, denominator); // change the order to directly use integer operations
        if (wrt_out) {
            ans = MathSol.mulUpFixed(
                MathSol.mulUpFixed(ans, partial_y),
                partial_x
            );
        }
    }
    return ans;
}
