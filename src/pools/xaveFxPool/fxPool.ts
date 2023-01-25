/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, ZERO } from '../../utils/bignumber';
import {
    PoolBase,
    PoolPairBase,
    PoolTypes,
    SubgraphPoolBase,
    SubgraphToken,
    SwapTypes,
} from '../../types';
import { isSameAddress } from '../../utils';
import { bnum } from '../../utils/bignumber';
import {
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _exactTokenInForTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _tokenInForExactTokenOut,
} from './fxPoolMath';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { universalNormalizedLiquidity } from '../liquidity';

type FxPoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals' | 'fxRate'
>;

export type FxPoolPairData = PoolPairBase & {
    alpha: BigNumber;
    beta: BigNumber;
    lambda: BigNumber;
    delta: BigNumber;
    epsilon: BigNumber;
    tokenInRate: BigNumber;
    tokenOutRate: BigNumber;
};

export class FxPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Fx;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: FxPoolToken[];
    tokensList: string[];
    alpha: BigNumber;
    beta: BigNumber;
    lambda: BigNumber;
    delta: BigNumber;
    epsilon: BigNumber;
    tokenInRate: BigNumber;
    tokenOutRate: BigNumber;

    // Max In/Out Ratios
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static fromPool(pool: SubgraphPoolBase): FxPool {
        return new FxPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.alpha!,
            pool.beta!,
            pool.lambda!,
            pool.delta!,
            pool.epsilon!
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
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.alpha = parseFixed(alpha, 18);
        this.beta = parseFixed(beta, 18);
        this.lambda = parseFixed(lambda, 18);
        this.delta = parseFixed(delta, 18);
        this.epsilon = parseFixed(epsilon, 18);
    }
    updateTotalShares: (newTotalShares: BigNumber) => void;
    mainIndex?: number | undefined;
    isLBP?: boolean | undefined;

    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // Will copy over other implementations, not supporting BPT tokens atm
        return new Array(this.tokens.length).fill(Zero);
    }

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
            tokenInRate: parseFixed(this.tokens[tokenIndexIn].fxRate!),
            tokenOutRate: parseFixed(this.tokens[tokenIndexOut].fxRate!),
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

    getLimitAmountSwap(
        poolPairData: FxPoolPairData,
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
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _exactTokenInForTokenOut(amount, poolPairData);
    }

    _tokenInForExactTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _tokenInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(poolPairData, amount);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapTokenInForExactTokenOut(poolPairData, amount);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: FxPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}
