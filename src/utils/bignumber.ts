import { BigNumber } from 'bignumber.js';
BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: 1,
    DECIMAL_PLACES: 18,
});

export { BigNumber };
