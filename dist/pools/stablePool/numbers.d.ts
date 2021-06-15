import { Decimal } from 'decimal.js';
import { BigNumber } from '../../utils/bignumber';
import { FixedPointNumber } from '../../math/FixedPointNumber';
export declare type BigNumberish =
    | string
    | number
    | BigNumber
    | FixedPointNumber;
export declare const decimal: (
    x: string | number | BigNumber | FixedPointNumber | Decimal
) => Decimal;
export declare const fp: (x: number | Decimal) => BigNumber;
export declare const toFp: (
    x: string | number | BigNumber | FixedPointNumber | Decimal
) => Decimal;
export declare const fromFp: (
    x: string | number | BigNumber | FixedPointNumber | Decimal
) => Decimal;
export declare const bn: (
    x: string | number | BigNumber | FixedPointNumber | Decimal
) => BigNumber;
export declare const maxUint: (e: number) => BigNumber;
export declare const maxInt: (e: number) => BigNumber;
export declare const minInt: (e: number) => BigNumber;
export declare const pct: (x: BigNumberish, pct: BigNumberish) => BigNumber;
export declare const max: (a: BigNumberish, b: BigNumberish) => BigNumber;
export declare const min: (a: BigNumberish, b: BigNumberish) => BigNumber;
export declare const arrayAdd: (
    arrA: BigNumberish[],
    arrB: BigNumberish[]
) => BigNumber[];
export declare const arraySub: (
    arrA: BigNumberish[],
    arrB: BigNumberish[]
) => BigNumber[];
export declare const divCeil: (x: BigNumber, y: BigNumber) => BigNumber;
export declare const FP_SCALING_FACTOR: BigNumber;
