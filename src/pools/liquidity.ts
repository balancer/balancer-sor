import { BigNumber as OldBigNumber, ZERO, bnum } from '../utils/bignumber';

/*
It is possible to compute the normalized liquidity using another function already existing at every pool type, which is the derivative of spot price after swap.
https://quark-ceres-740.notion.site/SOR-Normalized-liquidity-and-highest-liquidity-pool-d81bd3db48e5482ab2275a8eecac33b4
*/
export function universalNormalizedLiquidity(
    derivativeSpotPriceAtZero: OldBigNumber
): OldBigNumber {
    const ans = bnum(1).div(derivativeSpotPriceAtZero);
    if (ans.isNaN() || ans.lt(ZERO) || !ans.isFinite()) return ZERO;
    return ans;
}
