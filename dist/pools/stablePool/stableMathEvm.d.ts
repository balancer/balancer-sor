import { Decimal } from 'decimal.js';
import { BigNumber } from '../../utils/bignumber';
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
export declare function calcOutGivenIn(
    fpBalances: BigNumberish[],
    amplificationParameter: BigNumberish,
    tokenIndexIn: number,
    tokenIndexOut: number,
    fpTokenAmountIn: BigNumberish,
    swapFee: BigNumberish
): BigNumber;
export declare function calcInGivenOut(
    fpBalances: BigNumberish[],
    amplificationParameter: BigNumberish,
    tokenIndexIn: number,
    tokenIndexOut: number,
    fpTokenAmountOut: BigNumberish,
    swapFee: BigNumberish
): BigNumber;
export declare function calcBptOutGivenExactTokensIn(
    fpBalances: BigNumberish[],
    amplificationParameter: BigNumberish,
    fpAmountsIn: BigNumberish[],
    fpBptTotalSupply: BigNumberish,
    fpSwapFeePercentage: BigNumberish
): BigNumber;
export declare function calcTokenInGivenExactBptOut(
    tokenIndex: number,
    fpBalances: BigNumberish[],
    amplificationParameter: BigNumberish,
    fpBptAmountOut: BigNumberish,
    fpBptTotalSupply: BigNumberish,
    fpSwapFeePercentage: BigNumberish
): BigNumber;
export declare function calcBptInGivenExactTokensOut(
    fpBalances: BigNumber[],
    amplificationParameter: BigNumberish,
    fpAmountsOut: BigNumber[],
    fpBptTotalSupply: BigNumber,
    fpSwapFeePercentage: BigNumber
): BigNumber;
export declare function calcTokenOutGivenExactBptIn(
    tokenIndex: number,
    fpBalances: BigNumberish[],
    amplificationParameter: BigNumberish,
    fpBptAmountIn: BigNumberish,
    fpBptTotalSupply: BigNumberish,
    fpSwapFeePercentage: BigNumberish
): BigNumber;
export declare function calcTokensOutGivenExactBptIn(
    fpBalances: BigNumberish[],
    fpBptAmountIn: BigNumberish,
    fpBptTotalSupply: BigNumberish
): BigNumber[];
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
