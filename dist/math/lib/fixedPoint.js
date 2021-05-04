'use strict';
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
const bignumber_1 = require('../../utils/bignumber');
const FixedPointNumber_1 = require('../FixedPointNumber');
const logExpMath = __importStar(require('./logExpMath'));
exports.ONE = new FixedPointNumber_1.FixedPointNumber(1000000000000000000);
exports.MAX_POW_RELATIVE_ERROR = new FixedPointNumber_1.FixedPointNumber(10000); // 10^(-14)
function fnum(val) {
    return new FixedPointNumber_1.FixedPointNumber(val.toString());
}
exports.fnum = fnum;
function add(a, b) {
    // Fixed Point addition is the same as regular checked addition
    let c = a.plus(b);
    return new FixedPointNumber_1.FixedPointNumber(c);
}
exports.add = add;
function sub(a, b) {
    // Fixed Point addition is the same as regular checked addition
    let c = a.minus(b);
    return new FixedPointNumber_1.FixedPointNumber(c);
}
exports.sub = sub;
function mul(a, b) {
    let c0 = a.times(b);
    let c1 = c0.plus(exports.ONE.idiv(new bignumber_1.BigNumber(2)));
    let c2 = c1.idiv(exports.ONE);
    return new FixedPointNumber_1.FixedPointNumber(c2);
}
exports.mul = mul;
function mulDown(a, b) {
    let product = a.times(b);
    return new FixedPointNumber_1.FixedPointNumber(product.idiv(exports.ONE));
}
exports.mulDown = mulDown;
function mulUp(a, b) {
    let product = a.times(b);
    if (product.isZero()) {
        return new FixedPointNumber_1.FixedPointNumber(product);
    } else {
        // The traditional divUp formula is:
        // divUp(x, y) := (x + y - 1) / y
        // To avoid intermediate overflow in the addition, we distribute the division and get:
        // divUp(x, y) := (x - 1) / y + 1
        // Note that this requires x != 0, which we already tested for.
        return new FixedPointNumber_1.FixedPointNumber(
            product
                .minus(fnum(1))
                .idiv(exports.ONE)
                .plus(fnum(1))
        );
    }
}
exports.mulUp = mulUp;
function div(a, b) {
    let c0 = a.times(exports.ONE);
    let c1 = c0.plus(b.idiv(new FixedPointNumber_1.FixedPointNumber(2)));
    let c2 = c1.idiv(b);
    return new FixedPointNumber_1.FixedPointNumber(c2);
}
exports.div = div;
function divDown(a, b) {
    if (a.isZero()) {
        return new FixedPointNumber_1.FixedPointNumber(a);
    } else {
        let aInflated = a.times(exports.ONE);
        return new FixedPointNumber_1.FixedPointNumber(aInflated.idiv(b));
    }
}
exports.divDown = divDown;
function divUp(a, b) {
    if (a.isZero()) {
        return new FixedPointNumber_1.FixedPointNumber(a);
    } else {
        let aInflated = a.times(exports.ONE);
        // The traditional divUp formula is:
        // divUp(x, y) := (x + y - 1) / y
        // To avoid intermediate overflow in the addition, we distribute the division and get:
        // divUp(x, y) := (x - 1) / y + 1
        // Note that this requires x != 0, which we already tested for.
        return new FixedPointNumber_1.FixedPointNumber(
            aInflated
                .minus(fnum(1))
                .idiv(b)
                .plus(fnum(1))
        );
    }
}
exports.divUp = divUp;
function pow(x, y) {
    return new FixedPointNumber_1.FixedPointNumber(logExpMath.pow(x, y));
}
exports.pow = pow;
function powDown(x, y) {
    let result = new FixedPointNumber_1.FixedPointNumber(logExpMath.pow(x, y));
    if (result.isZero()) {
        return result;
    }
    return new FixedPointNumber_1.FixedPointNumber(
        sub(
            sub(result, mulDown(result, exports.MAX_POW_RELATIVE_ERROR)),
            fnum(1)
        )
    );
}
exports.powDown = powDown;
function powUp(x, y) {
    let result = new FixedPointNumber_1.FixedPointNumber(logExpMath.pow(x, y));
    return new FixedPointNumber_1.FixedPointNumber(
        add(add(result, mulUp(result, exports.MAX_POW_RELATIVE_ERROR)), fnum(1))
    );
}
exports.powUp = powUp;
/**
 * @dev Tells the complement of a given value capped to zero to avoid overflow
 */
function complement(x) {
    return new FixedPointNumber_1.FixedPointNumber(
        x.gte(exports.ONE) ? fnum(0) : sub(exports.ONE, x)
    );
}
exports.complement = complement;
