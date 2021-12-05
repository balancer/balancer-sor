import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { WeiPerEther as EONE } from '@ethersproject/constants';
import {
    BigNumber as OldBigNumber,
    bnum,
    ZERO,
    ONE,
} from '../../utils/bignumber';
import { PhantomStablePoolPairData } from './phantomStablePool';

const MAX_TOKEN_BALANCE = bnum(2)
    .pow(112)
    .minus(1)
    .div(10 ** 18);

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
    poolPairData: PhantomStablePoolPairData
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
    poolPairData: PhantomStablePoolPairData
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
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero()) return amount;
    const {
        amp,
        allBalances,
        virtualBptSupply,
        decimalsOut,
        tokenIndexIn,
        swapFee,
    } = poolPairData;
    const balances = [...allBalances];
    const bptAmountOut = amount;

    // Get current invariant
    const currentInvariant = _invariant(amp, balances);
    // Calculate new invariant
    const bnumBalanceOut = bnum(formatFixed(virtualBptSupply, decimalsOut));
    const newInvariant = bnumBalanceOut
        .plus(bptAmountOut)
        .div(bnumBalanceOut)
        .times(currentInvariant);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weight of token
    let sumBalances = bnum(0);
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
    const tokenBalancePercentageExcess = bnum(1).minus(currentWeight);

    // return amountIn
    const bnumSwapFee = bnum(formatFixed(swapFee, 18));
    return amountInAfterFee.div(
        bnum(1).minus(tokenBalancePercentageExcess.times(bnumSwapFee))
    );
}

export function _BPTInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero()) return amount;
    const {
        amp,
        allBalances,
        virtualBptSupply,
        decimalsIn,
        tokenIndexOut,
        swapFee,
    } = poolPairData;
    const balances = [...allBalances];
    const tokenAmountOut = amount;

    // Get current invariant
    const currentInvariant = _invariant(amp, balances);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weights of each token relative to the sum of all balances
    let sumBalances = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }

    // Calculate the weighted balance ratio without considering fees
    const currentWeight = balances[tokenIndexOut].div(sumBalances);
    const tokenBalanceRatioWithoutFee = balances[tokenIndexOut]
        .minus(tokenAmountOut)
        .div(balances[tokenIndexOut]);
    const weightedBalanceRatio = bnum(1).minus(
        bnum(1).minus(tokenBalanceRatioWithoutFee).times(currentWeight)
    );

    // calculate new amounts in taking into account the fee on the % excess
    const tokenBalancePercentageExcess = weightedBalanceRatio
        .minus(tokenBalanceRatioWithoutFee)
        .div(bnum(1).minus(tokenBalanceRatioWithoutFee));

    const bnumSwapFee = bnum(formatFixed(swapFee, 18));
    const amountOutBeforeFee = tokenAmountOut.div(
        bnum(1).minus(bnumSwapFee.times(tokenBalancePercentageExcess))
    );
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(amountOutBeforeFee);

    // get new invariant taking into account swap fees
    const newInvariant = _invariant(amp, balances);

    // return amountBPTIn
    const bnumBalanceIn = bnum(formatFixed(virtualBptSupply, decimalsIn));
    return bnumBalanceIn.times(
        bnum(1).minus(newInvariant.div(currentInvariant))
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

export function _exactTokenInForBPTOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero()) return amount;
    const {
        amp,
        allBalances,
        virtualBptSupply,
        tokenIndexIn,
        swapFee,
        decimalsOut,
    } = poolPairData;
    const balances = [...allBalances];

    const tokenAmountIn = amount;
    // Get current invariant
    const currentInvariant = _invariant(amp, balances);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weights of each token relative to the sum of all balances
    let sumBalances = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }

    // Calculate the weighted balance ratio without considering fees
    const currentWeight = balances[tokenIndexIn].div(sumBalances);
    const tokenBalanceRatioWithoutFee = balances[tokenIndexIn]
        .plus(tokenAmountIn)
        .div(balances[tokenIndexIn]);
    const weightedBalanceRatio = bnum(1).plus(
        tokenBalanceRatioWithoutFee.minus(bnum(1)).times(currentWeight)
    );

    // calculate new amountIn taking into account the fee on the % excess
    // Percentage of the amount supplied that will be implicitly swapped for other tokens in the pool
    const tokenBalancePercentageExcess = tokenBalanceRatioWithoutFee
        .minus(weightedBalanceRatio)
        .div(tokenBalanceRatioWithoutFee.minus(bnum(1)));

    const bnumSwapFee = bnum(formatFixed(swapFee, 18));
    const amountInAfterFee = tokenAmountIn.times(
        bnum(1).minus(bnumSwapFee.times(tokenBalancePercentageExcess))
    );
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(amountInAfterFee);

    // get new invariant taking into account swap fees
    const newInvariant = _invariant(amp, balances);

    const bnumBalanceOut = bnum(formatFixed(virtualBptSupply, decimalsOut));

    return bnumBalanceOut.times(
        newInvariant.div(currentInvariant).minus(bnum(1))
    );
}

/* 
Flow of calculations:
amountBPTin -> newInvariant -> (amountOutProportional, amountOutBeforeFee) ->
amountOutPercentageExcess -> amountOut
*/
export function _exactBPTInForTokenOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    // The formula below returns some dust (due to rounding errors) but when
    // we input zero the output should be zero
    if (amount.isZero()) return amount;

    const { amp, allBalances, balanceIn, tokenIndexOut, decimalsIn, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const bptAmountIn = amount;

    /**********************************************************************************************
    // TODO description                            //
    **********************************************************************************************/

    // Get current invariant
    const currentInvariant = _invariant(amp, balances);
    // Calculate new invariant

    const bnumBalanceIn = MAX_TOKEN_BALANCE.minus(
        bnum(formatFixed(balanceIn, decimalsIn))
    );
    const newInvariant = bnumBalanceIn
        .minus(bptAmountIn)
        .div(bnumBalanceIn)
        .times(currentInvariant);

    // First calculate the sum of all token balances which will be used to calculate
    // the current weight of token
    let sumBalances = bnum(0);
    for (let i = 0; i < balances.length; i++) {
        sumBalances = sumBalances.plus(balances[i]);
    }

    const newBalanceTokenIndex =
        _getTokenBalanceGivenInvariantAndAllOtherBalances(
            amp,
            balances,
            newInvariant,
            tokenIndexOut
        );
    const amountOutBeforeFee =
        balances[tokenIndexOut].minus(newBalanceTokenIndex);

    // Calculate tokenBalancePercentageExcess
    const currentWeight = balances[tokenIndexOut].div(sumBalances);
    const tokenBalancePercentageExcess = bnum(1).minus(currentWeight);
    const ans = amountOutBeforeFee.times(
        ONE.minus(
            tokenBalancePercentageExcess
                .times(swapFee.toString())
                .div(EONE.toString())
        )
    );
    return ans;
}

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
    const alpha = bnum(amp.toString()).times(totalCoins ** totalCoins); // = ampTimesNpowN
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
    poolPairData: PhantomStablePoolPairData
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
    poolPairData: PhantomStablePoolPairData
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
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactTokenInForBPTOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const {
        amp,
        allBalances,
        virtualBptSupply,
        decimalsOut,
        tokenIndexIn,
        swapFee,
    } = poolPairData;
    const balances = [...allBalances];
    const feeFactor = _feeFactor(balances, tokenIndexIn, swapFee);
    let bnumBalanceOut = bnum(formatFixed(virtualBptSupply, decimalsOut));
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(
        amount.times(feeFactor)
    );
    bnumBalanceOut = bnumBalanceOut.plus(
        _exactTokenInForBPTOut(amount, poolPairData)
    );
    let ans = _poolDerivativesBPT(
        amp,
        balances,
        bnumBalanceOut,
        tokenIndexIn,
        true,
        true,
        false
    );
    ans = bnum(1).div(ans.times(feeFactor));
    return ans;
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapTokenInForExactBPTOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const {
        amp,
        allBalances,
        virtualBptSupply,
        tokenIndexIn,
        decimalsOut,
        swapFee,
    } = poolPairData;
    const balances = [...allBalances];
    const _in = _tokenInForExactBPTOut(amount, poolPairData);
    const feeFactor = _feeFactor(balances, tokenIndexIn, swapFee);
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(_in.times(feeFactor));
    let bnumBalanceOut = bnum(formatFixed(virtualBptSupply, decimalsOut));
    bnumBalanceOut = bnumBalanceOut.plus(amount);
    let ans = _poolDerivativesBPT(
        amp,
        balances,
        bnumBalanceOut,
        tokenIndexIn,
        true,
        true,
        true
    );
    ans = ONE.div(ans.times(feeFactor));
    return ans;
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _spotPriceAfterSwapExactBPTInForTokenOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const {
        amp,
        allBalances,
        virtualBptSupply,
        tokenIndexOut,
        swapFee,
        decimalsIn,
    } = poolPairData;
    const balances = [...allBalances];

    const _out = _exactBPTInForTokenOut(amount, poolPairData);
    const feeFactor = _feeFactor(balances, tokenIndexOut, swapFee);
    let bnumBalanceIn = bnum(formatFixed(virtualBptSupply, decimalsIn));

    balances[tokenIndexOut] = balances[tokenIndexOut].minus(
        _out.div(feeFactor)
    );
    bnumBalanceIn = bnumBalanceIn.minus(amount);
    const ans = _poolDerivativesBPT(
        amp,
        balances,
        bnumBalanceIn,
        tokenIndexOut,
        true,
        false,
        false
    ).div(feeFactor);
    return ans;
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _spotPriceAfterSwapBPTInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const {
        amp,
        allBalances,
        virtualBptSupply,
        decimalsIn,
        tokenIndexOut,
        swapFee,
    } = poolPairData;
    const balances = [...allBalances];
    const feeFactor = _feeFactor(balances, tokenIndexOut, swapFee);
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(
        amount.div(feeFactor)
    );
    let bnumBalanceIn = bnum(formatFixed(virtualBptSupply, decimalsIn));
    bnumBalanceIn = bnumBalanceIn.minus(
        _BPTInForExactTokenOut(amount, poolPairData)
    );
    const ans = _poolDerivativesBPT(
        amp,
        balances,
        bnumBalanceIn,
        tokenIndexOut,
        true,
        false,
        true
    ).div(feeFactor);
    return ans;
}

/////////
///  Derivatives of spotPriceAfterSwap
/////////

// PairType = 'token->token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
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
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const { amp, allBalances, tokenIndexIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const bnumSwapFee = bnum(formatFixed(swapFee, 18));
    const _in = _tokenInForExactTokenOut(amount, poolPairData).times(
        bnum(1).minus(bnumSwapFee)
    );
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(_in);
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(amount);
    const feeFactor = bnum(1).minus(bnumSwapFee);
    return _poolDerivatives(
        amp,
        balances,
        tokenIndexIn,
        tokenIndexOut,
        false,
        true
    ).div(feeFactor);
}

// PairType = 'token->BPT'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const { amp, allBalances, balanceOut, decimalsOut, tokenIndexIn, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const feeFactor = _feeFactor(balances, tokenIndexIn, swapFee);
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(
        amount.times(feeFactor)
    );
    let bnumBalanceOut = bnum(formatFixed(balanceOut, decimalsOut));
    bnumBalanceOut = bnumBalanceOut.plus(
        _exactTokenInForBPTOut(amount, poolPairData)
    );
    const ans = _poolDerivativesBPT(
        amp,
        balances,
        bnumBalanceOut,
        tokenIndexIn,
        false,
        true,
        false
    );
    return ans;
}

// PairType = 'token->BPT'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const { amp, allBalances, balanceOut, decimalsOut, tokenIndexIn, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const _in = _tokenInForExactBPTOut(amount, poolPairData);
    const feeFactor = _feeFactor(balances, tokenIndexIn, swapFee);
    balances[tokenIndexIn] = balances[tokenIndexIn].plus(_in.times(feeFactor));
    let bnumBalanceOut = bnum(formatFixed(balanceOut, decimalsOut));
    bnumBalanceOut = bnumBalanceOut.plus(amount);
    return _poolDerivativesBPT(
        amp,
        balances,
        bnumBalanceOut,
        tokenIndexIn,
        false,
        true,
        true
    ).div(feeFactor);
}

// PairType = 'BPT->token'
// SwapType = 'swapExactOut'
export function _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const { amp, allBalances, balanceIn, decimalsIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const _in = _BPTInForExactTokenOut(amount, poolPairData);
    const feeFactor = _feeFactor(balances, tokenIndexOut, swapFee);
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(
        amount.div(feeFactor)
    );
    let bnumBalanceIn = bnum(formatFixed(balanceIn, decimalsIn));
    bnumBalanceIn = bnumBalanceIn.minus(_in);
    const ans = _poolDerivativesBPT(
        amp,
        balances,
        bnumBalanceIn,
        tokenIndexOut,
        false,
        false,
        true
    );
    return ans.div(feeFactor.pow(2));
}

// PairType = 'BPT->token'
// SwapType = 'swapExactIn'
export function _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
    amount: OldBigNumber,
    poolPairData: PhantomStablePoolPairData
): OldBigNumber {
    const { amp, allBalances, balanceIn, decimalsIn, tokenIndexOut, swapFee } =
        poolPairData;
    const balances = [...allBalances];
    const _out = _exactBPTInForTokenOut(amount, poolPairData);
    const feeFactor = _feeFactor(balances, tokenIndexOut, swapFee);
    balances[tokenIndexOut] = balances[tokenIndexOut].minus(
        _out.div(feeFactor)
    );
    let bnumBalanceIn = bnum(formatFixed(balanceIn, decimalsIn));
    bnumBalanceIn = bnumBalanceIn.minus(amount);
    const ans = _poolDerivativesBPT(
        amp,
        balances,
        bnumBalanceIn,
        tokenIndexOut,
        false,
        false,
        false
    );
    return ans.div(feeFactor);
}
