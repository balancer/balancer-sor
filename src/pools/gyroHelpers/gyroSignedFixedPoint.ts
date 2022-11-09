import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import {
    SQRT_1E_NEG_1,
    SQRT_1E_NEG_3,
    SQRT_1E_NEG_5,
    SQRT_1E_NEG_7,
    SQRT_1E_NEG_9,
    SQRT_1E_NEG_11,
    SQRT_1E_NEG_13,
    SQRT_1E_NEG_15,
    SQRT_1E_NEG_17,
    ONE_XP,
} from './constants';

/////////
/// ARITHMETIC HELPERS
/////////

export function mulUp(a: BigNumber, b: BigNumber) {
    const product = a.mul(b);
    return product.sub(1).div(ONE).add(1);
}

export function divUp(a: BigNumber, b: BigNumber) {
    const aInflated = a.mul(ONE);
    return aInflated.sub(1).div(b).add(1);
}

export function mulDown(a: BigNumber, b: BigNumber) {
    const product = a.mul(b);
    return product.div(ONE);
}

export function divDown(a: BigNumber, b: BigNumber) {
    const aInflated = a.mul(ONE);
    return aInflated.div(b);
}

export function mulXpU(a: BigNumber, b: BigNumber) {
    return a.mul(b).div(ONE_XP);
}

export function divXpU(a: BigNumber, b: BigNumber) {
    if (b.isZero()) throw new Error('ZERO DIVISION');
    return a.mul(ONE_XP).div(b);
}

export function mulDownMagU(a: BigNumber, b: BigNumber) {
    return a.mul(b).div(ONE);
}

export function divDownMagU(a: BigNumber, b: BigNumber) {
    if (b.isZero()) throw new Error('ZERO DIVISION');
    return a.mul(ONE).div(b);
}

export function mulUpMagU(a: BigNumber, b: BigNumber) {
    const product = a.mul(b);
    if (product.gt(0)) return product.sub(1).div(ONE).add(1);
    else if (product.lt(0)) return product.add(1).div(ONE).sub(1);
    else return BigNumber.from(0);
}

export function divUpMagU(a: BigNumber, b: BigNumber) {
    if (b.isZero()) throw new Error('ZERO DIVISION');
    if (b.lt(0)) {
        b = b.mul(-1);
        a = a.mul(-1);
    }
    if (a.isZero()) {
        return BigNumber.from(0);
    } else {
        if (a.gt(0)) return a.mul(ONE).sub(1).div(b).add(1);
        else return a.mul(ONE).add(1).div(b.sub(1));
    }
}

export function mulUpXpToNpU(a: BigNumber, b: BigNumber) {
    const TenPower19 = BigNumber.from(10).pow(19);
    const b1 = b.div(TenPower19);
    const b2 = b.isNegative()
        ? b.mul(-1).mod(TenPower19).mul(-1)
        : b.mod(TenPower19);
    const prod1 = a.mul(b1);
    const prod2 = a.mul(b2);
    return prod1.lte(0) && prod2.lte(0)
        ? prod1.add(prod2.div(TenPower19)).div(TenPower19)
        : prod1.add(prod2.div(TenPower19)).sub(1).div(TenPower19).add(1);
}

export function mulDownXpToNpU(a: BigNumber, b: BigNumber) {
    const TenPower19 = BigNumber.from(10).pow(19);
    const b1 = b.div(TenPower19);
    const b2 = b.isNegative()
        ? b.mul(-1).mod(TenPower19).mul(-1)
        : b.mod(TenPower19);
    const prod1 = a.mul(b1);
    const prod2 = a.mul(b2);
    return prod1.gte(0) && prod2.gte(0)
        ? prod1.add(prod2.div(TenPower19)).div(TenPower19)
        : prod1.add(prod2.div(TenPower19)).add(1).div(TenPower19).sub(1);
}

/////////
/// SQUARE ROOT
/////////

export function sqrt(input: BigNumber, tolerance: BigNumber) {
    if (input.isZero()) {
        return BigNumber.from(0);
    }
    let guess = makeInitialGuess(input);

    // 7 iterations
    for (let i of new Array(7).fill(0)) {
        guess = guess.add(input.mul(ONE).div(guess)).div(2);
    }

    // Check square is more or less correct (in some epsilon range)
    const guessSquared = guess.mul(guess).div(ONE);
    if (
        !(
            guessSquared.lte(input.add(mulUp(guess, tolerance))) &&
            guessSquared.gte(input.sub(mulUp(guess, tolerance)))
        )
    )
        throw new Error('GyroEPool: sqrt failed');

    return guess;
}

function makeInitialGuess(input: BigNumber) {
    if (input.gte(ONE)) {
        return BigNumber.from(2)
            .pow(intLog2Halved(input.div(ONE)))
            .mul(ONE);
    } else {
        if (input.lte('10')) {
            return SQRT_1E_NEG_17;
        }
        if (input.lte('100')) {
            return BigNumber.from('10000000000');
        }
        if (input.lte('1000')) {
            return SQRT_1E_NEG_15;
        }
        if (input.lte('10000')) {
            return BigNumber.from('100000000000');
        }
        if (input.lte('100000')) {
            return SQRT_1E_NEG_13;
        }
        if (input.lte('1000000')) {
            return BigNumber.from('1000000000000');
        }
        if (input.lte('10000000')) {
            return SQRT_1E_NEG_11;
        }
        if (input.lte('100000000')) {
            return BigNumber.from('10000000000000');
        }
        if (input.lte('1000000000')) {
            return SQRT_1E_NEG_9;
        }
        if (input.lte('10000000000')) {
            return BigNumber.from('100000000000000');
        }
        if (input.lte('100000000000')) {
            return SQRT_1E_NEG_7;
        }
        if (input.lte('1000000000000')) {
            return BigNumber.from('1000000000000000');
        }
        if (input.lte('10000000000000')) {
            return SQRT_1E_NEG_5;
        }
        if (input.lte('100000000000000')) {
            return BigNumber.from('10000000000000000');
        }
        if (input.lte('1000000000000000')) {
            return SQRT_1E_NEG_3;
        }
        if (input.lte('10000000000000000')) {
            return BigNumber.from('100000000000000000');
        }
        if (input.lte('100000000000000000')) {
            return SQRT_1E_NEG_1;
        }
        return input;
    }
}

function intLog2Halved(x: BigNumber) {
    let n = 0;

    for (let i = 128; i >= 2; i = i / 2) {
        const factor = BigNumber.from(2).pow(i);
        if (x.gte(factor)) {
            x = x.div(factor);
            n += i / 2;
        }
    }

    return n;
}
