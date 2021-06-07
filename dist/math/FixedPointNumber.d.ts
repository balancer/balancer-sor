import { BigNumber } from '../utils/bignumber';
export declare class FixedPointNumber extends BigNumber {
    constructor(number: any);
    add(b: FixedPointNumber): FixedPointNumber;
    sub(b: FixedPointNumber): FixedPointNumber;
    mul(b: FixedPointNumber): FixedPointNumber;
    mulDown(b: FixedPointNumber): FixedPointNumber;
    mulUp(b: FixedPointNumber): FixedPointNumber;
    divDown(b: FixedPointNumber): FixedPointNumber;
    divUp(b: FixedPointNumber): FixedPointNumber;
    powDown(x: FixedPointNumber, y: FixedPointNumber): FixedPointNumber;
    powUp(x: FixedPointNumber, y: FixedPointNumber): FixedPointNumber;
    /**
     * @dev Tells the complement of a given value capped to zero to avoid overflow
     */
    complement(): FixedPointNumber;
}
