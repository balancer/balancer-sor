import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { getAddress } from '@ethersproject/address';
import {
    BigNumber as OldBigNumber,
    ZERO,
    bnum,
    scale,
} from '../../utils/bignumber';
import { isSameAddress } from '../../utils';
import {
    PoolBase,
    PoolPairBase,
    PoolTypes,
    SubgraphPoolBase,
    SwapTypes,
} from '../../types';
import { WeightedPoolToken } from '../weightedPool/weightedPool';
import {
    _calcInGivenOut,
    _calcOutGivenIn,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
} from '../weightedPool/weightedMath';
import { universalNormalizedLiquidity } from '../liquidity';

export type ManagedPoolPairData = PoolPairBase & {
    weightIn: BigNumber;
    weightOut: BigNumber;
};

export class KassandraManagedPool implements PoolBase<PoolPairBase> {
    poolType: PoolTypes = PoolTypes.Managed;
    id: string;
    address: string;
    tokensList: string[];
    tokens: WeightedPoolToken[];
    totalWeight: BigNumber;
    totalShares: BigNumber;
    swapFee: BigNumber;
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);
    mainIndex?: number | undefined;
    isLBP?: boolean | undefined;

    constructor(
        id: string,
        address: string,
        tokenList: string[],
        tokens: WeightedPoolToken[],
        totalShares: string,
        totalWeight: string,
        swapFee: string
    ) {
        this.id = id;
        this.address = address;
        this.tokensList = tokenList;
        this.tokens = tokens;
        this.totalShares = parseFixed(totalShares, 18);
        this.totalWeight = parseFixed(totalWeight, 18);
        this.swapFee = parseFixed(swapFee, 18);
    }

    static fromPool(pool: SubgraphPoolBase): KassandraManagedPool {
        if (!pool.totalWeight) {
            throw new Error('WeightedPool missing totalWeight');
        }
        return new KassandraManagedPool(
            pool.id,
            pool.address,
            pool.tokensList,
            pool.tokens as WeightedPoolToken[],
            pool.totalShares,
            pool.totalWeight,
            pool.swapFee
        );
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): ManagedPoolPairData {
        if (
            isSameAddress(tokenIn, this.address) ||
            isSameAddress(tokenOut, this.address)
        ) {
            throw new Error('Token cannot be BPT');
        }
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;
        const weightIn = parseFixed(tI.weight, 18)
            .mul(ONE)
            .div(this.totalWeight);
        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;
        const weightOut = parseFixed(tO.weight, 18)
            .mul(ONE)
            .div(this.totalWeight);

        const poolPairData: ManagedPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            swapFee: this.swapFee,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            weightIn,
            weightOut,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: ManagedPoolPairData): OldBigNumber {
        return universalNormalizedLiquidity(
            this._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                ZERO
            )
        );
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

    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (isSameAddress(this.address, token)) {
            this.updateTotalShares(newBalance);
        }
        // token is underlying in the pool
        const T = this.tokens.find((t) => isSameAddress(t.address, token));
        if (!T) throw Error('Pool does not contain this token');
        T.balance = formatFixed(newBalance, T.decimals);
    }

    updateTotalShares(newTotalShares: BigNumber): void {
        this.totalShares = newTotalShares;
    }

    _exactTokenInForTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (amount.isNaN()) return amount;
        const amountIn = parseFixed(amount.dp(18, 1).toString(), 18).toBigInt();
        const decimalsIn = poolPairData.decimalsIn;
        const decimalsOut = poolPairData.decimalsOut;
        const balanceIn = parseFixed(
            poolPairData.balanceIn.toString(),
            18 - decimalsIn
        ).toBigInt();
        const balanceOut = parseFixed(
            poolPairData.balanceOut.toString(),
            18 - decimalsOut
        ).toBigInt();
        const normalizedWeightIn = poolPairData.weightIn.toBigInt();
        const normalizedWeightOut = poolPairData.weightOut.toBigInt();
        const swapFee = poolPairData.swapFee.toBigInt();
        try {
            const returnAmt = _calcOutGivenIn(
                balanceIn,
                normalizedWeightIn,
                balanceOut,
                normalizedWeightOut,
                amountIn,
                swapFee
            );
            return scale(bnum(returnAmt.toString()), -18);
        } catch (err) {
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (amount.isNaN()) return amount;
        const amountOut = parseFixed(
            amount.dp(18, 1).toString(),
            18
        ).toBigInt();
        const decimalsIn = poolPairData.decimalsIn;
        const decimalsOut = poolPairData.decimalsOut;
        const balanceIn = parseFixed(
            poolPairData.balanceIn.toString(),
            18 - decimalsIn
        ).toBigInt();
        const balanceOut = parseFixed(
            poolPairData.balanceOut.toString(),
            18 - decimalsOut
        ).toBigInt();
        const normalizedWeightIn = poolPairData.weightIn.toBigInt();
        const normalizedWeightOut = poolPairData.weightOut.toBigInt();
        const swapFee = poolPairData.swapFee.toBigInt();
        try {
            const returnAmt = _calcInGivenOut(
                balanceIn,
                normalizedWeightIn,
                balanceOut,
                normalizedWeightOut,
                amountOut,
                swapFee
            );
            // return human scaled
            return scale(bnum(returnAmt.toString()), -18);
        } catch (err) {
            return ZERO;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcTokensOutGivenExactBptIn(_: BigNumber): BigNumber[] {
        return Array(this.tokensList.length).fill(Zero);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcBptOutGivenExactTokensIn(_: BigNumber[]): BigNumber {
        return Zero;
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ManagedPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}
