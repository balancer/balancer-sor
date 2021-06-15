import { Decimal } from 'decimal.js';
import { BigNumber } from '../../utils/bignumber';
export declare type BigNumberish = string | number | BigNumber;
export declare const decimal: (
    x: string | number | BigNumber | Decimal
) => Decimal;
export declare const fp: (x: number | Decimal) => BigNumber;
export declare const toFp: (
    x: string | number | BigNumber | Decimal
) => Decimal;
export declare const fromFp: (
    x: string | number | BigNumber | Decimal
) => Decimal;
export declare const bn: (
    x: string | number | BigNumber | Decimal
) => BigNumber;
export declare const maxUint: (e: number) => BigNumber;
export declare const maxInt: (e: number) => BigNumber;
export declare const minInt: (e: number) => BigNumber;
export declare const pct: (
    x: string | number | BigNumber,
    pct: string | number | BigNumber
) => BigNumber;
export declare const max: (
    a: string | number | BigNumber,
    b: string | number | BigNumber
) => BigNumber;
export declare const min: (
    a: string | number | BigNumber,
    b: string | number | BigNumber
) => BigNumber;
export declare const arrayAdd: (
    arrA: (string | number | BigNumber)[],
    arrB: (string | number | BigNumber)[]
) => BigNumber[];
export declare const arraySub: (
    arrA: (string | number | BigNumber)[],
    arrB: (string | number | BigNumber)[]
) => BigNumber[];
export declare const divCeil: (x: BigNumber, y: BigNumber) => BigNumber;
export declare const FP_SCALING_FACTOR: BigNumber;
