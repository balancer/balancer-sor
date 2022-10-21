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
} from '../../types';
import { isSameAddress } from '../../utils';
import {
    _calculateInvariant,
    _calcOutGivenIn,
    _calcInGivenOut,
    _findVirtualParams,
    _calculateNewSpotPrice,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _getNormalizedLiquidity,
} from './gyro2Math';
import {
    _normalizeBalances,
    _reduceFee,
    _addFee,
    mulDown,
    divDown,
} from './helpers';

export type Gyro2PoolPairData = PoolPairBase & {
    sqrtAlpha: BigNumber;
    sqrtBeta: BigNumber;
};

export type Gyro2PoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export class Gyro2Pool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Gyro2;
    id: string;
    address: string;
    tokensList: string[];
    tokens: Gyro2PoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;
    sqrtAlpha: BigNumber;
    sqrtBeta: BigNumber;

    // Max In/Out Ratios
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static fromPool(pool: SubgraphPoolBase): Gyro2Pool {
        if (!pool.sqrtAlpha || !pool.sqrtBeta)
            throw new Error(
                'Pool missing Gyro2 sqrtAlpha and/or sqrtBeta params'
            );

        return new Gyro2Pool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens as Gyro2PoolToken[],
            pool.tokensList,
            pool.sqrtAlpha,
            pool.sqrtBeta
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: Gyro2PoolToken[],
        tokensList: string[],
        sqrtAlpha: string,
        sqrtBeta: string
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.sqrtAlpha = parseFixed(sqrtAlpha, 18);
        this.sqrtBeta = parseFixed(sqrtBeta, 18);
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): Gyro2PoolPairData {
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

        const poolPairData: Gyro2PoolPairData = {
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
            sqrtAlpha: tokenInIsToken0
                ? this.sqrtAlpha
                : divDown(ONE, this.sqrtBeta),
            sqrtBeta: tokenInIsToken0
                ? this.sqrtBeta
                : divDown(ONE, this.sqrtAlpha),
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: Gyro2PoolPairData): OldBigNumber {
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const normalizedBalances = _normalizeBalances(
            balances,
            poolPairData.decimalsIn,
            poolPairData.decimalsOut
        );
        const invariant = _calculateInvariant(
            normalizedBalances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [, virtualParamOut] = _findVirtualParams(
            invariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const normalisedLiquidity = _getNormalizedLiquidity(
            normalizedBalances,
            virtualParamOut
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
                    mulDown(poolPairData.balanceIn, this.MAX_IN_RATIO),
                    poolPairData.decimalsIn
                )
            );
        } else {
            return bnum(
                formatFixed(
                    mulDown(poolPairData.balanceOut, this.MAX_OUT_RATIO),
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
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = _normalizeBalances(
                balances,
                poolPairData.decimalsIn,
                poolPairData.decimalsOut
            );
            const invariant = _calculateInvariant(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const [virtualParamIn, virtualParamOut] = _findVirtualParams(
                invariant,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const inAmount = parseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);

            const outAmount = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFee,
                virtualParamIn,
                virtualParamOut
            );

            return bnum(formatFixed(outAmount, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = parseFixed(amount.toString(), 18);
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = _normalizeBalances(
                balances,
                poolPairData.decimalsIn,
                poolPairData.decimalsOut
            );
            const invariant = _calculateInvariant(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const [virtualParamIn, virtualParamOut] = _findVirtualParams(
                invariant,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const inAmountLessFee = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmount,
                virtualParamIn,
                virtualParamOut
            );
            const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

            return bnum(formatFixed(inAmount, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = _normalizeBalances(
                balances,
                poolPairData.decimalsIn,
                poolPairData.decimalsOut
            );
            const invariant = _calculateInvariant(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const [virtualParamIn, virtualParamOut] = _findVirtualParams(
                invariant,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const inAmount = parseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
            const outAmount = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFee,
                virtualParamIn,
                virtualParamOut
            );
            const newSpotPrice = _calculateNewSpotPrice(
                normalizedBalances,
                inAmount,
                outAmount,
                virtualParamIn,
                virtualParamOut,
                poolPairData.swapFee
            );
            return bnum(formatFixed(newSpotPrice, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = parseFixed(amount.toString(), 18);
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = _normalizeBalances(
                balances,
                poolPairData.decimalsIn,
                poolPairData.decimalsOut
            );
            const invariant = _calculateInvariant(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const [virtualParamIn, virtualParamOut] = _findVirtualParams(
                invariant,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const inAmountLessFee = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmount,
                virtualParamIn,
                virtualParamOut
            );
            const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);
            const newSpotPrice = _calculateNewSpotPrice(
                normalizedBalances,
                inAmount,
                outAmount,
                virtualParamIn,
                virtualParamOut,
                poolPairData.swapFee
            );

            return bnum(formatFixed(newSpotPrice, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = _normalizeBalances(
                balances,
                poolPairData.decimalsIn,
                poolPairData.decimalsOut
            );
            const invariant = _calculateInvariant(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const [virtualParamIn, virtualParamOut] = _findVirtualParams(
                invariant,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const inAmount = parseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
            const outAmount = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFee,
                virtualParamIn,
                virtualParamOut
            );
            const derivative =
                _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    normalizedBalances,
                    outAmount,
                    virtualParamOut
                );

            return bnum(formatFixed(derivative, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = parseFixed(amount.toString(), 18);
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = _normalizeBalances(
                balances,
                poolPairData.decimalsIn,
                poolPairData.decimalsOut
            );
            const invariant = _calculateInvariant(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const [virtualParamIn, virtualParamOut] = _findVirtualParams(
                invariant,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const inAmountLessFee = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmount,
                virtualParamIn,
                virtualParamOut
            );
            const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

            const derivative =
                _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                    normalizedBalances,
                    inAmount,
                    outAmount,
                    virtualParamIn,
                    virtualParamOut,
                    poolPairData.swapFee
                );

            return bnum(formatFixed(derivative, 18));
        } catch (error) {
            return bnum(0);
        }
    }
}
