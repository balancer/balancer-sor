import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { ONE_XP } from '../../gyroHelpers/constants';
import {
    mulDown,
    divDown,
    mulDownMagU,
    divDownMagU,
    mulUpMagU,
    divUpMagU,
    mulUpXpToNpU,
    mulDownXpToNpU,
    mulXpU,
    divXpU,
    sqrt,
} from '../../gyroHelpers/gyroSignedFixedPoint';
import { MAX_BALANCES } from './constants';

/////////
/// TYPES
/////////

export type GyroEParams = {
    alpha: BigNumber;
    beta: BigNumber;
    c: BigNumber;
    s: BigNumber;
    lambda: BigNumber;
};

// terms in this struct are stored in extra precision (38 decimals) with final decimal rounded down
export type DerivedGyroEParams = {
    tauAlpha: Vector2;
    tauBeta: Vector2;
    u: BigNumber;
    v: BigNumber;
    w: BigNumber;
    z: BigNumber;
    dSq: BigNumber;
};

export type Vector2 = {
    x: BigNumber;
    y: BigNumber;
};

export type QParams = {
    a: BigNumber;
    b: BigNumber;
    c: BigNumber;
};

/////////
/// FEE CALCULATION
/////////

export function reduceFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    const feeAmount = mulDown(amountIn, swapFee);
    return amountIn.sub(feeAmount);
}

export function addFee(amountIn: BigNumber, swapFee: BigNumber): BigNumber {
    return divDown(amountIn, ONE.sub(swapFee));
}

////////
/// BALANCE CALCULATION
////////
export function normalizeBalances(
    balances: BigNumber[],
    decimals: number[]
): BigNumber[] {
    const scalingFactors = decimals.map((d) => parseFixed('1', d));

    return balances.map((bal, index) =>
        bal.mul(ONE).div(scalingFactors[index])
    );
}

export function balancesFromTokenInOut(
    balanceTokenIn: BigNumber,
    balanceTokenOut: BigNumber,
    tokenInIsToken0: boolean
): [BigNumber, BigNumber] {
    return tokenInIsToken0
        ? [balanceTokenIn, balanceTokenOut]
        : [balanceTokenOut, balanceTokenIn];
}

/////////
/// INVARIANT CALC
/////////

export function calcAtAChi(
    x: BigNumber,
    y: BigNumber,
    p: GyroEParams,
    d: DerivedGyroEParams
): BigNumber {
    const dSq2 = mulXpU(d.dSq, d.dSq);

    // (cx - sy) * (w/lambda + z) / lambda
    //      account for 2 factors of dSq (4 s,c factors)
    const termXp = divXpU(
        divDownMagU(divDownMagU(d.w, p.lambda).add(d.z), p.lambda),
        dSq2
    );

    let val = mulDownXpToNpU(
        mulDownMagU(x, p.c).sub(mulDownMagU(y, p.s)),
        termXp
    );

    // (x lambda s + y lambda c) * u, note u > 0
    let termNp = mulDownMagU(mulDownMagU(x, p.lambda), p.s).add(
        mulDownMagU(mulDownMagU(y, p.lambda), p.c)
    );
    val = val.add(mulDownXpToNpU(termNp, divXpU(d.u, dSq2)));

    // (sx+cy) * v, note v > 0
    termNp = mulDownMagU(x, p.s).add(mulDownMagU(y, p.c));
    val = val.add(mulDownXpToNpU(termNp, divXpU(d.v, dSq2)));

    return val;
}

export function calcInvariantSqrt(
    x: BigNumber,
    y: BigNumber,
    p: GyroEParams,
    d: DerivedGyroEParams
): [BigNumber, BigNumber] {
    let val = calcMinAtxAChiySqPlusAtxSq(x, y, p, d).add(
        calc2AtxAtyAChixAChiy(x, y, p, d)
    );
    val = val.add(calcMinAtyAChixSqPlusAtySq(x, y, p, d));
    const err = mulUpMagU(x, x).add(mulUpMagU(y, y)).div(ONE_XP);
    val = val.gt(0) ? sqrt(val, BigNumber.from(5)) : BigNumber.from(0);
    return [val, err];
}

function calcMinAtxAChiySqPlusAtxSq(
    x: BigNumber,
    y: BigNumber,
    p: GyroEParams,
    d: DerivedGyroEParams
) {
    let termNp = mulUpMagU(mulUpMagU(mulUpMagU(x, x), p.c), p.c).add(
        mulUpMagU(mulUpMagU(mulUpMagU(y, y), p.s), p.s)
    );
    termNp = termNp.sub(
        mulDownMagU(mulDownMagU(mulDownMagU(x, y), p.c.mul(2)), p.s)
    );
    const termXp = mulXpU(d.u, d.u)
        .add(divDownMagU(mulXpU(d.u.mul(2), d.v), p.lambda))
        .add(divDownMagU(divDownMagU(mulXpU(d.v, d.v), p.lambda), p.lambda));

    let val = mulDownXpToNpU(termNp.mul(-1), termXp);
    val = val.add(
        mulDownXpToNpU(
            divDownMagU(divDownMagU(termNp.sub(9), p.lambda), p.lambda),
            divXpU(ONE_XP, d.dSq)
        )
    );
    return val;
}

function calc2AtxAtyAChixAChiy(
    x: BigNumber,
    y: BigNumber,
    p: GyroEParams,
    d: DerivedGyroEParams
) {
    let termNp = mulDownMagU(
        mulDownMagU(mulDownMagU(x, x).sub(mulUpMagU(y, y)), p.c.mul(2)),
        p.s
    );

    const xy = mulDownMagU(y, x.mul(2));
    termNp = termNp
        .add(mulDownMagU(mulDownMagU(xy, p.c), p.c))
        .sub(mulDownMagU(mulDownMagU(xy, p.s), p.s));
    let termXp = mulXpU(d.z, d.u).add(
        divDownMagU(divDownMagU(mulXpU(d.w, d.v), p.lambda), p.lambda)
    );
    termXp = termXp.add(
        divDownMagU(mulXpU(d.w, d.u).add(mulXpU(d.z, d.v)), p.lambda)
    );
    termXp = divXpU(termXp, mulXpU(mulXpU(mulXpU(d.dSq, d.dSq), d.dSq), d.dSq));
    const val = mulDownXpToNpU(termNp, termXp);
    return val;
}

function calcMinAtyAChixSqPlusAtySq(
    x: BigNumber,
    y: BigNumber,
    p: GyroEParams,
    d: DerivedGyroEParams
) {
    let termNp = mulUpMagU(mulUpMagU(mulUpMagU(x, x), p.s), p.s).add(
        mulUpMagU(mulUpMagU(mulUpMagU(y, y), p.c), p.c)
    );
    termNp = termNp.add(mulUpMagU(mulUpMagU(mulUpMagU(x, y), p.s.mul(2)), p.c));
    let termXp = mulXpU(d.z, d.z).add(
        divDownMagU(divDownMagU(mulXpU(d.w, d.w), p.lambda), p.lambda)
    );
    termXp = termXp.add(divDownMagU(mulXpU(d.z.mul(2), d.w), p.lambda));
    termXp = divXpU(termXp, mulXpU(mulXpU(mulXpU(d.dSq, d.dSq), d.dSq), d.dSq));
    let val = mulDownXpToNpU(termNp.mul(-1), termXp);
    val = val.add(mulDownXpToNpU(termNp.sub(9), divXpU(ONE_XP, d.dSq)));
    return val;
}

export function calcAChiAChiInXp(
    p: GyroEParams,
    d: DerivedGyroEParams
): BigNumber {
    const dSq3 = mulXpU(mulXpU(d.dSq, d.dSq), d.dSq);
    let val = mulUpMagU(p.lambda, divXpU(mulXpU(d.u.mul(2), d.v), dSq3));
    val = val.add(
        mulUpMagU(
            mulUpMagU(divXpU(mulXpU(d.u.add(1), d.u.add(1)), dSq3), p.lambda),
            p.lambda
        )
    );
    val = val.add(divXpU(mulXpU(d.v, d.v), dSq3));
    const termXp = divUpMagU(d.w, p.lambda).add(d.z);
    val = val.add(divXpU(mulXpU(termXp, termXp), dSq3));
    return val;
}

/////////
/// SWAP AMOUNT CALC
/////////

export function checkAssetBounds(
    params: GyroEParams,
    derived: DerivedGyroEParams,
    invariant: Vector2,
    newBal: BigNumber,
    assetIndex: number
): void {
    if (assetIndex === 0) {
        const xPlus = maxBalances0(params, derived, invariant);
        if (newBal.gt(MAX_BALANCES) || newBal.gt(xPlus))
            throw new Error('ASSET BOUNDS EXCEEDED');
    } else {
        const yPlus = maxBalances1(params, derived, invariant);
        if (newBal.gt(MAX_BALANCES) || newBal.gt(yPlus))
            throw new Error('ASSET BOUNDS EXCEEDED');
    }
}

function maxBalances0(p: GyroEParams, d: DerivedGyroEParams, r: Vector2) {
    const termXp1 = divXpU(d.tauBeta.x.sub(d.tauAlpha.x), d.dSq);
    const termXp2 = divXpU(d.tauBeta.y.sub(d.tauAlpha.y), d.dSq);
    let xp = mulDownXpToNpU(
        mulDownMagU(mulDownMagU(r.y, p.lambda), p.c),
        termXp1
    );
    xp = xp.add(
        termXp2.gt(BigNumber.from(0))
            ? mulDownXpToNpU(r.y, p.s)
            : mulDownXpToNpU(mulUpMagU(r.x, p.s), termXp2)
    );
    return xp;
}

function maxBalances1(p: GyroEParams, d: DerivedGyroEParams, r: Vector2) {
    const termXp1 = divXpU(d.tauBeta.x.sub(d.tauAlpha.x), d.dSq);
    const termXp2 = divXpU(d.tauBeta.y.sub(d.tauAlpha.y), d.dSq);
    let yp = mulDownXpToNpU(
        mulDownMagU(mulDownMagU(r.y, p.lambda), p.s),
        termXp1
    );
    yp = yp.add(
        termXp2.gt(BigNumber.from(0))
            ? mulDownXpToNpU(r.y, p.c)
            : mulDownXpToNpU(mulUpMagU(r.x, p.c), termXp2)
    );
    return yp;
}

export function calcYGivenX(
    x: BigNumber,
    params: GyroEParams,
    d: DerivedGyroEParams,
    r: Vector2
): BigNumber {
    const ab: Vector2 = {
        x: virtualOffset0(params, d, r),
        y: virtualOffset1(params, d, r),
    };

    const y = solveQuadraticSwap(
        params.lambda,
        x,
        params.s,
        params.c,
        r,
        ab,
        d.tauBeta,
        d.dSq
    );
    return y;
}

export function calcXGivenY(
    y: BigNumber,
    params: GyroEParams,
    d: DerivedGyroEParams,
    r: Vector2
): BigNumber {
    const ba: Vector2 = {
        x: virtualOffset1(params, d, r),
        y: virtualOffset0(params, d, r),
    };
    const x = solveQuadraticSwap(
        params.lambda,
        y,
        params.c,
        params.s,
        r,
        ba,
        {
            x: d.tauAlpha.x.mul(-1),
            y: d.tauAlpha.y,
        },
        d.dSq
    );
    return x;
}

export function virtualOffset0(
    p: GyroEParams,
    d: DerivedGyroEParams,
    r: Vector2,
    switchTau?: boolean
): BigNumber {
    const tauValue = switchTau ? d.tauAlpha : d.tauBeta;
    const termXp = divXpU(tauValue.x, d.dSq);

    let a = tauValue.x.gt(BigNumber.from(0))
        ? mulUpXpToNpU(mulUpMagU(mulUpMagU(r.x, p.lambda), p.c), termXp)
        : mulUpXpToNpU(mulDownMagU(mulDownMagU(r.y, p.lambda), p.c), termXp);

    a = a.add(mulUpXpToNpU(mulUpMagU(r.x, p.s), divXpU(tauValue.y, d.dSq)));

    return a;
}

export function virtualOffset1(
    p: GyroEParams,
    d: DerivedGyroEParams,
    r: Vector2,
    switchTau?: boolean
): BigNumber {
    const tauValue = switchTau ? d.tauBeta : d.tauAlpha;
    const termXp = divXpU(tauValue.x, d.dSq);

    let b = tauValue.x.lt(BigNumber.from(0))
        ? mulUpXpToNpU(mulUpMagU(mulUpMagU(r.x, p.lambda), p.s), termXp.mul(-1))
        : mulUpXpToNpU(
              mulDownMagU(mulDownMagU(r.y.mul(-1), p.lambda), p.s),
              termXp
          );

    b = b.add(mulUpXpToNpU(mulUpMagU(r.x, p.c), divXpU(tauValue.y, d.dSq)));
    return b;
}

function solveQuadraticSwap(
    lambda: BigNumber,
    x: BigNumber,
    s: BigNumber,
    c: BigNumber,
    r: Vector2,
    ab: Vector2,
    tauBeta: Vector2,
    dSq: BigNumber
): BigNumber {
    const lamBar: Vector2 = {
        x: ONE_XP.sub(divDownMagU(divDownMagU(ONE_XP, lambda), lambda)),
        y: ONE_XP.sub(divUpMagU(divUpMagU(ONE_XP, lambda), lambda)),
    };
    const q: QParams = {
        a: BigNumber.from(0),
        b: BigNumber.from(0),
        c: BigNumber.from(0),
    };
    const xp = x.sub(ab.x);
    if (xp.gt(BigNumber.from(0))) {
        q.b = mulUpXpToNpU(
            mulDownMagU(mulDownMagU(xp.mul(-1), s), c),
            divXpU(lamBar.y, dSq)
        );
    } else {
        q.b = mulUpXpToNpU(
            mulUpMagU(mulUpMagU(xp.mul(-1), s), c),
            divXpU(lamBar.x, dSq).add(1)
        );
    }
    const sTerm: Vector2 = {
        x: divXpU(mulDownMagU(mulDownMagU(lamBar.y, s), s), dSq),
        y: divXpU(mulUpMagU(mulUpMagU(lamBar.x, s), s), dSq.add(1)).add(1),
    };
    sTerm.x = ONE_XP.sub(sTerm.x);
    sTerm.y = ONE_XP.sub(sTerm.y);

    q.c = calcXpXpDivLambdaLambda(x, r, lambda, s, c, tauBeta, dSq).mul(-1);
    q.c = q.c.add(mulDownXpToNpU(mulDownMagU(r.y, r.y), sTerm.y)); // r.y ===  currentInv + err
    q.c = q.c.gt(BigNumber.from(0))
        ? sqrt(q.c, BigNumber.from(5))
        : BigNumber.from(0);
    if (q.b.sub(q.c).gt(BigNumber.from(0))) {
        q.a = mulUpXpToNpU(q.b.sub(q.c), divXpU(ONE_XP, sTerm.y).add(1));
    } else {
        q.a = mulUpXpToNpU(q.b.sub(q.c), divXpU(ONE_XP, sTerm.x));
    }
    return q.a.add(ab.y);
}

export function calcXpXpDivLambdaLambda(
    x: BigNumber,
    r: Vector2,
    lambda: BigNumber,
    s: BigNumber,
    c: BigNumber,
    tauBeta: Vector2,
    dSq: BigNumber
): BigNumber {
    const sqVars = {
        x: mulXpU(dSq, dSq),
        y: mulUpMagU(r.x, r.x),
    };
    const q: QParams = {
        a: BigNumber.from(0),
        b: BigNumber.from(0),
        c: BigNumber.from(0),
    };
    let termXp = divXpU(mulXpU(tauBeta.x, tauBeta.y), sqVars.x);
    if (termXp.gt(BigNumber.from(0))) {
        q.a = mulUpMagU(sqVars.y, s.mul(2));
        q.a = mulUpXpToNpU(mulUpMagU(q.a, c), termXp.add(7));
    } else {
        q.a = mulDownMagU(mulDownMagU(r.y, r.y), s.mul(2)); // r.y ===  currentInv + err
        q.a = mulUpXpToNpU(mulDownMagU(q.a, c), termXp);
    }

    if (tauBeta.x.lt(BigNumber.from(0))) {
        q.b = mulUpXpToNpU(
            mulUpMagU(mulUpMagU(r.x, x), c.mul(2)),
            divXpU(tauBeta.x, dSq).mul(-1).add(3)
        );
    } else {
        q.b = mulUpXpToNpU(
            mulDownMagU(mulDownMagU(r.y.mul(-1), x), c.mul(2)),
            divXpU(tauBeta.x, dSq)
        );
    }
    q.a = q.a.add(q.b);
    termXp = divXpU(mulXpU(tauBeta.y, tauBeta.y), sqVars.x).add(7);
    q.b = mulUpMagU(sqVars.y, s);
    q.b = mulUpXpToNpU(mulUpMagU(q.b, s), termXp);

    q.c = mulUpXpToNpU(
        mulDownMagU(mulDownMagU(r.y.mul(-1), x), s.mul(2)),
        divXpU(tauBeta.y, dSq)
    );
    q.b = q.b.add(q.c).add(mulUpMagU(x, x));
    q.b = q.b.gt(BigNumber.from(0))
        ? divUpMagU(q.b, lambda)
        : divDownMagU(q.b, lambda);

    q.a = q.a.add(q.b);
    q.a = q.a.gt(BigNumber.from(0))
        ? divUpMagU(q.a, lambda)
        : divDownMagU(q.a, lambda);

    termXp = divXpU(mulXpU(tauBeta.x, tauBeta.x), sqVars.x).add(7);
    const val = mulUpMagU(mulUpMagU(sqVars.y, c), c);
    return mulUpXpToNpU(val, termXp).add(q.a);
}

/////////
/// LINEAR ALGEBRA OPERATIONS
/////////

export function mulA(params: GyroEParams, tp: Vector2): Vector2 {
    return {
        x: divDownMagU(mulDownMagU(params.c, tp.x), params.lambda).sub(
            divDownMagU(mulDownMagU(params.s, tp.y), params.lambda)
        ),
        y: mulDownMagU(params.s, tp.x).add(mulDownMagU(params.c, tp.y)),
    };
}

export function scalarProd(t1: Vector2, t2: Vector2): BigNumber {
    const ret = mulDownMagU(t1.x, t2.x).add(mulDownMagU(t1.y, t2.y));
    return ret;
}
