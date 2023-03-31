import { getAddress } from '@ethersproject/address';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { formatFixed, BigNumber } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../../utils/bignumber';

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
    balancesFromTokenInOut,
    reduceFee,
    addFee,
    virtualOffset0,
    virtualOffset1,
} from '../gyroEPool/gyroEMath/gyroEMathHelpers';
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
} from '../gyroEPool/gyroEMath/gyroEMath';
import { SWAP_LIMIT_FACTOR } from '../gyroHelpers/constants';
import { universalNormalizedLiquidity } from '../liquidity';

import { normalizeBalances } from './gyroEV2Math/gyroEV2MathHelpers';

// Alias for code readability. Observe that `balancesFromTokenInOut()` is its own inverse.
const valuesInOutFrom01 = balancesFromTokenInOut;


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

export class GyroEV2Pool implements PoolBase<GyroEPoolPairData> {
    poolType: PoolTypes = PoolTypes.GyroE;
    id: string;
    address: string;
    tokensList: string[];
    tokens: GyroEPoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;
    gyroEParams: GyroEParams;
    derivedGyroEParams: DerivedGyroEParams;
    tokenRates: BigNumber[];

    static fromPool(pool: SubgraphPoolBase): GyroEV2Pool {
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
            tokenRates,
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

        if (!tokenRates) throw new Error('GyroEV2 Pool missing tokenRates');

        return new GyroEV2Pool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens as GyroEPoolToken[],
            pool.tokensList,
            gyroEParams as GyroEParamsFromSubgraph,
            derivedGyroEParams as DerivedGyroEParamsFromSubgraph,
            tokenRates
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
        derivedGyroEParams: DerivedGyroEParamsFromSubgraph,
        tokenRates: string[]
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = safeParseFixed(swapFee, 18);
        this.totalShares = safeParseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.tokenRates = [
            safeParseFixed(tokenRates[0], 18),
            safeParseFixed(tokenRates[1], 18),
        ];

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
        return universalNormalizedLiquidity(
            this._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                ZERO
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: GyroEPoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            const tokenRateInOut = valuesInOutFrom01(
                this.tokenRates[0],
                this.tokenRates[1],
                poolPairData.tokenInIsToken0
            );
            const normalizedBalances = normalizeBalances(
                [poolPairData.balanceIn, poolPairData.balanceOut],
                [poolPairData.decimalsIn, poolPairData.decimalsOut],
                tokenRateInOut
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
            const limitAmountIn = divDown(
                maxAmountInAssetInPool.sub(normalizedBalances[0]),
                tokenRateInOut[0]
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
        if (isSameAddress(this.address, token)) {
            this.updateTotalShares(newBalance);
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => isSameAddress(t.address, token));
            if (!T) throw Error('Pool does not contain this token');
            T.balance = formatFixed(newBalance, T.decimals);
        }
    }

    updateTotalShares(newTotalShares: BigNumber): void {
        this.totalShares = newTotalShares;
    }

    _exactTokenInForTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenRateInOut = valuesInOutFrom01(
            this.tokenRates[0],
            this.tokenRates[1],
            poolPairData.tokenInIsToken0
        );
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut],
            tokenRateInOut
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
        const inAmountLessFeeScaled = mulDown(inAmountLessFee, tokenRateInOut[0]);
        const outAmountScaled = calcOutGivenIn(
            orderedNormalizedBalances,
            inAmountLessFeeScaled,
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant
        );
        const outAmount = divDown(outAmountScaled, tokenRateInOut[1]);
        return bnum(formatFixed(outAmount, 18));
    }

    _tokenInForExactTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenRateInOut = valuesInOutFrom01(
            this.tokenRates[0],
            this.tokenRates[1],
            poolPairData.tokenInIsToken0
        );
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut],
            tokenRateInOut
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
        const outAmountScaled = mulDown(outAmount, tokenRateInOut[1]);

        const inAmountScaledLessFee = calcInGivenOut(
            orderedNormalizedBalances,
            outAmountScaled,
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant
        );
        const inAmountLessFee = divDown(inAmountScaledLessFee, tokenRateInOut[0]);
        const inAmount = addFee(inAmountLessFee, poolPairData.swapFee);
        return bnum(formatFixed(inAmount, 18));
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // Missing maths for this
        return new Array(this.tokens.length).fill(Zero);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        // Missing maths for this
        return Zero;
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenRateInOut = valuesInOutFrom01(
            this.tokenRates[0],
            this.tokenRates[1],
            poolPairData.tokenInIsToken0
        );
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut],
            tokenRateInOut
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
        const inAmountLessFeeScaled = mulDown(inAmountLessFee, tokenRateInOut[0]);
        const newSpotPriceScaled = calcSpotPriceAfterSwapOutGivenIn(
            orderedNormalizedBalances,
            inAmountLessFeeScaled,
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            poolPairData.swapFee
        );
        const newSpotPrice = divDown(mulDown(newSpotPriceScaled, tokenRateInOut[1]), tokenRateInOut[0]);
        return bnum(formatFixed(newSpotPrice, 18));
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenRateInOut = valuesInOutFrom01(
            this.tokenRates[0],
            this.tokenRates[1],
            poolPairData.tokenInIsToken0
        );
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut],
            tokenRateInOut
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
        const outAmountScaled = mulDown(outAmount, tokenRateInOut[1]);
        const newSpotPriceScaled = calcSpotPriceAfterSwapInGivenOut(
            orderedNormalizedBalances,
            outAmountScaled,
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            poolPairData.swapFee
        );
        const newSpotPrice = divDown(mulDown(newSpotPriceScaled, tokenRateInOut[1]), tokenRateInOut[0]);
        return bnum(formatFixed(newSpotPrice, 18));
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const inAmount = safeParseFixed(amount.toString(), 18);
        const tokenRateInOut = valuesInOutFrom01(
            this.tokenRates[0],
            this.tokenRates[1],
            poolPairData.tokenInIsToken0
        );
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut],
            tokenRateInOut
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

        const derivativeScaled = calcDerivativePriceAfterSwapOutGivenIn(
            [
                orderedNormalizedBalances[0].add(
                    reduceFee(mulDown(inAmount, tokenRateInOut[0]), poolPairData.swapFee)
                ),
                orderedNormalizedBalances[1],
            ],
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            poolPairData.swapFee
        );
        const derivative = mulDown(derivativeScaled, tokenRateInOut[1]);
        return bnum(formatFixed(derivative, 18));
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: GyroEPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenRateInOut = valuesInOutFrom01(
            this.tokenRates[0],
            this.tokenRates[1],
            poolPairData.tokenInIsToken0
        );
        const normalizedBalances = normalizeBalances(
            [poolPairData.balanceIn, poolPairData.balanceOut],
            [poolPairData.decimalsIn, poolPairData.decimalsOut],
            tokenRateInOut
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
        const derivativeScaled = calcDerivativeSpotPriceAfterSwapInGivenOut(
            [
                orderedNormalizedBalances[0],
                orderedNormalizedBalances[1].sub(mulDown(outAmount, tokenRateInOut[1])),
            ],
            poolPairData.tokenInIsToken0,
            this.gyroEParams,
            this.derivedGyroEParams,
            invariant,
            poolPairData.swapFee
        );
        const rateAdjFactor = divDown(mulDown(tokenRateInOut[1], tokenRateInOut[1]), tokenRateInOut[0]);
        const derivative = mulDown(derivativeScaled, rateAdjFactor);
        return bnum(formatFixed(derivative, 18));
    }
}
