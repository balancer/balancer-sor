import { Decimal } from 'decimal.js';
import { BigNumber } from '../../utils/bignumber';
import { FixedPointNumber as BigNumberFp } from '../../math/FixedPointNumber';
import { BigNumberish } from './numbers';
export declare function calculateInvariant(
    fpRawBalances: BigNumberish[],
    amplificationParameter: BigNumberish
): BigNumber;
export declare function calculateApproxInvariant(
    fpRawBalances: BigNumberish[],
    amplificationParameter: BigNumberish
): BigNumber;
export declare function calculateAnalyticalInvariantForTwoTokens(
    fpRawBalances: BigNumberish[],
    amplificationParameter: BigNumberish
): BigNumber;
export declare function _exactTokenInForTokenOut(
    fpBalances: BigNumberFp[],
    amplificationParameter: BigNumberFp,
    tokenIndexIn: number,
    tokenIndexOut: number,
    fpTokenAmountIn: BigNumberFp,
    swapFee: BigNumberFp
): BigNumberFp;
export declare function _tokenInForExactTokenOut(
    fpBalances: BigNumberFp[],
    amplificationParameter: BigNumberFp,
    tokenIndexIn: number,
    tokenIndexOut: number,
    fpTokenAmountOut: BigNumberFp,
    swapFee: BigNumberFp
): BigNumberFp;
export declare function _exactTokensInForBPTOut(
    fpBalances: BigNumberFp[],
    amplificationParameter: BigNumberFp,
    fpAmountsIn: BigNumberFp[],
    fpBptTotalSupply: BigNumberFp,
    fpSwapFeePercentage: BigNumberFp
): BigNumberFp;
export declare function _tokenInForExactBPTOut(
    tokenIndex: number,
    fpBalances: BigNumberFp[],
    amplificationParameter: BigNumberFp,
    fpBptAmountOut: BigNumberFp,
    fpBptTotalSupply: BigNumberFp,
    fpSwapFeePercentage: BigNumberFp
): BigNumberFp;
export declare function _bptInForExactTokensOut(
    fpBalances: BigNumberFp[],
    amplificationParameter: BigNumberFp,
    fpAmountsOut: BigNumberFp[],
    fpBptTotalSupply: BigNumberFp,
    fpSwapFeePercentage: BigNumberFp
): BigNumberFp;
export declare function _exactBPTInForTokenOut(
    tokenIndex: number,
    fpBalances: BigNumberFp[],
    amplificationParameter: BigNumberFp,
    fpBptAmountIn: BigNumberFp,
    fpBptTotalSupply: BigNumberFp,
    fpSwapFeePercentage: BigNumberFp
): BigNumberFp;
export declare function _exactBPTInForTokensOut(
    fpBalances: BigNumberFp[],
    fpBptAmountIn: BigNumberFp,
    fpBptTotalSupply: BigNumberFp
): BigNumberFp[];
export declare function calculateOneTokenSwapFeeAmount(
    fpBalances: BigNumberish[],
    amplificationParameter: BigNumberish,
    lastInvariant: BigNumberish,
    tokenIndex: number
): Decimal;
export declare function getTokenBalanceGivenInvariantAndAllOtherBalances(
    amp: BigNumber,
    fpBalances: BigNumber[],
    fpInvariant: BigNumber,
    tokenIndex: number
): BigNumber;
