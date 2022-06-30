import { BigNumber, parseFixed } from '@ethersproject/bignumber';

// Swap limits: amounts swapped may not be larger than this percentage of total balance.

export const _MAX_IN_RATIO: BigNumber = parseFixed('0.3', 18);
export const _MAX_OUT_RATIO: BigNumber = parseFixed('0.3', 18);

export const SQRT_1E_NEG_1 = BigNumber.from('316227766016837933');
export const SQRT_1E_NEG_3 = BigNumber.from('31622776601683793');
export const SQRT_1E_NEG_5 = BigNumber.from('3162277660168379');
export const SQRT_1E_NEG_7 = BigNumber.from('316227766016837');
export const SQRT_1E_NEG_9 = BigNumber.from('31622776601683');
export const SQRT_1E_NEG_11 = BigNumber.from('3162277660168');
export const SQRT_1E_NEG_13 = BigNumber.from('316227766016');
export const SQRT_1E_NEG_15 = BigNumber.from('31622776601');
export const SQRT_1E_NEG_17 = BigNumber.from('3162277660');
