import { BasePool } from './BasePool';
import { MathSol, _require } from './basicOperations';

abstract class BaseMinimalSwapInfoPool extends BasePool {
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

export class WeightedPool extends BaseMinimalSwapInfoPool {
    _onSwapGivenIn(
        tokenAmountsIn: bigint[],
        currentBalanceTokenIn: bigint,
        currentBalanceTokenOut: bigint,
        _weightIn: bigint,
        _weightOut: bigint
    ): bigint[] {
        return WeightedMath._calcOutGivenIn(
            currentBalanceTokenIn,
            _weightIn,
            currentBalanceTokenOut,
            _weightOut,
            tokenAmountsIn
        );
    }
}

export class WeightedMath {
    static _MAX_IN_RATIO = BigInt(300000000000000000);
    static _MAX_OUT_RATIO = BigInt(300000000000000000);
    // Computes how many tokens can be taken out of a pool if `amountIn` are sent, given the
    // current balances and weights.
    static _calcOutGivenIn(
        balanceIn: bigint,
        weightIn: bigint,
        balanceOut: bigint,
        weightOut: bigint,
        amountsIn: bigint[]
    ): bigint[] {
        /**********************************************************************************************
    // outGivenIn                                                                                //
    // aO = amountOut                                                                            //
    // bO = balanceOut                                                                           //
    // bI = balanceIn              /      /            bI             \    (wI / wO) \           //
    // aI = amountIn    aO = bO * |  1 - | --------------------------  | ^            |          //
    // wI = weightIn               \      \       ( bI + aI )         /              /           //
    // wO = weightOut                                                                            //
    **********************************************************************************************/

        // Amount out, so we round down overall.

        // The multiplication rounds down, and the subtrahend (power) rounds up (so the base rounds up too).
        // Because bI / (bI + aI) <= 1, the exponent rounds down.

        // Cannot exceed maximum in ratio

        const exponent = MathSol.divDownFixed(weightIn, weightOut);
        return amountsIn.map((amountIn) => {
            _require(
                amountIn <= MathSol.mulDownFixed(balanceIn, this._MAX_IN_RATIO),
                'Errors.MAX_IN_RATIO'
            );
            const denominator = balanceIn + amountIn;
            const base = MathSol.divUpFixed(balanceIn, denominator);
            const power = MathSol.powUpFixed(base, exponent);

            return MathSol.mulDownFixed(
                balanceOut,
                MathSol.complementFixed(power)
            );
        });
    }
}
