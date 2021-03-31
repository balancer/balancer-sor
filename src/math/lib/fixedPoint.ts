import { BigNumber } from '../../utils/bignumber';
import { FixedPointNumber } from '../FixedPointNumber';
import * as logExpMath from './logExpMath';

export const ONE = new FixedPointNumber(1000000000000000000);
export const MAX_POW_RELATIVE_ERROR = new FixedPointNumber(10000); // 10^(-14)

export function fnum(val: string | number | BigNumber): FixedPointNumber {
    return new FixedPointNumber(val.toString());
}

export function add(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber {
    // Fixed Point addition is the same as regular checked addition
    let c = a.plus(b);
    return new FixedPointNumber(c);
}

export function sub(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber {
    // Fixed Point addition is the same as regular checked addition
    let c = a.minus(b);
    return new FixedPointNumber(c);
}

export function mul(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber {
    let c0 = a.times(b);
    let c1 = c0.plus(ONE.idiv(new BigNumber(2)));
    let c2 = c1.idiv(ONE);
    return new FixedPointNumber(c2);
}

export function mulDown(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber {
    let product = a.times(b);
    return new FixedPointNumber(product.idiv(ONE));
}

export function mulUp(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber {
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

export function div(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber {
    let c0 = a.times(ONE);
    let c1 = c0.plus(b.idiv(new FixedPointNumber(2)));
    let c2 = c1.idiv(b);
    return new FixedPointNumber(c2);
}

export function divDown(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber {
    if (a.isZero()) {
        return new FixedPointNumber(a);
    } else {
        let aInflated = a.times(ONE);
        return new FixedPointNumber(aInflated.idiv(b));
    }
}

export function divUp(
    a: FixedPointNumber,
    b: FixedPointNumber
): FixedPointNumber {
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

export function pow(
    x: FixedPointNumber,
    y: FixedPointNumber
): FixedPointNumber {
    return new FixedPointNumber(logExpMath.pow(x, y));
}

export function powDown(
    x: FixedPointNumber,
    y: FixedPointNumber
): FixedPointNumber {
    let result = new FixedPointNumber(logExpMath.pow(x, y));
    if (result.isZero()) {
        return result;
    }
    return new FixedPointNumber(
        sub(sub(result, mulDown(result, MAX_POW_RELATIVE_ERROR)), fnum(1))
    );
}

export function powUp(
    x: FixedPointNumber,
    y: FixedPointNumber
): FixedPointNumber {
    let result = new FixedPointNumber(logExpMath.pow(x, y));
    return new FixedPointNumber(
        add(add(result, mulUp(result, MAX_POW_RELATIVE_ERROR)), fnum(1))
    );
}

/**
 * @dev Tells the complement of a given value capped to zero to avoid overflow
 */
export function complement(x: FixedPointNumber): FixedPointNumber {
    return new FixedPointNumber(x.gte(ONE) ? fnum(0) : sub(ONE, x));
}
