import { BigNumber } from '../../utils/bignumber';
import { FixedPointNumber } from '../FixedPointNumber';
export declare const ONE: FixedPointNumber;
export declare const MAX_POW_RELATIVE_ERROR: FixedPointNumber;
export declare function fnum(
    val: string | number | BigNumber
): FixedPointNumber;
export declare function add(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber;
export declare function sub(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber;
export declare function mul(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber;
export declare function mulDown(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber;
export declare function mulUp(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber;
export declare function div(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber;
export declare function divDown(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber;
export declare function divUp(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber;
export declare function pow(
    x: FixedPointNumber,
    y: FixedPointNumber
): FixedPointNumber;
export declare function powDown(
    x: FixedPointNumber,
    y: FixedPointNumber
): FixedPointNumber;
export declare function powUp(
    x: FixedPointNumber,
    y: FixedPointNumber
): FixedPointNumber;
/**
 * @dev Tells the complement of a given value capped to zero to avoid overflow
 */
export declare function complement(x: FixedPointNumber): FixedPointNumber;
