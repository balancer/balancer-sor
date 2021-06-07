import { FixedPointNumber as BigNumber } from '../../math/FixedPointNumber';
export declare function _exactTokenInForTokenOut(
    tokenBalanceIn: BigNumber,
    tokenWeightIn: BigNumber,
    tokenBalanceOut: BigNumber,
    tokenWeightOut: BigNumber,
    tokenAmountIn: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function _tokenInForExactTokenOut(
    tokenBalanceIn: BigNumber,
    tokenWeightIn: BigNumber,
    tokenBalanceOut: BigNumber,
    tokenWeightOut: BigNumber,
    tokenAmountOut: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function _invariant(
    normalizedWeights: BigNumber[],
    balances: BigNumber[]
): BigNumber;
export declare function _exactTokensInForBPTOut(
    balances: BigNumber[],
    normalizedWeights: BigNumber[],
    amountsIn: BigNumber[],
    bptTotalSupply: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function _exactTokenInForBPTOut(
    balance: BigNumber,
    normalizedWeight: BigNumber,
    amountIn: BigNumber,
    bptTotalSupply: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function _tokenInForExactBPTOut(
    tokenBalance: BigNumber,
    tokenNormalizedWeight: BigNumber,
    bptAmountOut: BigNumber,
    bptTotalSupply: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function _exactBPTInForTokenOut(
    tokenBalance: BigNumber,
    tokenNormalizedWeight: BigNumber,
    bptAmountIn: BigNumber,
    bptTotalSupply: BigNumber,
    swapFee: BigNumber
): BigNumber;
export declare function _exactBPTInForTokensOut(
    currentBalances: BigNumber[],
    bptAmountIn: BigNumber,
    totalBPT: BigNumber
): BigNumber[];
export declare function _bptInForExactTokensOut(
    balances: BigNumber[],
    normalizedWeights: BigNumber[],
    amountsOut: BigNumber[],
    bptTotalSupply: BigNumber,
    swapFee: any
): BigNumber;
export declare function _bptInForExactTokenOut(
    balance: BigNumber,
    normalizedWeight: BigNumber,
    amountOut: BigNumber,
    bptTotalSupply: BigNumber,
    swapFee: any
): BigNumber;
