import { BigNumber } from 'bignumber.js';

// needed in order for the curve params (epsilon, alpha etc) to
// have enough precision to as the ABDK 64.64 fixed point library
// in the smart contract
BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: 1,
    DECIMAL_PLACES: 36,
});

export const ZERO = bnum(0);
export const ONE = bnum(1);
export const INFINITY = bnum('Infinity');

export function scale(input: BigNumber, decimalPlaces: number): BigNumber {
    const scalePow = new BigNumber(decimalPlaces.toString());
    const scaleMul = new BigNumber(10).pow(scalePow);
    return input.times(scaleMul);
}

export function bnum(val: string | number | BigNumber): BigNumber {
    return new BigNumber(val.toString());
}

export { BigNumber };
