import { StablePool } from './StablePool';

/*
MetaStable Pools are an extension of Stable Pools that contain tokens with known exchange rates. MetaStable Pools use
Stable Math in conjunction with this known exchange rate (see scaling factors). They are great for tokens with highly correlated, but not pegged, prices. 
*/
export class MetaStablePool extends StablePool {
    // StablePool suitable for assets with proportional prices (i.e. with slow-changing exchange rates between them).

    /*
    scaling factors should include rate:
    scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
        MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
    )
    */
    onSell(
        amounts: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        scalingFactors: bigint[],
        swapFeePercentage: bigint,
        amplificationParameter: bigint
    ): bigint[] {
        return super.onSell(
            amounts,
            balances,
            indexIn,
            indexOut,
            scalingFactors,
            swapFeePercentage,
            amplificationParameter
        );
    }
}
