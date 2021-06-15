'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
/*
Uses implementation from V2 core: https://github.com/balancer-labs/balancer-v2-monorepo/blob/master/pvt/helpers/src/models/pools/stable/math.ts
Changed from Ethers BigNumber to use BigNumber.js
*/
const bmath_1 = require('../../bmath');
const bignumber_1 = require('../../utils/bignumber');
const numbers_1 = require('./numbers');
function calculateInvariant(fpRawBalances, amplificationParameter) {
    return calculateApproxInvariant(fpRawBalances, amplificationParameter);
}
exports.calculateInvariant = calculateInvariant;
function calculateApproxInvariant(fpRawBalances, amplificationParameter) {
    const totalCoins = fpRawBalances.length;
    const balances = fpRawBalances.map(numbers_1.fromFp);
    const sum = balances.reduce((a, b) => a.add(b), numbers_1.decimal(0));
    if (sum.isZero()) {
        return numbers_1.bn(0);
    }
    let inv = sum;
    let prevInv = numbers_1.decimal(0);
    const ampTimesTotal = numbers_1
        .decimal(amplificationParameter)
        .mul(totalCoins);
    for (let i = 0; i < 255; i++) {
        let P_D = balances[0].mul(totalCoins);
        for (let j = 1; j < totalCoins; j++) {
            P_D = P_D.mul(balances[j])
                .mul(totalCoins)
                .div(inv);
        }
        prevInv = inv;
        inv = numbers_1
            .decimal(totalCoins)
            .mul(inv)
            .mul(inv)
            .add(ampTimesTotal.mul(sum).mul(P_D))
            .div(
                numbers_1
                    .decimal(totalCoins)
                    .add(1)
                    .mul(inv)
                    .add(ampTimesTotal.sub(1).mul(P_D))
            );
        // Equality with the precision of 1
        if (inv > prevInv) {
            if (inv.sub(prevInv).lte(1)) {
                break;
            }
        } else if (prevInv.sub(inv).lte(1)) {
            break;
        }
    }
    return numbers_1.fp(inv);
}
exports.calculateApproxInvariant = calculateApproxInvariant;
function calculateAnalyticalInvariantForTwoTokens(
    fpRawBalances,
    amplificationParameter
) {
    if (fpRawBalances.length !== 2) {
        throw 'Analytical invariant is solved only for 2 balances';
    }
    const sum = fpRawBalances.reduce(
        (a, b) => a.add(numbers_1.fromFp(b)),
        numbers_1.decimal(0)
    );
    const prod = fpRawBalances.reduce(
        (a, b) => a.mul(numbers_1.fromFp(b)),
        numbers_1.decimal(1)
    );
    // The amplification parameter equals to: A n^(n-1), where A is the amplification coefficient
    const amplificationCoefficient = numbers_1
        .decimal(amplificationParameter)
        .div(2);
    //Q
    const q = amplificationCoefficient
        .mul(-16)
        .mul(sum)
        .mul(prod);
    //P
    const p = amplificationCoefficient
        .minus(numbers_1.decimal(1).div(4))
        .mul(16)
        .mul(prod);
    //C
    const c = q
        .pow(2)
        .div(4)
        .add(p.pow(3).div(27))
        .pow(1 / 2)
        .minus(q.div(2))
        .pow(1 / 3);
    const invariant = c.minus(p.div(c.mul(3)));
    return numbers_1.fp(invariant);
}
exports.calculateAnalyticalInvariantForTwoTokens = calculateAnalyticalInvariantForTwoTokens;
// Compared to V2 implementation this has the swap fee added.
// export function calcOutGivenIn(
function _exactTokenInForTokenOut(
    fpBalances,
    amplificationParameter,
    tokenIndexIn,
    tokenIndexOut,
    fpTokenAmountIn,
    swapFee
) {
    const sf = bmath_1.bnum(1e18).minus(swapFee);
    const amtWithFee = numbers_1
        .fromFp(fpTokenAmountIn)
        .times(numbers_1.fromFp(sf));
    const invariant = numbers_1.fromFp(
        calculateInvariant(fpBalances, amplificationParameter)
    );
    const balances = fpBalances.map(numbers_1.fromFp);
    balances[tokenIndexIn] = balances[tokenIndexIn].add(amtWithFee);
    const finalBalanceOut = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        balances,
        numbers_1.decimal(amplificationParameter),
        invariant,
        tokenIndexOut
    );
    return new bignumber_1.BigNumber(
        numbers_1.toFp(balances[tokenIndexOut].sub(finalBalanceOut)).toString()
    );
}
exports._exactTokenInForTokenOut = _exactTokenInForTokenOut;
// Compared to V2 implementation this has the swap fee added.
// export function calcInGivenOut(
function _tokenInForExactTokenOut(
    fpBalances,
    amplificationParameter,
    tokenIndexIn,
    tokenIndexOut,
    fpTokenAmountOut,
    swapFee
) {
    const invariant = numbers_1.fromFp(
        calculateInvariant(fpBalances, amplificationParameter)
    );
    const balances = fpBalances.map(numbers_1.fromFp);
    balances[tokenIndexOut] = balances[tokenIndexOut].sub(
        numbers_1.fromFp(fpTokenAmountOut)
    );
    const finalBalanceIn = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        balances,
        numbers_1.decimal(amplificationParameter),
        invariant,
        tokenIndexIn
    );
    const sf = bmath_1.bnum(1e18).minus(swapFee);
    const amtWithFee = numbers_1
        .toFp(finalBalanceIn.sub(balances[tokenIndexIn]))
        .div(numbers_1.fromFp(sf));
    return new bignumber_1.BigNumber(amtWithFee.toString());
}
exports._tokenInForExactTokenOut = _tokenInForExactTokenOut;
// export function calcBptOutGivenExactTokensIn(
function exactTokensInForBPTOut(
    fpBalances,
    amplificationParameter,
    fpAmountsIn,
    fpBptTotalSupply,
    fpSwapFeePercentage
) {
    // Get current invariant
    const currentInvariant = numbers_1.fromFp(
        calculateInvariant(fpBalances, amplificationParameter)
    );
    const balances = fpBalances.map(numbers_1.fromFp);
    const amountsIn = fpAmountsIn.map(numbers_1.fromFp);
    // First calculate the sum of all token balances which will be used to calculate
    // the current weights of each token relative to the sum of all balances
    const sumBalances = balances.reduce(
        (a, b) => a.add(b),
        numbers_1.decimal(0)
    );
    // Calculate the weighted balance ratio without considering fees
    const balanceRatiosWithFee = [];
    // The weighted sum of token balance rations sans fee
    let invariantRatioWithFees = numbers_1.decimal(0);
    for (let i = 0; i < balances.length; i++) {
        const currentWeight = balances[i].div(sumBalances);
        balanceRatiosWithFee[i] = balances[i]
            .add(amountsIn[i])
            .div(balances[i]);
        invariantRatioWithFees = invariantRatioWithFees.add(
            balanceRatiosWithFee[i].mul(currentWeight)
        );
    }
    // Second loop to calculate new amounts in taking into account the fee on the % excess
    for (let i = 0; i < balances.length; i++) {
        let amountInWithoutFee;
        // Check if the balance ratio is greater than the ideal ratio to charge fees or not
        if (balanceRatiosWithFee[i].gt(invariantRatioWithFees)) {
            const nonTaxableAmount = balances[i].mul(
                invariantRatioWithFees.sub(1)
            );
            const taxableAmount = amountsIn[i].sub(nonTaxableAmount);
            amountInWithoutFee = nonTaxableAmount.add(
                taxableAmount.mul(
                    numbers_1
                        .decimal(1)
                        .sub(numbers_1.fromFp(fpSwapFeePercentage))
                )
            );
        } else {
            amountInWithoutFee = amountsIn[i];
        }
        balances[i] = balances[i].add(amountInWithoutFee);
    }
    // Calculate the new invariant, taking swap fees into account
    const newInvariant = numbers_1.fromFp(
        calculateInvariant(balances.map(numbers_1.fp), amplificationParameter)
    );
    const invariantRatio = newInvariant.div(currentInvariant);
    if (invariantRatio.gt(1)) {
        return numbers_1.fp(
            numbers_1.fromFp(fpBptTotalSupply).mul(invariantRatio.sub(1))
        );
    } else {
        return new bignumber_1.BigNumber(0);
    }
}
exports.exactTokensInForBPTOut = exactTokensInForBPTOut;
// export function calcTokenInGivenExactBptOut(
function _tokenInForExactBPTOut(
    tokenIndex,
    fpBalances,
    amplificationParameter,
    fpBptAmountOut,
    fpBptTotalSupply,
    fpSwapFeePercentage
) {
    // Get current invariant
    const fpCurrentInvariant = numbers_1.bn(
        calculateInvariant(fpBalances, amplificationParameter)
    );
    // Calculate new invariant
    const newInvariant = numbers_1
        .fromFp(numbers_1.bn(fpBptTotalSupply).plus(fpBptAmountOut))
        .div(numbers_1.fromFp(fpBptTotalSupply))
        .mul(numbers_1.fromFp(fpCurrentInvariant));
    // First calculate the sum of all token balances which will be used to calculate
    // the current weight of token
    const balances = fpBalances.map(numbers_1.fromFp);
    const sumBalances = balances.reduce(
        (a, b) => a.add(b),
        numbers_1.decimal(0)
    );
    // Calculate amount in without fee.
    const newBalanceTokenIndex = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        balances,
        amplificationParameter,
        newInvariant,
        tokenIndex
    );
    const amountInWithoutFee = newBalanceTokenIndex.sub(balances[tokenIndex]);
    // We can now compute how much extra balance is being deposited and used in virtual swaps, and charge swap fees
    // accordingly.
    const currentWeight = balances[tokenIndex].div(sumBalances);
    const taxablePercentage = currentWeight.gt(1)
        ? 0
        : numbers_1.decimal(1).sub(currentWeight);
    const taxableAmount = amountInWithoutFee.mul(taxablePercentage);
    const nonTaxableAmount = amountInWithoutFee.sub(taxableAmount);
    const bptOut = nonTaxableAmount.add(
        taxableAmount.div(
            numbers_1.decimal(1).sub(numbers_1.fromFp(fpSwapFeePercentage))
        )
    );
    return numbers_1.fp(bptOut);
}
exports._tokenInForExactBPTOut = _tokenInForExactBPTOut;
// export function calcBptInGivenExactTokensOut(
function _bptInForExactTokensOut(
    fpBalances,
    amplificationParameter,
    fpAmountsOut,
    fpBptTotalSupply,
    fpSwapFeePercentage
) {
    // Get current invariant
    const currentInvariant = numbers_1.fromFp(
        calculateInvariant(fpBalances, amplificationParameter)
    );
    const balances = fpBalances.map(numbers_1.fromFp);
    const amountsOut = fpAmountsOut.map(numbers_1.fromFp);
    // First calculate the sum of all token balances which will be used to calculate
    // the current weight of token
    const sumBalances = balances.reduce(
        (a, b) => a.add(b),
        numbers_1.decimal(0)
    );
    // Calculate the weighted balance ratio without considering fees
    const balanceRatiosWithoutFee = [];
    let invariantRatioWithoutFees = numbers_1.decimal(0);
    for (let i = 0; i < balances.length; i++) {
        const currentWeight = balances[i].div(sumBalances);
        balanceRatiosWithoutFee[i] = balances[i]
            .sub(amountsOut[i])
            .div(balances[i]);
        invariantRatioWithoutFees = invariantRatioWithoutFees.add(
            balanceRatiosWithoutFee[i].mul(currentWeight)
        );
    }
    // Second loop to calculate new amounts in taking into account the fee on the % excess
    for (let i = 0; i < balances.length; i++) {
        // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it to
        // 'token out'. This results in slightly larger price impact.
        let amountOutWithFee;
        if (invariantRatioWithoutFees > balanceRatiosWithoutFee[i]) {
            const invariantRatioComplement = invariantRatioWithoutFees.gt(1)
                ? numbers_1.decimal(0)
                : numbers_1.decimal(1).sub(invariantRatioWithoutFees);
            const nonTaxableAmount = balances[i].mul(invariantRatioComplement);
            const taxableAmount = amountsOut[i].sub(nonTaxableAmount);
            amountOutWithFee = nonTaxableAmount.add(
                taxableAmount.div(
                    numbers_1
                        .decimal(1)
                        .sub(numbers_1.fromFp(fpSwapFeePercentage))
                )
            );
        } else {
            amountOutWithFee = amountsOut[i];
        }
        balances[i] = balances[i].sub(amountOutWithFee);
    }
    // get new invariant taking into account swap fees
    const newInvariant = numbers_1.fromFp(
        calculateInvariant(balances.map(numbers_1.fp), amplificationParameter)
    );
    // return amountBPTIn
    const invariantRatio = newInvariant.div(currentInvariant);
    const invariantRatioComplement = invariantRatio.lt(1)
        ? numbers_1.decimal(1).sub(invariantRatio)
        : numbers_1.decimal(0);
    return numbers_1.fp(
        numbers_1.fromFp(fpBptTotalSupply).mul(invariantRatioComplement)
    );
}
exports._bptInForExactTokensOut = _bptInForExactTokensOut;
// export function calcTokenOutGivenExactBptIn(
function _exactBPTInForTokenOut(
    tokenIndex,
    fpBalances,
    amplificationParameter,
    fpBptAmountIn,
    fpBptTotalSupply,
    fpSwapFeePercentage
) {
    // Get current invariant
    const fpCurrentInvariant = numbers_1.bn(
        calculateInvariant(fpBalances, amplificationParameter)
    );
    // Calculate new invariant
    const newInvariant = numbers_1
        .fromFp(numbers_1.bn(fpBptTotalSupply).minus(fpBptAmountIn))
        .div(numbers_1.fromFp(fpBptTotalSupply))
        .mul(numbers_1.fromFp(fpCurrentInvariant));
    // First calculate the sum of all token balances which will be used to calculate
    // the current weight of token
    const balances = fpBalances.map(numbers_1.fromFp);
    const sumBalances = balances.reduce(
        (a, b) => a.add(b),
        numbers_1.decimal(0)
    );
    // get amountOutBeforeFee
    const newBalanceTokenIndex = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        balances,
        amplificationParameter,
        newInvariant,
        tokenIndex
    );
    const amountOutWithoutFee = balances[tokenIndex].sub(newBalanceTokenIndex);
    // We can now compute how much excess balance is being withdrawn as a result of the virtual swaps, which result
    // in swap fees.
    const currentWeight = balances[tokenIndex].div(sumBalances);
    const taxablePercentage = currentWeight.gt(1)
        ? numbers_1.decimal(0)
        : numbers_1.decimal(1).sub(currentWeight);
    // Swap fees are typically charged on 'token in', but there is no 'token in' here, so we apply it
    // to 'token out'. This results in slightly larger price impact. Fees are rounded up.
    const taxableAmount = amountOutWithoutFee.mul(taxablePercentage);
    const nonTaxableAmount = amountOutWithoutFee.sub(taxableAmount);
    const tokenOut = nonTaxableAmount.add(
        taxableAmount.mul(
            numbers_1.decimal(1).sub(numbers_1.fromFp(fpSwapFeePercentage))
        )
    );
    return new bignumber_1.BigNumber(numbers_1.fp(tokenOut).toString());
}
exports._exactBPTInForTokenOut = _exactBPTInForTokenOut;
// export function calcTokensOutGivenExactBptIn(
function _exactBPTInForTokensOut(fpBalances, fpBptAmountIn, fpBptTotalSupply) {
    const balances = fpBalances.map(numbers_1.fromFp);
    const bptRatio = numbers_1
        .fromFp(fpBptAmountIn)
        .div(numbers_1.fromFp(fpBptTotalSupply));
    const amountsOut = balances.map(balance => balance.mul(bptRatio));
    return amountsOut.map(numbers_1.fp);
}
exports._exactBPTInForTokensOut = _exactBPTInForTokensOut;
function calculateOneTokenSwapFeeAmount(
    fpBalances,
    amplificationParameter,
    lastInvariant,
    tokenIndex
) {
    const balances = fpBalances.map(numbers_1.fromFp);
    const finalBalanceFeeToken = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        balances,
        numbers_1.decimal(amplificationParameter),
        numbers_1.fromFp(lastInvariant),
        tokenIndex
    );
    if (finalBalanceFeeToken.gt(balances[tokenIndex])) {
        return numbers_1.decimal(0);
    }
    return numbers_1.toFp(balances[tokenIndex].sub(finalBalanceFeeToken));
}
exports.calculateOneTokenSwapFeeAmount = calculateOneTokenSwapFeeAmount;
function getTokenBalanceGivenInvariantAndAllOtherBalances(
    amp,
    fpBalances,
    fpInvariant,
    tokenIndex
) {
    const invariant = numbers_1.fromFp(fpInvariant);
    const balances = fpBalances.map(numbers_1.fromFp);
    return numbers_1.fp(
        _getTokenBalanceGivenInvariantAndAllOtherBalances(
            balances,
            numbers_1.decimal(amp),
            invariant,
            tokenIndex
        )
    );
}
exports.getTokenBalanceGivenInvariantAndAllOtherBalances = getTokenBalanceGivenInvariantAndAllOtherBalances;
function _getTokenBalanceGivenInvariantAndAllOtherBalances(
    balances,
    amplificationParameter,
    invariant,
    tokenIndex
) {
    let sum = numbers_1.decimal(0);
    let mul = numbers_1.decimal(1);
    const numTokens = balances.length;
    for (let i = 0; i < numTokens; i++) {
        if (i != tokenIndex) {
            sum = sum.add(balances[i]);
            mul = mul.mul(balances[i]);
        }
    }
    // const a = 1;
    amplificationParameter = numbers_1.decimal(amplificationParameter);
    const b = invariant
        .div(amplificationParameter.mul(numTokens))
        .add(sum)
        .sub(invariant);
    const c = invariant
        .pow(numTokens + 1)
        .mul(-1)
        .div(
            amplificationParameter.mul(
                numbers_1
                    .decimal(numTokens)
                    .pow(numTokens + 1)
                    .mul(mul)
            )
        );
    return b
        .mul(-1)
        .add(
            b
                .pow(2)
                .sub(c.mul(4))
                .squareRoot()
        )
        .div(2);
}
