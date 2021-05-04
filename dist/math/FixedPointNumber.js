'use strict';
// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
var __importStar =
    (this && this.__importStar) ||
    function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result['default'] = mod;
        return result;
    };
Object.defineProperty(exports, '__esModule', { value: true });
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
// This is ported to JS from solidity
// https://github.com/balancer-labs/balancer-core-v2/blob/master/contracts/lib/math/FixedPoint.sol
const bignumber_1 = require('../utils/bignumber');
const LogExpMath = __importStar(require('./lib/logExpMath'));
const fixedPoint_1 = require('./lib/fixedPoint');
// This class was created to simplify the process of porting solidity code to js
class FixedPointNumber extends bignumber_1.BigNumber {
    // number: FixedPoint;
    constructor(number) {
        super(number);
        // this.number = number;
    }
    add(b) {
        // Fixed Point addition is the same as regular checked addition
        let a = this;
        let c = a.plus(b);
        return new FixedPointNumber(c);
    }
    sub(b) {
        // Fixed Point addition is the same as regular checked addition
        let a = this;
        let c = a.minus(b);
        return new FixedPointNumber(c);
    }
    mul(b) {
        let a = this;
        let c0 = a.times(b);
        let c1 = c0.plus(fixedPoint_1.ONE.idiv(new bignumber_1.BigNumber(2)));
        let c2 = c1.idiv(fixedPoint_1.ONE);
        return new FixedPointNumber(c2);
    }
    mulDown(b) {
        let a = this;
        let product = a.times(b);
        return new FixedPointNumber(product.idiv(fixedPoint_1.ONE));
    }
    mulUp(b) {
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
                    .minus(fixedPoint_1.fnum(1))
                    .idiv(fixedPoint_1.ONE)
                    .plus(fixedPoint_1.fnum(1))
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
    divDown(b) {
        let a = this;
        if (a.isZero()) {
            return new FixedPointNumber(a);
        } else {
            let aInflated = a.times(fixedPoint_1.ONE);
            return new FixedPointNumber(aInflated.idiv(b));
        }
    }
    divUp(b) {
        let a = this;
        if (a.isZero()) {
            return new FixedPointNumber(a);
        } else {
            let aInflated = a.times(fixedPoint_1.ONE);
            // The traditional divUp formula is:
            // divUp(x, y) := (x + y - 1) / y
            // To avoid intermediate overflow in the addition, we distribute the division and get:
            // divUp(x, y) := (x - 1) / y + 1
            // Note that this requires x != 0, which we already tested for.
            return new FixedPointNumber(
                aInflated
                    .minus(fixedPoint_1.fnum(1))
                    .idiv(b)
                    .plus(fixedPoint_1.fnum(1))
            );
        }
    }
    // pow(x: FixedPointNumber, y: FixedPointNumber): FixedPointNumber {
    //     return new FixedPointNumber(LogExpMath.pow(x, y);
    // }
    powDown(x, y) {
        let result = new FixedPointNumber(LogExpMath.pow(x, y));
        if (result.isZero()) {
            return result;
        }
        return fixedPoint_1.sub(
            fixedPoint_1.sub(
                result,
                fixedPoint_1.mulDown(
                    result,
                    fixedPoint_1.MAX_POW_RELATIVE_ERROR
                )
            ),
            fixedPoint_1.fnum(1)
        );
    }
    powUp(x, y) {
        let result = new FixedPointNumber(LogExpMath.pow(x, y));
        return fixedPoint_1.add(
            fixedPoint_1.add(
                result,
                fixedPoint_1.mulUp(result, fixedPoint_1.MAX_POW_RELATIVE_ERROR)
            ),
            fixedPoint_1.fnum(1)
        );
    }
    /**
     * @dev Tells the complement of a given value capped to zero to avoid overflow
     */
    complement() {
        let x = this;
        return new FixedPointNumber(
            x.gte(fixedPoint_1.ONE)
                ? fixedPoint_1.fnum(0)
                : fixedPoint_1.sub(fixedPoint_1.ONE, x)
        );
    }
}
exports.FixedPointNumber = FixedPointNumber;
