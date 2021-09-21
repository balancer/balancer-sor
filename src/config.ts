import { BigNumber as OldBigNumber } from './utils/bignumber';

// priceErrorTolerance is how close we expect prices after swap to be in SOR
// suggested paths
const priceErrorTolerance: string =
    process.env.PRICE_ERROR_TOLERANCE || '0.00001';
export const PRICE_ERROR_TOLERANCE: OldBigNumber = new OldBigNumber(
    priceErrorTolerance
);
// infinitesimal is an amount that's used to initialize swap amounts so they are
// not zero or the path's limit.
// It's also used in the calculation of derivatives in pool maths
// const infinitesimal: string = process.env.INFINITESIMAL || '0.000001';
const infinitesimal = '0.01'; // Increasing INFINITESIMAL to '0.01' to test derivative sensitivity
export const INFINITESIMAL = new OldBigNumber(infinitesimal);
