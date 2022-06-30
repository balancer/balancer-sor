import { BigNumber, parseFixed } from '@ethersproject/bignumber';
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
} from './constants';

// Helpers

export function _sqrt(input: BigNumber, tolerance: BigNumber) {
    if (input.isZero()) {
        return BigNumber.from(0);
    }
    let guess = _makeInitialGuess(input);

    // 7 iterations
    for (let i of new Array(7).fill(0)) {
        guess = guess.add(input.mul(ONE).div(guess)).div(2);
    }

    // Check in some epsilon range
    // Check square is more or less correct
    const guessSquared = guess.mul(guess).div(ONE);

    if (
        !(
            guessSquared.lte(input.add(mulUp(guess, tolerance))) &&
            guessSquared.gte(input.sub(mulUp(guess, tolerance)))
        )
    )
        throw new Error('Gyro2Pool: _sqrt failed');

    return guess;
}

function _makeInitialGuess(input: BigNumber) {
    if (input.gte(ONE)) {
        return BigNumber.from(2)
            .pow(_intLog2Halved(input.div(ONE)))
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

function _intLog2Halved(x: BigNumber) {
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
