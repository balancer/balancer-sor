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
import { isSameAddress, safeParseFixed } from '../../utils';
import {
    _calculateInvariant,
    _calcOutGivenIn,
    _calcInGivenOut,
    _calculateNewSpotPrice,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from '../gyro3Pool/gyro3Math';

import { _reduceFee, _addFee } from '../gyroHelpers/helpers';
import { mulDown, divDown } from '../gyroHelpers/gyroSignedFixedPoint';
import { SWAP_LIMIT_FACTOR } from '../gyroHelpers/constants';
import { universalNormalizedLiquidity } from '../liquidity';

import { normalizeBalances } from './gyro3V2Math/gyro3V2MathHelpers';

export type Gyro3V2PoolPairData = PoolPairBase & {
    balanceTertiary: BigNumber; // Balance of the unchanged asset
    decimalsTertiary: number; // Decimals of the unchanged asset
    tokenRateIn: BigNumber;
    tokenRateOut: BigNumber;
    tokenRateTertiary: BigNumber; // Rate of the unchanged asset
};

export type Gyro3PoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export class Gyro3V2Pool implements PoolBase<Gyro3V2PoolPairData> {
    poolType: PoolTypes = PoolTypes.Gyro3;
    id: string;
    address: string;
    tokensList: string[];
    tokens: Gyro3PoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;
    root3Alpha: BigNumber;
    tokenRates: BigNumber[];

    /*
    private static findToken(list, tokenAddress, error) {
        const token = list.find(
            (t) => getAddress(t.address) === getAddress(tokenAddress)
        );
        if (!token) throw new Error(error);
        return token;
    }
    */

    private findTokenIndex(tokenAddress: string, error: string | undefined) {
        const ix = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenAddress)
        );
        if (ix === -1) throw new Error(error);
        return ix;
    }

    static fromPool(pool: SubgraphPoolBase): Gyro3V2Pool {
        if (!pool.root3Alpha) throw new Error('Pool missing root3Alpha');

        if (
            safeParseFixed(pool.root3Alpha, 18).lte(0) ||
            safeParseFixed(pool.root3Alpha, 18).gte(ONE)
        )
            throw new Error('Invalid root3Alpha parameter');

        if (!pool.tokenRates)
            throw new Error('Gyro3V2 Pool missing tokenRates');

        if (pool.tokens.length !== 3)
            throw new Error('Gyro3Pool must contain three tokens only');

        return new Gyro3V2Pool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens as Gyro3PoolToken[],
            pool.tokensList,
            pool.root3Alpha,
            pool.tokenRates
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: Gyro3PoolToken[],
        tokensList: string[],
        root3Alpha: string,
        tokenRates: string[]
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = safeParseFixed(swapFee, 18);
        this.totalShares = safeParseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.root3Alpha = safeParseFixed(root3Alpha, 18);
        this.tokenRates = [
            safeParseFixed(tokenRates[0], 18),
            safeParseFixed(tokenRates[1], 18),
            safeParseFixed(tokenRates[2], 18),
        ];
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): Gyro3V2PoolPairData {
        const tIix = this.findTokenIndex(
            tokenIn,
            'Pool does not contain tokenIn'
        );
        const tI = this.tokens[tIix];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tOix = this.findTokenIndex(
            tokenOut,
            'Pool does not contain tokenOut'
        );
        const tO = this.tokens[tOix];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        const tTertiaryIx = this.tokens.findIndex(
            (t) =>
                getAddress(t.address) !== getAddress(tokenOut) &&
                getAddress(t.address) !== getAddress(tokenIn)
        );
        const tokenTertiary = this.tokens[tTertiaryIx];

        if (!tokenTertiary)
            throw new Error('Pool does not contain a valid third token');

        const balanceTertiary = tokenTertiary.balance;
        const decimalsTertiary = tokenTertiary.decimals;

        const poolPairData: Gyro3V2PoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            decimalsTertiary: Number(decimalsTertiary),
            tokenRateIn: this.tokenRates[tIix],
            tokenRateOut: this.tokenRates[tOix],
            tokenRateTertiary: this.tokenRates[tTertiaryIx],
            balanceIn: safeParseFixed(balanceIn, decimalsIn),
            balanceOut: safeParseFixed(balanceOut, decimalsOut),
            balanceTertiary: safeParseFixed(balanceTertiary, decimalsTertiary),
            swapFee: this.swapFee,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: Gyro3V2PoolPairData): OldBigNumber {
        return universalNormalizedLiquidity(
            this._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                ZERO
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: Gyro3V2PoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            const balances = [
                poolPairData.balanceIn,
                poolPairData.balanceOut,
                poolPairData.balanceTertiary,
            ];
            const decimals = [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
                poolPairData.decimalsTertiary,
            ];
            const rates = [
                poolPairData.tokenRateIn,
                poolPairData.tokenRateOut,
                poolPairData.tokenRateTertiary,
            ];
            const normalizedBalances = normalizeBalances(
                balances,
                decimals,
                rates
            );
            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );
            const a = mulDown(invariant, this.root3Alpha);
            const maxAmountInAssetInPool = divDown(
                mulDown(
                    normalizedBalances[0].add(a),
                    normalizedBalances[1].add(a)
                ),
                a
            ).sub(a); // (x + a)(y + a) / a - a
            const limitAmountIn = divDown(
                maxAmountInAssetInPool.sub(normalizedBalances[0]),
                poolPairData.tokenRateIn
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
        poolPairData: Gyro3V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [
                poolPairData.balanceIn,
                poolPairData.balanceOut,
                poolPairData.balanceTertiary,
            ];
            const decimals = [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
                poolPairData.decimalsTertiary,
            ];
            const rates = [
                poolPairData.tokenRateIn,
                poolPairData.tokenRateOut,
                poolPairData.tokenRateTertiary,
            ];
            const normalizedBalances = normalizeBalances(
                balances,
                decimals,
                rates
            );

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);
            const inAmount = safeParseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
            const inAmountLessFeeScaled = mulDown(
                inAmountLessFee,
                poolPairData.tokenRateIn
            );

            const outAmountScaled = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFeeScaled,
                virtualOffsetInOut
            );
            const outAmount = divDown(
                outAmountScaled,
                poolPairData.tokenRateOut
            );
            return bnum(formatFixed(outAmount, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: Gyro3V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
            const outAmountScaled = mulDown(
                outAmount,
                poolPairData.tokenRateOut
            );
            const balances = [
                poolPairData.balanceIn,
                poolPairData.balanceOut,
                poolPairData.balanceTertiary,
            ];
            const decimals = [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
                poolPairData.decimalsTertiary,
            ];
            const rates = [
                poolPairData.tokenRateIn,
                poolPairData.tokenRateOut,
                poolPairData.tokenRateTertiary,
            ];
            const normalizedBalances = normalizeBalances(
                balances,
                decimals,
                rates
            );

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmountScaledLessFee = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmountScaled,
                virtualOffsetInOut
            );
            const inAmountLessFee = divDown(
                inAmountScaledLessFee,
                poolPairData.tokenRateIn
            );
            const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

            return bnum(formatFixed(inAmount, 18));
        } catch (error) {
            return bnum(0);
        }
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
        poolPairData: Gyro3V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [
                poolPairData.balanceIn,
                poolPairData.balanceOut,
                poolPairData.balanceTertiary,
            ];
            const decimals = [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
                poolPairData.decimalsTertiary,
            ];
            const rates = [
                poolPairData.tokenRateIn,
                poolPairData.tokenRateOut,
                poolPairData.tokenRateTertiary,
            ];
            const normalizedBalances = normalizeBalances(
                balances,
                decimals,
                rates
            );

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmount = safeParseFixed(amount.toString(), 18);
            const inAmountScaled = mulDown(inAmount, poolPairData.tokenRateIn);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
            const inAmountLessFeeScaled = mulDown(
                inAmountLessFee,
                poolPairData.tokenRateIn
            );

            const outAmountScaled = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFeeScaled,
                virtualOffsetInOut
            );

            const newSpotPriceScaled = _calculateNewSpotPrice(
                normalizedBalances,
                inAmountScaled,
                outAmountScaled,
                virtualOffsetInOut,
                poolPairData.swapFee
            );
            const newSpotPrice = divDown(
                mulDown(newSpotPriceScaled, poolPairData.tokenRateOut),
                poolPairData.tokenRateIn
            );
            return bnum(formatFixed(newSpotPrice, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro3V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
            const outAmountScaled = mulDown(
                outAmount,
                poolPairData.tokenRateOut
            );
            const balances = [
                poolPairData.balanceIn,
                poolPairData.balanceOut,
                poolPairData.balanceTertiary,
            ];
            const decimals = [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
                poolPairData.decimalsTertiary,
            ];
            const rates = [
                poolPairData.tokenRateIn,
                poolPairData.tokenRateOut,
                poolPairData.tokenRateTertiary,
            ];
            const normalizedBalances = normalizeBalances(
                balances,
                decimals,
                rates
            );

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmountLessFeeScaled = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmountScaled,
                virtualOffsetInOut
            );
            const inAmountScaled = _addFee(
                inAmountLessFeeScaled,
                poolPairData.swapFee
            );

            const newSpotPriceScaled = _calculateNewSpotPrice(
                normalizedBalances,
                inAmountScaled,
                outAmountScaled,
                virtualOffsetInOut,
                poolPairData.swapFee
            );
            const newSpotPrice = divDown(
                mulDown(newSpotPriceScaled, poolPairData.tokenRateOut),
                poolPairData.tokenRateIn
            );

            return bnum(formatFixed(newSpotPrice, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro3V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [
                poolPairData.balanceIn,
                poolPairData.balanceOut,
                poolPairData.balanceTertiary,
            ];
            const decimals = [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
                poolPairData.decimalsTertiary,
            ];
            const rates = [
                poolPairData.tokenRateIn,
                poolPairData.tokenRateOut,
                poolPairData.tokenRateTertiary,
            ];
            const normalizedBalances = normalizeBalances(
                balances,
                decimals,
                rates
            );

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmount = safeParseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
            const inAmountLessFeeScaled = mulDown(
                inAmountLessFee,
                poolPairData.tokenRateIn
            );

            const outAmountScaled = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFeeScaled,
                virtualOffsetInOut
            );
            const derivativeScaled =
                _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    normalizedBalances,
                    outAmountScaled,
                    virtualOffsetInOut
                );
            const derivative = mulDown(
                derivativeScaled,
                poolPairData.tokenRateOut
            );

            return bnum(formatFixed(derivative, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro3V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
            const outAmountScaled = mulDown(
                outAmount,
                poolPairData.tokenRateOut
            );
            const balances = [
                poolPairData.balanceIn,
                poolPairData.balanceOut,
                poolPairData.balanceTertiary,
            ];
            const decimals = [
                poolPairData.decimalsIn,
                poolPairData.decimalsOut,
                poolPairData.decimalsTertiary,
            ];
            const rates = [
                poolPairData.tokenRateIn,
                poolPairData.tokenRateOut,
                poolPairData.tokenRateTertiary,
            ];
            const normalizedBalances = normalizeBalances(
                balances,
                decimals,
                rates
            );

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmountLessFeeScaled = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmountScaled,
                virtualOffsetInOut
            );
            const inAmountScaled = _addFee(
                inAmountLessFeeScaled,
                poolPairData.swapFee
            );

            const derivativeScaled =
                _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                    normalizedBalances,
                    inAmountScaled,
                    outAmountScaled,
                    virtualOffsetInOut,
                    poolPairData.swapFee
                );
            const rateAdjFactor = divDown(
                mulDown(poolPairData.tokenRateOut, poolPairData.tokenRateOut),
                poolPairData.tokenRateIn
            );
            const derivative = mulDown(derivativeScaled, rateAdjFactor);
            return bnum(formatFixed(derivative, 18));
        } catch (error) {
            return bnum(0);
        }
    }
}
