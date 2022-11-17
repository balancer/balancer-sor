import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { DerivedGyroEParams, GyroEParams } from './gyroEMath/gyroEMathHelpers';

const ONE_100 = parseFixed('1', 100);

export function calculateDerivedValues(p: GyroEParams): DerivedGyroEParams {
    let { alpha, beta, s, c, lambda } = p;
    [alpha, beta, s, c, lambda] = [alpha, beta, s, c, lambda].map((bn) =>
        scale(bn, 18, 100)
    );

    const dSq = mul(c, c).add(mul(s, s));
    const d = sqrtArbitraryDecimal(dSq, 100);

    const cOverDPlusAlphaOverSD = div(c, d).add(div(mul(alpha, s), d));
    const lambdaSquared = mul(lambda, lambda);
    const alphaCOverDMinusSOverD = div(mul(alpha, c), d).sub(div(s, d));

    const dAlpha = div(
        ONE_100,
        sqrtArbitraryDecimal(
            div(
                mul(cOverDPlusAlphaOverSD, cOverDPlusAlphaOverSD),
                lambdaSquared
            ).add(mul(alphaCOverDMinusSOverD, alphaCOverDMinusSOverD)),
            100
        )
    );

    const cOverDPlusBetaSOverD = div(c, d).add(div(mul(beta, s), d));
    const betaCOverDMinusSOverD = div(mul(beta, c), d).sub(div(s, d));

    const dBeta = div(
        ONE_100,
        sqrtArbitraryDecimal(
            div(
                mul(cOverDPlusBetaSOverD, cOverDPlusBetaSOverD),
                lambdaSquared
            ).add(mul(betaCOverDMinusSOverD, betaCOverDMinusSOverD)),
            100
        )
    );

    let tauAlpha: BigNumber[] = [];
    tauAlpha.push(mul(mul(alpha, c).sub(s), dAlpha));
    tauAlpha.push(mul(c.add(mul(s, alpha)), div(dAlpha, lambda)));

    let tauBeta: BigNumber[] = [];

    tauBeta.push(mul(mul(beta, c).sub(s), dBeta));
    tauBeta.push(mul(c.add(mul(s, beta)), div(dBeta, lambda)));

    let w = mul(mul(s, c), tauBeta[1].sub(tauAlpha[1]));
    let z = mul(mul(c, c), tauBeta[0]).add(mul(mul(s, s), tauAlpha[0]));
    let u = mul(mul(s, c), tauBeta[0].sub(tauAlpha[0]));
    let v = mul(mul(s, s), tauBeta[1]).add(mul(mul(c, c), tauAlpha[1]));

    const derived = {
        tauAlpha: {
            x: scale(tauAlpha[0], 100, 38),
            y: scale(tauAlpha[1], 100, 38),
        },
        tauBeta: {
            x: scale(tauBeta[0], 100, 38),
            y: scale(tauBeta[1], 100, 38),
        },
        u: scale(u, 100, 38),
        v: scale(v, 100, 38),
        w: scale(w, 100, 38),
        z: scale(z, 100, 38),
        dSq: scale(dSq, 100, 38),
    };

    return derived;
}

function scale(bn: BigNumber, decimalsIn: number, decimalsOut: number) {
    return bn
        .mul(parseFixed('1', decimalsOut))
        .div(parseFixed('1', decimalsIn));
}

export function sqrtArbitraryDecimal(input: BigNumber, decimals: number) {
    if (input.isZero()) {
        return BigNumber.from(0);
    }
    let guess = input.gt(parseFixed('1', decimals)) ? input.div(2) : input;

    // 100 iterations
    for (let i of new Array(100).fill(0)) {
        guess = guess
            .add(input.mul(parseFixed('1', decimals)).div(guess))
            .div(2);
    }

    return guess;
}

function mul(x: BigNumber, y: BigNumber) {
    return x.mul(y).div(ONE_100);
}
function div(x: BigNumber, y: BigNumber) {
    return x.mul(ONE_100).div(y);
}
