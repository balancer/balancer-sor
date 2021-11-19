import { MathSol } from './basicOperations';

// PairType = 'token->token'
// SwapType = 'swapExactIn'
// Would it be better to call this _calcOutGivenIn?
export function _exactTokenInForTokenOut(
    balanceIn: bigint,
    weightIn: bigint,
    balanceOut: bigint,
    weightOut: bigint,
    amountIn: bigint,
    fee: bigint
): bigint {
    // is it necessary to check ranges of variables? same for the other functions
    amountIn = subtractFee(amountIn, fee);
    const exponent = MathSol.divDownFixed(weightIn, weightOut);
    const denominator = balanceIn + amountIn;
    const base = MathSol.divUpFixed(balanceIn, denominator);
    const power = MathSol.powUpFixed(base, exponent);
    return MathSol.mulDownFixed(balanceOut, MathSol.complementFixed(power));
}

// PairType = 'token->token'
// SwapType = 'swapExactOut'
export function _tokenInForExactTokenOut(
    balanceIn: bigint,
    weightIn: bigint,
    balanceOut: bigint,
    weightOut: bigint,
    amountOut: bigint,
    fee: bigint
): bigint {
    const base = MathSol.divUpFixed(balanceOut, balanceOut - amountOut);
    const exponent = MathSol.divUpFixed(weightOut, weightIn);
    const power = MathSol.powUpFixed(base, exponent);
    const ratio = MathSol.sub(power, MathSol.ONE);
    let amountIn = MathSol.mulUpFixed(balanceIn, ratio);
    return addFee(amountIn, fee);
}

function subtractFee(amount: bigint, fee: bigint): bigint {
    const feeAmount = MathSol.mulUpFixed(amount, fee);
    return amount - feeAmount;
}

function addFee(amount: bigint, fee: bigint): bigint {
    return MathSol.divUpFixed(amount, MathSol.complementFixed(fee));
}
