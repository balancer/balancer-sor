/////////
/// UI Helpers
/////////

// Get BPT amount with zero-price impact
export function _ExactTokensInForBPTOutZeroPriceImpact(
    poolPairData: any,
    amountsIn: BigNumber[]
): BigNumber {
    return bnum(1);
}

// Get BPT amount with zero-price impact
export function _BPTInForExactTokensOutZeroPriceImpact(
    poolPairData: any,
    amountsOut: BigNumber[]
): BigNumber {
    return bnum(1);
}

// PairType = 'token->token'
export function _spotPriceTokenInForTokenOut(poolPairData): BigNumber {
    return _derivative(_tokenInForExactTokenOut, amount, poolPairData);
}
