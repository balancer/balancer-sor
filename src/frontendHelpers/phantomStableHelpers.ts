import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { BPTForTokensZeroPriceImpact as stableBPTForTokensZeroPriceImpact } from './stableHelpers';

/////////
/// UI Helpers
/////////

// Get BPT amount for token amounts with zero-price impact
// Amounts are stablecoin amounts (DAI, USDT, USDC)
// Since the phantom stable pool is actually metastable
// and their components are bDAI, bUSDT, bUSDC,
// we transform its balances according to the price rates
// to obtain units of DAI, USDT, USDC.
export function BPTForTokensZeroPriceImpact(
    allBalances: BigNumberish[], // assuming that BPT balance was removed
    decimals: number[], // This should be [18, 18, 18]
    amounts: BigNumberish[], // This has to have the same length as allBalances
    virtualBptSupply: BigNumberish,
    amp: BigNumberish,
    fee: BigNumberish,
    rates: BigNumberish[]
): BigNumber {
    const amountsAfterFee = amounts.map((amountIn, i) => {
        const amount = BigNumber.from(amountIn);
        const feeAmount = amount.mul(fee).div(ONE);
        return amount.sub(feeAmount);
    });

    const transformedBalances = allBalances.map((balance, i) => {
        return BigNumber.from(balance).mul(rates[i]).div(ONE);
    });

    return stableBPTForTokensZeroPriceImpact(
        transformedBalances,
        decimals,
        amountsAfterFee,
        virtualBptSupply,
        amp
    );
}
