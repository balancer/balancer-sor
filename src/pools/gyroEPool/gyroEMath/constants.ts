import { BigNumber } from '@ethersproject/bignumber';

// SQRT constants

export const SQRT_1E_NEG_1 = BigNumber.from('316227766016837933');
export const SQRT_1E_NEG_3 = BigNumber.from('31622776601683793');
export const SQRT_1E_NEG_5 = BigNumber.from('3162277660168379');
export const SQRT_1E_NEG_7 = BigNumber.from('316227766016837');
export const SQRT_1E_NEG_9 = BigNumber.from('31622776601683');
export const SQRT_1E_NEG_11 = BigNumber.from('3162277660168');
export const SQRT_1E_NEG_13 = BigNumber.from('316227766016');
export const SQRT_1E_NEG_15 = BigNumber.from('31622776601');
export const SQRT_1E_NEG_17 = BigNumber.from('3162277660');

export const MAX_BALANCES = BigNumber.from(10).pow(34); // 1e16 in normal precision

// High precision
export const ONE_XP = BigNumber.from(10).pow(38); // 38 decimal places

// Invariant calculation
export const MAX_INVARIANT = BigNumber.from(10).pow(37).mul(3); // 3e19 in normal precision

// Small number to prevent rounding errors
export const SMALL = BigNumber.from(10).pow(8); // 1e-10 in normal precision

// Swap Limit factor
export const SWAP_LIMIT_FACTOR = BigNumber.from('999999000000000000');
