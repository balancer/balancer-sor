import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import {
    MAX_POW_RELATIVE_ERROR,
    MILD_EXPONENT_BOUND,
    LN_36_LOWER_BOUND,
    LN_36_UPPER_BOUND,
    a0,
    a1,
    a2,
    a3,
    a4,
    a5,
    a6,
    a7,
    a8,
    a9,
    a10,
    a11,
    x0,
    x1,
    x2,
    x3,
    x4,
    x5,
    x6,
    x7,
    x8,
    x9,
    x10,
    x11,
} from './constants';

// Helpers
export function _squareRoot(input: BigNumber): BigNumber {
    return powDown(input, ONE.div(2));
}

function powDown(a: BigNumber, b: BigNumber) {
    const raw = logExpMathPow(a, b);
    const maxError = mulUp(raw, MAX_POW_RELATIVE_ERROR).add(1);

    if (raw.lt(maxError)) {
        return BigNumber.from(0);
    } else {
        return raw.sub(maxError);
    }
}

function logExpMathPow(x: BigNumber, y: BigNumber): BigNumber {
    if (y.isZero()) {
        return ONE;
    }
    if (x.isZero()) {
        return BigNumber.from(0);
    }

    // Instead of computing x^y directly, we instead rely on the properties of logarithms and exponentiation to
    // arrive at that result. In particular, exp(ln(x)) = x, and ln(x^y) = y * ln(x). This means
    // x^y = exp(y * ln(x)).

    // The ln function takes a signed value, so we need to make sure x fits in the signed 256 bit range.
    if (x.gte(BigNumber.from(2).pow(255)))
        throw new Error('logExpMathPow error: Input out of bounds');

    if (y.gte(MILD_EXPONENT_BOUND))
        throw new Error('logExpMathPow error: Exponent out of bounds');

    let logXTimesY = BigNumber.from(0);
    let isPos = true;
    if (x.gt(LN_36_LOWER_BOUND) && x.lt(LN_36_UPPER_BOUND)) {
        const ln36A = _ln_36(x);
        logXTimesY = ln36A.div(ONE).mul(y).add(ln36A.mod(ONE).mul(y).div(ONE));
    } else {
        const [lnA, lnAPos] = _ln(x);
        if (!lnAPos) isPos = false;
        logXTimesY = lnA.mul(y);
    }
    logXTimesY = logXTimesY.div(ONE);

    return exp(logXTimesY, isPos);
}

function _ln_36(x: BigNumber): BigNumber {
    x = x.mul(ONE);
    const ONE36 = ONE.mul(ONE);

    const z = x.sub(ONE36).mul(ONE36).div(x.add(ONE36));
    const zSquared = z.mul(z).div(ONE36);

    let num = z;
    let seriesSum = num;

    for (let i = 3; i <= 15; i = i + 2) {
        num = num.mul(zSquared).div(ONE36);
        seriesSum = seriesSum.add(num.div(i));
    }

    return seriesSum.mul(2);
}

function _ln(a: BigNumber): [BigNumber, boolean] {
    if (a.lt(ONE)) {
        return [_ln(ONE.mul(ONE).div(a))[0], false];
    }

    let sum = BigNumber.from(0);

    if (a.gte(a0.mul(ONE))) {
        a = a.div(a0);
        sum = sum.add(x0);
    }

    if (a.gte(a1.mul(ONE))) {
        a = a.div(a1);
        sum = sum.add(x1);
    }

    sum = sum.mul(100);
    a = a.mul(100);
    const ONE20 = ONE.mul(100);

    [
        [a2, x2],
        [a3, x3],
        [a4, x4],
        [a5, x5],
        [a6, x6],
        [a7, x7],
        [a8, x8],
        [a9, x9],
        [a10, x10],
        [a11, x11],
    ].forEach(([aNum, xNum]) => {
        if (a.gte(aNum)) {
            a = a.mul(ONE20).div(aNum);
            sum = sum.add(xNum);
        }
    });

    const z = a.sub(ONE20).mul(ONE20).div(a.add(ONE20));
    const zSquared = z.mul(z).div(ONE20);

    let num = z;
    let seriesSum = num;

    for (let i = 3; i <= 11; i = i + 2) {
        num = num.mul(zSquared).div(ONE20);
        seriesSum = seriesSum.add(num.div(i));
    }

    seriesSum = seriesSum.mul(2);

    return [sum.add(seriesSum).div(100), true];
}

function exp(x: BigNumber, isPos: boolean) {
    if (!isPos) {
        return ONE.mul(ONE).div(exp(x, true));
    }

    let firstAN = BigNumber.from(0);
    if (x.gte(x0)) {
        x = x.sub(x0);
        firstAN = a0;
    } else if (x.gte(x1)) {
        x = x.sub(x1);
        firstAN = a1;
    } else {
        firstAN = BigNumber.from(1);
    }

    x = x.mul(100);
    const ONE20 = ONE.mul(100);

    let product = ONE20;

    [
        [a2, x2],
        [a3, x3],
        [a4, x4],
        [a5, x5],
        [a6, x6],
        [a7, x7],
        [a8, x8],
        [a9, x9],
    ].forEach(([aNum, xNum]) => {
        if (x.gte(xNum)) {
            x = x.sub(xNum);
            product = product.mul(aNum).div(ONE20);
        }
    });

    let seriesSum = ONE20;
    let term = x;
    seriesSum = seriesSum.add(term);

    for (let i = 2; i <= 12; i++) {
        term = term.mul(x).div(ONE20).div(i);
        seriesSum = seriesSum.add(term);
    }

    return product.mul(seriesSum).div(ONE20).mul(firstAN).div(100);
}

export function mulUp(a: BigNumber, b: BigNumber) {
    const product = a.mul(b);
    return product.sub(1).div(ONE).add(1);
}

export function divUp(a: BigNumber, b: BigNumber) {
    const aInflated = a.mul(ONE);
    return aInflated.sub(1).div(b).add(1);
}

export function _normalizeBalances(
    balances: BigNumber[],
    decimalsIn: number,
    decimalsOut: number
): BigNumber[] {
    const scalingFactors = [
        parseFixed('1', decimalsIn),
        parseFixed('1', decimalsOut),
    ];

    return balances.map((bal, index) =>
        bal.mul(ONE).div(scalingFactors[index])
    );
}

/////////
/// Fee calculations
/////////

export function _reduceFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    const feeAmount = amountIn.mul(swapFee).div(ONE);
    return amountIn.sub(feeAmount);
}

export function _addFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    return amountIn.mul(ONE).div(ONE.sub(swapFee));
}
