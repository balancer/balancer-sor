import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { isSameAddress } from '../../utils';
import {
    BigNumber as OldBigNumber,
    bnum,
    scale,
    ZERO,
} from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import { getAddress } from '@ethersproject/address';
import * as SDK from '@georgeroman/balancer-v2-pools';
import {
    _invariant,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from './metaStableMath';
import { StablePoolPairData } from 'pools/stablePool/stablePool';

type MetaStablePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals' | 'priceRate'
>;

export type MetaStablePoolPairData = StablePoolPairData & {
    tokenInPriceRate: BigNumber;
    tokenOutPriceRate: BigNumber;
};

export class MetaStablePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.MetaStable;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: MetaStablePoolToken[];
    tokensList: string[];
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static AMP_DECIMALS = 3;

    static fromPool(pool: SubgraphPoolBase): MetaStablePool {
        if (!pool.amp) throw new Error('MetaStablePool missing amp factor');
        return new MetaStablePool(
            pool.id,
            pool.address,
            pool.amp,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList
        );
    }

    constructor(
        id: string,
        address: string,
        amp: string,
        swapFee: string,
        totalShares: string,
        tokens: MetaStablePoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.address = address;
        this.amp = parseFixed(amp, MetaStablePool.AMP_DECIMALS);
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
    }

    setTypeForSwap(type: SwapPairType): void {
        this.swapPairType = type;
    }

    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): MetaStablePoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];

        const decimalsIn = tI.decimals;
        const tokenInPriceRate = parseFixed(tI.priceRate, 18);
        const balanceIn = formatFixed(
            parseFixed(tI.balance, decimalsIn).mul(tokenInPriceRate).div(ONE),
            decimalsIn
        );

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];

        const decimalsOut = tO.decimals;
        const tokenOutPriceRate = parseFixed(tO.priceRate, 18);
        const balanceOut = formatFixed(
            parseFixed(tO.balance, decimalsOut).mul(tokenOutPriceRate).div(ONE),
            decimalsOut
        );

        // Get all token balances
        const allBalances = this.tokens.map(({ balance, priceRate }) =>
            bnum(balance).times(priceRate)
        );
        const allBalancesScaled = this.tokens.map(({ balance, priceRate }) =>
            parseFixed(balance, 18).mul(parseFixed(priceRate, 18)).div(ONE)
        );

        const inv = _invariant(this.amp, allBalances);

        const poolPairData: MetaStablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            invariant: inv,
            swapFee: this.swapFee,
            allBalances,
            allBalancesScaled,
            amp: this.amp,
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            tokenInPriceRate,
            tokenOutPriceRate,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: MetaStablePoolPairData): OldBigNumber {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return bnum(
            formatFixed(
                poolPairData.balanceOut.mul(poolPairData.amp),
                poolPairData.decimalsOut + MetaStablePool.AMP_DECIMALS
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: MetaStablePoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        // We multiply ratios by 10**-18 because we are in normalized space
        // so 0.5 should be 0.5 and not 500000000000000000
        // TODO: update bmath to use everything normalized
        // PoolPairData is using balances that have already been exchanged so need to convert back
        if (swapType === SwapTypes.SwapExactIn) {
            return bnum(
                formatFixed(
                    poolPairData.balanceIn
                        .mul(this.MAX_IN_RATIO)
                        .div(poolPairData.tokenInPriceRate),
                    poolPairData.decimalsIn
                )
            );
        } else {
            return bnum(
                formatFixed(
                    poolPairData.balanceOut
                        .mul(this.MAX_OUT_RATIO)
                        .div(poolPairData.tokenOutPriceRate),
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
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            const amountConverted = amtScaled.times(
                formatFixed(poolPairData.tokenInPriceRate, 18)
            );

            const amt = SDK.StableMath._calcOutGivenIn(
                bnum(this.amp.toString()),
                poolPairData.allBalancesScaled.map((balance) =>
                    bnum(balance.toString())
                ),
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountConverted,
                bnum(poolPairData.swapFee.toString())
            );
            // return normalised amount
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(
                amt.div(formatFixed(poolPairData.tokenOutPriceRate, 18)),
                -18
            ).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            const amountConverted = amtScaled.times(
                formatFixed(poolPairData.tokenOutPriceRate, 18)
            );

            const amt = SDK.StableMath._calcInGivenOut(
                bnum(this.amp.toString()),
                poolPairData.allBalancesScaled.map((balance) =>
                    bnum(balance.toString())
                ),
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountConverted,
                bnum(poolPairData.swapFee.toString())
            );

            // return normalised amount
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_UP mode (0)
            return scale(
                amt.div(formatFixed(poolPairData.tokenInPriceRate, 18)),
                -18
            ).dp(poolPairData.decimalsIn, 0);
        } catch (err) {
            console.error(`_evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateIn = formatFixed(poolPairData.tokenInPriceRate, 18);
        const priceRateOut = formatFixed(poolPairData.tokenOutPriceRate, 18);
        const amountConverted = amount.times(
            formatFixed(poolPairData.tokenInPriceRate, 18)
        );
        const result = _spotPriceAfterSwapExactTokenInForTokenOut(
            amountConverted,
            poolPairData
        );
        return result.div(priceRateIn).times(priceRateOut);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateIn = formatFixed(poolPairData.tokenInPriceRate, 18);
        const priceRateOut = formatFixed(poolPairData.tokenOutPriceRate, 18);
        const amountConverted = amount.times(
            formatFixed(poolPairData.tokenOutPriceRate, 18)
        );
        const result = _spotPriceAfterSwapTokenInForExactTokenOut(
            amountConverted,
            poolPairData
        );
        return result.div(priceRateIn).times(priceRateOut);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateOut = formatFixed(poolPairData.tokenOutPriceRate, 18);
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        ).times(priceRateOut);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateIn = formatFixed(poolPairData.tokenInPriceRate, 18);
        const priceRateOut = formatFixed(poolPairData.tokenOutPriceRate, 18);
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        )
            .div(priceRateIn)
            .times(priceRateOut)
            .times(priceRateOut);
    }
}
