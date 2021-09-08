import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
} from '../../types';
import { getAddress } from '@ethersproject/address';
import { bnum, scale, ZERO } from '../../utils/bignumber';
import * as SDK from '@georgeroman/balancer-v2-pools';
import {
    _invariant,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from './metaStableMath';

export interface MetaStablePoolToken {
    address: string;
    balance: string;
    decimals: string | number;
    priceRate?: string;
}

export interface MetaStablePoolPairData extends PoolPairBase {
    id: string;
    address: string;
    poolType: PoolTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    swapFee: BigNumber;
    swapFeeScaled: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    allBalances: BigNumber[]; // Only for stable pools
    allBalancesScaled: BigNumber[]; // Only for stable pools - EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    invariant: BigNumber; // Only for stable pools
    amp: BigNumber; // Only for stable pools
    tokenIndexIn: number; // Only for stable pools
    tokenIndexOut: number; // Only for stable pools
    tokenInPriceRate: BigNumber;
    tokenOutPriceRate: BigNumber;
}

export class MetaStablePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.MetaStable;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    swapFeeScaled: BigNumber; // EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    totalShares: string;
    tokens: MetaStablePoolToken[];
    tokensList: string[];
    AMP_PRECISION = bnum(1000);
    MAX_IN_RATIO = bnum(0.3);
    MAX_OUT_RATIO = bnum(0.3);
    ampAdjusted: BigNumber;

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
        this.amp = bnum(amp);
        this.swapFee = bnum(swapFee);
        this.swapFeeScaled = scale(this.swapFee, 18);
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.ampAdjusted = this.amp.times(this.AMP_PRECISION);
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
        // balanceIn = tI.balance;
        const balanceIn = bnum(tI.balance).times(bnum(tI.priceRate));
        const decimalsIn = tI.decimals;
        const tokenInPriceRate = bnum(tI.priceRate);

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        // balanceOut = tO.balance;
        const balanceOut = bnum(tO.balance).times(bnum(tO.priceRate));
        const decimalsOut = tO.decimals;
        const tokenOutPriceRate = bnum(tO.priceRate);

        // Get all token balances
        const allBalances: BigNumber[] = [];
        const allBalancesScaled: BigNumber[] = [];
        for (let i = 0; i < this.tokens.length; i++) {
            // const balanceBn = bnum(this.tokens[i].balance);
            const balanceBn = bnum(this.tokens[i].balance)
                .times(bnum(this.tokens[i].priceRate))
                .dp(Number(this.tokens[i].decimals), 1);
            allBalances.push(balanceBn);
            allBalancesScaled.push(scale(balanceBn, 18));
        }

        const inv = _invariant(this.amp, allBalances);

        const poolPairData: MetaStablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: balanceIn,
            balanceOut: balanceOut,
            invariant: inv,
            swapFee: this.swapFee,
            swapFeeScaled: this.swapFeeScaled,
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

    getNormalizedLiquidity(poolPairData: MetaStablePoolPairData): BigNumber {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return poolPairData.balanceOut.times(poolPairData.amp);
    }

    getLimitAmountSwap(
        poolPairData: MetaStablePoolPairData,
        swapType: SwapTypes
    ): BigNumber {
        // We multiply ratios by 10**-18 because we are in normalized space
        // so 0.5 should be 0.5 and not 500000000000000000
        // TODO: update bmath to use everything normalized
        // PoolPairData is using balances that have already been exchanged so need to convert back
        if (swapType === SwapTypes.SwapExactIn) {
            return poolPairData.balanceIn
                .div(poolPairData.tokenInPriceRate)
                .times(this.MAX_IN_RATIO);
        } else {
            return poolPairData.balanceOut
                .div(poolPairData.tokenOutPriceRate)
                .times(this.MAX_OUT_RATIO);
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (this.address == token) {
            this.totalShares = newBalance.toString();
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => t.address === token);
            T.balance = newBalance.toString();
        }
    }

    _exactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber,
        exact: boolean
    ): BigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            const amountConverted = amtScaled.times(
                poolPairData.tokenInPriceRate
            );

            const amt = SDK.StableMath._calcOutGivenIn(
                this.ampAdjusted,
                poolPairData.allBalancesScaled,
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountConverted,
                poolPairData.swapFeeScaled
            );
            // return normalised amount
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt.div(poolPairData.tokenOutPriceRate), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber,
        exact: boolean
    ): BigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            const amountConverted = amtScaled.times(
                poolPairData.tokenOutPriceRate
            );

            const amt = SDK.StableMath._calcInGivenOut(
                this.ampAdjusted,
                poolPairData.allBalancesScaled,
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountConverted,
                poolPairData.swapFeeScaled
            );

            // return normalised amount
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_UP mode (0)
            return scale(amt.div(poolPairData.tokenInPriceRate), -18).dp(
                poolPairData.decimalsIn,
                0
            );
        } catch (err) {
            console.error(`_evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        const amountConverted = amount.times(poolPairData.tokenInPriceRate);
        const result = _spotPriceAfterSwapExactTokenInForTokenOut(
            amountConverted,
            poolPairData
        );
        return result;
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        const amountConverted = amount.times(poolPairData.tokenOutPriceRate);
        const result = _spotPriceAfterSwapTokenInForExactTokenOut(
            amountConverted,
            poolPairData
        );
        return result;
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}
