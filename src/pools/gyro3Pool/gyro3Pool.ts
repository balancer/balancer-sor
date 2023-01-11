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
} from './gyro3Math';

import {
    _normalizeBalances,
    _reduceFee,
    _addFee,
} from '../gyroHelpers/helpers';
import { mulDown, divDown } from '../gyroHelpers/gyroSignedFixedPoint';
import { SWAP_LIMIT_FACTOR } from '../gyroHelpers/constants';
import { universalNormalizedLiquidity } from '../liquidity';

export type Gyro3PoolPairData = PoolPairBase & {
    balanceTertiary: BigNumber; // Balance of the unchanged asset
    decimalsTertiary: number; // Decimals of the unchanged asset
};

export type Gyro3PoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export class Gyro3Pool implements PoolBase<Gyro3PoolPairData> {
    poolType: PoolTypes = PoolTypes.Gyro3;
    id: string;
    address: string;
    tokensList: string[];
    tokens: Gyro3PoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;
    root3Alpha: BigNumber;

    private static findToken(list, tokenAddress, error) {
        const token = list.find(
            (t) => getAddress(t.address) === getAddress(tokenAddress)
        );
        if (!token) throw new Error(error);
        return token;
    }

    static fromPool(pool: SubgraphPoolBase): Gyro3Pool {
        if (!pool.root3Alpha) throw new Error('Pool missing root3Alpha');

        if (
            safeParseFixed(pool.root3Alpha, 18).lte(0) ||
            safeParseFixed(pool.root3Alpha, 18).gte(ONE)
        )
            throw new Error('Invalid root3Alpha parameter');

        if (pool.tokens.length !== 3)
            throw new Error('Gyro3Pool must contain three tokens only');

        return new Gyro3Pool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens as Gyro3PoolToken[],
            pool.tokensList,
            pool.root3Alpha
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: Gyro3PoolToken[],
        tokensList: string[],
        root3Alpha: string
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = safeParseFixed(swapFee, 18);
        this.totalShares = safeParseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.root3Alpha = safeParseFixed(root3Alpha, 18);
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
            balanceIn: safeParseFixed(balanceIn, decimalsIn),
            balanceOut: safeParseFixed(balanceOut, decimalsOut),
            balanceTertiary: safeParseFixed(balanceTertiary, decimalsTertiary),
            swapFee: this.swapFee,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: Gyro3PoolPairData): OldBigNumber {
        return universalNormalizedLiquidity(
            this._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                ZERO
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: Gyro3PoolPairData,
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
            const normalizedBalances = _normalizeBalances(balances, decimals);
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
        poolPairData: Gyro3PoolPairData,
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
            const normalizedBalances = _normalizeBalances(balances, decimals);

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);
            const inAmount = safeParseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);

            const outAmount = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFee,
                virtualOffsetInOut
            );
            return bnum(formatFixed(outAmount, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
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

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmountLessFee = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmount,
                virtualOffsetInOut
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
        poolPairData: Gyro3PoolPairData,
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
            const normalizedBalances = _normalizeBalances(balances, decimals);

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmount = safeParseFixed(amount.toString(), 18);
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
        } catch (error) {
            return bnum(0);
        }
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
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

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

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
        } catch (error) {
            return bnum(0);
        }
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro3PoolPairData,
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
            const normalizedBalances = _normalizeBalances(balances, decimals);

            const invariant = _calculateInvariant(
                normalizedBalances,
                this.root3Alpha
            );

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmount = safeParseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);

            const outAmount = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFee,
                virtualOffsetInOut
            );
            const derivative =
                _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    normalizedBalances,
                    outAmount,
                    virtualOffsetInOut
                );

            return bnum(formatFixed(derivative, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro3PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
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

            const virtualOffsetInOut = mulDown(invariant, this.root3Alpha);

            const inAmountLessFee = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmount,
                virtualOffsetInOut
            );
            const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

            const derivative =
                _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                    normalizedBalances,
                    inAmount,
                    outAmount,
                    virtualOffsetInOut,
                    poolPairData.swapFee
                );

            return bnum(formatFixed(derivative, 18));
        } catch (error) {
            return bnum(0);
        }
    }
}
