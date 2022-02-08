import { StablePool } from './StablePool';

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
