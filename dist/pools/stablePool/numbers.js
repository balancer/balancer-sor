'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const decimal_js_1 = require('decimal.js');
const bignumber_1 = require('../../utils/bignumber');
const SCALING_FACTOR = 1e18;
exports.decimal = x => new decimal_js_1.Decimal(x.toString());
exports.fp = x => exports.bn(exports.toFp(x));
exports.toFp = x => exports.decimal(x).mul(SCALING_FACTOR);
exports.fromFp = x => exports.decimal(x).div(SCALING_FACTOR);
exports.bn = x => {
    if (bignumber_1.BigNumber.isBigNumber(x)) return x;
    const stringified = parseScientific(x.toString());
    const integer = stringified.split('.')[0];
    return new bignumber_1.BigNumber(integer);
};
exports.maxUint = e =>
    exports
        .bn(2)
        .pow(e)
        .minus(1);
exports.maxInt = e =>
    exports
        .bn(2)
        .pow(exports.bn(e).minus(1))
        .minus(1);
exports.minInt = e =>
    exports
        .bn(2)
        .pow(exports.bn(e).minus(1))
        .times(-1);
exports.pct = (x, pct) =>
    exports.bn(exports.decimal(x).mul(exports.decimal(pct)));
exports.max = (a, b) => {
    a = exports.bn(a);
    b = exports.bn(b);
    return a.gt(b) ? a : b;
};
exports.min = (a, b) => {
    a = exports.bn(a);
    b = exports.bn(b);
    return a.lt(b) ? a : b;
};
exports.arrayAdd = (arrA, arrB) =>
    arrA.map((a, i) => exports.bn(a).plus(exports.bn(arrB[i])));
exports.arraySub = (arrA, arrB) =>
    arrA.map((a, i) => exports.bn(a).minus(exports.bn(arrB[i])));
exports.divCeil = (x, y) =>
    // ceil(x/y) == (x + y - 1) / y
    x
        .plus(y)
        .minus(1)
        .div(y);
exports.FP_SCALING_FACTOR = exports.bn(SCALING_FACTOR);
function parseScientific(num) {
    // If the number is not in scientific notation return it as it is
    if (!/\d+\.?\d*e[+-]*\d+/i.test(num)) return num;
    // Remove the sign
    const numberSign = Math.sign(Number(num));
    num = Math.abs(Number(num)).toString();
    // Parse into coefficient and exponent
    const [coefficient, exponent] = num.toLowerCase().split('e');
    let zeros = Math.abs(Number(exponent));
    const exponentSign = Math.sign(Number(exponent));
    const [integer, decimals] = (coefficient.indexOf('.') != -1
        ? coefficient
        : `${coefficient}.`
    ).split('.');
    if (exponentSign === -1) {
        zeros -= integer.length;
        num =
            zeros < 0
                ? integer.slice(0, zeros) +
                  '.' +
                  integer.slice(zeros) +
                  decimals
                : '0.' + '0'.repeat(zeros) + integer + decimals;
    } else {
        if (decimals) zeros -= decimals.length;
        num =
            zeros < 0
                ? integer +
                  decimals.slice(0, zeros) +
                  '.' +
                  decimals.slice(zeros)
                : integer + decimals + '0'.repeat(zeros);
    }
    return numberSign < 0 ? '-' + num : num;
}
