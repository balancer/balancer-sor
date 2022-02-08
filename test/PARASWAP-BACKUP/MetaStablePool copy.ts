import { BasePool } from './BasePool';
import * as StableMath from './StableMath';
import { BZERO } from './basicOperations';

export class MetaStablePool extends BasePool {
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
        return this._swapGivenIn(
            amounts,
            balances,
            indexIn,
            indexOut,
            scalingFactors,
            swapFeePercentage,
            amplificationParameter
        );
    }

    _swapGivenIn(
        tokenAmountsIn: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        scalingFactors: bigint[],
        swapFeePercentage: bigint,
        amplificationParameter: bigint
    ): bigint[] {
        // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
        const tokenAmountsInWithFee = tokenAmountsIn.map((a) =>
            this._subtractSwapFeeAmount(a, swapFeePercentage)
        );
        const balancesUpscaled = this._upscaleArray(balances, scalingFactors);
        const tokenAmountsInScaled = tokenAmountsInWithFee.map((a) =>
            this._upscale(a, scalingFactors[indexIn])
        );

        const amountsOut = this._onSwapGivenIn(
            tokenAmountsInScaled,
            balancesUpscaled,
            indexIn,
            indexOut,
            amplificationParameter
        );

        // amountOut tokens are exiting the Pool, so we round down.
        return amountsOut.map((a) =>
            this._downscaleDown(a, scalingFactors[indexOut])
        );
    }
    /*
    Called when a swap with the Pool occurs, where the amount of tokens entering the Pool is known.
    All amounts are upscaled.
    Swap fee is already deducted.
    The return value is also considered upscaled, and should be downscaled (rounding down)
    */
    _onSwapGivenIn(
        tokenAmountsIn: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        amplificationParameter: bigint
    ): bigint[] {
        const invariant = StableMath._calculateInvariant(
            amplificationParameter,
            balances,
            true
        );

        const amountsOut: bigint[] = [];

        tokenAmountsIn.forEach((amountIn) => {
            let amt: bigint;
            try {
                amt = StableMath._calcOutGivenIn(
                    amplificationParameter,
                    balances,
                    indexIn,
                    indexOut,
                    amountIn,
                    invariant
                );
            } catch (err) {
                amt = BZERO;
            }
            amountsOut.push(amt);
        });

        return amountsOut;
    }
}
