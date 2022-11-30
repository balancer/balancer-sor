import { getAddress } from '@ethersproject/address';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { formatFixed, BigNumber } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, bnum } from '../../utils/bignumber';

import {
    PoolBase,
    PoolPairBase,
    PoolTypes,
    SubgraphToken,
    SwapTypes,
    SubgraphPoolBase,
} from '../../types';
import {
    GyroEParams,
    DerivedGyroEParams,
    Vector2,
    normalizeBalances,
    balancesFromTokenInOut,
    reduceFee,
    addFee,
    virtualOffset0,
    virtualOffset1,
} from './gyroEMath/gyroEMathHelpers';
import { isSameAddress, safeParseFixed } from '../../utils';
import { mulDown, divDown } from '../gyroHelpers/gyroSignedFixedPoint';
import {
    calculateInvariantWithError,
    calcOutGivenIn,
    calcInGivenOut,
    calcSpotPriceAfterSwapOutGivenIn,
    calcSpotPriceAfterSwapInGivenOut,
    calcDerivativePriceAfterSwapOutGivenIn,
    calcDerivativeSpotPriceAfterSwapInGivenOut,
    calculateNormalizedLiquidity,
} from './gyroEMath/gyroEMath';
import { SWAP_LIMIT_FACTOR } from '../gyroHelpers/constants';

export type GyroEPoolPairData = PoolPairBase & {
    tokenInIsToken0: boolean;
};

export type GyroEPoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

type GyroEParamsFromSubgraph = {
    alpha: string;
    beta: string;
    c: string;
    s: string;
    lambda: string;
};
type DerivedGyroEParamsFromSubgraph = {
    tauAlphaX: string;
    tauAlphaY: string;
    tauBetaX: string;
    tauBetaY: string;
    u: string;
    v: string;
    w: string;
    z: string;
    dSq: string;
};

export class GyroEPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.GyroE;
    id: string;
    address: string;
    tokensList: string[];
    tokens: GyroEPoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;
    gyroEParams: GyroEParams;
    derivedGyroEParams: DerivedGyroEParams;

    static fromPool(pool: SubgraphPoolBase): GyroEPool {
        const {
            alpha,
            beta,
            c,
            s,
            lambda,
            tauAlphaX,
            tauAlphaY,
            tauBetaX,
            tauBetaY,
            u,
            v,
            w,
            z,
            dSq,
        } = pool;

        const gyroEParams = {
            alpha,
            beta,
            c,
            s,
            lambda,
        };

        const derivedGyroEParams = {
            tauAlphaX,
            tauAlphaY,
            tauBetaX,
            tauBetaY,
            u,
            v,
            w,
            z,
            dSq,
        };

        if (
            !Object.values(gyroEParams).every((el) => el) ||
            !Object.values(derivedGyroEParams).every((el) => el)
        )
            throw new Error(
                'Pool missing GyroE params and/or GyroE derived params'
            );

        return new GyroEPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens as GyroEPoolToken[],
            pool.tokensList,
            gyroEParams as GyroEParamsFromSubgraph,
            derivedGyroEParams as DerivedGyroEParamsFromSubgraph
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: GyroEPoolToken[],
        tokensList: string[],
        gyroEParams: GyroEParamsFromSubgraph,
        derivedGyroEParams: DerivedGyroEParamsFromSubgraph
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = safeParseFixed(swapFee, 18);
        this.totalShares = safeParseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;

        this.gyroEParams = {
            alpha: safeParseFixed(gyroEParams.alpha, 18),
            beta: safeParseFixed(gyroEParams.beta, 18),
            c: safeParseFixed(gyroEParams.c, 18),
            s: safeParseFixed(gyroEParams.s, 18),
            lambda: safeParseFixed(gyroEParams.lambda, 18),
        };

        this.derivedGyroEParams = {
            tauAlpha: {
                x: safeParseFixed(derivedGyroEParams.tauAlphaX, 38),
                y: safeParseFixed(derivedGyroEParams.tauAlphaY, 38),
            },
            tauBeta: {
                x: safeParseFixed(derivedGyroEParams.tauBetaX, 38),
                y: safeParseFixed(derivedGyroEParams.tauBetaY, 38),
            },
            u: safeParseFixed(derivedGyroEParams.u, 38),
            v: safeParseFixed(derivedGyroEParams.v, 38),
            w: safeParseFixed(derivedGyroEParams.w, 38),
            z: safeParseFixed(derivedGyroEParams.z, 38),
            dSq: safeParseFixed(derivedGyroEParams.dSq, 38),
        };
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): GyroEPoolPairData {
        const tokenInIndex = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenInIndex < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenInIndex];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tokenOutIndex = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenOutIndex < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenOutIndex];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        const tokenInIsToken0 = tokenInIndex === 0;

        const poolPairData: GyroEPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: safeParseFixed(balanceIn, decimalsIn),
            balanceOut: safeParseFixed(balanceOut, decimalsOut),
            swapFee: this.swapFee,
            tokenInIsToken0,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: GyroEPoolPairData): OldBigNumber {
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut]
        );

        const orderedNormalizedBalances = balancesFromTokenInOut(
            normalizedBalances[0],
            normalizedBalances[1],
            poolPairData.tokenInIsToken0
        );

        const [currentInvariant, invErr] = calculateInvariantWithError(
            orderedNormalizedBalances,
            this.gyroEParams,
            this.derivedGyroEParams
        );

        const invariant: Vector2 = {
            x: currentInvariant.add(invErr.mul(2)),
            y: currentInvariant,
        };

        const normalizedLiquidity = calculateNormalizedLiquidity(
            orderedNormalizedBalances,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            this.swapFee,
            poolPairData.tokenInIsToken0
        );

        return bnum(formatFixed(normalizedLiquidity, 18));
    }

    getLimitAmountSwap(
        poolPairData: GyroEPoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            const normalizedBalances = normalizeBalances(
                [poolPairData.balanceIn, poolPairData.balanceOut],
                [poolPairData.decimalsIn, poolPairData.decimalsOut]
            );
            const orderedNormalizedBalances = balancesFromTokenInOut(
                normalizedBalances[0],
                normalizedBalances[1],
                poolPairData.tokenInIsToken0
            );
            const [currentInvariant, invErr] = calculateInvariantWithError(
                orderedNormalizedBalances,
                this.gyroEParams,
                this.derivedGyroEParams
            );
            const invariant: Vector2 = {
                x: currentInvariant.add(invErr.mul(2)),
                y: currentInvariant,
            };
            const virtualOffsetFunc = poolPairData.tokenInIsToken0
                ? virtualOffset0
                : virtualOffset1;
            const maxAmountInAssetInPool = virtualOffsetFunc(
                this.gyroEParams,
                this.derivedGyroEParams,
                invariant
            ).sub(
                virtualOffsetFunc(
                    this.gyroEParams,
                    this.derivedGyroEParams,
                    invariant,
                    true
                )
            );
            const limitAmountIn = maxAmountInAssetInPool.sub(
                normalizedBalances[0]
            );
            const limitAmountInPlusSwapFee = divDown(
                limitAmountIn,
                ONE.sub(poolPairData.swapFee)
            );
            return bnum(
                formatFixed(
                    mulDown(limitAmountInPlusSwapFee, SWAP_LIMIT_FACTOR),
                    18
                )
            );
        } else {
            return bnum(
                formatFixed(
                    mulDown(poolPairData.balanceOut, SWAP_LIMIT_FACTOR),
                    poolPairData.decimalsOut
                )
            );
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (this.address == token) {
            this.totalShares = newBalance;
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => isSameAddress(t.address, token));
            if (!T) throw Error('Pool does not contain this token');
            T.balance = formatFixed(newBalance, T.decimals);
        }
    }

    _exactTokenInForTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut]
        );
        const orderedNormalizedBalances = balancesFromTokenInOut(
            normalizedBalances[0],
            normalizedBalances[1],
            poolPairData.tokenInIsToken0
        );
        const [currentInvariant, invErr] = calculateInvariantWithError(
            orderedNormalizedBalances,
            this.gyroEParams,
            this.derivedGyroEParams
        );

        const invariant: Vector2 = {
            x: currentInvariant.add(invErr.mul(2)),
            y: currentInvariant,
        };
        const inAmount = safeParseFixed(amount.toString(), 18);
        const inAmountLessFee = reduceFee(inAmount, poolPairData.swapFee);
        const outAmount = calcOutGivenIn(
            orderedNormalizedBalances,
            inAmountLessFee,
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant
        );
        return bnum(formatFixed(outAmount, 18));
    }

    _tokenInForExactTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut]
        );
        const orderedNormalizedBalances = balancesFromTokenInOut(
            normalizedBalances[0],
            normalizedBalances[1],
            poolPairData.tokenInIsToken0
        );
        const [currentInvariant, invErr] = calculateInvariantWithError(
            orderedNormalizedBalances,
            this.gyroEParams,
            this.derivedGyroEParams
        );
        const invariant: Vector2 = {
            x: currentInvariant.add(invErr.mul(2)),
            y: currentInvariant,
        };
        const outAmount = safeParseFixed(amount.toString(), 18);

        const inAmountLessFee = calcInGivenOut(
            orderedNormalizedBalances,
            outAmount,
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant
        );
        const inAmount = addFee(inAmountLessFee, poolPairData.swapFee);
        return bnum(formatFixed(inAmount, 18));
    }

    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // Missing maths for this
        return new Array(this.tokens.length).fill(Zero);
    }

    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        // Missing maths for this
        return Zero;
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut]
        );
        const orderedNormalizedBalances = balancesFromTokenInOut(
            normalizedBalances[0],
            normalizedBalances[1],
            poolPairData.tokenInIsToken0
        );
        const [currentInvariant, invErr] = calculateInvariantWithError(
            orderedNormalizedBalances,
            this.gyroEParams,
            this.derivedGyroEParams
        );
        const invariant: Vector2 = {
            x: currentInvariant.add(invErr.mul(2)),
            y: currentInvariant,
        };
        const inAmount = safeParseFixed(amount.toString(), 18);
        const inAmountLessFee = reduceFee(inAmount, poolPairData.swapFee);
        const newSpotPrice = calcSpotPriceAfterSwapOutGivenIn(
            orderedNormalizedBalances,
            inAmountLessFee,
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            poolPairData.swapFee
        );
        return bnum(formatFixed(newSpotPrice, 18));
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut]
        );
        const orderedNormalizedBalances = balancesFromTokenInOut(
            normalizedBalances[0],
            normalizedBalances[1],
            poolPairData.tokenInIsToken0
        );
        const [currentInvariant, invErr] = calculateInvariantWithError(
            orderedNormalizedBalances,
            this.gyroEParams,
            this.derivedGyroEParams
        );
        const invariant: Vector2 = {
            x: currentInvariant.add(invErr.mul(2)),
            y: currentInvariant,
        };
        const outAmount = safeParseFixed(amount.toString(), 18);
        const newSpotPrice = calcSpotPriceAfterSwapInGivenOut(
            orderedNormalizedBalances,
            outAmount,
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            poolPairData.swapFee
        );
        return bnum(formatFixed(newSpotPrice, 18));
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const inAmount = safeParseFixed(amount.toString(), 18);
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut]
        );
        const orderedNormalizedBalances = balancesFromTokenInOut(
            normalizedBalances[0],
            normalizedBalances[1],
            poolPairData.tokenInIsToken0
        );
        const [currentInvariant, invErr] = calculateInvariantWithError(
            orderedNormalizedBalances,
            this.gyroEParams,
            this.derivedGyroEParams
        );
        const invariant: Vector2 = {
            x: currentInvariant.add(invErr.mul(2)),
            y: currentInvariant,
        };

        const derivative = calcDerivativePriceAfterSwapOutGivenIn(
            [
                orderedNormalizedBalances[0].add(
                    reduceFee(inAmount, poolPairData.swapFee)
                ),
                orderedNormalizedBalances[1],
            ],
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            poolPairData.swapFee
        );
        return bnum(formatFixed(derivative, 18));
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut]
        );
        const orderedNormalizedBalances = balancesFromTokenInOut(
            normalizedBalances[0],
            normalizedBalances[1],
            poolPairData.tokenInIsToken0
        );
        const [currentInvariant, invErr] = calculateInvariantWithError(
            orderedNormalizedBalances,
            this.gyroEParams,
            this.derivedGyroEParams
        );
        const invariant: Vector2 = {
            x: currentInvariant.add(invErr.mul(2)),
            y: currentInvariant,
        };
        const outAmount = safeParseFixed(amount.toString(), 18);
        const derivative = calcDerivativeSpotPriceAfterSwapInGivenOut(
            [
                orderedNormalizedBalances[0],
                orderedNormalizedBalances[1].sub(outAmount),
            ],
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            poolPairData.swapFee
        );
        return bnum(formatFixed(derivative, 18));
    }
}
