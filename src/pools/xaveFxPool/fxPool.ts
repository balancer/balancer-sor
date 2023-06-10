import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { BigNumber as OldBigNumber, ZERO, bnum } from './big-number';
import { isSameAddress } from '../../utils';
import { universalNormalizedLiquidity } from '../liquidity';
import {
    PoolBase,
    PoolPairBase,
    PoolTypes,
    SubgraphPoolBase,
    SubgraphToken,
    SwapTypes,
} from '../../types';
import {
    poolBalancesToNumeraire,
    viewRawAmount,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _exactTokenInForTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _tokenInForExactTokenOut,
} from './fxPoolMath';

type FxPoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals' | 'token'
>;

// replicates ` (_lambda + 1).divu(1e18)` operation from the smart contract
const parseFixedCurveParam = (param: string): OldBigNumber => {
    const param64 =
        ((((BigInt(parseFixed(param, 18).toString()) + 1n) << 64n) /
            10n ** 18n) *
            10n ** 36n) >>
        64n;
    return bnum(param64.toString()).div(bnum(10).pow(18));
};

export type FxPoolPairData = PoolPairBase & {
    alpha: OldBigNumber;
    beta: OldBigNumber;
    lambda: OldBigNumber;
    delta: OldBigNumber;
    epsilon: OldBigNumber;
    tokenInLatestFXPrice: OldBigNumber;
    tokenInfxOracleDecimals: OldBigNumber;
    tokenOutLatestFXPrice: OldBigNumber;
    tokenOutfxOracleDecimals: OldBigNumber;
};

export class FxPool implements PoolBase<FxPoolPairData> {
    poolType: PoolTypes = PoolTypes.Fx;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: FxPoolToken[];
    tokensList: string[];
    alpha: OldBigNumber;
    beta: OldBigNumber;
    lambda: OldBigNumber;
    delta: OldBigNumber;
    epsilon: OldBigNumber;

    static fromPool(pool: SubgraphPoolBase): FxPool {
        if (
            !pool.alpha ||
            !pool.beta ||
            !pool.lambda ||
            !pool.delta ||
            !pool.epsilon
        )
            throw new Error('FX Pool Missing Subgraph Field');
        return new FxPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.alpha,
            pool.beta,
            pool.lambda,
            pool.delta,
            pool.epsilon
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: FxPoolToken[],
        tokensList: string[],
        alpha: string,
        beta: string,
        lambda: string,
        delta: string,
        epsilon: string
    ) {
        /**
                 64.64 fixed point value -> decimal (including precision error)
          alpha     14757395258967641311 -> 0.800000000000000000987
          beta       7747632510958011697 -> 0.420000000000000000991
          delta      5534023222112865502 -> 0.30000000000000000093
          epsilon      27670116110564345 -> 0.001500000000000000953
          lambda     5534023222112865503 -> 0.300000000000000000987
        */

        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.alpha = parseFixedCurveParam(alpha).decimalPlaces(
            3,
            OldBigNumber.ROUND_UP
        );
        this.beta = parseFixedCurveParam(beta).decimalPlaces(
            3,
            OldBigNumber.ROUND_UP
        );
        this.lambda = parseFixedCurveParam(lambda).decimalPlaces(
            3,
            OldBigNumber.ROUND_UP
        );
        this.delta = parseFixedCurveParam(delta).decimalPlaces(
            3,
            OldBigNumber.ROUND_UP
        );

        this.epsilon = parseFixedCurveParam(epsilon).decimalPlaces(
            3,
            OldBigNumber.ROUND_UP
        );
    }
    updateTotalShares: (newTotalShares: BigNumber) => void;
    mainIndex?: number | undefined;
    isLBP?: boolean | undefined;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // Will copy over other implementations, not supporting BPT tokens atm
        return new Array(this.tokens.length).fill(Zero);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        // Will copy over other implementations, not supporting BPT tokens atm
        return Zero;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): FxPoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );

        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        if (!tO.token?.latestFXPrice || !tI.token?.latestFXPrice)
            throw 'FX Pool Missing LatestFxPrice';
        if (!tO.token?.fxOracleDecimals || !tI.token?.fxOracleDecimals)
            throw 'FX Pool Missing tokenIn or tokenOut fxOracleDecimals';

        const poolPairData: FxPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            swapFee: this.swapFee,
            alpha: this.alpha,
            beta: this.beta,
            lambda: this.lambda,
            delta: this.delta,
            epsilon: this.epsilon,
            tokenInLatestFXPrice: bnum(tI.token.latestFXPrice)
                .times(bnum(10).pow(tI.token.fxOracleDecimals))
                .integerValue(OldBigNumber.ROUND_DOWN), // decimals is formatted from subgraph in rate we get from the chainlink oracle
            tokenOutLatestFXPrice: bnum(tO.token.latestFXPrice)
                .times(bnum(10).pow(tO.token.fxOracleDecimals))
                .integerValue(OldBigNumber.ROUND_DOWN), // decimals is formatted from subgraph in rate we get from the chainlink oracle
            tokenInfxOracleDecimals: bnum(tI.token.fxOracleDecimals),
            tokenOutfxOracleDecimals: bnum(tO.token.fxOracleDecimals),
        };

        return poolPairData;
    }

    // Normalized liquidity is an abstract term that can be thought of the
    // inverse of the slippage. It is proportional to the token balances in the
    // pool but also depends on the shape of the invariant curve.
    // As a standard, we define normalized liquidity in tokenOut
    getNormalizedLiquidity(poolPairData: FxPoolPairData): OldBigNumber {
        return universalNormalizedLiquidity(
            this._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                ZERO
            )
        );
    }

    /*
    Fx pool logic has an alpha region where it halts swaps.
    maxLimit  = [(1 + alpha) * oGLiq * 0.5] - token value in numeraire
    */
    getLimitAmountSwap(
        poolPairData: FxPoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        try {
            const parsedReserves = poolBalancesToNumeraire(poolPairData);

            const alphaValue = poolPairData.alpha.div(bnum(10).pow(18));

            const maxLimit = alphaValue
                .plus(1)
                .times(parsedReserves._oGLiq)
                .times(0.5);

            if (swapType === SwapTypes.SwapExactIn) {
                const maxLimitAmount = maxLimit.minus(
                    parsedReserves.tokenInReservesInNumeraire
                );

                return viewRawAmount(
                    maxLimitAmount,
                    bnum(poolPairData.decimalsIn),
                    poolPairData.tokenInLatestFXPrice,
                    poolPairData.tokenInfxOracleDecimals
                ).div(bnum(10).pow(poolPairData.decimalsIn));
            } else {
                const maxLimitAmount = maxLimit.minus(
                    parsedReserves.tokenOutReservesInNumeraire
                );

                return viewRawAmount(
                    maxLimitAmount,
                    bnum(poolPairData.decimalsOut),
                    poolPairData.tokenOutLatestFXPrice,
                    poolPairData.tokenOutfxOracleDecimals
                ).div(bnum(10).pow(poolPairData.decimalsOut));
            }
        } catch {
            return ZERO;
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
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            return _exactTokenInForTokenOut(amount, poolPairData);
        } catch {
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            return _tokenInForExactTokenOut(amount, poolPairData);
        } catch {
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            return _spotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                amount
            );
        } catch {
            return ZERO;
        }
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            return _spotPriceAfterSwapTokenInForExactTokenOut(
                poolPairData,
                amount
            );
        } catch {
            return ZERO;
        }
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                poolPairData
            );
        } catch {
            return ZERO;
        }
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                poolPairData
            );
        } catch {
            return ZERO;
        }
    }
}
