import { BigNumber, parseFixed } from '@ethersproject/bignumber';

// Swap limits: amounts swapped may not be larger than this percentage of total balance.

export const _MAX_IN_RATIO: BigNumber = parseFixed('0.3', 18);
export const _MAX_OUT_RATIO: BigNumber = parseFixed('0.3', 18);
