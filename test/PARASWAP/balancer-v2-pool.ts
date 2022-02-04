// import { MathSol, BZERO, BONE } from './balancer-v2-math';
import { MathSol, BZERO } from '../../src/utils/basicOperations';

const _require = (b: boolean, message: string) => {
    if (!b) throw new Error(message);
};

class BasePool {
    _subtractSwapFeeAmount(amount: bigint, _swapFeePercentage: bigint): bigint {
        // This returns amount - fee amount, so we round up (favoring a higher fee amount).
        const feeAmount = MathSol.mulUpFixed(amount, _swapFeePercentage);
        return amount - feeAmount;
    }

    _upscaleArray(amounts: bigint[], scalingFactors: bigint[]): bigint[] {
        return amounts.map((a, i) => MathSol.mul(a, scalingFactors[i]));
    }

    _upscale(amount: bigint, scalingFactor: bigint): bigint {
        return MathSol.mul(amount, scalingFactor);
    }

    _downscaleDown(amount: bigint, scalingFactor: bigint): bigint {
        return MathSol.divDown(amount, scalingFactor);
    }
}

export abstract class BaseGeneralPool extends BasePool {
    // Swap Hooks

    // Modification: this is inspired from the function onSwap which is in the original contract
    onSell(
        amounts: bigint[],
        balances: bigint[],
        indexIn: number,
        indexOut: number,
        _scalingFactors: bigint[],
        _swapFeePercentage: bigint,
        _amplificationParameter: bigint
    ): bigint[] {
        // _validateIndexes(indexIn, indexOut, _getTotalTokens());
        // uint256[] memory scalingFactors = _scalingFactors();
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

export abstract class BaseMinimalSwapInfoPool extends BasePool {
    // Swap Hooks

    // Modification: this is inspired from the function onSwap which is in the original contract
    onSell(
        tokenAmountsIn: bigint[],
        balanceTokenIn: bigint,
        balanceTokenOut: bigint,
        _scalingFactorTokenIn: bigint,
        _scalingFactorTokenOut: bigint,
        _weightIn: bigint,
        _weightOut: bigint,
        _swapFeePercentage: bigint
    ): bigint[] {
        // uint256 _scalingFactorTokenIn = _scalingFactor(request.tokenIn);
        // uint256 _scalingFactorTokenOut = _scalingFactor(request.tokenOut);

        // Fees are subtracted before scaling, to reduce the complexity of the rounding direction analysis.
        const tokenAmountsInWithFee = tokenAmountsIn.map((a) =>
            this._subtractSwapFeeAmount(a, _swapFeePercentage)
        );

        // All token amounts are upscaled.
        balanceTokenIn = this._upscale(balanceTokenIn, _scalingFactorTokenIn);
        balanceTokenOut = this._upscale(
            balanceTokenOut,
            _scalingFactorTokenOut
        );
        const tokenAmountsInScaled = tokenAmountsInWithFee.map((a) =>
            this._upscale(a, _scalingFactorTokenIn)
        );

        const amountsOut = this._onSwapGivenIn(
            tokenAmountsInScaled,
            balanceTokenIn,
            balanceTokenOut,
            _weightIn,
            _weightOut
        );

        // amountOut tokens are exiting the Pool, so we round down.
        return amountsOut.map((a) =>
            this._downscaleDown(a, _scalingFactorTokenOut)
        );
    }

    abstract _onSwapGivenIn(
        tokenAmountsIn: bigint[],
        currentBalanceTokenIn: bigint,
        currentBalanceTokenOut: bigint,
        _weightIn: bigint,
        _weightOut: bigint
    ): bigint[];
}
