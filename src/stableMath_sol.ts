import { BigNumber } from './utils/bignumber';
import { bnum } from './bmath';
// All functions are adapted from the solidity ones to be found on:
// https://github.com/balancer-labs/balancer-core-v2/blob/master/contracts/pools/stable/StableMath.sol

// TODO: implement all up and down rounding variations

/**********************************************************************************************
    // invariant                                                                                 //
    // D = invariant to compute                                                                  //
    // A = amplifier                n * D^2 + A * n^n * S * (n^n * P / D^(n−1))                  //
    // S = sum of balances         ____________________________________________                  //
    // P = product of balances    (n+1) * D + ( A * n^n − 1)* (n^n * P / D^(n−1))                //
    // n = number of tokens                                                                      //
    **********************************************************************************************/
export function _invariant(
    amp: BigNumber, // amp
    balances: BigNumber[] // balances
): BigNumber {
    let sum = bnum(0);
    let totalCoins = balances.length;
    for (let i = 0; i < totalCoins; i++) {
        sum = sum.plus(balances[i]);
    }
    if (sum.isZero()) {
        return bnum(0);
    }
    let prevInv = bnum(0);
    let inv = sum;
    let ampTimesNpowN = amp.times(totalCoins ** totalCoins); // A*n^n

    for (let i = 0; i < 255; i++) {
        let P_D = bnum(totalCoins).times(balances[0]);
        for (let j = 1; j < totalCoins; j++) {
            //P_D is rounded up
            P_D = P_D.times(balances[j])
                .times(totalCoins)
                .div(inv);
        }
        prevInv = inv;
        //inv is rounded up
        inv = bnum(totalCoins)
            .times(inv)
            .times(inv)
            .plus(ampTimesNpowN.times(sum).times(P_D))
            .div(
                bnum(totalCoins + 1)
                    .times(inv)
                    .plus(ampTimesNpowN.minus(1).times(P_D))
            );
        // Equality with the precision of 1
        if (inv.gt(prevInv)) {
            if (inv.minus(prevInv).lt(bnum(10 ** -18))) {
                break;
            }
        } else if (prevInv.minus(inv).lt(bnum(10 ** -18))) {
            break;
        }
    }
    //Result is rounded up
    return inv;
}

// // This function has to be zero if the invariant D was calculated correctly
// // It was only used for double checking that the invariant was correct
// export function _invariantValueFunction(
//     amp: BigNumber, // amp
//     balances: BigNumber[], // balances
//     D: BigNumber
// ): BigNumber {
//     let invariantValueFunction;
//     let prod = bnum(1);
//     let sum = bnum(0);
//     for (let i = 0; i < balances.length; i++) {
//         prod = prod.times(balances[i]);
//         sum = sum.plus(balances[i]);
//     }
//     let n = bnum(balances.length);

//     // NOT! working based on Daniel's equation: https://www.notion.so/Analytical-for-2-tokens-1cd46debef6648dd81f2d75bae941fea
//     // invariantValueFunction = amp.times(sum)
//     //     .plus((bnum(1).div(n.pow(n)).minus(amp)).times(D))
//     //     .minus((bnum(1).div(n.pow(n.times(2)).times(prod))).times(D.pow(n.plus(bnum(1)))));
//     invariantValueFunction = D.pow(n.plus(bnum(1)))
//         .div(n.pow(n).times(prod))
//         .plus(D.times(amp.times(n.pow(n)).minus(bnum(1))))
//         .minus(amp.times(n.pow(n)).times(sum));

//     return invariantValueFunction;
// }

// Adapted from StableMath.sol
// * Added swap fee at very first line
/**********************************************************************************************
    // outGivenIn token x for y - polynomial equation to solve                                   //
    // ay = amount out to calculate                                                              //
    // by = balance token out                                                                    //
    // y = by - ay                                                                               //
    // D = invariant                               D                     D^(n+1)                 //
    // A = amplifier               y^2 + ( S - ----------  - 1) * y -  ------------- = 0         //
    // n = number of tokens                    (A * n^n)               A * n^2n * P              //
    // S = sum of final balances but y                                                           //
    // P = product of final balances but y                                                       //
    **********************************************************************************************/
export function _outGivenIn(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    tokenAmountIn = tokenAmountIn.times(bnum(1).minus(swapFee));

    //Invariant is rounded up
    let inv = _invariant(amp, balances);
    let p = inv;
    let sum = bnum(0);
    let totalCoins = bnum(balances.length);
    let n_pow_n = bnum(1);
    let x = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        n_pow_n = n_pow_n.times(totalCoins);

        if (i == tokenIndexIn) {
            x = balances[i].plus(tokenAmountIn);
        } else if (i != tokenIndexOut) {
            x = balances[i];
        } else {
            continue;
        }
        sum = sum.plus(x);
        //Round up p
        p = p.times(inv).div(x);
    }

    //Calculate out balance
    let y = _solveAnalyticalBalance(sum, inv, amp, n_pow_n, p);

    //Result is rounded down
    // return balances[tokenIndexOut] > y ? balances[tokenIndexOut].minus(y) : 0;
    return balances[tokenIndexOut].minus(y);
}

// Adapted from StableMath.sol
// * Added swap fee at very last line
/**********************************************************************************************
    // inGivenOut token x for y - polynomial equation to solve                                   //
    // ax = amount in to calculate                                                               //
    // bx = balance token in                                                                     //
    // x = bx + ax                                                                               //
    // D = invariant                               D                     D^(n+1)                 //
    // A = amplifier               x^2 + ( S - ----------  - 1) * x -  ------------- = 0         //
    // n = number of tokens                    (A * n^n)               A * n^2n * P              //
    // S = sum of final balances but x                                                           //
    // P = product of final balances but x                                                       //
    **********************************************************************************************/
export function _inGivenOut(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    //Invariant is rounded up
    let inv = _invariant(amp, balances);
    let p = inv;
    let sum = bnum(0);
    let totalCoins = bnum(balances.length);
    let n_pow_n = bnum(1);
    let x = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        n_pow_n = n_pow_n.times(totalCoins);

        if (i == tokenIndexOut) {
            x = balances[i].minus(tokenAmountOut);
        } else if (i != tokenIndexIn) {
            x = balances[i];
        } else {
            continue;
        }
        sum = sum.plus(x);
        //Round up p
        p = p.times(inv).div(x);
    }

    //Calculate in balance
    let y = _solveAnalyticalBalance(sum, inv, amp, n_pow_n, p);

    //Result is rounded up
    return y.minus(balances[tokenIndexIn]).div(bnum(1).minus(swapFee));
}

//This function calculates the balance of a given token (tokenIndex)
// given all the other balances and the invariant
function _getTokenBalanceGivenInvariantAndAllOtherBalances(
    amp: BigNumber,
    balances: BigNumber[],
    inv: BigNumber,
    tokenIndex: number
): BigNumber {
    let p = inv;
    let sum = bnum(0);
    let totalCoins = balances.length;
    let nPowN = bnum(1);
    let x = bnum(0);
    for (let i = 0; i < totalCoins; i++) {
        nPowN = nPowN.times(totalCoins);
        if (i != tokenIndex) {
            x = balances[i];
        } else {
            continue;
        }
        sum = sum.plus(x);
        //Round up p
        p = p.times(inv).div(x);
    }

    // Calculate token balance
    return _solveAnalyticalBalance(sum, inv, amp, nPowN, p);
}

//This function calcuates the analytical solution to find the balance required
export function _solveAnalyticalBalance(
    sum: BigNumber,
    inv: BigNumber,
    amp: BigNumber,
    n_pow_n: BigNumber,
    p: BigNumber
): BigNumber {
    //Round up p
    p = p.times(inv).div(amp.times(n_pow_n).times(n_pow_n));
    //Round down b
    let b = sum.plus(inv.div(amp.times(n_pow_n)));
    //Round up c
    // let c = inv >= b
    //     ? inv.minus(b).plus(Math.sqrtUp(inv.minus(b).times(inv.minus(b)).plus(p.times(4))))
    //     : Math.sqrtUp(b.minus(inv).times(b.minus(inv)).plus(p.times(4))).minus(b.minus(inv));
    let c;
    if (inv.gte(b)) {
        c = inv.minus(b).plus(
            inv
                .minus(b)
                .times(inv.minus(b))
                .plus(p.times(4))
                .sqrt()
        );
    } else {
        c = b
            .minus(inv)
            .times(b.minus(inv))
            .plus(p.times(4))
            .sqrt()
            .minus(b.minus(inv));
    }
    //Round up y
    return c.div(2);
}

/* 
Adapted from StableMath.sol _exactTokensInForBPTOut() 
    * renamed it to _exactTokenInForBPTOut (i.e. just one token in)
*/
function _exactTokenInForBPTOut(
    amp: BigNumber,
    balances: BigNumber[],
    bptTotalSupply: BigNumber,
    tokenIndexIn: number,
    tokenAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    // Get current invariant
    let currentInvariant = _invariant(amp, balances);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weights of each token relative to the sum of all balances
    let sumBalances = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }

    // Calculate the weighted balance ratio without considering fees
    let currentWeight = balances[tokenIndexIn].div(sumBalances);
    let tokenBalanceRatioWithoutFee = balances[tokenIndexIn]
        .plus(tokenAmountIn)
        .div(balances[tokenIndexIn]);
    let weightedBalanceRatio = tokenBalanceRatioWithoutFee.times(currentWeight);

    // calculate new amountIn taking into account the fee on the % excess
    // Percentage of the amount supplied that will be implicitly swapped for other tokens in the pool
    let tokenBalancePercentageExcess = tokenBalanceRatioWithoutFee
        .minus(weightedBalanceRatio)
        .div(tokenBalanceRatioWithoutFee.minus(bnum(1)));

    let amountInAfterFee = tokenAmountIn.times(
        bnum(1).minus(swapFee.times(tokenBalancePercentageExcess))
    );
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(amountInAfterFee);

    // get new invariant taking into account swap fees
    let newInvariant = _invariant(amp, balances);

    // return amountBPTOut
    return bptTotalSupply.times(
        newInvariant.div(currentInvariant).minus(bnum(1))
    );
}

/* 
Flow of calculations:
amountBPTOut -> newInvariant -> (amountInProportional, amountInAfterFee) ->
amountInPercentageExcess -> amountIn
*/
function _tokenInForExactBPTOut(
    amp: BigNumber,
    balances: BigNumber[],
    bptTotalSupply: BigNumber,
    tokenIndexIn: number,
    bptAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /**********************************************************************************************
    // TODO description                            //
    **********************************************************************************************/

    // Calculate new invariant
    let newInvariant = bptTotalSupply.plus(bptAmountOut).div(bptTotalSupply);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weight of token
    let sumBalances = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }

    // get amountInAfterFee
    let newBalanceTokenIndex = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        amp,
        balances,
        newInvariant,
        tokenIndexIn
    );
    let amountInAfterFee = newBalanceTokenIndex.minus(balances[tokenIndexIn]);

    // Get tokenBalancePercentageExcess
    let currentWeight = balances[tokenIndexIn].div(sumBalances);
    let tokenBalancePercentageExcess = bnum(1).minus(currentWeight);

    // return amountIn
    return amountInAfterFee.div(
        bnum(1).minus(tokenBalancePercentageExcess.times(swapFee))
    );
}

/* 
Adapted from StableMath.sol _BPTInForExactTokensOut() to reduce it to 
_BPTInForExactTokenOut (i.e. just one token out)
*/
function _BPTInForExactTokenOut(
    amp: BigNumber,
    balances: BigNumber[],
    bptTotalSupply: BigNumber,
    tokenIndexOut: number,
    tokenAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    // Get current invariant
    let currentInvariant = _invariant(amp, balances);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weights of each token relative to the sum of all balances
    let sumBalances = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }

    // Calculate the weighted balance ratio without considering fees
    let currentWeight = balances[tokenIndexOut].div(sumBalances);
    let tokenBalanceRatioWithoutFee = balances[tokenIndexOut]
        .minus(tokenAmountOut)
        .div(balances[tokenIndexOut]);
    let weightedBalanceRatio = tokenBalanceRatioWithoutFee.times(currentWeight);

    // calculate new amounts in taking into account the fee on the % excess
    let tokenBalancePercentageExcess = weightedBalanceRatio
        .minus(tokenBalanceRatioWithoutFee)
        .div(bnum(1).minus(tokenBalanceRatioWithoutFee));

    let amountOutBeforeFee = tokenAmountOut.div(
        bnum(1).minus(swapFee.times(tokenBalancePercentageExcess))
    );
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(amountOutBeforeFee);

    // get new invariant taking into account swap fees
    let newInvariant = _invariant(amp, balances);

    // return amountBPTIn
    return bptTotalSupply.times(
        bnum(1).minus(newInvariant.div(currentInvariant))
    );
}

/* 
Flow of calculations:
amountBPTin -> newInvariant -> (amountOutProportional, amountOutBeforeFee) ->
amountOutPercentageExcess -> amountOut
*/
function _exactBPTInForTokenOut(
    amp: BigNumber,
    balances: BigNumber[],
    bptTotalSupply: BigNumber,
    tokenIndexOut: number,
    bptAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /**********************************************************************************************
    // TODO description                            //
    **********************************************************************************************/

    // Get current invariant
    let currentInvariant = _invariant(amp, balances);
    // Calculate new invariant
    let newInvariant = bptTotalSupply.minus(bptAmountIn).div(bptTotalSupply);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weight of token
    let sumBalances = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }

    // get amountOutBeforeFee
    let newBalanceTokenIndex = _getTokenBalanceGivenInvariantAndAllOtherBalances(
        amp,
        balances,
        newInvariant,
        tokenIndexOut
    );
    let amountOutBeforeFee = balances[tokenIndexOut].minus(
        newBalanceTokenIndex
    );

    // Calculate tokenBalancePercentageExcess
    let currentWeight = balances[tokenIndexOut].div(sumBalances);
    let tokenBalancePercentageExcess = bnum(1).minus(currentWeight);

    // return amountOut
    return amountOutBeforeFee.times(
        bnum(1).minus(tokenBalancePercentageExcess.times(swapFee))
    );
}

//////////////////////
////  These functions have been added exclusively for the SORv2
//////////////////////

export function _derivative(f: Function, input: any): BigNumber {
    let amp = input.amp;
    let balances = input.balances;
    let tokenIndexIn = input.tokenIndexIn;
    let tokenIndexOut = input.tokenIndexOut;
    let amount = input.amount;
    let swapFee = input.swapFee;

    let delta = amount.times(0.0001);
    let prevDerivative = bnum(0);
    let derivative = bnum(0);
    let amountIn = f(
        amp,
        balances,
        tokenIndexIn,
        tokenIndexOut,
        amount,
        swapFee
    );
    for (let i = 0; i < 255; i++) {
        let amountInDelta = f(
            amp,
            balances,
            tokenIndexIn,
            tokenIndexOut,
            amount.plus(delta),
            swapFee
        );
        derivative = amountInDelta.minus(amountIn).div(delta);
        // Break if precision reached
        if (derivative.gt(prevDerivative)) {
            if (
                derivative
                    .minus(prevDerivative)
                    .div(derivative)
                    .lt(bnum(10 ** -10))
            ) {
                break;
            }
        } else if (
            prevDerivative
                .minus(derivative)
                .div(derivative)
                .lt(bnum(10 ** -10))
        ) {
            break;
        }
        prevDerivative = derivative;
        delta = delta.div(bnum(2));
    }
    return derivative;
}

/////////
/// SpotPriceAfterSwap
/////////

// PairType = 'token-token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapOutGivenIn(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: tokenAmountIn,
        swapFee: swapFee,
    };
    return bnum(1).div(_derivative(_outGivenIn, input));
}

// PairType = 'token-token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapInGivenOut(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: tokenAmountOut,
        swapFee: swapFee,
    };
    return _derivative(_inGivenOut, input);
}

// PairType = 'token-BPT'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapBptOutGivenTokenIn(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: tokenAmountIn,
        swapFee: swapFee,
    };
    return bnum(1).div(_derivative(_exactTokenInForBPTOut, input));
}

// PairType = 'token-BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInGivenBptOut(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    bptAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: bptAmountOut,
        swapFee: swapFee,
    };
    return _derivative(_tokenInForExactBPTOut, input);
}

// PairType = 'BPT-token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapTokenOutGivenBptIn(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    bptAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: bptAmountIn,
        swapFee: swapFee,
    };
    return bnum(1).div(_derivative(_exactBPTInForTokenOut, input));
}

// PairType = 'BPT-token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapBptInGivenTokenOut(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: tokenAmountOut,
        swapFee: swapFee,
    };
    return _derivative(_BPTInForExactTokenOut, input);
}

/////////
///  Derivatives of spotPriceAfterSwap
/////////

// PairType = 'token-token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapOutGivenIn(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: tokenAmountIn,
        swapFee: swapFee,
    };
    return _derivative(_spotPriceAfterSwapOutGivenIn, input);
}

// PairType = 'token-token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapInGivenOut(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: tokenAmountOut,
        swapFee: swapFee,
    };
    return _derivative(_spotPriceAfterSwapInGivenOut, input);
}

// PairType = 'token-BPT'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapBptOutGivenTokenIn(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: tokenAmountIn,
        swapFee: swapFee,
    };
    return _derivative(_spotPriceAfterSwapBptOutGivenTokenIn, input);
}

// PairType = 'token-BPT'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInGivenBptOut(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    bptAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: bptAmountOut,
        swapFee: swapFee,
    };
    return _derivative(_spotPriceAfterSwapTokenInGivenBptOut, input);
}

// PairType = 'BPT-token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapTokenOutGivenBptIn(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    bptAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: bptAmountIn,
        swapFee: swapFee,
    };
    return _derivative(_spotPriceAfterSwapTokenOutGivenBptIn, input);
}

// PairType = 'BPT-token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapBptInGivenTokenOut(
    amp: BigNumber,
    balances: BigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    tokenAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let input = {
        amp: amp,
        balances: balances,
        tokenIndexIn: tokenIndexIn,
        tokenIndexOut: tokenIndexOut,
        amount: tokenAmountOut,
        swapFee: swapFee,
    };
    return _derivative(_spotPriceAfterSwapBptInGivenTokenOut, input);
}
