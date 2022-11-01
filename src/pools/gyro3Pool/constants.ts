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

// POW3 constant
// Threshold of x where the normal method of computing x^3 would overflow and we need a workaround.
// Equal to 4.87e13 scaled; 4.87e13 is the point x where x**3 * 10**36 = (x**2 native) * (x native) ~ 2**256
export const _SAFE_LARGE_POW3_THRESHOLD = BigNumber.from(10).pow(29).mul(487);
export const MIDDECIMAL = BigNumber.from(10).pow(9); // splits the fixed point decimals into two equal parts.

// Stopping criterion for the Newton iteration that computes the invariant:
// - Stop if the step width doesn't shrink anymore by at least a factor _INVARIANT_SHRINKING_FACTOR_PER_STEP.
// - ... but in any case, make at least _INVARIANT_MIN_ITERATIONS iterations. This is useful to compensate for a
// less-than-ideal starting point, which is important when alpha is small.
export const _INVARIANT_SHRINKING_FACTOR_PER_STEP = 8;
export const _INVARIANT_MIN_ITERATIONS = 5;

// Swap Limit factor
export const SWAP_LIMIT_FACTOR = BigNumber.from('999999000000000000');
