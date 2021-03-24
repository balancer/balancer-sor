import { BigNumber } from '../../utils/bignumber';
import * as weightedMath from '../../poolMath/weightedMath';

/////////
/// UI Helpers
/////////

// Get BPT amount for token amounts with zero-price impact
// This function is the same regardless of whether we are considering
// an Add or Remove liquidity operation: The spot prices of BPT in tokens
// are the same regardless.
export function BPTForTokensZeroPriceImpact(
    balances: BigNumber[],
    normalizedWeights: BigNumber[],
    amounts: BigNumber[],
    bptTotalSupply: BigNumber,
    swapFee: BigNumber
): BigNumber {
    let zero = new BigNumber(0);
    let amountBPTOut = new BigNumber(0);
    // Calculate the amount of BPT adding this liquidity would result in
    // if there were no price impact, i.e. using the spot price of tokenIn/BPT
    for (let i = 0; i < balances.length; i++) {
        let poolPairData = {
            balanceIn: balances[i],
            balanceOut: bptTotalSupply,
            weightIn: normalizedWeights[i],
            swapFee: swapFee,
        };
        let BPTPrice = weightedMath._spotPriceAfterSwapTokenInForExactBPTOut(
            zero,
            poolPairData
        );
        amountBPTOut = amountBPTOut.plus(amounts[i].div(BPTPrice));
    }
    return amountBPTOut;
}
