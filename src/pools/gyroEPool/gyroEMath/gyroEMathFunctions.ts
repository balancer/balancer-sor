import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import {
    GyroEParams,
    DerivedGyroEParams,
    Vector2,
    QParams,
    virtualOffset0,
    virtualOffset1,
} from './gyroEMathHelpers';
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
    divXpU,
    sqrt,
} from '../../gyroHelpers/gyroSignedFixedPoint';
import { calcXpXpDivLambdaLambda } from './gyroEMathHelpers';

/////////
/// SPOT PRICE AFTER SWAP CALCULATIONS
/////////

export function calcSpotPriceYGivenX(
    x: BigNumber,
    params: GyroEParams,
    d: DerivedGyroEParams,
    r: Vector2
) {
    const ab: Vector2 = {
        x: virtualOffset0(params, d, r),
        y: virtualOffset1(params, d, r),
    };
    const newSpotPriceFactor = solveDerivativeQuadraticSwap(
        params.lambda,
        x,
        params.s,
        params.c,
        r,
        ab,
        d.tauBeta,
        d.dSq
    );
    return newSpotPriceFactor;
}

export function calcSpotPriceXGivenY(
    y: BigNumber,
    params: GyroEParams,
    d: DerivedGyroEParams,
    r: Vector2
) {
    const ba: Vector2 = {
        x: virtualOffset1(params, d, r),
        y: virtualOffset0(params, d, r),
    };
    const newSpotPriceFactor = solveDerivativeQuadraticSwap(
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
    return newSpotPriceFactor;
}

function solveDerivativeQuadraticSwap(
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
    q.b = mulUpXpToNpU(mulDownMagU(s, c), divXpU(lamBar.y, dSq));

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

    q.c = mulDown(mulDown(q.c, lambda), lambda);
    q.c = divDown(xp, q.c);

    if (q.b.sub(q.c).gt(BigNumber.from(0))) {
        q.a = mulUpXpToNpU(q.b.sub(q.c), divXpU(ONE_XP, sTerm.y).add(1));
    } else {
        q.a = mulUpXpToNpU(q.b.sub(q.c), divXpU(ONE_XP, sTerm.x));
    }
    return q.a;
}

/////////
/// SPOT PRICE DERIVATIVE CALCULATIONS
/////////

function setup(
    balances,
    params: GyroEParams,
    derived: DerivedGyroEParams,
    fee: BigNumber,
    rVec: Vector2,
    ixVar: number
) {
    const r = rVec.y;
    const { c, s, lambda } = params;
    const [x0, y0] = balances;
    const a = virtualOffset0(params, derived, rVec);
    const b = virtualOffset1(params, derived, rVec);
    const ls = ONE.sub(divDown(ONE, mulDown(lambda, lambda)));
    const f = ONE.sub(fee);

    let R: BigNumber;
    if (ixVar === 0) {
        R = sqrt(
            mulDown(mulDown(r, r), ONE.sub(mulDown(ls, mulDown(s, s)))).sub(
                divDown(mulDown(x0.sub(a), x0.sub(a)), mulDown(lambda, lambda))
            ),
            BigNumber.from(5)
        );
    } else {
        R = sqrt(
            mulDown(mulDown(r, r), ONE.sub(mulDown(ls, mulDown(c, c)))).sub(
                divDown(mulDown(y0.sub(b), y0.sub(b)), mulDown(lambda, lambda))
            ),
            BigNumber.from(5)
        );
    }

    return { x0, y0, c, s, lambda, a, b, ls, f, r, R };
}

export function normalizedLiquidityYIn(
    balances: BigNumber[],
    params: GyroEParams,
    derived: DerivedGyroEParams,
    fee: BigNumber,
    rVec: Vector2
) {
    const { y0, c, s, lambda, b, ls, R } = setup(
        balances,
        params,
        derived,
        fee,
        rVec,
        1
    );

    const returnValue = divDown(
        mulDown(
            divDown(ONE, ONE.sub(mulDown(ls, mulDown(c, c)))),
            mulDown(
                R,
                mulDown(
                    mulDown(
                        mulDown(
                            mulDown(mulDown(ls, s), c),
                            mulDown(lambda, lambda)
                        ),
                        R
                    ).sub(y0.sub(b)),
                    mulDown(
                        mulDown(
                            mulDown(mulDown(ls, s), c),
                            mulDown(lambda, lambda)
                        ),
                        R
                    ).sub(y0.sub(b))
                )
            )
        ),
        mulDown(mulDown(lambda, lambda), mulDown(R, R)).add(
            mulDown(y0.sub(b), y0.sub(b))
        )
    );

    return returnValue;
}

export function normalizedLiquidityXIn(
    balances: BigNumber[],
    params: GyroEParams,
    derived: DerivedGyroEParams,
    fee: BigNumber,
    rVec: Vector2
) {
    const { x0, c, s, lambda, a, ls, R } = setup(
        balances,
        params,
        derived,
        fee,
        rVec,
        0
    );

    const returnValue = divDown(
        mulDown(
            divDown(ONE, ONE.sub(mulDown(ls, mulDown(s, s)))),
            mulDown(
                R,
                mulDown(
                    mulDown(
                        mulDown(
                            mulDown(mulDown(ls, s), c),
                            mulDown(lambda, lambda)
                        ),
                        R
                    ).sub(x0.sub(a)),
                    mulDown(
                        mulDown(
                            mulDown(mulDown(ls, s), c),
                            mulDown(lambda, lambda)
                        ),
                        R
                    ).sub(x0.sub(a))
                )
            )
        ),
        mulDown(mulDown(lambda, lambda), mulDown(R, R)).add(
            mulDown(x0.sub(a), x0.sub(a))
        )
    );

    return returnValue;
}

export function dPyDXIn(
    balances: BigNumber[],
    params: GyroEParams,
    derived: DerivedGyroEParams,
    fee: BigNumber,
    rVec: Vector2
) {
    const { x0, c, s, lambda, a, ls, R } = setup(
        balances,
        params,
        derived,
        fee,
        rVec,
        0
    );

    const returnValue = divDown(
        mulDown(
            ONE.sub(mulDown(ls, mulDown(s, s))),
            divDown(ONE, mulDown(mulDown(lambda, lambda), R)).add(
                divDown(
                    mulDown(x0.sub(a), x0.sub(a)),
                    mulDown(
                        mulDown(
                            mulDown(lambda, lambda),
                            mulDown(lambda, lambda)
                        ),
                        mulDown(R, mulDown(R, R))
                    )
                )
            )
        ),
        mulDown(
            mulDown(mulDown(ls, s), c).sub(
                divDown(x0.sub(a), mulDown(mulDown(lambda, lambda), R))
            ),
            mulDown(mulDown(ls, s), c).sub(
                divDown(x0.sub(a), mulDown(mulDown(lambda, lambda), R))
            )
        )
    );

    return returnValue;
}

export function dPxDYIn(
    balances: BigNumber[],
    params: GyroEParams,
    derived: DerivedGyroEParams,
    fee: BigNumber,
    rVec: Vector2
) {
    const { y0, c, s, lambda, b, ls, R } = setup(
        balances,
        params,
        derived,
        fee,
        rVec,
        1
    );

    const returnValue = divDown(
        mulDown(
            ONE.sub(mulDown(ls, mulDown(c, c))),
            divDown(ONE, mulDown(mulDown(lambda, lambda), R)).add(
                divDown(
                    mulDown(y0.sub(b), y0.sub(b)),
                    mulDown(
                        mulDown(
                            mulDown(lambda, lambda),
                            mulDown(lambda, lambda)
                        ),
                        mulDown(R, mulDown(R, R))
                    )
                )
            )
        ),
        mulDown(
            mulDown(mulDown(ls, s), c).sub(
                divDown(y0.sub(b), mulDown(mulDown(lambda, lambda), R))
            ),
            mulDown(mulDown(ls, s), c).sub(
                divDown(y0.sub(b), mulDown(mulDown(lambda, lambda), R))
            )
        )
    );

    return returnValue;
}

export function dPxDXOut(
    balances: BigNumber[],
    params: GyroEParams,
    derived: DerivedGyroEParams,
    fee: BigNumber,
    rVec: Vector2
) {
    const { x0, s, lambda, a, ls, R, f } = setup(
        balances,
        params,
        derived,
        fee,
        rVec,
        0
    );

    const returnValue = mulDown(
        divDown(ONE, mulDown(f, ONE.sub(mulDown(ls, mulDown(s, s))))),
        divDown(ONE, mulDown(mulDown(lambda, lambda), R)).add(
            divDown(
                mulDown(x0.sub(a), x0.sub(a)),
                mulDown(
                    mulDown(mulDown(lambda, lambda), mulDown(lambda, lambda)),
                    mulDown(mulDown(R, R), R)
                )
            )
        )
    );

    return returnValue;
}

export function dPyDYOut(
    balances: BigNumber[],
    params: GyroEParams,
    derived: DerivedGyroEParams,
    fee: BigNumber,
    rVec: Vector2
) {
    const { y0, c, lambda, b, ls, R, f } = setup(
        balances,
        params,
        derived,
        fee,
        rVec,
        1
    );

    const returnValue = mulDown(
        divDown(ONE, mulDown(f, ONE.sub(mulDown(ls, mulDown(c, c))))),
        divDown(ONE, mulDown(mulDown(lambda, lambda), R)).add(
            divDown(
                mulDown(y0.sub(b), y0.sub(b)),
                mulDown(
                    mulDown(mulDown(lambda, lambda), mulDown(lambda, lambda)),
                    mulDown(mulDown(R, R), R)
                )
            )
        )
    );

    return returnValue;
}
