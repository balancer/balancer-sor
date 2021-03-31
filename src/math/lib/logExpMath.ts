// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General internal License for more details.

// You should have received a copy of the GNU General internal License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

// This is ported to JS from solidity
// https://github.com/balancer-labs/balancer-core-v2/blob/master/contracts/lib/math/LogExpMath.sol

import { BigNumber } from '../../utils/bignumber';

const DECIMALS = new BigNumber(10 ** 18);
const DOUBLE_DECIMALS = DECIMALS.times(DECIMALS);
const PRECISION = new BigNumber(10 ** 20);
const DOUBLE_PRECISION = PRECISION.times(PRECISION);
const PRECISION_LOG_UNDER_BOUND = DECIMALS.minus(10 ** 17);
const PRECISION_LOG_UPPER_BOUND = DECIMALS.plus(10 ** 17);
const EXPONENT_LB = new BigNumber(-41446531673892822312);
const EXPONENT_UB = new BigNumber(130700829182905140221);
const MILD_EXPONENT_BOUND = new BigNumber(2 ** 254).idiv(PRECISION);

const x0 = new BigNumber(128000000000000000000); //2ˆ7
const a0 = new BigNumber(
    38877084059945950922200000000000000000000000000000000000
); //eˆ(x0)
const x1 = new BigNumber(64000000000000000000); //2ˆ6
const a1 = new BigNumber(6235149080811616882910000000); //eˆ(x1)
const x2 = new BigNumber(3200000000000000000000); //2ˆ5
const a2 = new BigNumber(7896296018268069516100000000000000); //eˆ(x2)
const x3 = new BigNumber(1600000000000000000000); //2ˆ4
const a3 = new BigNumber(888611052050787263676000000); //eˆ(x3)
const x4 = new BigNumber(800000000000000000000); //2ˆ3
const a4 = new BigNumber(298095798704172827474000); //eˆ(x4)
const x5 = new BigNumber(400000000000000000000); //2ˆ2
const a5 = new BigNumber(5459815003314423907810); //eˆ(x5)
const x6 = new BigNumber(200000000000000000000); //2ˆ1
const a6 = new BigNumber(738905609893065022723); //eˆ(x6)
const x7 = new BigNumber(100000000000000000000); //2ˆ0
const a7 = new BigNumber(271828182845904523536); //eˆ(x7)
const x8 = new BigNumber(50000000000000000000); //2ˆ-1
const a8 = new BigNumber(164872127070012814685); //eˆ(x8)
const x9 = new BigNumber(25000000000000000000); //2ˆ-2
const a9 = new BigNumber(128402541668774148407); //eˆ(x9)
const x10 = new BigNumber(12500000000000000000); //2ˆ-3
const a10 = new BigNumber(113314845306682631683); //eˆ(x10)
const x11 = new BigNumber(6250000000000000000); //2ˆ-4
const a11 = new BigNumber(106449445891785942956); //eˆ(x11)

/**
 * Calculate the natural exponentiation of a number with 18 decimals precision.
 * @param x Exponent with 18 decimal places.
 * @notice Max x is log((2^255 - 1) / 10^20) = 130.700829182905140221
 * @notice Min x log(0.000000000000000001) = -41.446531673892822312
 * @return eˆx
 */
export function n_exp(x: BigNumber): BigNumber {
    if (x.lt(new BigNumber(0)))
        return DOUBLE_DECIMALS.idiv(n_exp(x.times(new BigNumber(-1))));
    let ans = PRECISION;
    let last = new BigNumber(1);
    if (x.gte(x0)) {
        last = a0;
        x = x.minus(x0);
    }
    if (x.gte(x1)) {
        last = last.times(a1);
        x = x.minus(x1);
    }
    x = x.times(new BigNumber(100));
    if (x.gte(x2)) {
        ans = ans.times(a2).idiv(PRECISION);
        x = x.minus(x2);
    }
    if (x.gte(x3)) {
        ans = ans.times(a3).idiv(PRECISION);
        x = x.minus(x3);
    }
    if (x.gte(x4)) {
        ans = ans.times(a4).idiv(PRECISION);
        x = x.minus(x4);
    }
    if (x.gte(x5)) {
        ans = ans.times(a5).idiv(PRECISION);
        x = x.minus(x5);
    }
    if (x.gte(x6)) {
        ans = ans.times(a6).idiv(PRECISION);
        x = x.minus(x6);
    }
    if (x.gte(x7)) {
        ans = ans.times(a7).idiv(PRECISION);
        x = x.minus(x7);
    }
    if (x.gte(x8)) {
        ans = ans.times(a8).idiv(PRECISION);
        x = x.minus(x8);
    }
    if (x.gte(x9)) {
        ans = ans.times(a9).idiv(PRECISION);
        x = x.minus(x9);
    }
    let s = PRECISION;
    let t = x;
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(2))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(3))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(4))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(5))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(6))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(7))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(8))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(9))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(10))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(11))
        .idiv(PRECISION);
    s = s.plus(t);
    t = t
        .times(x)
        .idiv(new BigNumber(12))
        .idiv(PRECISION);
    s = s.plus(t);
    return ans
        .times(s)
        .idiv(PRECISION)
        .times(last)
        .idiv(new BigNumber(100));
}

/**
 * Calculate the natural logarithm of a number with 18 decimals precision.
 * @param a Positive number with 18 decimal places.
 * @return ln(x)
 */
export function n_log(a: BigNumber): BigNumber {
    if (a < DECIMALS)
        return n_log(DOUBLE_DECIMALS.idiv(a)).times(new BigNumber(-1));
    let ans = new BigNumber(0);
    if (a.gte(a0.times(DECIMALS))) {
        ans = ans.plus(x0);
        a = a.idiv(a0);
    }
    if (a.gte(a1.times(DECIMALS))) {
        ans = ans.plus(x1);
        a = a.idiv(a1);
    }
    a = a.times(new BigNumber(100));
    ans = ans.times(new BigNumber(100));
    if (a.gte(a2)) {
        ans = ans.plus(x2);
        a = a.times(PRECISION).idiv(a2);
    }
    if (a.gte(a3)) {
        ans = ans.plus(x3);
        a = a.times(PRECISION).idiv(a3);
    }
    if (a.gte(a4)) {
        ans = ans.plus(x4);
        a = a.times(PRECISION).idiv(a4);
    }
    if (a.gte(a5)) {
        ans = ans.plus(x5);
        a = a.times(PRECISION).idiv(a5);
    }
    if (a.gte(a6)) {
        ans = ans.plus(x6);
        a = a.times(PRECISION).idiv(a6);
    }
    if (a.gte(a7)) {
        ans = ans.plus(x7);
        a = a.times(PRECISION).idiv(a7);
    }
    if (a.gte(a8)) {
        ans = ans.plus(x8);
        a = a.times(PRECISION).idiv(a8);
    }
    if (a.gte(a9)) {
        ans = ans.plus(x9);
        a = a.times(PRECISION).idiv(a9);
    }
    if (a.gte(a10)) {
        ans = ans.plus(x10);
        a = a.times(PRECISION).idiv(a10);
    }
    if (a.gte(a11)) {
        ans = ans.plus(x11);
        a = a.times(PRECISION).idiv(a11);
    }
    let z = PRECISION.times(a.minus(PRECISION)).idiv(a.plus(PRECISION));
    let s = z;
    let z_squared = z.times(z).idiv(PRECISION);
    let t = z.times(z_squared).idiv(PRECISION);
    s = s.plus(t.idiv(3));
    t = t.times(z_squared).idiv(PRECISION);
    s = s.plus(t.idiv(5));
    t = t.times(z_squared).idiv(PRECISION);
    s = s.plus(t.idiv(7));
    t = t.times(z_squared).idiv(PRECISION);
    s = s.plus(t.idiv(9));
    t = t.times(z_squared).idiv(PRECISION);
    s = s.plus(t.idiv(11));
    return ans.plus(s.times(new BigNumber(2))).idiv(new BigNumber(100));
}

/**
 * Computes x to the power of y for numbers with 18 decimals precision.
 * @param x Base with 18 decimal places.
 * @param y Exponent with 18 decimal places.
 * @notice Must fulfil: -41.446531673892822312  < (log(x) * y) <  130.700829182905140221
 * @return xˆy
 */
export function pow(x: BigNumber, y: BigNumber): BigNumber {
    if (y.isZero()) {
        return DECIMALS;
    }

    if (x.isZero()) {
        return x;
    }

    let logx_times_y;
    if (PRECISION_LOG_UNDER_BOUND.lt(x) && x.lt(PRECISION_LOG_UPPER_BOUND)) {
        let logbase = n_log_36(x);
        logx_times_y = logbase
            .idiv(DECIMALS)
            .times(y)
            .plus(
                logbase
                    .mod(DECIMALS)
                    .times(y)
                    .idiv(DECIMALS)
            );
    } else {
        logx_times_y = n_log(x).times(y);
    }
    logx_times_y = logx_times_y.idiv(DECIMALS);
    return n_exp(logx_times_y);
}

/**
 * Computes log of a number in base of another number, both numbers with 18 decimals precision.
 * @param arg Argument with 18 decimal places.
 * @param base Base with 18 decimal places.
 * @notice Must fulfil: -41.446531673892822312  < (log(x) * y) <  130.700829182905140221
 * @return log[base](arg)
 */
export function log(arg: BigNumber, base: BigNumber): BigNumber {
    let logbase;
    if (PRECISION_LOG_UNDER_BOUND < base && base < PRECISION_LOG_UPPER_BOUND) {
        logbase = n_log_36(base);
    } else {
        logbase = n_log(base).times(DECIMALS);
    }
    let logarg;
    if (PRECISION_LOG_UNDER_BOUND < arg && arg < PRECISION_LOG_UPPER_BOUND) {
        logarg = n_log_36(arg);
    } else {
        logarg = n_log(arg).times(DECIMALS);
    }
    return logarg.times(DECIMALS).idiv(logbase);
}

/**
 * Private export function to calculate the natural logarithm of a number with 36 decimals precision.
 * @param a Positive number with 18 decimal places.
 * @return ln(x)
 */
export function n_log_36(a: BigNumber): BigNumber {
    a = a.times(DECIMALS);
    let z = DOUBLE_DECIMALS.times(a.minus(DOUBLE_DECIMALS)).idiv(
        a.plus(DOUBLE_DECIMALS)
    );
    let s = z;
    let z_squared = z.times(z).idiv(DOUBLE_DECIMALS);
    let t = z.times(z_squared).idiv(DOUBLE_DECIMALS);
    s = s.plus(t.idiv(3));
    t = t.times(z_squared).idiv(DOUBLE_DECIMALS);
    s = s.plus(t.idiv(5));
    t = t.times(z_squared).idiv(DOUBLE_DECIMALS);
    s = s.plus(t.idiv(7));
    t = t.times(z_squared).idiv(DOUBLE_DECIMALS);
    s = s.plus(t.idiv(9));
    t = t.times(z_squared).idiv(DOUBLE_DECIMALS);
    s = s.plus(t.idiv(11));
    t = t.times(z_squared).idiv(DOUBLE_DECIMALS);
    s = s.plus(t.idiv(13));
    t = t.times(z_squared).idiv(DOUBLE_DECIMALS);
    s = s.plus(t.idiv(15));
    return s.times(new BigNumber(2));
}
