import { isSameAddress } from '../../src/utils';
import * as StableMath from '../../src/pools/stablePool/stableMathBigInt';
import { BZERO } from '../../src/utils/basicOperations';
import { BigNumber } from '@ethersproject/bignumber';
import { BasePool } from './BasePool';

enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

export class PhantomStablePool extends BasePool {
    static MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');
    /*
    scaling factors should include rate:
    scalingFactors: pool.tokens.map(({ decimals, priceRate }) =>
        MathSol.mulDownFixed(getTokenScalingFactor(decimals), priceRate)
    )
    */
    onSell(
        amounts: bigint[],
        tokens: string[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        bptIndex: number,
        _scalingFactors: bigint[],
        _swapFeePercentage: bigint,
        _amplificationParameter: bigint
    ): bigint[] {
        return this._swapGivenIn(
            amounts,
            tokens,
            balances,
            indexIn,
            indexOut,
            bptIndex,
            _scalingFactors,
            _swapFeePercentage,
            _amplificationParameter
        );
    }

    // Remove BPT from Balances and update indices
    static removeBPT(
        balances: bigint[],
        tokenIndexIn: number,
        tokenIndexOut: number,
        bptIndex: number
    ): {
        balances;
        indexIn;
        indexOut;
    } {
        if (bptIndex != -1) {
            balances.splice(bptIndex, 1);
            if (bptIndex < tokenIndexIn) tokenIndexIn -= 1;
            if (bptIndex < tokenIndexOut) tokenIndexOut -= 1;
        }
        return {
            balances,
            indexIn: tokenIndexIn,
            indexOut: tokenIndexOut,
        };
    }

    _swapGivenIn(
        tokenAmountsIn: bigint[],
        tokens: string[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        bptIndex: number,
        scalingFactors: bigint[],
        _swapFeePercentage: bigint,
        _amplificationParameter: bigint
    ): bigint[] {
        // Phantom pools allow trading between token and pool BPT
        let pairType: PairTypes;
        if (isSameAddress(tokens[indexIn], tokens[bptIndex])) {
            pairType = PairTypes.BptToToken;
        } else if (isSameAddress(tokens[indexOut], tokens[bptIndex])) {
            pairType = PairTypes.TokenToBpt;
        } else {
            pairType = PairTypes.TokenToToken;
        }

        // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
        const tokenAmountsInWithFee = tokenAmountsIn.map((a) =>
            this._subtractSwapFeeAmount(a, _swapFeePercentage)
        );
        const balancesUpscaled = this._upscaleArray(balances, scalingFactors);
        const tokenAmountsInScaled = tokenAmountsInWithFee.map((a) =>
            this._upscale(a, scalingFactors[indexIn])
        );

        // VirtualBPTSupply must be used for the maths
        const virtualBptSupply = PhantomStablePool.MAX_TOKEN_BALANCE.sub(
            balances[bptIndex]
        ).toBigInt();

        const droppedBpt = PhantomStablePool.removeBPT(
            balancesUpscaled,
            indexIn,
            indexOut,
            bptIndex
        );

        const amountsOut = this._onSwapGivenIn(
            tokenAmountsInScaled,
            droppedBpt.balances,
            droppedBpt.indexIn,
            droppedBpt.indexOut,
            _amplificationParameter,
            virtualBptSupply,
            pairType
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
    _onSwapGivenIn(
        tokenAmountsIn: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        _amplificationParameter: bigint,
        virtualBptSupply: bigint,
        pairType: PairTypes
    ): bigint[] {
        const invariant = StableMath._calculateInvariant(
            _amplificationParameter,
            balances,
            true
        );

        const amountsOut: bigint[] = [];

        if (pairType === PairTypes.TokenToBpt) {
            tokenAmountsIn.forEach((amountIn) => {
                let amt: bigint;
                try {
                    const amountsInBigInt = Array(balances.length).fill(BZERO);
                    amountsInBigInt[indexIn] = amountIn;

                    amt = StableMath._calcBptOutGivenExactTokensIn(
                        _amplificationParameter,
                        balances,
                        amountsInBigInt,
                        virtualBptSupply,
                        BZERO,
                        invariant
                    );
                } catch (err) {
                    amt = BZERO;
                }
                amountsOut.push(amt);
            });
        } else if (pairType === PairTypes.BptToToken) {
            tokenAmountsIn.forEach((amountIn) => {
                let amt: bigint;
                try {
                    amt = StableMath._calcTokenOutGivenExactBptIn(
                        _amplificationParameter,
                        balances,
                        indexOut,
                        amountIn,
                        virtualBptSupply,
                        BZERO,
                        invariant
                    );
                } catch (err) {
                    amt = BZERO;
                }
                amountsOut.push(amt);
            });
        } else {
            tokenAmountsIn.forEach((amountIn) => {
                let amt: bigint;
                try {
                    amt = StableMath._calcOutGivenIn(
                        _amplificationParameter,
                        balances,
                        indexIn,
                        indexOut,
                        amountIn,
                        BZERO,
                        invariant
                    );
                } catch (err) {
                    amt = BZERO;
                }
                amountsOut.push(amt);
            });
        }
        return amountsOut;
    }
}
