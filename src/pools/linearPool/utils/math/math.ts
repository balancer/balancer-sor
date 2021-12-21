// Ported from Solidity:
// https://github.com/balancer-labs/balancer-v2-monorepo/blob/ce70f7663e0ac94b25ed60cb86faaa8199fd9e13/pkg/solidity-utils/contracts/math/Math.sol

import BigNumber, { bn } from '../big-number';

export const ZERO = bn(0);
export const ONE = bn(1);
export const TWO = bn(2);

export const abs = (a: BigNumber, b: BigNumber): BigNumber => {
    return a.gt(0) ? a : a.negated();
};

export const add = (a: BigNumber, b: BigNumber): BigNumber => {
    return a.plus(b);
};

export const sub = (a: BigNumber, b: BigNumber): BigNumber => {
    if (b.gt(a)) {
        throw new Error('SUB_OVERFLOW');
    }
    return a.minus(b);
};

export const max = (a: BigNumber, b: BigNumber): BigNumber => {
    return a.gte(b) ? a : b;
};

export const min = (a: BigNumber, b: BigNumber): BigNumber => {
    return a.lt(b) ? a : b;
};

export const mul = (a: BigNumber, b: BigNumber): BigNumber => {
    return a.times(b);
};

export const div = (
    a: BigNumber,
    b: BigNumber,
    roundUp: boolean
): BigNumber => {
    return roundUp ? divUp(a, b) : divDown(a, b);
};

export const divDown = (a: BigNumber, b: BigNumber): BigNumber => {
    if (b.isZero()) {
        throw new Error('ZERO_DIVISION');
    }
    return a.idiv(b);
};

export const divUp = (a: BigNumber, b: BigNumber): BigNumber => {
    if (b.isZero()) {
        throw new Error('ZERO_DIVISION');
    }
    return a.isZero() ? ZERO : ONE.plus(a.minus(ONE).idiv(b));
};
