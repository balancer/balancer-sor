import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { WeiPerEther as EONE } from '@ethersproject/constants';
import {
    BigNumber as OldBigNumber,
    bnum,
    ZERO,
    ONE,
} from '../../utils/bignumber';
import { StablePoolPairData } from './stablePool';
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
    balances: OldBigNumber[] // balances
): OldBigNumber {
    let sum = ZERO;
    const totalCoins = balances.length;
    for (let i = 0; i < totalCoins; i++) {
        sum = sum.plus(balances[i]);
    }
    if (sum.isZero()) {
        return ZERO;
    }
    let prevInv = ZERO;
    let inv = sum;

    // amp is passed as an ethers bignumber while maths uses bignumber.js
    const ampAdjusted = bnum(formatFixed(amp, 3));
    const ampTimesNpowN = ampAdjusted.times(totalCoins ** totalCoins); // A*n^n

    for (let i = 0; i < 255; i++) {
        let P_D = bnum(totalCoins).times(balances[0]);
        for (let j = 1; j < totalCoins; j++) {
            //P_D is rounded up
            P_D = P_D.times(balances[j]).times(totalCoins).div(inv);
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
//     let prod = ONE;
//     let sum = ZERO;
//     for (let i = 0; i < balances.length; i++) {
//         prod = prod.times(balances[i]);
//         sum = sum.plus(balances[i]);
//     }
//     let n = bnum(balances.length);

//     // NOT! working based on Daniel's equation: https://www.notion.so/Analytical-for-2-tokens-1cd46debef6648dd81f2d75bae941fea
//     // invariantValueFunction = amp.times(sum)
//     //     .plus((ONE.div(n.pow(n)).minus(amp)).times(D))
//     //     .minus((ONE.div(n.pow(n.times(2)).times(prod))).times(D.pow(n.plus(ONE))));
//     invariantValueFunction = D.pow(n.plus(ONE))
//         .div(n.pow(n).times(prod))
//         .plus(D.times(amp.times(n.pow(n)).minus(ONE)))
//         .minus(amp.times(n.pow(n)).times(sum));

//     return invariantValueFunction;
// }

// Adapted from StableMath.sol, _outGivenIn()
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
export function _exactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: StablePoolPairData
): OldBigNumber {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero()) return amount;
    const { amp, allBalances, tokenIndexIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    let tokenAmountIn = amount;
    tokenAmountIn = tokenAmountIn
        .times(EONE.sub(swapFee).toString())
        .div(EONE.toString());

    //Invariant is rounded up
    const inv = _invariant(amp, balances);
    let p = inv;
    let sum = ZERO;
    const totalCoins = bnum(balances.length);
    let n_pow_n = ONE;
    let x = ZERO;
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
    const y = _solveAnalyticalBalance(sum, inv, amp, n_pow_n, p);

    //Result is rounded down
    // return balances[tokenIndexOut] > y ? balances[tokenIndexOut].minus(y) : 0;
    return balances[tokenIndexOut].minus(y);
}

// Adapted from StableMath.sol, _inGivenOut()
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
export function _tokenInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: StablePoolPairData
): OldBigNumber {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero()) return amount;
    const { amp, allBalances, tokenIndexIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const tokenAmountOut = amount;
    //Invariant is rounded up
    const inv = _invariant(amp, balances);
    let p = inv;
    let sum = ZERO;
    const totalCoins = bnum(balances.length);
    let n_pow_n = ONE;
    let x = ZERO;
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
    const y = _solveAnalyticalBalance(sum, inv, amp, n_pow_n, p);

    //Result is rounded up
    return y
        .minus(balances[tokenIndexIn])
        .multipliedBy(EONE.toString())
        .div(EONE.sub(swapFee).toString());
}

/*
Flow of calculations:
amountBPTOut -> newInvariant -> (amountInProportional, amountInAfterFee) ->
amountInPercentageExcess -> amountIn
*/
export function _tokenInForExactBPTOut(
    amount: OldBigNumber,
    poolPairData: StablePoolPairData
): OldBigNumber {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero()) return amount;
    const { amp, allBalances, tokenIndexIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const bptAmountOut = amount;

    /**********************************************************************************************
    // TODO description                            //
    **********************************************************************************************/

    // Get current invariant
    const currentInvariant = _invariant(amp, balances);
    // Calculate new invariant
    const newInvariant = allBalances[tokenIndexOut]
        .plus(bptAmountOut)
        .div(allBalances[tokenIndexOut])
        .times(currentInvariant);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weight of token
    let sumBalances = ZERO;
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }

    // get amountInAfterFee
    const newBalanceTokenIndex =
        _getTokenBalanceGivenInvariantAndAllOtherBalances(
            amp,
            balances,
            newInvariant,
            tokenIndexIn
        );
    const amountInAfterFee = newBalanceTokenIndex.minus(balances[tokenIndexIn]);

    // Get tokenBalancePercentageExcess
    const currentWeight = balances[tokenIndexIn].div(sumBalances);
    const tokenBalancePercentageExcess = ONE.minus(currentWeight);

    // return amountIn
    return amountInAfterFee.div(
        ONE.minus(
            tokenBalancePercentageExcess
                .times(swapFee.toString())
                .div(EONE.toString())
        )
    );
}

//This function calculates the balance of a given token (tokenIndex)
// given all the other balances and the invariant
function _getTokenBalanceGivenInvariantAndAllOtherBalances(
    amp: BigNumber,
    balances: OldBigNumber[],
    inv: OldBigNumber,
    tokenIndex: number
): OldBigNumber {
    let p = inv;
    let sum = ZERO;
    const totalCoins = balances.length;
    let nPowN = ONE;
    let x = ZERO;
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
    sum: OldBigNumber,
    inv: OldBigNumber,
    amp: BigNumber,
    n_pow_n: OldBigNumber,
    p: OldBigNumber
): OldBigNumber {
    // amp is passed as an ethers bignumber while maths uses bignumber.js
    const oldBN_amp = bnum(formatFixed(amp, 3));
    //Round up p
    p = p.times(inv).div(oldBN_amp.times(n_pow_n).times(n_pow_n));
    //Round down b
    const b = sum.plus(inv.div(oldBN_amp.times(n_pow_n)));
    //Round up c
    // let c = inv >= b
    //     ? inv.minus(b).plus(Math.sqrtUp(inv.minus(b).times(inv.minus(b)).plus(p.times(4))))
    //     : Math.sqrtUp(b.minus(inv).times(b.minus(inv)).plus(p.times(4))).minus(b.minus(inv));
    let c;
    if (inv.gte(b)) {
        c = inv
            .minus(b)
            .plus(inv.minus(b).times(inv.minus(b)).plus(p.times(4)).sqrt());
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

//////////////////////
////  These functions have been added exclusively for the SORv2
//////////////////////

export function _poolDerivatives(
    amp: BigNumber,
    balances: OldBigNumber[],
    tokenIndexIn: number,
    tokenIndexOut: number,
    is_first_derivative: boolean,
    wrt_out: boolean
): OldBigNumber {
    const totalCoins = balances.length;
    const D = _invariant(amp, balances);
    let S = ZERO;
    for (let i = 0; i < totalCoins; i++) {
        if (i != tokenIndexIn && i != tokenIndexOut) {
            S = S.plus(balances[i]);
        }
    }
    const x = balances[tokenIndexIn];
    const y = balances[tokenIndexOut];
    // amp is passed as an ethers bignumber while maths uses bignumber.js
    const ampAdjusted = bnum(formatFixed(amp, 3));
    const a = ampAdjusted.times(totalCoins ** totalCoins); // = ampTimesNpowN
    const b = S.minus(D).times(a).plus(D);
    const twoaxy = bnum(2).times(a).times(x).times(y);
    const partial_x = twoaxy.plus(a.times(y).times(y)).plus(b.times(y));
    const partial_y = twoaxy.plus(a.times(x).times(x)).plus(b.times(x));
    let ans;
    if (is_first_derivative) {
        ans = partial_x.div(partial_y);
    } else {
        const partial_xx = bnum(2).times(a).times(y);
        const partial_yy = bnum(2).times(a).times(x);
        const partial_xy = partial_xx.plus(partial_yy).plus(b);
        const numerator = bnum(2)
            .times(partial_x)
            .times(partial_y)
            .times(partial_xy)
            .minus(partial_xx.times(partial_y.pow(2)))
            .minus(partial_yy.times(partial_x.pow(2)));
        const denominator = partial_x.pow(2).times(partial_y);
        ans = numerator.div(denominator);
        if (wrt_out) {
            ans = ans.times(partial_y).div(partial_x);
        }
    }
    return ans;
}

/////////
/// SpotPriceAfterSwap
/////////

export function _poolDerivativesBPT(
    amp: BigNumber,
    balances: OldBigNumber[],
    bptSupply: OldBigNumber,
    tokenIndexIn: number,
    is_first_derivative: boolean,
    is_BPT_out: boolean,
    wrt_out: boolean
): OldBigNumber {
    const totalCoins = balances.length;
    const D = _invariant(amp, balances);
    let S = ZERO;
    let D_P = D.div(totalCoins);
    for (let i = 0; i < totalCoins; i++) {
        if (i != tokenIndexIn) {
            S = S.plus(balances[i]);
            D_P = D_P.times(D).div(balances[i].times(totalCoins));
        }
    }
    const x = balances[tokenIndexIn];
    // amp is passed as an ethers bignumber while maths uses bignumber.js
    const ampAdjusted = bnum(formatFixed(amp, 3));
    const alpha = ampAdjusted.times(totalCoins ** totalCoins); // = ampTimesNpowN
    const beta = alpha.times(S);
    const gamma = ONE.minus(alpha);
    const partial_x = bnum(2)
        .times(alpha)
        .times(x)
        .plus(beta)
        .plus(gamma.times(D));
    const minus_partial_D = D_P.times(totalCoins + 1).minus(gamma.times(x));
    const partial_D = ZERO.minus(minus_partial_D);
    let ans;
    if (is_first_derivative) {
        ans = partial_x.div(minus_partial_D).times(bptSupply).div(D);
    } else {
        const partial_xx = bnum(2).times(alpha);
        const partial_xD = gamma;
        const n_times_nplusone = totalCoins * (totalCoins + 1);
        const partial_DD = ZERO.minus(D_P.times(n_times_nplusone).div(D));
        if (is_BPT_out) {
            const term1 = partial_xx.times(partial_D).div(partial_x.pow(2));
            const term2 = bnum(2).times(partial_xD).div(partial_x);
            const term3 = partial_DD.div(partial_D);
            ans = term1.minus(term2).plus(term3).times(D).div(bptSupply);
            if (wrt_out) {
                const D_prime = ZERO.minus(partial_x.div(partial_D));
                ans = ans.div(D_prime).times(D).div(bptSupply);
            }
        } else {
            ans = bnum(2)
                .times(partial_xD)
                .div(partial_D)
                .minus(partial_DD.times(partial_x).div(partial_D.pow(2)))
                .minus(partial_xx.div(partial_x));
            if (wrt_out) {
                ans = ans
                    .times(partial_x)
                    .div(minus_partial_D)
                    .times(bptSupply)
                    .div(D);
            }
        }
    }
    return ans;
}

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: StablePoolPairData
): OldBigNumber {
    const { amp, allBalances, tokenIndexIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(
        amount.times(EONE.sub(swapFee).toString()).div(EONE.toString())
    );
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(
        _exactTokenInForTokenOut(amount, poolPairData)
    );
    let ans = _poolDerivatives(
        amp,
        balances,
        tokenIndexIn,
        tokenIndexOut,
        true,
        false
    );
    ans = ONE.div(ans.times(EONE.sub(swapFee).toString()).div(EONE.toString()));
    return ans;
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: StablePoolPairData
): OldBigNumber {
    const { amp, allBalances, tokenIndexIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const _in = _tokenInForExactTokenOut(amount, poolPairData)
        .times(EONE.sub(swapFee).toString())
        .div(EONE.toString());
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(_in);
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(amount);
    let ans = _poolDerivatives(
        amp,
        balances,
        tokenIndexIn,
        tokenIndexOut,
        true,
        true
    );
    ans = ONE.div(ans.times(EONE.sub(swapFee).toString()).div(EONE.toString()));
    return ans;
}

function _feeFactor(
    balances: OldBigNumber[],
    tokenIndex: number,
    swapFee: BigNumber
): OldBigNumber {
    let sumBalances = ZERO;
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }
    const currentWeight = balances[tokenIndex].div(sumBalances);
    const tokenBalancePercentageExcess = ONE.minus(currentWeight);
    return ONE.minus(
        tokenBalancePercentageExcess
            .times(swapFee.toString())
            .div(EONE.toString())
    );
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactBPTOut(
    amount: OldBigNumber,
    poolPairData: StablePoolPairData
): OldBigNumber {
    const { amp, allBalances, balanceOut, tokenIndexIn, decimalsOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const _in = _tokenInForExactBPTOut(amount, poolPairData);
    const feeFactor = _feeFactor(balances, tokenIndexIn, swapFee);
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(_in.times(feeFactor));
    let ans = _poolDerivativesBPT(
        amp,
        balances,
        bnum(formatFixed(balanceOut, decimalsOut)).plus(amount),
        tokenIndexIn,
        true,
        true,
        true
    );
    ans = ONE.div(ans.times(feeFactor));
    return ans;
}

/////////
///  Derivatives of spotPriceAfterSwap
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: StablePoolPairData
): OldBigNumber {
    const { amp, allBalances, tokenIndexIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(
        amount.times(EONE.sub(swapFee).toString()).div(EONE.toString())
    );
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(
        _exactTokenInForTokenOut(amount, poolPairData)
    );
    return _poolDerivatives(
        amp,
        balances,
        tokenIndexIn,
        tokenIndexOut,
        false,
        false
    );
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: StablePoolPairData
): OldBigNumber {
    const { amp, allBalances, tokenIndexIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const _in = _tokenInForExactTokenOut(amount, poolPairData)
        .times(EONE.sub(swapFee).toString())
        .div(EONE.toString());
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(_in);
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(amount);
    const feeFactor = EONE.div(swapFee).toString();
    return _poolDerivatives(
        amp,
        balances,
        tokenIndexIn,
        tokenIndexOut,
        false,
        true
    ).div(feeFactor);
}
