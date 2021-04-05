import { BigNumber } from './utils/bignumber';

let allowAddRemove: string | boolean = process.env.ALLOW_ADD_REMOVE || false;
if (typeof allowAddRemove === 'string') {
    if (allowAddRemove === 'true' || allowAddRemove === 'True')
        allowAddRemove = true;
    else allowAddRemove = false;
}
export const ALLOW_ADD_REMOVE: boolean = allowAddRemove;
// priceErrorTolerance is how close we expect prices after swap to be in SOR
// suggested paths
const priceErrorTolerance: string =
    process.env.PRICE_ERROR_TOLERANCE || '0.00001';
export const PRICE_ERROR_TOLERANCE: BigNumber = new BigNumber(
    priceErrorTolerance
);
// infinitesimal is an amount that's used to initialize swap amounts so they are
// not zero or the path's limit.
// It's also used in the calculation of derivatives in pool maths
const infinitesimal: string = process.env.INFINITESIMAL || '0.000001';
export const INFINITESIMAL = new BigNumber(infinitesimal);
