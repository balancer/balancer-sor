import {
    BigNumber,
    BigNumberish,
    formatFixed,
    parseFixed,
} from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../utils/bignumber';
import { LinearPoolPairData } from '../pools/linearPool/linearPool';
import { _spotPriceAfterSwapExactTokenInForBPTOut } from '../pools/linearPool/linearMath';
import { BPTForTokensZeroPriceImpact as stableBPTForTokensZeroPriceImpact } from './stableHelpers';

/////////
/// UI Helpers
/////////

// Get BPT amount for token amounts with zero-price impact
// This function is the same regardless of whether we are considering
// an Add or Remove liquidity operation: The spot prices of BPT in tokens
// are the same regardless.
export function BPTForTokensZeroPriceImpact(
    allBalances: BigNumberish[],
    decimals: number[], // This should be [18, 18, 18]
    amounts: BigNumberish[], // This has to have the same length as allBalances
    bptTotalSupply: BigNumberish,
    amp: BigNumberish,
    fee: BigNumberish,
    // linear pools parameters
    mainBalances: BigNumberish[],
    mainDecimals: Number[],
    wrappedBalances: BigNumberish[],
    wrappedDecimals: Number[],
    virtualBptSupplies: BigNumberish[],
    linearFees: BigNumberish[],
    rates: BigNumberish[],
    lowerTargets: BigNumberish[],
    upperTargets: BigNumberish[]
): BigNumber {
    // Amounts are stablecoin amounts (DAI, USDT, USDC)
    // We first transform it into amounts of the
    // corresponding linear pools' BPTs (bDAI, bUSDT, bUSDC)
    // using _spotPriceAfterSwapExactTokenInForBPTOut
    // Then the fee is charged to amounts and the result
    // of this is passed to the regular stable
    // BPTForTokensZeroPriceImpact.

    const transformedAmounts = amounts.map((amountIn, i) => {
        const linearPoolPairData: LinearPoolPairData = {
            balanceIn: mainBalances[i],
            decimalsIn: mainDecimals[i],
            wrappedBalance: wrappedBalances[i],
            wrappedDecimals: wrappedDecimals[i],
            virtualBptSupply: virtualBptSupplies[i],
            swapFee: linearFees[i],
            rate: rates[i],
            lowerTarget: lowerTargets[i],
            upperTarget: upperTargets[i],
        } as unknown as LinearPoolPairData;
        let ans = bnum(formatFixed(amountIn, decimals[i]));
        ans = ans.div(
            _spotPriceAfterSwapExactTokenInForBPTOut(
                bnum(0),
                linearPoolPairData
            )
        );
        const feeAmount = ans.times(formatFixed(fee, 18));
        ans = ans.minus(feeAmount);
        return parseFixed(ans.toString(), decimals[i]);
    });

    return stableBPTForTokensZeroPriceImpact(
        allBalances,
        decimals,
        transformedAmounts,
        bptTotalSupply,
        amp
    );
}
