// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// This is ported to JS from solidity
// https://github.com/balancer-labs/balancer-core-v2/blob/master/contracts/lib/math/FixedPoint.sol

import { BigNumber } from '../../utils/bignumber';
import * as Math from './Math';
import * as LogExpMath from './LogExpMath';

// This class was created to simplify the process of porting solidity code to js
export class FixedPoint extends BigNumber {
    // number: FixedPoint;
    constructor(number) {
        super(number);
        // this.number = number;
    }

    add(b: FixedPoint): FixedPoint {
        // Fixed Point addition is the same as regular checked addition
        let a = this;
        let c = a.plus(b);
        return new FixedPoint(c);
    }

    sub(b: FixedPoint): FixedPoint {
        // Fixed Point addition is the same as regular checked addition
        let a = this;
        let c = a.minus(b);
        return new FixedPoint(c);
    }

    mul(b: FixedPoint): FixedPoint {
        let a = this;
        let c0 = a.times(b);
        let c1 = c0.plus(ONE.div(new BigNumber(2)));
        let c2 = c1.idiv(ONE);
        return new FixedPoint(c2);
    }

    mulDown(b: FixedPoint): FixedPoint {
        let a = this;
        let product = a.times(b);
        return new FixedPoint(product.idiv(ONE));
    }

    mulUp(b: FixedPoint): FixedPoint {
        let a = this;
        let product = a.times(b);
        if (product.isZero()) {
            return new FixedPoint(product);
        } else {
            // The traditional divUp formula is:
            // divUp(x, y) := (x + y - 1) / y
            // To avoid intermediate overflow in the addition, we distribute the division and get:
            // divUp(x, y) := (x - 1) / y + 1
            // Note that this requires x != 0, which we already tested for.

            return new FixedPoint(product
                .minus(bnum(1))
                .div(ONE)
                .plus(bnum(1)));
        }
    }

    // div(b: FixedPoint): FixedPoint {
    //     let a = this;
    //     let c0 = a.times(ONE);
    //     let c1 = c0.plus(b.div(new FixedPoint(2)));
    //     let c2 = c1.idiv(b);
    //     return new FixedPoint(c2);
    // }

    divDown(b: FixedPoint): FixedPoint {
        let a = this;
        if (a.isZero()) {
            return new FixedPoint(a);
        } else {
            let aInflated = a.times(ONE);
            return new FixedPoint(aInflated.idiv(b));
        }
    }

    divUp(b: FixedPoint): FixedPoint {
        let a = this;
        if (a.isZero()) {
            return new FixedPoint(a);
        } else {
            let aInflated = a.times(ONE);
            // The traditional divUp formula is:
            // divUp(x, y) := (x + y - 1) / y
            // To avoid intermediate overflow in the addition, we distribute the division and get:
            // divUp(x, y) := (x - 1) / y + 1
            // Note that this requires x != 0, which we already tested for.

            return new FixedPoint(aInflated
                .minus(bnum(1))
                .div(ONE)
                .plus(bnum(1)));
        }
    }

    // pow(x: FixedPoint, y: FixedPoint): FixedPoint {
    //     return new FixedPoint(LogExpMath.pow(x, y);
    // }

    powDown(x: FixedPoint, y: FixedPoint): FixedPoint {
        let result = new FixedPoint(LogExpMath.pow(x, y));
        if (result.isZero()) {
            return result;
        }
        return sub(
            sub(result, mulDown(result, MAX_POW_RELATIVE_ERROR)),
            bnum(1)
        );
    }

    powUp(x: FixedPoint, y: FixedPoint): FixedPoint {
        let result = new FixedPoint(LogExpMath.pow(x, y));
        return add(add(result, mulUp(result, MAX_POW_RELATIVE_ERROR)), bnum(1));
    }

    /**
     * @dev Tells the complement of a given value capped to zero to avoid overflow
     */
    complement(x: FixedPoint): FixedPoint {
        return new FixedPoint(x >= ONE ? bnum(0) : sub(ONE, x));
    }
}

// /* solhint-disable private-vars-leading-underscore */

export const ONE = new FixedPoint(1000000000000000000);
export const MAX_POW_RELATIVE_ERROR = new FixedPoint(10000); // 10^(-14)

export function bnum(val: string | number | BigNumber): FixedPoint {
    return new FixedPoint(val.toString());
}

export function add(a: FixedPoint, b: FixedPoint): FixedPoint {
    // Fixed Point addition is the same as regular checked addition
    let c = a.plus(b);
    return new FixedPoint(c);
}

export function sub(a: FixedPoint, b: FixedPoint): FixedPoint {
    // Fixed Point addition is the same as regular checked addition
    let c = a.minus(b);
    return new FixedPoint(c);
}

export function mul(a: FixedPoint, b: FixedPoint): FixedPoint {
    let c0 = a.times(b);
    let c1 = c0.plus(ONE.div(new BigNumber(2)));
    let c2 = c1.idiv(ONE);
    return new FixedPoint(c2);
}

export function mulDown(a: FixedPoint, b: FixedPoint): FixedPoint {
    let product = a.times(b);
    return new FixedPoint(product.idiv(ONE));
}

export function mulUp(a: FixedPoint, b: FixedPoint): FixedPoint {
    let product = a.times(b);
    if (product.isZero()) {
        return new FixedPoint(product);
    } else {
        // The traditional divUp formula is:
        // divUp(x, y) := (x + y - 1) / y
        // To avoid intermediate overflow in the addition, we distribute the division and get:
        // divUp(x, y) := (x - 1) / y + 1
        // Note that this requires x != 0, which we already tested for.

        return new FixedPoint(product
            .minus(bnum(1))
            .div(ONE)
            .plus(bnum(1)));
    }
}

export function div(a: FixedPoint, b: FixedPoint): FixedPoint {
    let c0 = a.times(ONE);
    let c1 = c0.plus(b.div(new FixedPoint(2)));
    let c2 = c1.idiv(b);
    return new FixedPoint(c2);
}

export function divDown(a: FixedPoint, b: FixedPoint): FixedPoint {
    if (a.isZero()) {
        return new FixedPoint(a);
    } else {
        let aInflated = a.times(ONE);
        return new FixedPoint(aInflated.idiv(b));
    }
}

export function divUp(a: FixedPoint, b: FixedPoint): FixedPoint {
    if (a.isZero()) {
        return new FixedPoint(a);
    } else {
        let aInflated = a.times(ONE);
        // The traditional divUp formula is:
        // divUp(x, y) := (x + y - 1) / y
        // To avoid intermediate overflow in the addition, we distribute the division and get:
        // divUp(x, y) := (x - 1) / y + 1
        // Note that this requires x != 0, which we already tested for.

        return new FixedPoint(aInflated
            .minus(bnum(1))
            .div(ONE)
            .plus(bnum(1)));
    }
}

export function pow(x: FixedPoint, y: FixedPoint): FixedPoint {
    return new FixedPoint(LogExpMath.pow(x, y));
}

export function powDown(x: FixedPoint, y: FixedPoint): FixedPoint {
    let result = new FixedPoint(LogExpMath.pow(x, y));
    if (result.isZero()) {
        return result;
    }
    return new FixedPoint(sub(sub(result, mulDown(result, MAX_POW_RELATIVE_ERROR)), bnum(1)));
}

export function powUp(x: FixedPoint, y: FixedPoint): FixedPoint {
    let result = new FixedPoint(LogExpMath.pow(x, y));
    return new FixedPoint(add(add(result, mulUp(result, MAX_POW_RELATIVE_ERROR)), bnum(1)));
}

/**
 * @dev Tells the complement of a given value capped to zero to avoid overflow
 */
export function complement(x: FixedPoint): FixedPoint {
    return new FixedPoint(x >= ONE ? bnum(0) : sub(ONE, x));
}
