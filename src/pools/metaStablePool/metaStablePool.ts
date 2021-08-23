import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
} from '../../types';
import { getAddress } from '@ethersproject/address';
import { bnum, scale, ZERO } from '../../bmath';
import * as SDK from '@georgeroman/balancer-v2-pools';
import {
    _invariant,
    _exactTokenInForTokenOut,
    _exactTokenInForBPTOut,
    _exactBPTInForTokenOut,
    _tokenInForExactTokenOut,
    _tokenInForExactBPTOut,
    _BPTInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapExactTokenInForBPTOut,
    _spotPriceAfterSwapExactBPTInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _spotPriceAfterSwapTokenInForExactBPTOut,
    _spotPriceAfterSwapBPTInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut,
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut,
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
    pairType: PairTypes;
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

    static fromPool(
        pool: SubgraphPoolBase
    ): MetaStablePool {
        return new MetaStablePool(
            pool.id,
            pool.address,
            pool.amp,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList
        )
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

    setTypeForSwap(type: SwapPairType) {
        this.swapPairType = type;
    }

    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): MetaStablePoolPairData {
        let pairType: PairTypes;
        let tI: MetaStablePoolToken;
        let tO: MetaStablePoolToken;
        let balanceIn: BigNumber;
        let balanceOut: BigNumber;
        let decimalsOut: string | number;
        let decimalsIn: string | number;
        let tokenIndexIn: number;
        let tokenIndexOut: number;
        let tokenInPriceRate = bnum(1);
        let tokenOutPriceRate = bnum(1);

        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn === this.address) {
            pairType = PairTypes.BptToToken;
            balanceIn = bnum(this.totalShares);
            decimalsIn = '18'; // Not used but has to be defined
        } else if (tokenOut === this.address) {
            pairType = PairTypes.TokenToBpt;
            balanceOut = bnum(this.totalShares);
            decimalsOut = '18'; // Not used but has to be defined
        } else {
            pairType = PairTypes.TokenToToken;
        }

        if (pairType !== PairTypes.BptToToken) {
            tokenIndexIn = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenIn)
            );
            if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
            tI = this.tokens[tokenIndexIn];
            // balanceIn = tI.balance;
            balanceIn = bnum(tI.balance).times(bnum(tI.priceRate));
            decimalsIn = tI.decimals;
            tokenInPriceRate = bnum(tI.priceRate);
        }
        if (pairType !== PairTypes.TokenToBpt) {
            tokenIndexOut = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            // balanceOut = tO.balance;
            balanceOut = bnum(tO.balance).times(bnum(tO.priceRate));
            decimalsOut = tO.decimals;
            tokenOutPriceRate = bnum(tO.priceRate);
        }

        // Get all token balances
        let allBalances: BigNumber[] = [];
        let allBalancesScaled: BigNumber[] = [];
        for (let i = 0; i < this.tokens.length; i++) {
            // const balanceBn = bnum(this.tokens[i].balance);
            const balanceBn = bnum(this.tokens[i].balance)
                .times(bnum(this.tokens[i].priceRate))
                .dp(Number(this.tokens[i].decimals), 1);
            allBalances.push(balanceBn);
            allBalancesScaled.push(scale(balanceBn, 18));
        }

        let inv = _invariant(this.amp, allBalances);

        const poolPairData: MetaStablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
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

    getNormalizedLiquidity(poolPairData: MetaStablePoolPairData) {
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
            const T = this.tokens.find(t => t.address === token);
            T.balance = newBalance.toString();
        }
    }

    _exactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
        // i.e. when using token with 2decimals 0.002 should be returned as 0
        // Uses ROUND_DOWN mode (1)
        let amt = _exactTokenInForTokenOut(
            amount.times(poolPairData.tokenInPriceRate),
            poolPairData
        ).dp(poolPairData.decimalsOut, 1);
        return amt.div(poolPairData.tokenOutPriceRate);
    }

    _exactTokenInForBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactTokenInForBPTOut(amount, poolPairData);
    }

    _exactBPTInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactBPTInForTokenOut(amount, poolPairData);
    }

    _tokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
        // i.e. when using token with 2decimals 0.002 should be returned as 0
        // Uses ROUND_UP mode (0)
        let amt = _tokenInForExactTokenOut(
            amount.times(poolPairData.tokenOutPriceRate),
            poolPairData
        ).dp(poolPairData.decimalsIn, 0);

        return amt.div(poolPairData.tokenInPriceRate);
    }

    _tokenInForExactBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _tokenInForExactBPTOut(amount, poolPairData);
    }

    _BPTInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _BPTInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        let amountConverted = amount.times(poolPairData.tokenInPriceRate);
        let result = _spotPriceAfterSwapExactTokenInForTokenOut(
            amountConverted,
            poolPairData
        );
        return result;
    }

    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactTokenInForBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactBPTInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        let amountConverted = amount.times(poolPairData.tokenOutPriceRate);
        let result = _spotPriceAfterSwapTokenInForExactTokenOut(
            amountConverted,
            poolPairData
        );
        return result;
    }

    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapTokenInForExactBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapBPTInForExactTokenOut(amount, poolPairData);
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

    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
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

    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }

    _evmoutGivenIn(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            let amountConverted = amtScaled.times(
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
            return scale(amt.div(poolPairData.tokenOutPriceRate), -18);
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _evminGivenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            let amountConverted = amtScaled.times(
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
            return scale(amt.div(poolPairData.tokenInPriceRate), -18);
        } catch (err) {
            console.error(`_evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    _evmexactTokenInForBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const bptTotalSupplyScaled = scale(poolPairData.balanceOut, 18);
            // amountsIn must have same length as balances. Only need value for token in.
            const amountsIn = poolPairData.allBalances.map((bal, i) => {
                if (i === poolPairData.tokenIndexIn) return scale(amount, 18);
                else return ZERO;
            });

            const amt = SDK.StableMath._calcBptOutGivenExactTokensIn(
                this.ampAdjusted,
                poolPairData.allBalancesScaled,
                amountsIn,
                bptTotalSupplyScaled,
                poolPairData.swapFeeScaled
            );

            // return normalised amount
            return scale(amt, -18);
        } catch (err) {
            console.error(`_evmexactTokenInForBPTOut: ${err.message}`);
            return ZERO;
        }
    }

    _evmexactBPTInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const bptAmountInScaled = scale(amount, 18);
            const bptTotalSupplyScaled = scale(poolPairData.balanceIn, 18);

            const amt = SDK.StableMath._calcTokenOutGivenExactBptIn(
                this.ampAdjusted,
                poolPairData.allBalancesScaled,
                poolPairData.tokenIndexOut,
                bptAmountInScaled,
                bptTotalSupplyScaled,
                poolPairData.swapFeeScaled
            );

            // return normalised amount
            return scale(amt, -18);
        } catch (err) {
            console.error(`_evmexactBPTInForTokenOut: ${err.message}`);
            return ZERO;
        }
    }

    _evmtokenInForExactBPTOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const bptAmountOutScaled = scale(amount, 18);
            const bptTotalSupplyScaled = scale(poolPairData.balanceOut, 18);

            const amt = SDK.StableMath._calcTokenInGivenExactBptOut(
                this.ampAdjusted,
                poolPairData.allBalancesScaled,
                poolPairData.tokenIndexIn,
                bptAmountOutScaled,
                bptTotalSupplyScaled,
                poolPairData.swapFeeScaled
            );

            // return normalised amount
            return scale(amt, -18);
        } catch (err) {
            console.error(`_evmtokenInForExactBPTOut: ${err.message}`);
            return ZERO;
        }
    }

    _evmbptInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            // amountsOut must have same length as balances. Only need value for token out.
            const amountsOut = poolPairData.allBalances.map((bal, i) => {
                if (i === poolPairData.tokenIndexOut) return scale(amount, 18);
                else return ZERO;
            });
            const bptTotalSupplyScaled = scale(poolPairData.balanceIn, 18);

            const amt = SDK.StableMath._calcBptInGivenExactTokensOut(
                this.ampAdjusted,
                poolPairData.allBalancesScaled,
                amountsOut,
                bptTotalSupplyScaled,
                poolPairData.swapFeeScaled
            );
            // return normalised amount
            return scale(amt, -18);
        } catch (err) {
            console.error(`_evmbptInForExactTokenOut: ${err.message}`);
            return ZERO;
        }
    }
}
