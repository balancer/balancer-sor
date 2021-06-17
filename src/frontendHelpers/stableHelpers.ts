import { BigNumber } from '../utils/bignumber';
import * as stableMath from '../pools/stablePool/stableMath';

/////////
/// UI Helpers
/////////

// Get BPT amount for token amounts with zero-price impact
// This function is the same regardless of whether we are considering
// an Add or Remove liquidity operation: The spot prices of BPT in tokens
// are the same regardless.
export function BPTForTokensZeroPriceImpact(
    allBalances: BigNumber[],
    decimals: number[],
    amounts: BigNumber[], // This has to have the same lenght as allBalances
    bptTotalSupply: BigNumber,
    amp: BigNumber
): BigNumber {
    if (allBalances.length != amounts.length)
        throw 'allBalances and amounts have to have same length';
    let zero = new BigNumber(0);
    let amountBPTOut = new BigNumber(0);
    // Calculate the amount of BPT adding this liquidity would result in
    // if there were no price impact, i.e. using the spot price of tokenIn/BPT

    // We need to scale down allBalances
    let allBalancesDownScaled = [];
    for (let i = 0; i < allBalances.length; i++) {
        allBalancesDownScaled.push(
            allBalances[i].times(new BigNumber(10).pow(-decimals[i]))
        );
    }

    for (let i = 0; i < allBalances.length; i++) {
        // We need to scale down amounts
        amounts[i] = amounts[i].times(new BigNumber(10).pow(-decimals[i]));
        let poolPairData = {
            amp: amp,
            allBalances: allBalancesDownScaled,
            tokenIndexIn: i,
            balanceOut: bptTotalSupply.times(new BigNumber(10).pow(-18)),
            swapFee: zero,
        };
        let BPTPrice = stableMath._spotPriceAfterSwapTokenInForExactBPTOut(
            zero,
            poolPairData
        );
        amountBPTOut = amountBPTOut.plus(amounts[i].div(BPTPrice));
    }
    // We need to scale up the amount of BPT out
    return amountBPTOut.times(new BigNumber(10).pow(18));
}
