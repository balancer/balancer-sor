import { BigNumber } from 'bignumber.js';

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: 1,
    DECIMAL_PLACES: 18,
});

export default BigNumber;

type BigNumberish = BigNumber | number | string;

export const bn = (value: BigNumberish): BigNumber => new BigNumber(value);

export const scale = (value: BigNumberish, decimalPlaces: number): BigNumber =>
    bn(value).times(bn(10).pow(decimalPlaces));

export const scaleAll = (
    values: BigNumberish[],
    decimalPlaces: number
): BigNumber[] => values.map((x) => scale(x, decimalPlaces));
