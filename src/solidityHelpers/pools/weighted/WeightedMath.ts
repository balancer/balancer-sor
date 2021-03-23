// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// This is ported to JS from solidity
// https://github.com/balancer-labs/balancer-core-v2/blob/master/contracts/pools/weighted/WeightedMath.sol

// import { BigNumber } from '../../../utils/bignumber';
import { complement, powUp, powDown, pow, divUp, divDown, div, mulUp, mulDown, mul, sub, add, bnum} from "../../math/FixedPoint";
import * as FixedPoint from "../../math/FixedPoint";
import { FixedPoint as BigNumber } from "../../math/FixedPoint";

// This is a contract to emulate file-level functions. Convert to a library
// after the migration to solc v0.7.1.

/* solhint-disable private-vars-leading-underscore */

// Computes how many tokens can be taken out of a pool if `tokenAmountIn` are sent, given the
// current balances and weights.
function _outGivenIn(
    tokenBalanceIn: BigNumber,
    tokenWeightIn: BigNumber,
    tokenBalanceOut: BigNumber,
    tokenWeightOut: BigNumber,
    tokenAmountIn: BigNumber
): BigNumber {
    /**********************************************************************************************
    // outGivenIn                                                                                //
    // aO = tokenAmountOut                                                                       //
    // bO = tokenBalanceOut                                                                      //
    // bI = tokenBalanceIn              /      /            bI             \    (wI / wO) \      //
    // aI = tokenAmountIn    aO = bO * |  1 - | --------------------------  | ^            |     //
    // wI = tokenWeightIn               \      \       ( bI + aI )         /              /      //
    // wO = tokenWeightOut                                                                       //
    **********************************************************************************************/

    // Amount out, so we round down overall.

    // The multiplication rounds down, and the subtrahend (power) rounds up (so the base rounds up too).
    // Because bI / (bI + aI) <= 1, the exponent rounds down.

    let newBalance = tokenBalanceIn.add(tokenAmountIn);
    let base = tokenBalanceIn.divUp(newBalance);
    let exponent = tokenWeightIn.divDown(tokenWeightOut);
    let power = FixedPoint.powUp(base, exponent);

    return tokenBalanceOut.mulDown(power.complement());
}

// Computes how many tokens must be sent to a pool in order to take `tokenAmountOut`, given the
// current balances and weights.
function _inGivenOut(
    tokenBalanceIn: BigNumber,
    tokenWeightIn: BigNumber,
    tokenBalanceOut: BigNumber,
    tokenWeightOut: BigNumber,
    tokenAmountOut: BigNumber
): BigNumber {
    /**********************************************************************************************
    // inGivenOut                                                                                //
    // aO = tokenAmountOut                                                                       //
    // bO = tokenBalanceOut                                                                      //
    // bI = tokenBalanceIn              /  /            bO             \    (wO / wI)      \     //
    // aI = tokenAmountIn    aI = bI * |  | --------------------------  | ^            - 1  |    //
    // wI = tokenWeightIn               \  \       ( bO - aO )         /                   /     //
    // wO = tokenWeightOut                                                                       //
    **********************************************************************************************/

    // Amount in, so we round up overall.

    // The multiplication rounds up, and the power rounds up (so the base rounds up too).
    // Because b0 / (b0 - a0) >= 1, the exponent rounds up.

    let base = tokenBalanceOut.divUp(tokenBalanceOut.sub(tokenAmountOut));
    let exponent = tokenWeightOut.divUp(tokenWeightIn);
    let power = FixedPoint.powUp(base, exponent);

    let ratio = power.sub(FixedPoint.ONE);

    return tokenBalanceIn.mulUp(ratio);
}

function _invariant(normalizedWeights: BigNumber[], balances: BigNumber[])
: BigNumber
{
    /**********************************************************************************************
    // invariant               _____                                                             //
    // wi = weight index i      | |      wi                                                      //
    // bi = balance index i     | |  bi ^   = i                                                  //
    // i = invariant                                                                             //
    **********************************************************************************************/

    let invariant = FixedPoint.ONE;
    for (let i = 0; i < normalizedWeights.length; i++) {
        invariant = invariant.mul(FixedPoint.pow(balances[i], normalizedWeights[i]));
    }
    return invariant;
}

function _exactTokensInForBPTOut(
    balances: BigNumber[],
    normalizedWeights: BigNumber[],
    amountsIn: BigNumber[],
    bptTotalSupply: BigNumber,
    swapFee: BigNumber
): BigNumber {
    // BPT out, so we round down overall.

    // First loop to calculate the weighted balance ratio
    // The increment `amountIn` represents for each token, as a quotient of new and current balances: BigNumber,
    // not accounting swap fees
    let tokenBalanceRatiosWithoutFee = new Array(amountsIn.length);
    // The weighted sum of token balance rations sans fee
    let weightedBalanceRatio = 0;
    for (let i = 0; i < balances.length; i++) {
        tokenBalanceRatiosWithoutFee[i] = balances[i].add(amountsIn[i]).divDown(balances[i]);
        weightedBalanceRatio = weightedBalanceRatio.add(
            tokenBalanceRatiosWithoutFee[i].mulDown(normalizedWeights[i])
        );
    }

    //Second loop to calculate new amounts in taking into account the fee on the % excess
    // The growth of the invariant caused by the join, as a quotient of the new value and the current one
    let invariantRatio = FixedPoint.ONE;
    for (let i = 0; i < balances.length; i++) {
        // Percentage of the amount supplied that will be swapped for other tokens in the pool
        let tokenBalancePercentageExcess;
        // Some tokens might have amounts supplied in excess of a 'balanced' join: these are identified if
        // the token's balance ratio sans fee is larger than the weighted balance ratio, and swap fees charged
        // on the amount to swap
        if (weightedBalanceRatio >= tokenBalanceRatiosWithoutFee[i]) {
            tokenBalancePercentageExcess = 0;
        } else {
            tokenBalancePercentageExcess = tokenBalanceRatiosWithoutFee[i].sub(weightedBalanceRatio).divUp(
                tokenBalanceRatiosWithoutFee[i].sub(FixedPoint.ONE)
            );
        }

        let swapFeeExcess = swapFee.mulUp(tokenBalancePercentageExcess);

        let amountInAfterFee = amountsIn[i].mulDown(swapFeeExcess.complement());

        let tokenBalanceRatio = FixedPoint.ONE.add(amountInAfterFee.divDown(balances[i]));

        invariantRatio = invariantRatio.mulDown(FixedPoint.powDown(tokenBalanceRatio, normalizedWeights[i]));
    }

    return bptTotalSupply.mulDown(invariantRatio.sub(FixedPoint.ONE));
}

function _tokenInForExactBPTOut(
    tokenBalance: BigNumber,
    tokenNormalizedWeight: BigNumber,
    bptAmountOut: BigNumber,
    bptTotalSupply: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /******************************************************************************************
    // tokenInForExactBPTOut                                                                 //
    // a = tokenAmountIn                                                                     //
    // b = tokenBalance                 /  /    totalBPT + bptOut      \    (1 / w)       \  //
    // bptOut = bptAmountOut   a = b * |  | --------------------------  | ^          - 1  |  //
    // bpt = totalBPT                   \  \       totalBPT            /                  /  //
    // w = tokenWeight                                                                       //
    ******************************************************************************************/

    // Token in, so we round up overall.

    // Calculate the factor by which the invariant will increase after minting BPTAmountOut
    let invariantRatio = bptTotalSupply.add(bptAmountOut).divUp(bptTotalSupply);

    // Calculate by how much the token balance has to increase to cause invariantRatio
    let tokenBalanceRatio = FixedPoint.powUp(invariantRatio, FixedPoint.ONE.divUp(tokenNormalizedWeight));
    let tokenBalancePercentageExcess = tokenNormalizedWeight.complement();
    let amountInAfterFee = tokenBalance.mulUp(tokenBalanceRatio.sub(FixedPoint.ONE));

    let swapFeeExcess = swapFee.mulUp(tokenBalancePercentageExcess);

    return amountInAfterFee.divUp(swapFeeExcess.complement());
}

function _exactBPTInForTokenOut(
    tokenBalance: BigNumber,
    tokenNormalizedWeight: BigNumber,
    bptAmountIn: BigNumber,
    bptTotalSupply: BigNumber,
    swapFee: BigNumber
): BigNumber {
    /*****************************************************************************************
    // exactBPTInForTokenOut                                                                //
    // a = tokenAmountOut                                                                   //
    // b = tokenBalance                /      /    totalBPT - bptIn       \    (1 / w)  \   //
    // bptIn = bptAmountIn    a = b * |  1 - | --------------------------  | ^           |  //
    // bpt = totalBPT                  \      \       totalBPT            /             /   //
    // w = tokenWeight                                                                      //
    *****************************************************************************************/

    // Token out, so we round down overall.

    // Calculate the factor by which the invariant will decrease after burning BPTAmountIn
    let invariantRatio = bptTotalSupply.sub(bptAmountIn).divUp(bptTotalSupply);

    // Calculate by how much the token balance has to increase to cause invariantRatio
    let tokenBalanceRatio = FixedPoint.powUp(invariantRatio, FixedPoint.ONE.divUp(tokenNormalizedWeight));
    let tokenBalancePercentageExcess = tokenNormalizedWeight.complement();

    //Because of rounding up, tokenBalanceRatio can be greater than one
    let amountOutBeforeFee = tokenBalance.mulDown(tokenBalanceRatio.complement());

    let swapFeeExcess = swapFee.mulUp(tokenBalancePercentageExcess);

    return amountOutBeforeFee.mulDown(swapFeeExcess.complement());
}

function _exactBPTInForTokensOut(
    currentBalances: BigNumber[],
    bptAmountIn: BigNumber,
    totalBPT: BigNumber
): BigNumber[] {
    /**********************************************************************************************
    // exactBPTInForAllTokensOut                                                                 //
    // (per token)                                                                               //
    // aO = tokenAmountOut             /        bptIn         \                                  //
    // b = tokenBalance      a0 = b * | ---------------------  |                                 //
    // bptIn = bptAmountIn             \       totalBPT       /                                  //
    // bpt = totalBPT                                                                            //
    **********************************************************************************************/

    // Since we're computing an amount out, we round down overall. This means rounding down on both the
    // multiplication and division.

    let bptRatio = bptAmountIn.divDown(totalBPT);

    let amountsOut = new Array(currentBalances.length);
    for (let i = 0; i < currentBalances.length; i++) {
        amountsOut[i] = currentBalances[i].mulDown(bptRatio);
    }

    return amountsOut;
}

function _bptInForExactTokensOut(
    balances: BigNumber[],
    normalizedWeights: BigNumber[],
    amountsOut: BigNumber[],
    bptTotalSupply: BigNumber,
    swapFee
): BigNumber {
    // BPT in, so we round up overall.

    // First loop to calculate the weighted balance ratio
    let tokenBalanceRatiosWithoutFee = new Array(amountsOut.length);
    let weightedBalanceRatio = 0;
    for (let i = 0; i < balances.length; i++) {
        tokenBalanceRatiosWithoutFee[i] = balances[i].sub(amountsOut[i]).divUp(balances[i]);
        weightedBalanceRatio = weightedBalanceRatio.add(
            tokenBalanceRatiosWithoutFee[i].mulUp(normalizedWeights[i])
        );
    }

    //Second loop to calculate new amounts in taking into account the fee on the % excess
    let invariantRatio = FixedPoint.ONE;
    for (let i = 0; i < balances.length; i++) {
        let tokenBalancePercentageExcess;
        let tokenBalanceRatio;
        // For each ratioSansFee, compare with the total weighted ratio (weightedBalanceRatio) and
        // decrease the fee from what goes above it
        if (weightedBalanceRatio <= tokenBalanceRatiosWithoutFee[i]) {
            tokenBalancePercentageExcess = 0;
        } else {
            tokenBalancePercentageExcess = weightedBalanceRatio.sub(tokenBalanceRatiosWithoutFee[i]).divUp(
                tokenBalanceRatiosWithoutFee[i].complement()
            );
        }

        let swapFeeExcess = swapFee.mulUp(tokenBalancePercentageExcess);

        let amountOutBeforeFee = amountsOut[i].divUp(swapFeeExcess.complement());

        tokenBalanceRatio = amountOutBeforeFee.divUp(balances[i]).complement();

        invariantRatio = invariantRatio.mulDown(FixedPoint.powDown(tokenBalanceRatio, normalizedWeights[i]));
    }

    return bptTotalSupply.mulUp(invariantRatio.complement());
}

function _calculateDueTokenProtocolSwapFee(
    balance: BigNumber,
    normalizedWeight: BigNumber,
    previousInvariant: BigNumber,
    currentInvariant: BigNumber,
    protocolSwapFeePercentage
): BigNumber {
    /*********************************************************************************
    /*  protocolSwapFee * balanceToken * ( 1 - (previousInvariant / currentInvariant) ^ (1 / weightToken))
    *********************************************************************************/

    // We round down to prevent issues in the Pool's accounting, even if it means paying slightly less protocol fees
    // to the Vault.

    // Fee percentage and balance multiplications round down, while the subtrahend (power) rounds up (as does the
    // base). Because previousInvariant / currentInvariant <= 1, the exponent rounds down.

    if (currentInvariant.lt(previousInvariant)) {
        // This should never happen, but this acts as a safeguard to prevent the Pool from entering a locked state
        // in which joins and exits revert while computing accumulated swap fees.
        return bnum(0);
    }

    let base = previousInvariant.divUp(currentInvariant);
    let exponent = FixedPoint.ONE.divDown(normalizedWeight);

    let power = FixedPoint.powUp(base, exponent);

    let tokenAccruedFees = balance.mulDown(power.complement());
    return tokenAccruedFees.mulDown(protocolSwapFeePercentage);
}
