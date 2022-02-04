import { BasePool } from './balancer-v2-pool';
import { StableMath } from './StablePool';
import { MathSol, BZERO } from '../../src/utils/basicOperations';
import _ from 'lodash';
import { parseFixed } from '@ethersproject/bignumber';

abstract class BaseGeneralPool extends BasePool {
    // Swap Hooks

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
        _scalingFactors: bigint[],
        _swapFeePercentage: bigint,
        _amplificationParameter: bigint
    ): bigint[] {
        return this._swapGivenIn(
            amounts,
            balances,
            indexIn,
            indexOut,
            _scalingFactors,
            _swapFeePercentage,
            _amplificationParameter
        );
    }

    _swapGivenIn(
        tokenAmountsIn: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        scalingFactors: bigint[],
        _swapFeePercentage: bigint,
        _amplificationParameter: bigint
    ): bigint[] {
        // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
        const tokenAmountsInWithFee = tokenAmountsIn.map((a) =>
            this._subtractSwapFeeAmount(a, _swapFeePercentage)
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
            _amplificationParameter
        );

        // amountOut tokens are exiting the Pool, so we round down.
        return amountsOut.map((a) =>
            this._downscaleDown(a, scalingFactors[indexOut])
        );
    }

    /*
     * @dev Called when a swap with the Pool occurs, where the amount of tokens entering the Pool is known.
     *
     * Returns the amount of tokens that will be taken from the Pool in return.
     *
     * All amounts inside `swapRequest` and `balances` are upscaled. The swap fee has already been deducted from
     * `swapRequest.amount`.
     *
     * The return value is also considered upscaled, and will be downscaled (rounding down) before returning it to the
     * Vault.
     */
    abstract _onSwapGivenIn(
        tokenAmountsIn: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        _amplificationParameter: bigint
    ): bigint[];
}

export class MetaStablePool extends BaseGeneralPool {
    _onSwapGivenIn(
        tokenAmountsIn: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        _amplificationParameter: bigint
    ): bigint[] {
        return StableMath._calcOutGivenIn(
            _amplificationParameter,
            balances,
            indexIn,
            indexOut,
            tokenAmountsIn
        );
    }
}
