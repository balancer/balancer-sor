import { BigNumber } from '../../utils/bignumber';
/**
 * Calculate the natural exponentiation of a number with 18 decimals precision.
 * @param x Exponent with 18 decimal places.
 * @notice Max x is log((2^255 - 1) / 10^20) = 130.700829182905140221
 * @notice Min x log(0.000000000000000001) = -41.446531673892822312
 * @return eˆx
 */
export declare function n_exp(x: BigNumber): BigNumber;
/**
 * Calculate the natural logarithm of a number with 18 decimals precision.
 * @param a Positive number with 18 decimal places.
 * @return ln(x)
 */
export declare function n_log(a: BigNumber): BigNumber;
/**
 * Computes x to the power of y for numbers with 18 decimals precision.
 * @param x Base with 18 decimal places.
 * @param y Exponent with 18 decimal places.
 * @notice Must fulfil: -41.446531673892822312  < (log(x) * y) <  130.700829182905140221
 * @return xˆy
 */
export declare function pow(x: BigNumber, y: BigNumber): BigNumber;
/**
 * Computes log of a number in base of another number, both numbers with 18 decimals precision.
 * @param arg Argument with 18 decimal places.
 * @param base Base with 18 decimal places.
 * @notice Must fulfil: -41.446531673892822312  < (log(x) * y) <  130.700829182905140221
 * @return log[base](arg)
 */
export declare function log(arg: BigNumber, base: BigNumber): BigNumber;
/**
 * Private export function to calculate the natural logarithm of a number with 36 decimals precision.
 * @param a Positive number with 18 decimal places.
 * @return ln(x)
 */
export declare function n_log_36(a: BigNumber): BigNumber;
