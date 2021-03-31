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

import { BigNumber } from '../utils/bignumber';
import * as LogExpMath from './lib/logExpMath';
import {
    ONE,
    MAX_POW_RELATIVE_ERROR,
    fnum,
    sub,
    mulDown,
    add,
    mulUp,
} from './lib/fixedPoint';

// This class was created to simplify the process of porting solidity code to js
export class FixedPointNumber extends BigNumber {
    // number: FixedPoint;
    constructor(number) {
        super(number);
        // this.number = number;
    }

    add(b: FixedPointNumber): FixedPointNumber {
        // Fixed Point addition is the same as regular checked addition
        let a = this;
        let c = a.plus(b);
        return new FixedPointNumber(c);
    }

    sub(b: FixedPointNumber): FixedPointNumber {
        // Fixed Point addition is the same as regular checked addition
        let a = this;
        let c = a.minus(b);
        return new FixedPointNumber(c);
    }

    mul(b: FixedPointNumber): FixedPointNumber {
        let a = this;
        let c0 = a.times(b);
        let c1 = c0.plus(ONE.idiv(new BigNumber(2)));
        let c2 = c1.idiv(ONE);
        return new FixedPointNumber(c2);
    }

    mulDown(b: FixedPointNumber): FixedPointNumber {
        let a = this;
        let product = a.times(b);
        return new FixedPointNumber(product.idiv(ONE));
    }

    mulUp(b: FixedPointNumber): FixedPointNumber {
        let a = this;
        let product = a.times(b);
        if (product.isZero()) {
            return new FixedPointNumber(product);
        } else {
            // The traditional divUp formula is:
            // divUp(x, y) := (x + y - 1) / y
            // To avoid intermediate overflow in the addition, we distribute the division and get:
            // divUp(x, y) := (x - 1) / y + 1
            // Note that this requires x != 0, which we already tested for.

            return new FixedPointNumber(
                product
                    .minus(fnum(1))
                    .idiv(ONE)
                    .plus(fnum(1))
            );
        }
    }

    // div(b: FixedPointNumber): FixedPointNumber {
    //     let a = this;
    //     let c0 = a.times(ONE);
    //     let c1 = c0.plus(b.idiv(new FixedPointNumber(2)));
    //     let c2 = c1.idiv(b);
    //     return new FixedPointNumber(c2);
    // }

    divDown(b: FixedPointNumber): FixedPointNumber {
        let a = this;
        if (a.isZero()) {
            return new FixedPointNumber(a);
        } else {
            let aInflated = a.times(ONE);
            return new FixedPointNumber(aInflated.idiv(b));
        }
    }

    divUp(b: FixedPointNumber): FixedPointNumber {
        let a = this;
        if (a.isZero()) {
            return new FixedPointNumber(a);
        } else {
            let aInflated = a.times(ONE);
            // The traditional divUp formula is:
            // divUp(x, y) := (x + y - 1) / y
            // To avoid intermediate overflow in the addition, we distribute the division and get:
            // divUp(x, y) := (x - 1) / y + 1
            // Note that this requires x != 0, which we already tested for.

            return new FixedPointNumber(
                aInflated
                    .minus(fnum(1))
                    .idiv(b)
                    .plus(fnum(1))
            );
        }
    }

    // pow(x: FixedPointNumber, y: FixedPointNumber): FixedPointNumber {
    //     return new FixedPointNumber(LogExpMath.pow(x, y);
    // }

    powDown(x: FixedPointNumber, y: FixedPointNumber): FixedPointNumber {
        let result = new FixedPointNumber(LogExpMath.pow(x, y));
        if (result.isZero()) {
            return result;
        }
        return sub(
            sub(result, mulDown(result, MAX_POW_RELATIVE_ERROR)),
            fnum(1)
        );
    }

    powUp(x: FixedPointNumber, y: FixedPointNumber): FixedPointNumber {
        let result = new FixedPointNumber(LogExpMath.pow(x, y));
        return add(add(result, mulUp(result, MAX_POW_RELATIVE_ERROR)), fnum(1));
    }

    /**
     * @dev Tells the complement of a given value capped to zero to avoid overflow
     */
    complement(): FixedPointNumber {
        let x = this;
        return new FixedPointNumber(x.gte(ONE) ? fnum(0) : sub(ONE, x));
    }
}
