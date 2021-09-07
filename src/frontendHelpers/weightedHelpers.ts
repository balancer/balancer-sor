import { BigNumber } from '../utils/bignumber';
import * as weightedMath from '../pools/weightedPool/weightedMath';
import { WeightedPoolPairData } from 'pools/weightedPool/weightedPool';

/////////
/// UI Helpers
/////////

// Get BPT amount for token amounts with zero-price impact
// This function is the same regardless of whether we are considering
// an Add or Remove liquidity operation: The spot prices of BPT in tokens
// are the same regardless.
export function BPTForTokensZeroPriceImpact(
    balances: BigNumber[],
    decimals: number[],
    normalizedWeights: BigNumber[],
    amounts: BigNumber[],
    bptTotalSupply: BigNumber
): BigNumber {
    const zero = new BigNumber(0);
    let amountBPTOut = new BigNumber(0);
    // Calculate the amount of BPT adding this liquidity would result in
    // if there were no price impact, i.e. using the spot price of tokenIn/BPT
    for (let i = 0; i < balances.length; i++) {
        // We need to scale down all the balances and amounts
        amounts[i] = amounts[i].times(new BigNumber(10).pow(-decimals[i]));
        const poolPairData: WeightedPoolPairData = {
            balanceIn: balances[i].times(new BigNumber(10).pow(-decimals[i])),
            balanceOut: bptTotalSupply.times(new BigNumber(10).pow(-18)),
            weightIn: normalizedWeights[i].times(new BigNumber(10).pow(-18)),
            swapFee: zero,
        } as WeightedPoolPairData;
        const BPTPrice = weightedMath._spotPriceAfterSwapTokenInForExactBPTOut(
            zero,
            poolPairData
        );
        amountBPTOut = amountBPTOut.plus(amounts[i].div(BPTPrice));
    }
    // We need to scale up the amount of BPT out
    return amountBPTOut.times(new BigNumber(10).pow(18));
}
