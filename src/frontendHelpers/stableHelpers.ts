import { BigNumber as OldBigNumber, ZERO } from '../utils/bignumber';
import * as stableMath from '../pools/stablePool/stableMath';
import { StablePoolPairData } from 'pools/stablePool/stablePool';
import { BigNumber } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';

/////////
/// UI Helpers
/////////

// Get BPT amount for token amounts with zero-price impact
// This function is the same regardless of whether we are considering
// an Add or Remove liquidity operation: The spot prices of BPT in tokens
// are the same regardless.
export function BPTForTokensZeroPriceImpact(
    allBalances: OldBigNumber[],
    decimals: number[],
    amounts: OldBigNumber[], // This has to have the same lenght as allBalances
    bptTotalSupply: OldBigNumber,
    amp: BigNumber
): OldBigNumber {
    if (allBalances.length != amounts.length)
        throw 'allBalances and amounts have to have same length';
    let amountBPTOut = ZERO;
    // Calculate the amount of BPT adding this liquidity would result in
    // if there were no price impact, i.e. using the spot price of tokenIn/BPT

    // We need to scale down allBalances
    const allBalancesDownScaled: OldBigNumber[] = [];
    for (let i = 0; i < allBalances.length; i++) {
        allBalancesDownScaled.push(
            allBalances[i].times(new OldBigNumber(10).pow(-decimals[i]))
        );
    }

    for (let i = 0; i < allBalances.length; i++) {
        // We need to scale down amounts
        amounts[i] = amounts[i].times(new OldBigNumber(10).pow(-decimals[i]));
        const poolPairData: StablePoolPairData = {
            amp: amp,
            allBalances: allBalancesDownScaled,
            tokenIndexIn: i,
            balanceOut: BigNumber.from(bptTotalSupply.toString()),
            decimalsOut: 18,
            swapFee: Zero,
        } as unknown as StablePoolPairData;
        const BPTPrice = stableMath._spotPriceAfterSwapTokenInForExactBPTOut(
            ZERO,
            poolPairData
        );
        amountBPTOut = amountBPTOut.plus(amounts[i].div(BPTPrice));
    }
    // We need to scale up the amount of BPT out
    return amountBPTOut.times(new OldBigNumber(10).pow(18));
}
