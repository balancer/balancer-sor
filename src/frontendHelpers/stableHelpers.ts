import {
    BigNumber,
    BigNumberish,
    formatFixed,
    parseFixed,
} from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../utils/bignumber';
import * as stableMath from '../pools/stablePool/stableMath';
import { StablePoolPairData } from '../pools/stablePool/stablePool';

/////////
/// UI Helpers
/////////

// Get BPT amount for token amounts with zero-price impact
// This function is the same regardless of whether we are considering
// an Add or Remove liquidity operation: The spot prices of BPT in tokens
// are the same regardless.
export function BPTForTokensZeroPriceImpact(
    allBalances: BigNumberish[],
    decimals: number[],
    amounts: BigNumberish[], // This has to have the same lenght as allBalances
    bptTotalSupply: BigNumberish,
    amp: BigNumberish
): BigNumber {
    if (allBalances.length != amounts.length)
        throw 'allBalances and amounts have to have same length';
    // Calculate the amount of BPT adding this liquidity would result in
    // if there were no price impact, i.e. using the spot price of tokenIn/BPT

    // We downscale the pool balances once as this will be reused across tokens
    const allBalancesDownScaled: OldBigNumber[] = allBalances.map(
        (balance, i) => bnum(formatFixed(balance, decimals[i]))
    );

    const amountBPTOut = amounts.reduce((totalBptOut, amountIn, i) => {
        // Calculate amount of BPT gained per token in
        const poolPairData: StablePoolPairData = {
            amp: amp,
            allBalances: allBalancesDownScaled,
            tokenIndexIn: i,
            balanceOut: bptTotalSupply,
            decimalsOut: 18,
            swapFee: Zero,
        } as unknown as StablePoolPairData;
        const BPTPrice = stableMath._spotPriceAfterSwapTokenInForExactBPTOut(
            ZERO,
            poolPairData
        );

        // Multiply by amountIn to get contribution to total bpt out
        const downscaledAmountIn = formatFixed(amountIn, decimals[i]);
        const downscaledBptOut = bnum(downscaledAmountIn)
            .div(BPTPrice)
            .toString();
        return BigNumber.from(totalBptOut).add(
            parseFixed(downscaledBptOut, 18)
        );
    }, Zero);

    return BigNumber.from(amountBPTOut);
}
