import { BigNumber } from '@ethersproject/bignumber';

export const MAX_BALANCES = BigNumber.from(10).pow(34); // 1e16 in normal precision

// Invariant calculation
export const MAX_INVARIANT = BigNumber.from(10).pow(37).mul(3); // 3e19 in normal precision
