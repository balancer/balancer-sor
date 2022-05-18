import { getAddress } from '@ethersproject/address';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { parseFixed, formatFixed, BigNumber } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, bnum } from '../../utils/bignumber';

import {
    PoolBase,
    PoolPairBase,
    PoolTypes,
    SubgraphToken,
    SwapTypes,
    SubgraphPoolBase,
    Gyro3PriceBounds,
} from '../../types';
import { isSameAddress } from '../../utils';
import {
    _normalizeBalances,
    _calculateInvariant,
    _calcOutGivenIn,
    _calcInGivenOut,
    _reduceFee,
    _addFee,
    _calculateNewSpotPrice,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _getNormalizedLiquidity,
} from './gyro3Math';

export type Gyro3PoolPairData = PoolPairBase & {
    balanceTertiary: BigNumber; // Balance of the unchanged asset
    decimalsTertiary: number; // Decimals of the unchanged asset
};

export type Gyro3PoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export class Gyro3Pool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Gyro3;
    id: string;
    address: string;
    tokensList: string[];
    tokens: Gyro3PoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;
    root3Alpha: BigNumber;

    // Max In/Out Ratios
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    private static findToken(list, tokenAddress, error) {
        const token = list.find(
            (t) => getAddress(t.address) === getAddress(tokenAddress)
        );
        if (!token) throw new Error(error);
        return token;
    }

    static fromPool(pool: SubgraphPoolBase): Gyro3Pool {
        if (!pool.gyro3PriceBounds)
            throw new Error('Pool missing gyro3PriceBounds');

        const { alpha } = pool.gyro3PriceBounds;
        if (!(Number(alpha) > 0 && Number(alpha) < 1))
            throw new Error('Invalid alpha price bound in gyro3PriceBounds');

        if (pool.tokens.length !== 3)
            throw new Error('Gyro3Pool must contain three tokens only');

        return new Gyro3Pool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens as Gyro3PoolToken[],
            pool.tokensList,
            pool.gyro3PriceBounds as Gyro3PriceBounds
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: Gyro3PoolToken[],
        tokensList: string[],
        priceBounds: Gyro3PriceBounds
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;

        const root3Alpha = parseFixed(
            Math.pow(Number(priceBounds.alpha), 1 / 3).toString(),
            18
        );

        this.root3Alpha = root3Alpha;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): Gyro3PoolPairData {
        const tI = Gyro3Pool.findToken(
            this.tokens,
            tokenIn,
            'Pool does not contain tokenIn'
        );
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tO = Gyro3Pool.findToken(
            this.tokens,
            tokenOut,
            'Pool does not contain tokenOut'
        );
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        const tokenTertiary = this.tokens.find(
            (t) =>
                getAddress(t.address) !== getAddress(tokenOut) &&
                getAddress(t.address) !== getAddress(tokenIn)
        );

        if (!tokenTertiary)
            throw new Error('Pool does not contain a valid third token');

        const balanceTertiary = tokenTertiary.balance;
        const decimalsTertiary = tokenTertiary.decimals;

        const poolPairData: Gyro3PoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            decimalsTertiary: Number(decimalsTertiary),
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            balanceTertiary: parseFixed(balanceTertiary, decimalsTertiary),
            swapFee: this.swapFee,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: Gyro3PoolPairData): OldBigNumber {
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
        const normalizedBalances = _normalizeBalances(balances, decimals);

        const invariant = _calculateInvariant(
            normalizedBalances,
            this.root3Alpha
        );

        const virtualOffsetInOut = invariant.mul(this.root3Alpha).div(ONE);

        const normalisedLiquidity = _getNormalizedLiquidity(
            normalizedBalances,
            virtualOffsetInOut,
            poolPairData.swapFee
        );

        return bnum(formatFixed(normalisedLiquidity, 18));
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            return bnum(
                formatFixed(
                    poolPairData.balanceIn.mul(this.MAX_IN_RATIO).div(ONE),
                    poolPairData.decimalsIn
                )
            );
        } else {
            return bnum(
                formatFixed(
                    poolPairData.balanceOut.mul(this.MAX_OUT_RATIO).div(ONE),
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
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
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
        const normalizedBalances = _normalizeBalances(balances, decimals);

        const invariant = _calculateInvariant(
            normalizedBalances,
            this.root3Alpha
        );

        const virtualOffsetInOut = invariant.mul(this.root3Alpha).div(ONE);

        const inAmount = parseFixed(amount.toString(), 18);
        const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);

        const outAmount = _calcOutGivenIn(
            normalizedBalances[0],
            normalizedBalances[1],
            inAmountLessFee,
            virtualOffsetInOut
        );

        return bnum(formatFixed(outAmount, 18));
    }

    _tokenInForExactTokenOut(
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const outAmount = parseFixed(amount.toString(), 18);
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
        const normalizedBalances = _normalizeBalances(balances, decimals);

        const invariant = _calculateInvariant(
            normalizedBalances,
            this.root3Alpha
        );

        const virtualOffsetInOut = invariant.mul(this.root3Alpha).div(ONE);

        const inAmountLessFee = _calcInGivenOut(
            normalizedBalances[0],
            normalizedBalances[1],
            outAmount,
            virtualOffsetInOut
        );
        const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

        return bnum(formatFixed(inAmount, 18));
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
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
        const normalizedBalances = _normalizeBalances(balances, decimals);

        const invariant = _calculateInvariant(
            normalizedBalances,
            this.root3Alpha
        );

        const virtualOffsetInOut = invariant.mul(this.root3Alpha).div(ONE);

        const inAmount = parseFixed(amount.toString(), 18);
        const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);

        const outAmount = _calcOutGivenIn(
            normalizedBalances[0],
            normalizedBalances[1],
            inAmountLessFee,
            virtualOffsetInOut
        );

        const newSpotPrice = _calculateNewSpotPrice(
            normalizedBalances,
            inAmount,
            outAmount,
            virtualOffsetInOut,
            poolPairData.swapFee
        );
        return bnum(formatFixed(newSpotPrice, 18));
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const outAmount = parseFixed(amount.toString(), 18);
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
        const normalizedBalances = _normalizeBalances(balances, decimals);

        const invariant = _calculateInvariant(
            normalizedBalances,
            this.root3Alpha
        );

        const virtualOffsetInOut = invariant.mul(this.root3Alpha).div(ONE);

        const inAmountLessFee = _calcInGivenOut(
            normalizedBalances[0],
            normalizedBalances[1],
            outAmount,
            virtualOffsetInOut
        );
        const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

        const newSpotPrice = _calculateNewSpotPrice(
            normalizedBalances,
            inAmount,
            outAmount,
            virtualOffsetInOut,
            poolPairData.swapFee
        );

        return bnum(formatFixed(newSpotPrice, 18));
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
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
        const normalizedBalances = _normalizeBalances(balances, decimals);

        const invariant = _calculateInvariant(
            normalizedBalances,
            this.root3Alpha
        );

        const virtualOffsetInOut = invariant.mul(this.root3Alpha).div(ONE);

        const inAmount = parseFixed(amount.toString(), 18);
        const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);

        const outAmount = _calcOutGivenIn(
            normalizedBalances[0],
            normalizedBalances[1],
            inAmountLessFee,
            virtualOffsetInOut
        );
        const derivative = _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            normalizedBalances,
            outAmount,
            virtualOffsetInOut
        );

        return bnum(formatFixed(derivative, 18));
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const outAmount = parseFixed(amount.toString(), 18);
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
        const normalizedBalances = _normalizeBalances(balances, decimals);

        const invariant = _calculateInvariant(
            normalizedBalances,
            this.root3Alpha
        );

        const virtualOffsetInOut = invariant.mul(this.root3Alpha).div(ONE);

        const inAmountLessFee = _calcInGivenOut(
            normalizedBalances[0],
            normalizedBalances[1],
            outAmount,
            virtualOffsetInOut
        );
        const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

        const derivative = _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            normalizedBalances,
            inAmount,
            outAmount,
            virtualOffsetInOut,
            poolPairData.swapFee
        );

        return bnum(formatFixed(derivative, 18));
    }
}
