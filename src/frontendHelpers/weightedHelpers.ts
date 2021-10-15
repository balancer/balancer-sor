import {
    BigNumber,
    BigNumberish,
    formatFixed,
    parseFixed,
} from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { bnum, ZERO } from '../utils/bignumber';
import * as weightedMath from '../pools/weightedPool/weightedMath';
import { WeightedPoolPairData } from '../pools/weightedPool/weightedPool';

/////////
/// UI Helpers
/////////

// Get BPT amount for token amounts with zero-price impact
// This function is the same regardless of whether we are considering
// an Add or Remove liquidity operation: The spot prices of BPT in tokens
// are the same regardless.
export function BPTForTokensZeroPriceImpact(
    balances: BigNumberish[],
    decimals: number[],
    normalizedWeights: BigNumberish[],
    amounts: BigNumberish[],
    bptTotalSupply: BigNumberish
): BigNumber {
    const amountBPTOut = amounts.reduce((totalBptOut, amountIn, i) => {
        // Calculate amount of BPT gained per token in
        const poolPairData: WeightedPoolPairData = {
            balanceIn: balances[i],
            decimalsIn: decimals[i],
            balanceOut: bptTotalSupply,
            weightIn: normalizedWeights[i],
            swapFee: Zero,
        } as WeightedPoolPairData;
        const BPTPrice = weightedMath._spotPriceAfterSwapTokenInForExactBPTOut(
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
