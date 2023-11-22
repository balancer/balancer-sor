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
import { mulDown, divDown } from '../gyroHelpers/gyroSignedFixedPoint';
import {
    _calculateInvariant,
    _calcOutGivenIn,
    _calcInGivenOut,
    _findVirtualParams,
    _calculateNewSpotPrice,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from '../gyro2Pool/gyro2Math';
import { _reduceFee, _addFee } from '../gyroHelpers/helpers';
import { SWAP_LIMIT_FACTOR } from '../gyroHelpers/constants';
import { universalNormalizedLiquidity } from '../liquidity';

import { normalizeBalances } from './gyro2V2Math/gyro2V2MathHelpers';

type Gyro2V2PoolPairData = PoolPairBase & {
    // NB we follow a different approach than for the gyroE[V2]Pool here, where the pool pair data contains everything we need to know and we can forget about whether token-in is token 0 or 1.
    sqrtAlpha: BigNumber;
    sqrtBeta: BigNumber;
    tokenRates: BigNumber[];
};

export type Gyro2PoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export class Gyro2V2Pool implements PoolBase<Gyro2V2PoolPairData> {
    poolType: PoolTypes = PoolTypes.Gyro2;
    id: string;
    address: string;
    tokensList: string[];
    tokens: Gyro2PoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;
    sqrtAlpha: BigNumber;
    sqrtBeta: BigNumber;
    tokenRates: BigNumber[];

    static fromPool(pool: SubgraphPoolBase): Gyro2V2Pool {
        if (!pool.sqrtAlpha || !pool.sqrtBeta)
            throw new Error(
                'Pool missing Gyro2 sqrtAlpha and/or sqrtBeta params'
            );

        if (!pool.tokenRates)
            throw new Error('Gyro2V2 Pool missing tokenRates');

        return new Gyro2V2Pool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens as Gyro2PoolToken[],
            pool.tokensList,
            pool.sqrtAlpha,
            pool.sqrtBeta,
            pool.tokenRates
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
        sqrtBeta: string,
        tokenRates: string[]
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = safeParseFixed(swapFee, 18);
        this.totalShares = safeParseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.sqrtAlpha = safeParseFixed(sqrtAlpha, 18);
        this.sqrtBeta = safeParseFixed(sqrtBeta, 18);
        this.tokenRates = [
            safeParseFixed(tokenRates[0], 18),
            safeParseFixed(tokenRates[1], 18),
        ];
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): Gyro2V2PoolPairData {
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

        const poolPairData: Gyro2V2PoolPairData = {
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
            sqrtAlpha: tokenInIsToken0
                ? this.sqrtAlpha
                : divDown(ONE, this.sqrtBeta),
            sqrtBeta: tokenInIsToken0
                ? this.sqrtBeta
                : divDown(ONE, this.sqrtAlpha),
            tokenRates: tokenInIsToken0
                ? this.tokenRates
                : [this.tokenRates[1], this.tokenRates[0]],
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: Gyro2V2PoolPairData): OldBigNumber {
        return universalNormalizedLiquidity(
            this._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                ZERO
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: Gyro2V2PoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(
                balances,
                [poolPairData.decimalsIn, poolPairData.decimalsOut],
                poolPairData.tokenRates
            );
            const invariant = _calculateInvariant(
                normalizedBalances,
                poolPairData.sqrtAlpha,
                poolPairData.sqrtBeta
            );
            const maxAmountInAssetInPool = mulDown(
                invariant,
                divDown(ONE, poolPairData.sqrtAlpha).sub(
                    divDown(ONE, poolPairData.sqrtBeta)
                )
            ); // x+ = L * (1/sqrtAlpha - 1/sqrtBeta)
            const limitAmountIn = divDown(
                maxAmountInAssetInPool.sub(normalizedBalances[0]),
                poolPairData.tokenRates[0]
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
        poolPairData: Gyro2V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(
                balances,
                [poolPairData.decimalsIn, poolPairData.decimalsOut],
                poolPairData.tokenRates
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
            const inAmount = safeParseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
            const inAmountLessFeeScaled = mulDown(
                inAmountLessFee,
                poolPairData.tokenRates[0]
            );

            const outAmountScaled = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFeeScaled,
                virtualParamIn,
                virtualParamOut
            );
            const outAmount = divDown(
                outAmountScaled,
                poolPairData.tokenRates[1]
            );
            return bnum(formatFixed(outAmount, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: Gyro2V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const outAmountScaled = mulDown(
                outAmount,
                poolPairData.tokenRates[1]
            );
            const normalizedBalances = normalizeBalances(
                balances,
                [poolPairData.decimalsIn, poolPairData.decimalsOut],
                poolPairData.tokenRates
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
            const inAmountScaledLessFee = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmountScaled,
                virtualParamIn,
                virtualParamOut
            );
            const inAmountLessFee = divDown(
                inAmountScaledLessFee,
                poolPairData.tokenRates[0]
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
        poolPairData: Gyro2V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(
                balances,
                [poolPairData.decimalsIn, poolPairData.decimalsOut],
                poolPairData.tokenRates
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
            const inAmount = safeParseFixed(amount.toString(), 18);
            const inAmountScaled = mulDown(
                inAmount,
                poolPairData.tokenRates[0]
            );
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
            const inAmountLessFeeScaled = mulDown(
                inAmountLessFee,
                poolPairData.tokenRates[0]
            );
            const outAmountScaled = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFeeScaled,
                virtualParamIn,
                virtualParamOut
            );
            const newSpotPriceScaled = _calculateNewSpotPrice(
                normalizedBalances,
                inAmountScaled,
                outAmountScaled,
                virtualParamIn,
                virtualParamOut,
                poolPairData.swapFee
            );
            const newSpotPrice = divDown(
                mulDown(newSpotPriceScaled, poolPairData.tokenRates[1]),
                poolPairData.tokenRates[0]
            );
            return bnum(formatFixed(newSpotPrice, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro2V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(
                balances,
                [poolPairData.decimalsIn, poolPairData.decimalsOut],
                poolPairData.tokenRates
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
            const outAmountScaled = mulDown(
                outAmount,
                poolPairData.tokenRates[1]
            );
            const inAmountLessFeeScaled = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmountScaled,
                virtualParamIn,
                virtualParamOut
            );
            const inAmountScaled = _addFee(
                inAmountLessFeeScaled,
                poolPairData.swapFee
            );
            const newSpotPriceScaled = _calculateNewSpotPrice(
                normalizedBalances,
                inAmountScaled,
                outAmountScaled,
                virtualParamIn,
                virtualParamOut,
                poolPairData.swapFee
            );
            const newSpotPrice = divDown(
                mulDown(newSpotPriceScaled, poolPairData.tokenRates[1]),
                poolPairData.tokenRates[0]
            );

            return bnum(formatFixed(newSpotPrice, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro2V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(
                balances,
                [poolPairData.decimalsIn, poolPairData.decimalsOut],
                poolPairData.tokenRates
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
            const inAmount = safeParseFixed(amount.toString(), 18);
            const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
            const inAmountLessFeeScaled = mulDown(
                inAmountLessFee,
                poolPairData.tokenRates[0]
            );
            const outAmountScaled = _calcOutGivenIn(
                normalizedBalances[0],
                normalizedBalances[1],
                inAmountLessFeeScaled,
                virtualParamIn,
                virtualParamOut
            );
            const derivativeScaled =
                _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    normalizedBalances,
                    outAmountScaled,
                    virtualParamOut
                );
            const derivative = mulDown(
                derivativeScaled,
                poolPairData.tokenRates[1]
            );
            return bnum(formatFixed(derivative, 18));
        } catch (error) {
            return bnum(0);
        }
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro2V2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            const outAmount = safeParseFixed(amount.toString(), 18);
            const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
            const normalizedBalances = normalizeBalances(
                balances,
                [poolPairData.decimalsIn, poolPairData.decimalsOut],
                poolPairData.tokenRates
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
            const outAmountScaled = mulDown(
                outAmount,
                poolPairData.tokenRates[1]
            );
            const inAmountLessFeeScaled = _calcInGivenOut(
                normalizedBalances[0],
                normalizedBalances[1],
                outAmountScaled,
                virtualParamIn,
                virtualParamOut
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
                    virtualParamIn,
                    virtualParamOut,
                    poolPairData.swapFee
                );
            const rateAdjFactor = divDown(
                mulDown(poolPairData.tokenRates[1], poolPairData.tokenRates[1]),
                poolPairData.tokenRates[0]
            );
            const derivative = mulDown(derivativeScaled, rateAdjFactor);
            return bnum(formatFixed(derivative, 18));
        } catch (error) {
            return bnum(0);
        }
    }
}
