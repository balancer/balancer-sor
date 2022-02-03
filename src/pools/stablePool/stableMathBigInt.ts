/*
Swap outcome and "spot price after swap" formulas for weighted, stable and linear pools.
Amounts are represented using bigint type. Swap outcomes formulas should
match exactly those from smart contracts.

Test cases are found in poolsMathWeighted.spec.ts, poolsMathStable.spec.ts poolsMathLinear.spec.ts.

It is necessary to review whether to use MathSol operations or native +,-,\*,/ case by case. MathSol operations are able to reproduce overflows while native operations produce a much more readable code. For instance, for "spot price after swap" native operations
are preferred since in this case there are not smart contract analogs, amount limits are assumed to have been checked elsewhere, and some formulas get complicated, specially for stable pools.
*/
import { MathSol, BZERO } from '../../utils/basicOperations';

const AMP_PRECISION = BigInt(1e3);

export function _calculateInvariant(
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
    fee: bigint,
    invariant?: bigint
): bigint {
    balances = [...balances];
    amountIn = subtractFee(amountIn, fee);
    // Given that we need to have a greater final balance out, the invariant needs to be rounded up
    if (!invariant) invariant = _calculateInvariant(amp, balances, true);

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
    fee: bigint,
    invariant?: bigint
): bigint {
    balances = [...balances];
    if (!invariant) invariant = _calculateInvariant(amp, balances, true);
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
    swapFeePercentage: bigint,
    invariant?: bigint
): bigint {
    if (!invariant) invariant = _calculateInvariant(amp, balances, true);
    // BPT out, so we round down overall.

    // First loop calculates the sum of all token balances, which will be used to calculate
    // the current weights of each token, relative to this sum
    let sumBalances = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances + balances[i];
    }

    // Calculate the weighted balance ratio without considering fees
    const balanceRatiosWithFee: bigint[] = new Array(amountsIn.length);
    // The weighted sum of token balance ratios with fee
    let invariantRatioWithFees = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        const currentWeight = MathSol.divDownFixed(balances[i], sumBalances);
        balanceRatiosWithFee[i] = MathSol.divDownFixed(
            balances[i] + amountsIn[i],
            balances[i]
        );
        invariantRatioWithFees =
            invariantRatioWithFees +
            MathSol.mulDownFixed(balanceRatiosWithFee[i], currentWeight);
    }

    // Second loop calculates new amounts in, taking into account the fee on the percentage excess
    const newBalances: bigint[] = new Array(balances.length);
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
    fee: bigint,
    invariant?: bigint
): bigint {
    if (!invariant) invariant = _calculateInvariant(amp, balances, true);
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
    swapFeePercentage: bigint,
    invariant?: bigint
): bigint {
    if (!invariant) invariant = _calculateInvariant(amp, balances, true);
    // BPT in, so we round up overall.

    // First loop calculates the sum of all token balances, which will be used to calculate
    // the current weights of each token relative to this sum
    let sumBalances = BigInt(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances + balances[i];
    }

    // Calculate the weighted balance ratio without considering fees
    const balanceRatiosWithoutFee: bigint[] = new Array(amountsOut.length);
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
    const newBalances: bigint[] = new Array(balances.length);
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
    const invariantRatio = MathSol.divDownFixed(newInvariant, currentInvariant);

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
    swapFeePercentage: bigint,
    invariant?: bigint
): bigint {
    if (!invariant) invariant = _calculateInvariant(amp, balances, true);
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

    const amountsOut: bigint[] = new Array(balances.length);
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

export function subtractFee(amount: bigint, fee: bigint): bigint {
    const feeAmount = MathSol.mulUpFixed(amount, fee);
    return amount - feeAmount;
}

export function addFee(amount: bigint, fee: bigint): bigint {
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
    const _in = _calcInGivenOut(
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

// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForBPTOut(
    amp: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    bptTotalSupply: bigint,
    amountIn: bigint
    // assuming zero fee
): bigint {
    balances[tokenIndexIn] = balances[tokenIndexIn] + amountIn;
    // working
    const amountsIn = balances.map((_value, index) =>
        index == tokenIndexIn ? amountIn : BigInt(0)
    );
    const finalBPTSupply =
        bptTotalSupply +
        _calcBptOutGivenExactTokensIn(
            amp,
            balances,
            amountsIn,
            bptTotalSupply,
            BigInt(0)
        );
    let ans = _poolDerivativesBPT(
        amp,
        balances,
        finalBPTSupply,
        tokenIndexIn,
        true,
        true,
        false
    );
    ans = MathSol.divUpFixed(MathSol.ONE, ans);
    return ans;
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactBPTOut(
    amp: bigint,
    balances: bigint[],
    tokenIndexIn: number,
    bptTotalSupply: bigint,
    amountOut: bigint
    // assuming zero fee
): bigint {
    const balancesCopy = [...balances];
    const _in = _calcTokenInGivenExactBptOut(
        amp,
        balancesCopy,
        tokenIndexIn,
        amountOut,
        bptTotalSupply,
        BigInt(0)
    );
    balances[tokenIndexIn] = balances[tokenIndexIn] + _in;
    let ans = _poolDerivativesBPT(
        amp,
        balances,
        bptTotalSupply + amountOut,
        tokenIndexIn,
        true,
        true,
        true
    );
    ans = MathSol.divUpFixed(MathSol.ONE, ans); // ONE.div(ans.times(feeFactor));
    return ans;
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactBPTInForTokenOut(
    amp: bigint,
    balances: bigint[],
    tokenIndexOut: number,
    bptTotalSupply: bigint,
    amountIn: bigint
    // assuming zero fee
): bigint {
    // balances copy not necessary?
    const _out = _calcTokenOutGivenExactBptIn(
        amp,
        balances,
        tokenIndexOut,
        amountIn,
        bptTotalSupply,
        BigInt(0)
    );
    balances[tokenIndexOut] = balances[tokenIndexOut] - _out;
    const bptTotalSupplyAfter = MathSol.sub(bptTotalSupply, amountIn);
    const ans = _poolDerivativesBPT(
        amp,
        balances,
        bptTotalSupplyAfter,
        tokenIndexOut,
        true,
        false,
        false
    );
    return ans;
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapBPTInForExactTokenOut(
    amp: bigint,
    balances: bigint[],
    tokenIndexOut: number,
    bptTotalSupply: bigint,
    amountOut: bigint
): bigint {
    balances[tokenIndexOut] = MathSol.sub(balances[tokenIndexOut], amountOut);
    const amountsOut = balances.map((_value, index) =>
        index == tokenIndexOut ? amountOut : BigInt(0)
    );
    const bptTotalSupplyAfter =
        bptTotalSupply -
        _calcBptInGivenExactTokensOut(
            amp,
            balances,
            amountsOut,
            bptTotalSupply,
            BigInt(0)
        );
    const ans = _poolDerivativesBPT(
        amp,
        balances,
        bptTotalSupplyAfter,
        tokenIndexOut,
        true,
        false,
        true
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
    const totalCoins = balances.length;
    const D = _calculateInvariant(amp, balances, true);
    let S = BigInt(0);
    for (let i = 0; i < totalCoins; i++) {
        if (i != tokenIndexIn && i != tokenIndexOut) {
            S += balances[i];
        }
    }
    const x = balances[tokenIndexIn];
    const y = balances[tokenIndexOut];
    const a = amp * BigInt(totalCoins);
    const b = a * (S - D) + D * AMP_PRECISION;
    const twoaxy = BigInt(2) * a * x * y;
    const partial_x = twoaxy + a * y * y + b * y;
    const partial_y = twoaxy + a * x * x + b * x;
    let ans: bigint;
    if (is_first_derivative) {
        ans = MathSol.divUpFixed(partial_x, partial_y);
    } else {
        // Untested case:
        const partial_xx = BigInt(2) * a * y;
        const partial_yy = BigInt(2) * a * x;
        const partial_xy = partial_xx + partial_yy + b; // AMP_PRECISION missing
        const numerator =
            BigInt(2) * partial_x * partial_y * partial_xy -
            partial_xx * partial_y * partial_y +
            partial_yy * partial_x * partial_x;
        const denominator = partial_x * partial_x * partial_y;
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

export function _poolDerivativesBPT(
    amp: bigint,
    balances: bigint[],
    bptSupply: bigint,
    tokenIndexIn: number,
    is_first_derivative: boolean,
    is_BPT_out: boolean,
    wrt_out: boolean
): bigint {
    const totalCoins = balances.length;
    const D = _calculateInvariant(amp, balances, true);
    let S = BigInt(0);
    let D_P = D / BigInt(totalCoins);
    for (let i = 0; i < totalCoins; i++) {
        if (i != tokenIndexIn) {
            S = S + balances[i];
            D_P = (D_P * D) / (BigInt(totalCoins) * balances[i]);
        }
    }
    const x = balances[tokenIndexIn];
    const alpha = amp * BigInt(totalCoins);
    const beta = alpha * S; // units = 10 ** 21
    const gamma = BigInt(AMP_PRECISION) - alpha;
    const partial_x = BigInt(2) * alpha * x + beta + gamma * D;
    const minus_partial_D =
        D_P * BigInt(totalCoins + 1) * AMP_PRECISION - gamma * x;
    const partial_D = -minus_partial_D;
    const ans = MathSol.divUpFixed(
        (partial_x * bptSupply) / minus_partial_D,
        D
    );
    /*
    if (is_first_derivative) {
        ans = MathSol.divUpFixed((partial_x * bptSupply) / minus_partial_D, D);
    } else {
        let partial_xx = bnum(2).times(alpha);
        let partial_xD = gamma;
        let n_times_nplusone = totalCoins * (totalCoins + 1);
        let partial_DD = bnum(0).minus( D_P.times(n_times_nplusone).div(D) );
        if (is_BPT_out) {
            let term1 = partial_xx.times(partial_D).div( partial_x.pow(2) );
            let term2 = bnum(2).times(partial_xD).div(partial_x);
            let term3 = partial_DD.div(partial_D);
            ans = (term1.minus(term2).plus(term3)).times(D).div(bptSupply)
            if (wrt_out) {
                let D_prime = bnum(0).minus( partial_x.div(partial_D) );
                ans = ans.div( D_prime ).times(D).div(bptSupply);
            }
        } else {
            ans = bnum(2).times(partial_xD).div(partial_D).minus(
                partial_DD.times(partial_x).div(partial_D.pow(2)) ).minus(
                partial_xx.div(partial_x) );
            if (wrt_out) {
                ans = ans.times(partial_x).div(minus_partial_D).times(bptSupply).div(D);
            }
        }
    }
*/
    return ans;
}
