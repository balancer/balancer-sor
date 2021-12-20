// Ported from Solidity:
// https://github.com/balancer-labs/balancer-core-v2/blob/70843e6a61ad11208c1cfabf5cfe15be216ca8d3/pkg/solidity-utils/contracts/math/LogExpMath.sol

import BigNumber, { bn } from '../big-number';

// All fixed point multiplications and divisions are inlined
// This means we need to divide by ONE when multiplying two numbers, and multiply by ONE when dividing them

// All arguments and return values are 18 decimal fixed point numbers
const ONE_18 = bn('1000000000000000000'); // 1e18

// Internally, intermediate values are computed with higher precision as 20 decimal fixed point numbers, and in the case of ln36, 36 decimals
const ONE_20 = bn('100000000000000000000'); // 1e20
const ONE_36 = bn('1000000000000000000000000000000000000'); // 1e36

// The domain of natural exponentiation is bound by the word size and number of decimals used
// Because internally the result will be stored using 20 decimals, the largest possible result is
// (2^255 - 1) / 10^20, which makes the largest exponent ln((2^255 - 1) / 10^20) = 130.700829182905140221
// The smallest possible result is 10^(-18), which makes largest negative argument
// ln(10^(-18)) = -41.446531673892822312.
// We use 130.0 and -41.0 to have some safety margin
const MAX_NATURAL_EXPONENT = bn('130000000000000000000'); // 130e18
const MIN_NATURAL_EXPONENT = bn('-41000000000000000000'); // (-41)e18

// Bounds for ln_36's argument
// Both ln(0.9) and ln(1.1) can be represented with 36 decimal places in a fixed point 256 bit integer
const LN_36_LOWER_BOUND = ONE_18.minus(bn('100000000000000000')); // 1e18 - 1e17
const LN_36_UPPER_BOUND = ONE_18.plus(bn('100000000000000000')); // 1e18 + 1e17

const MILD_EXPONENT_BOUND = bn(2).pow(254).idiv(ONE_20);

// 18 decimal constants
const x0 = bn('128000000000000000000'); // 2ˆ7
const a0 = bn('38877084059945950922200000000000000000000000000000000000'); // eˆ(x0) (no decimals)
const x1 = bn('64000000000000000000'); // 2ˆ6
const a1 = bn('6235149080811616882910000000'); // eˆ(x1) (no decimals)

// 20 decimal constants
const x2 = bn('3200000000000000000000'); // 2ˆ5
const a2 = bn('7896296018268069516100000000000000'); // eˆ(x2)
const x3 = bn('1600000000000000000000'); // 2ˆ4
const a3 = bn('888611052050787263676000000'); // eˆ(x3)
const x4 = bn('800000000000000000000'); // 2ˆ3
const a4 = bn('298095798704172827474000'); // eˆ(x4)
const x5 = bn('400000000000000000000'); // 2ˆ2
const a5 = bn('5459815003314423907810'); // eˆ(x5)
const x6 = bn('200000000000000000000'); // 2ˆ1
const a6 = bn('738905609893065022723'); // eˆ(x6)
const x7 = bn('100000000000000000000'); // 2ˆ0
const a7 = bn('271828182845904523536'); // eˆ(x7)
const x8 = bn('50000000000000000000'); // 2ˆ(-1)
const a8 = bn('164872127070012814685'); // eˆ(x8)
const x9 = bn('25000000000000000000'); // 2ˆ(-2)
const a9 = bn('128402541668774148407'); // eˆ(x9)
const x10 = bn('12500000000000000000'); // 2ˆ(-3)
const a10 = bn('113314845306682631683'); // eˆ(x10)
const x11 = bn('6250000000000000000'); // 2ˆ(-4)
const a11 = bn('106449445891785942956'); // eˆ(x11)

export const pow = (x: BigNumber, y: BigNumber): BigNumber => {
    if (y.isZero()) {
        // We solve the 0^0 indetermination by making it equal one.
        return ONE_18;
    }

    if (x.isZero()) {
        return bn(0);
    }

    // Instead of computing x^y directly, we instead rely on the properties of logarithms and exponentiation to
    // arrive at that result. In particular, exp(ln(x)) = x, and ln(x^y) = y * ln(x). This means
    // x^y = exp(y * ln(x)).

    // The ln function takes a signed value, so we need to make sure x fits in the signed 256 bit range.
    if (x.gte(bn(2).pow(255))) {
        throw new Error('X_OUT_OF_BOUNDS');
    }

    // We will compute y * ln(x) in a single step. Depending on the value of x, we can either use ln or ln_36. In
    // both cases, we leave the division by ONE_18 (due to fixed point multiplication) to the end.

    // This prevents y * ln(x) from overflowing, and at the same time guarantees y fits in the signed 256 bit range.
    if (y.gte(MILD_EXPONENT_BOUND)) {
        throw new Error('Y_OUT_OF_BOUNDS');
    }

    let logx_times_y: BigNumber;
    if (LN_36_LOWER_BOUND.lt(x) && x.lt(LN_36_UPPER_BOUND)) {
        let ln_36_x = _ln_36(x);

        // ln_36_x has 36 decimal places, so multiplying by y_int256 isn't as straightforward, since we can't just
        // bring y_int256 to 36 decimal places, as it might overflow. Instead, we perform two 18 decimal
        // multiplications and add the results: one with the first 18 decimals of ln_36_x, and one with the
        // (downscaled) last 18 decimals.
        logx_times_y = ln_36_x
            .idiv(ONE_18)
            .times(y)
            .plus(ln_36_x.mod(ONE_18).times(y).idiv(ONE_18));
    } else {
        logx_times_y = _ln(x).times(y);
    }
    logx_times_y = logx_times_y.idiv(ONE_18);

    // Finally, we compute exp(y * ln(x)) to arrive at x^y
    if (
        logx_times_y.lt(MIN_NATURAL_EXPONENT) ||
        logx_times_y.gt(MAX_NATURAL_EXPONENT)
    ) {
        throw new Error('PRODUCT_OUT_OF_BOUNDS');
    }

    return exp(logx_times_y);
};

export const exp = (x: BigNumber): BigNumber => {
    if (x.lt(MIN_NATURAL_EXPONENT) || x.gt(MAX_NATURAL_EXPONENT)) {
        throw new Error('INVALID_EXPONENT');
    }

    if (x.lt(0)) {
        // We only handle positive exponents: e^(-x) is computed as 1 / e^x. We can safely make x positive since it
        // fits in the signed 256 bit range (as it is larger than MIN_NATURAL_EXPONENT).
        // Fixed point division requires multiplying by ONE_18.
        return ONE_18.times(ONE_18).idiv(exp(x.negated()));
    }

    // First, we use the fact that e^(x+y) = e^x * e^y to decompose x into a sum of powers of two, which we call x_n,
    // where x_n == 2^(7 - n), and e^x_n = a_n has been precomputed. We choose the first x_n, x0, to equal 2^7
    // because all larger powers are larger than MAX_NATURAL_EXPONENT, and therefore not present in the
    // decomposition.
    // At the end of this process we will have the product of all e^x_n = a_n that apply, and the remainder of this
    // decomposition, which will be lower than the smallest x_n.
    // exp(x) = k_0 * a_0 * k_1 * a_1 * ... + k_n * a_n * exp(remainder), where each k_n equals either 0 or 1.
    // We mutate x by subtracting x_n, making it the remainder of the decomposition.

    // The first two a_n (e^(2^7) and e^(2^6)) are too large if stored as 18 decimal numbers, and could cause
    // intermediate overflows. Instead we store them as plain integers, with 0 decimals.
    // Additionally, x0 + x1 is larger than MAX_NATURAL_EXPONENT, which means they will not both be present in the
    // decomposition.

    // For each x_n, we test if that term is present in the decomposition (if x is larger than it), and if so deduct
    // it and compute the accumulated product.

    let firstAN: BigNumber;
    if (x.gte(x0)) {
        x = x.minus(x0);
        firstAN = a0;
    } else if (x.gte(x1)) {
        x = x.minus(x1);
        firstAN = a1;
    } else {
        firstAN = bn(1); // One with no decimal places
    }

    // We now transform x into a 20 decimal fixed point number, to have enhanced precision when computing the
    // smaller terms.
    x = x.times(100);

    // `product` is the accumulated product of all a_n (except a0 and a1), which starts at 20 decimal fixed point
    // one. Recall that fixed point multiplication requires dividing by ONE_20.
    let product = ONE_20;

    if (x.gte(x2)) {
        x = x.minus(x2);
        product = product.times(a2).idiv(ONE_20);
    }
    if (x.gte(x3)) {
        x = x.minus(x3);
        product = product.times(a3).idiv(ONE_20);
    }
    if (x.gte(x4)) {
        x = x.minus(x4);
        product = product.times(a4).idiv(ONE_20);
    }
    if (x.gte(x5)) {
        x = x.minus(x5);
        product = product.times(a5).idiv(ONE_20);
    }
    if (x.gte(x6)) {
        x = x.minus(x6);
        product = product.times(a6).idiv(ONE_20);
    }
    if (x.gte(x7)) {
        x = x.minus(x7);
        product = product.times(a7).idiv(ONE_20);
    }
    if (x.gte(x8)) {
        x = x.minus(x8);
        product = product.times(a8).idiv(ONE_20);
    }
    if (x.gte(x9)) {
        x = x.minus(x9);
        product = product.times(a9).idiv(ONE_20);
    }

    // x10 and x11 are unnecessary here since we have high enough precision already.

    // Now we need to compute e^x, where x is small (in particular, it is smaller than x9). We use the Taylor series
    // expansion for e^x: 1 + x + (x^2 / 2!) + (x^3 / 3!) + ... + (x^n / n!).

    let seriesSum = ONE_20; // The initial one in the sum, with 20 decimal places.
    let term: BigNumber; // Each term in the sum, where the nth term is (x^n / n!).

    // The first term is simply x.
    term = x;
    seriesSum = seriesSum.plus(term);

    // Each term (x^n / n!) equals the previous one times x, divided by n. Since x is a fixed point number,
    // multiplying by it requires dividing by ONE_20, but dividing by the non-fixed point n values does not.

    term = term.times(x).idiv(ONE_20).idiv(2);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(3);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(4);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(5);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(6);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(7);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(8);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(9);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(10);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(11);
    seriesSum = seriesSum.plus(term);

    term = term.times(x).idiv(ONE_20).idiv(12);
    seriesSum = seriesSum.plus(term);

    // 12 Taylor terms are sufficient for 18 decimal precision.

    // We now have the first a_n (with no decimals), and the product of all other a_n present, and the Taylor
    // approximation of the exponentiation of the remainder (both with 20 decimals). All that remains is to multiply
    // all three (one 20 decimal fixed point multiplication, dividing by ONE_20, and one integer multiplication),
    // and then drop two digits to return an 18 decimal value.

    return product.times(seriesSum).idiv(ONE_20).times(firstAN).idiv(100);
};

export const log = (arg: BigNumber, base: BigNumber): BigNumber => {
    // This performs a simple base change: log(arg, base) = ln(arg) / ln(base).

    // Both logBase and logArg are computed as 36 decimal fixed point numbers, either by using ln_36, or by
    // upscaling.

    let logBase: BigNumber;
    if (LN_36_LOWER_BOUND.lt(base) && base.lt(LN_36_UPPER_BOUND)) {
        logBase = _ln_36(base);
    } else {
        logBase = _ln(base).times(ONE_18);
    }

    let logArg: BigNumber;
    if (LN_36_LOWER_BOUND.lt(arg) && arg.lt(LN_36_UPPER_BOUND)) {
        logArg = _ln_36(arg);
    } else {
        logArg = _ln(arg).times(ONE_18);
    }

    // When dividing, we multiply by ONE_18 to arrive at a result with 18 decimal places
    return logArg.times(ONE_18).idiv(logBase);
};

export const ln = (a: BigNumber): BigNumber => {
    // The real natural logarithm is not defined for negative numbers or zero.
    if (a.lte(0)) {
        throw new Error('OUT_OF_BOUNDS');
    }
    if (LN_36_LOWER_BOUND.lt(a) && a.lt(LN_36_UPPER_BOUND)) {
        return _ln_36(a).idiv(ONE_18);
    } else {
        return _ln(a);
    }
};

const _ln = (a: BigNumber): BigNumber => {
    if (a.lt(ONE_18)) {
        // Since ln(a^k) = k * ln(a), we can compute ln(a) as ln(a) = ln((1/a)^(-1)) = - ln((1/a))
        // If a is less than one, 1/a will be greater than one, and this if statement will not be entered in the recursive call
        // Fixed point division requires multiplying by ONE_18
        return _ln(ONE_18.times(ONE_18).idiv(a)).negated();
    }

    // First, we use the fact that ln^(a * b) = ln(a) + ln(b) to decompose ln(a) into a sum of powers of two, which
    // we call x_n, where x_n == 2^(7 - n), which are the natural logarithm of precomputed quantities a_n (that is,
    // ln(a_n) = x_n). We choose the first x_n, x0, to equal 2^7 because the exponential of all larger powers cannot
    // be represented as 18 fixed point decimal numbers in 256 bits, and are therefore larger than a.
    // At the end of this process we will have the sum of all x_n = ln(a_n) that apply, and the remainder of this
    // decomposition, which will be lower than the smallest a_n.
    // ln(a) = k_0 * x_0 + k_1 * x_1 + ... + k_n * x_n + ln(remainder), where each k_n equals either 0 or 1
    // We mutate a by subtracting a_n, making it the remainder of the decomposition

    // For reasons related to how `exp` works, the first two a_n (e^(2^7) and e^(2^6)) are not stored as fixed point
    // numbers with 18 decimals, but instead as plain integers with 0 decimals, so we need to multiply them by
    // ONE_18 to convert them to fixed point.
    // For each a_n, we test if that term is present in the decomposition (if a is larger than it), and if so divide
    // by it and compute the accumulated sum.

    let sum = bn(0);
    if (a.gte(a0.times(ONE_18))) {
        a = a.idiv(a0); // Integer, not fixed point division
        sum = sum.plus(x0);
    }

    if (a.gte(a1.times(ONE_18))) {
        a = a.idiv(a1); // Integer, not fixed point division
        sum = sum.plus(x1);
    }

    // All other a_n and x_n are stored as 20 digit fixed point numbers, so we convert the sum and a to this format.
    sum = sum.times(100);
    a = a.times(100);

    // Because further a_n are  20 digit fixed point numbers, we multiply by ONE_20 when dividing by them.

    if (a.gte(a2)) {
        a = a.times(ONE_20).idiv(a2);
        sum = sum.plus(x2);
    }

    if (a.gte(a3)) {
        a = a.times(ONE_20).idiv(a3);
        sum = sum.plus(x3);
    }

    if (a.gte(a4)) {
        a = a.times(ONE_20).idiv(a4);
        sum = sum.plus(x4);
    }

    if (a.gte(a5)) {
        a = a.times(ONE_20).idiv(a5);
        sum = sum.plus(x5);
    }

    if (a.gte(a6)) {
        a = a.times(ONE_20).idiv(a6);
        sum = sum.plus(x6);
    }

    if (a.gte(a7)) {
        a = a.times(ONE_20).idiv(a7);
        sum = sum.plus(x7);
    }

    if (a.gte(a8)) {
        a = a.times(ONE_20).idiv(a8);
        sum = sum.plus(x8);
    }

    if (a.gte(a9)) {
        a = a.times(ONE_20).idiv(a9);
        sum = sum.plus(x9);
    }

    if (a.gte(a10)) {
        a = a.times(ONE_20).idiv(a10);
        sum = sum.plus(x10);
    }

    if (a.gte(a11)) {
        a = a.times(ONE_20).idiv(a11);
        sum = sum.plus(x11);
    }

    // a is now a small number (smaller than a_11, which roughly equals 1.06). This means we can use a Taylor series
    // that converges rapidly for values of `a` close to one - the same one used in ln_36.
    // Let z = (a - 1) / (a + 1).
    // ln(a) = 2 * (z + z^3 / 3 + z^5 / 5 + z^7 / 7 + ... + z^(2 * n + 1) / (2 * n + 1))

    // Recall that 20 digit fixed point division requires multiplying by ONE_20, and multiplication requires
    // division by ONE_20.
    const z = a.minus(ONE_20).times(ONE_20).idiv(a.plus(ONE_20));
    const z_squared = z.times(z).idiv(ONE_20);

    // num is the numerator of the series: the z^(2 * n + 1) term
    let num = z;

    // seriesSum holds the accumulated sum of each term in the series, starting with the initial z
    let seriesSum = num;

    // In each step, the numerator is multiplied by z^2
    num = num.times(z_squared).idiv(ONE_20);
    seriesSum = seriesSum.plus(num.idiv(3));

    num = num.times(z_squared).idiv(ONE_20);
    seriesSum = seriesSum.plus(num.idiv(5));

    num = num.times(z_squared).idiv(ONE_20);
    seriesSum = seriesSum.plus(num.idiv(7));

    num = num.times(z_squared).idiv(ONE_20);
    seriesSum = seriesSum.plus(num.idiv(9));

    num = num.times(z_squared).idiv(ONE_20);
    seriesSum = seriesSum.plus(num.idiv(11));

    // 6 Taylor terms are sufficient for 36 decimal precision.

    // Finally, we multiply by 2 (non fixed point) to compute ln(remainder)
    seriesSum = seriesSum.times(2);

    // We now have the sum of all x_n present, and the Taylor approximation of the logarithm of the remainder (both
    // with 20 decimals). All that remains is to sum these two, and then drop two digits to return a 18 decimal
    // value.

    return sum.plus(seriesSum).idiv(100);
};

const _ln_36 = (x: BigNumber): BigNumber => {
    // Since ln(1) = 0, a value of x close to one will yield a very small result, which makes using 36 digits worthwhile

    // First, we transform x to a 36 digit fixed point value
    x = x.times(ONE_18);

    // We will use the following Taylor expansion, which converges very rapidly. Let z = (x - 1) / (x + 1)
    // ln(x) = 2 * (z + z^3 / 3 + z^5 / 5 + z^7 / 7 + ... + z^(2 * n + 1) / (2 * n + 1))

    // Recall that 36 digit fixed point division requires multiplying by ONE_36, and multiplication requires division by ONE_36
    const z = x.minus(ONE_36).times(ONE_36).idiv(x.plus(ONE_36));
    const z_squared = z.times(z).idiv(ONE_36);

    // num is the numerator of the series: the z^(2 * n + 1) term
    let num = z;

    // seriesSum holds the accumulated sum of each term in the series, starting with the initial z
    let seriesSum = num;

    // In each step, the numerator is multiplied by z^2
    num = num.times(z_squared).idiv(ONE_36);
    seriesSum = seriesSum.plus(num.idiv(3));

    num = num.times(z_squared).idiv(ONE_36);
    seriesSum = seriesSum.plus(num.idiv(5));

    num = num.times(z_squared).idiv(ONE_36);
    seriesSum = seriesSum.plus(num.idiv(7));

    num = num.times(z_squared).idiv(ONE_36);
    seriesSum = seriesSum.plus(num.idiv(9));

    num = num.times(z_squared).idiv(ONE_36);
    seriesSum = seriesSum.plus(num.idiv(11));

    num = num.times(z_squared).idiv(ONE_36);
    seriesSum = seriesSum.plus(num.idiv(13));

    num = num.times(z_squared).idiv(ONE_36);
    seriesSum = seriesSum.plus(num.idiv(15));

    // 8 Taylor terms are sufficient for 36 decimal precision

    // All that remains is multiplying by 2 (non fixed point)
    return seriesSum.times(2);
};
