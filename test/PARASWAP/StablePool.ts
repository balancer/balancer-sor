import { BaseGeneralPool } from './balancer-v2-pool';
import { MathSol, BZERO } from '../../src/utils/basicOperations';

class StableMath {
    static _AMP_PRECISION = BigInt(1e3);

    static _calculateInvariant(
        amplificationParameter: bigint,
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
        const ampTimesTotal = amplificationParameter * BigInt(numTokens);

        for (let i = 0; i < 255; i++) {
            let P_D = balances[0] * BigInt(numTokens);
            for (let j = 1; j < numTokens; j++) {
                P_D = MathSol.div(
                    MathSol.mul(
                        MathSol.mul(P_D, balances[j]),
                        BigInt(numTokens)
                    ),
                    invariant,
                    roundUp
                );
            }
            prevInvariant = invariant;
            invariant = MathSol.div(
                MathSol.mul(
                    MathSol.mul(BigInt(numTokens), invariant),
                    invariant
                ) +
                    MathSol.div(
                        MathSol.mul(MathSol.mul(ampTimesTotal, sum), P_D),
                        this._AMP_PRECISION,
                        roundUp
                    ),
                MathSol.mul(BigInt(numTokens + 1), invariant) +
                    // No need to use checked arithmetic for the amp precision, the amp is guaranteed to be at least 1
                    MathSol.div(
                        MathSol.mul(ampTimesTotal - this._AMP_PRECISION, P_D),
                        this._AMP_PRECISION,
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

    static _calcOutGivenIn(
        amplificationParameter: bigint,
        balances: bigint[],
        tokenIndexIn: number,
        tokenIndexOut: number,
        tokenAmountsIn: bigint[]
    ): bigint[] {
        /**************************************************************************************************************
    // outGivenIn token x for y - polynomial equation to solve                                                   //
    // ay = amount out to calculate                                                                              //
    // by = balance token out                                                                                    //
    // y = by - ay (finalBalanceOut)                                                                             //
    // D = invariant                                               D                     D^(n+1)                 //
    // A = amplification coefficient               y^2 + ( S - ----------  - D) * y -  ------------- = 0         //
    // n = number of tokens                                    (A * n^n)               A * n^2n * P              //
    // S = sum of final balances but y                                                                           //
    // P = product of final balances but y                                                                       //
    **************************************************************************************************************/

        // Amount out, so we round down overall.

        // Given that we need to have a greater final balance out, the invariant needs to be rounded up
        const invariant = this._calculateInvariant(
            amplificationParameter,
            balances,
            true
        );

        const initBalance = balances[tokenIndexIn];
        // Modification: The original code was implemented for a single tokenAmountsIn
        return tokenAmountsIn.map((a) => {
            balances[tokenIndexIn] = initBalance + a;

            const finalBalanceOut =
                this._getTokenBalanceGivenInvariantAndAllOtherBalances(
                    amplificationParameter,
                    balances,
                    invariant,
                    tokenIndexOut
                );

            // No need to use checked arithmetic since `tokenAmountIn` was actually added to the same balance right before
            // calling `_getTokenBalanceGivenInvariantAndAllOtherBalances` which doesn't alter the balances array.
            // balances[tokenIndexIn] = balances[tokenIndexIn] - tokenAmountIn;
            return balances[tokenIndexOut] - finalBalanceOut - BigInt(1);
        });
    }

    static _getTokenBalanceGivenInvariantAndAllOtherBalances(
        amplificationParameter: bigint,
        balances: bigint[],
        invariant: bigint,
        tokenIndex: number
    ): bigint {
        // Rounds result up overall

        const ampTimesTotal = amplificationParameter * BigInt(balances.length);
        let sum = balances[0];
        let P_D = balances[0] * BigInt(balances.length);
        for (let j = 1; j < balances.length; j++) {
            P_D = MathSol.divDown(
                MathSol.mul(
                    MathSol.mul(P_D, balances[j]),
                    BigInt(balances.length)
                ),
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
                this._AMP_PRECISION
            ),
            balances[tokenIndex]
        );
        const b =
            sum +
            MathSol.mul(
                MathSol.divDown(invariant, ampTimesTotal),
                this._AMP_PRECISION
            );

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
}

export class StablePool extends BaseGeneralPool {
    _onSwapGivenIn(
        tokenAmountsIn: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        _amplificationParameter: bigint
    ): bigint[] {
        return StableMath._calcOutGivenIn(
            _amplificationParameter,
            balances,
            indexIn,
            indexOut,
            tokenAmountsIn
        );
    }
}
