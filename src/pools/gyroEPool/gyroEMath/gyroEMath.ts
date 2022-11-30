import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { MAX_BALANCES, MAX_INVARIANT } from './constants';
import { ONE_XP, SMALL } from '../../gyroHelpers/constants';
import {
    GyroEParams,
    DerivedGyroEParams,
    Vector2,
    calcAtAChi,
    calcInvariantSqrt,
    calcAChiAChiInXp,
    calcXGivenY,
    calcYGivenX,
    checkAssetBounds,
} from './gyroEMathHelpers';
import {
    mulDown,
    divDown,
    mulUpMagU,
    divUpMagU,
    mulUpXpToNpU,
    mulDownXpToNpU,
    divXpU,
    sqrt,
} from '../../gyroHelpers/gyroSignedFixedPoint';
import {
    normalizedLiquidityXIn,
    normalizedLiquidityYIn,
    calcSpotPriceXGivenY,
    calcSpotPriceYGivenX,
    dPxDXOut,
    dPxDYIn,
    dPyDXIn,
    dPyDYOut,
} from './gyroEMathFunctions';

export function calculateNormalizedLiquidity(
    balances: BigNumber[],
    params: GyroEParams,
    derived: DerivedGyroEParams,
    r: Vector2,
    fee: BigNumber,
    tokenInIsToken0: boolean
): BigNumber {
    if (tokenInIsToken0) {
        return normalizedLiquidityXIn(balances, params, derived, fee, r);
    } else {
        return normalizedLiquidityYIn(balances, params, derived, fee, r);
    }
}

export function calculateInvariantWithError(
    balances: BigNumber[],
    params: GyroEParams,
    derived: DerivedGyroEParams
): [BigNumber, BigNumber] {
    const [x, y] = balances;

    if (x.add(y).gt(MAX_BALANCES)) throw new Error('MAX ASSETS EXCEEDED');
    const AtAChi = calcAtAChi(x, y, params, derived);

    let [square_root, err] = calcInvariantSqrt(x, y, params, derived);

    if (square_root.gt(0)) {
        err = divUpMagU(err.add(1), square_root.mul(2));
    } else {
        err = err.gt(0)
            ? sqrt(err, BigNumber.from(5))
            : BigNumber.from(10).pow(9);
    }

    err = mulUpMagU(params.lambda, x.add(y))
        .div(ONE_XP)
        .add(err)
        .add(1)
        .mul(20);

    const mulDenominator = divXpU(
        ONE_XP,
        calcAChiAChiInXp(params, derived).sub(ONE_XP)
    );
    const invariant = mulDownXpToNpU(
        AtAChi.add(square_root).sub(err),
        mulDenominator
    );
    err = mulUpXpToNpU(err, mulDenominator);

    err = err
        .add(
            mulUpXpToNpU(invariant, mulDenominator)
                .mul(
                    params.lambda
                        .mul(params.lambda)
                        .div(BigNumber.from(10).pow(36))
                )
                .mul(40)
                .div(ONE_XP)
        )
        .add(1);

    if (invariant.add(err).gt(MAX_INVARIANT))
        throw new Error('MAX INVARIANT EXCEEDED');

    return [invariant, err];
}

export function calcOutGivenIn(
    balances: BigNumber[],
    amountIn: BigNumber,
    tokenInIsToken0: boolean,
    params: GyroEParams,
    derived: DerivedGyroEParams,
    invariant: Vector2
): BigNumber {
    if (amountIn.lt(SMALL)) return BigNumber.from(0);

    const ixIn = Number(!tokenInIsToken0);
    const ixOut = Number(tokenInIsToken0);

    const calcGiven = tokenInIsToken0 ? calcYGivenX : calcXGivenY;

    const balInNew = balances[ixIn].add(amountIn);

    checkAssetBounds(params, derived, invariant, balInNew, ixIn);
    const balOutNew = calcGiven(balInNew, params, derived, invariant);
    const amountOut = balances[ixOut].sub(balOutNew);
    if (amountOut.lt(0)) {
        // Should never happen; check anyways to catch a numerical bug.
        throw new Error('ASSET BOUNDS EXCEEDED 1');
    }

    return amountOut;
}

export function calcInGivenOut(
    balances: BigNumber[],
    amountOut: BigNumber,
    tokenInIsToken0: boolean,
    params: GyroEParams,
    derived: DerivedGyroEParams,
    invariant: Vector2
): BigNumber {
    if (amountOut.lt(SMALL)) return BigNumber.from(0);

    const ixIn = Number(!tokenInIsToken0);
    const ixOut = Number(tokenInIsToken0);

    const calcGiven = tokenInIsToken0 ? calcXGivenY : calcYGivenX;

    if (amountOut.gt(balances[ixOut]))
        throw new Error('ASSET BOUNDS EXCEEDED 2');
    const balOutNew = balances[ixOut].sub(amountOut);

    const balInNew = calcGiven(balOutNew, params, derived, invariant);
    checkAssetBounds(params, derived, invariant, balInNew, ixIn);
    const amountIn = balInNew.sub(balances[ixIn]);

    if (amountIn.lt(0))
        // Should never happen; check anyways to catch a numerical bug.
        throw new Error('ASSET BOUNDS EXCEEDED 3');
    return amountIn;
}

export function calcSpotPriceAfterSwapOutGivenIn(
    balances: BigNumber[],
    amountIn: BigNumber,
    tokenInIsToken0: boolean,
    params: GyroEParams,
    derived: DerivedGyroEParams,
    invariant: Vector2,
    swapFee: BigNumber
): BigNumber {
    const ixIn = Number(!tokenInIsToken0);
    const f = ONE.sub(swapFee);

    const calcSpotPriceGiven = tokenInIsToken0
        ? calcSpotPriceYGivenX
        : calcSpotPriceXGivenY;

    const balInNew = balances[ixIn].add(amountIn);
    const newSpotPriceFactor = calcSpotPriceGiven(
        balInNew,
        params,
        derived,
        invariant
    );
    return divDown(ONE, mulDown(newSpotPriceFactor, f));
}

export function calcSpotPriceAfterSwapInGivenOut(
    balances: BigNumber[],
    amountOut: BigNumber,
    tokenInIsToken0: boolean,
    params: GyroEParams,
    derived: DerivedGyroEParams,
    invariant: Vector2,
    swapFee: BigNumber
): BigNumber {
    const ixOut = Number(tokenInIsToken0);
    const f = ONE.sub(swapFee);

    const calcSpotPriceGiven = tokenInIsToken0
        ? calcSpotPriceXGivenY
        : calcSpotPriceYGivenX;

    const balOutNew = balances[ixOut].sub(amountOut);
    const newSpotPriceFactor = calcSpotPriceGiven(
        balOutNew,
        params,
        derived,
        invariant
    );
    return divDown(newSpotPriceFactor, f);
}

export function calcDerivativePriceAfterSwapOutGivenIn(
    balances: BigNumber[],
    tokenInIsToken0: boolean,
    params: GyroEParams,
    derived: DerivedGyroEParams,
    invariant: Vector2,
    swapFee: BigNumber
): BigNumber {
    const ixIn = Number(!tokenInIsToken0);

    const newDerivativeSpotPriceFactor = ixIn
        ? dPxDYIn(balances, params, derived, swapFee, invariant)
        : dPyDXIn(balances, params, derived, swapFee, invariant);

    return newDerivativeSpotPriceFactor;
}

export function calcDerivativeSpotPriceAfterSwapInGivenOut(
    balances: BigNumber[],
    tokenInIsToken0: boolean,
    params: GyroEParams,
    derived: DerivedGyroEParams,
    invariant: Vector2,
    swapFee: BigNumber
): BigNumber {
    const ixIn = Number(!tokenInIsToken0);

    const newDerivativeSpotPriceFactor = ixIn
        ? dPxDXOut(balances, params, derived, swapFee, invariant)
        : dPyDYOut(balances, params, derived, swapFee, invariant);

    return newDerivativeSpotPriceFactor;
}
