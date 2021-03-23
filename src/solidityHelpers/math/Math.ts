// SPDX-License-Identifier: MIT

// This is ported to JS from solidity
// https://github.com/balancer-labs/balancer-core-v2/blob/master/contracts/lib/math/Math.sol

import { BigNumber } from '../../utils/bignumber';

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow checks.
 * Adapted from OpenZeppelin's SafeMath library
 */

/**
 * @dev Returns the addition of two unsigned integers of 256 bits, reverting on overflow.
 */
function add(a: BigNumber, b: BigNumber): BigNumber {
    let c = a.plus(b);
    return c;
}

/**
 * @dev Returns the subtraction of two unsigned integers of 256 bits, reverting on overflow.
 */
function sub(a: BigNumber, b: BigNumber): BigNumber {
    let c = a.minus(b);
    return c;
}

/**
 * @dev Returns the largest of two numbers of 256 bits.
 */
function max(a: BigNumber, b: BigNumber): BigNumber {
    return a.gte(b) ? a : b;
}

/**
 * @dev Returns the smallest of two numbers of 256 bits.
 */
function min(a: BigNumber, b: BigNumber): BigNumber {
    return a.lt(b) ? a : b;
}

function mul(a: BigNumber, b: BigNumber): BigNumber {
    let c = a.times(b);
    return c;
}

function divDown(a: BigNumber, b: BigNumber): BigNumber {
    return a.idiv(b);
}

function divUp(a: BigNumber, b: BigNumber): BigNumber {
    if (a.isZero()) {
        return a;
    } else {
        return new BigNumber(1).plus(a.minus(new BigNumber(1)).idiv(b));
    }
}
