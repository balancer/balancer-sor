import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
} from '../../types';
import { getAddress } from '@ethersproject/address';
import { bnum, scale } from '../../bmath';
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
} from './stableMath';

export interface StablePoolToken {
    address: string;
    balance: string;
    decimals: string | number;
}

export interface StablePoolPairData extends PoolPairBase {
    id: string;
    address: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    allBalances: BigNumber[]; // Only for stable pools
    invariant: BigNumber; // Only for stable pools
    amp: BigNumber; // Only for stable pools
    tokenIndexIn: number; // Only for stable pools
    tokenIndexOut: number; // Only for stable pools
}

export class StablePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Stable;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    totalShares: string;
    tokens: StablePoolToken[];
    tokensList: string[];
    AMP_PRECISION = bnum(1000);
    MAX_IN_RATIO = bnum(0.3);
    MAX_OUT_RATIO = bnum(0.3);
    ampAdjusted: BigNumber;

    constructor(
        id: string,
        address: string,
        amp: string,
        swapFee: string,
        totalShares: string,
        tokens: StablePoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.address = address;
        this.amp = bnum(amp);
        this.swapFee = bnum(swapFee);
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.ampAdjusted = this.amp.times(this.AMP_PRECISION);
    }

    setTypeForSwap(type: SwapPairType) {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): StablePoolPairData {
        let pairType: PairTypes;
        let tI: StablePoolToken;
        let tO: StablePoolToken;
        let balanceIn: string;
        let balanceOut: string;
        let decimalsOut: string | number;
        let decimalsIn: string | number;
        let tokenIndexIn: number;
        let tokenIndexOut: number;

        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn === this.address) {
            pairType = PairTypes.BptToToken;
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
        } else if (tokenOut === this.address) {
            pairType = PairTypes.TokenToBpt;
            balanceOut = this.totalShares;
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
            balanceIn = tI.balance;
            decimalsIn = tI.decimals;
        }
        if (pairType !== PairTypes.TokenToBpt) {
            tokenIndexOut = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
        }

        // Get all token balances
        let allBalances = [];
        for (let i = 0; i < this.tokens.length; i++) {
            allBalances.push(bnum(this.tokens[i].balance));
        }

        let inv = _invariant(this.amp, allBalances);

        const poolPairData: StablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: bnum(balanceIn),
            balanceOut: bnum(balanceOut),
            invariant: inv,
            swapFee: this.swapFee,
            allBalances: allBalances,
            amp: this.amp,
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: StablePoolPairData) {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return poolPairData.balanceOut.times(poolPairData.amp);
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): BigNumber {
        // We multiply ratios by 10**-18 because we are in normalized space
        // so 0.5 should be 0.5 and not 500000000000000000
        // TODO: update bmath to use everything normalized
        if (swapType === SwapTypes.SwapExactIn) {
            return poolPairData.balanceIn.times(this.MAX_IN_RATIO);
        } else {
            return poolPairData.balanceOut.times(this.MAX_OUT_RATIO);
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
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
        // i.e. when using token with 2decimals 0.002 should be returned as 0
        // Uses ROUND_DOWN mode (1)
        return _exactTokenInForTokenOut(amount, poolPairData).dp(
            poolPairData.decimalsOut,
            1
        );
    }

    _exactTokenInForBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactTokenInForBPTOut(amount, poolPairData);
    }

    _exactBPTInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactBPTInForTokenOut(amount, poolPairData);
    }

    _tokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
        // i.e. when using token with 2decimals 0.002 should be returned as 0
        // Uses ROUND_UP mode (0)
        return _tokenInForExactTokenOut(amount, poolPairData).dp(
            poolPairData.decimalsIn,
            0
        );
    }

    _tokenInForExactBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _tokenInForExactBPTOut(amount, poolPairData);
    }

    _BPTInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _BPTInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactTokenInForBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactBPTInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapTokenInForExactBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapBPTInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }

    _evmoutGivenIn(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // TO DO - Tidy this by adding scaled allBalances to poolPairData?
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const balancesScaled = poolPairData.allBalances.map(bal =>
                scale(bal, 18)
            );
            const amtScaled = scale(amount, 18);
            const swapFeeScaled = scale(poolPairData.swapFee, 18);

            const amt = SDK.StableMath._calcOutGivenIn(
                this.ampAdjusted,
                balancesScaled,
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amtScaled,
                swapFeeScaled
            );

            return scale(amt, -18 + poolPairData.decimalsOut);
        } catch (err) {
            return bnum(0);
        }
    }

    _evminGivenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // TO DO - Tidy this by adding scaled allBalances to poolPairData?
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const balancesScaled = poolPairData.allBalances.map(bal =>
                scale(bal, 18)
            );
            const amtScaled = scale(amount, 18);
            const swapFeeScaled = scale(poolPairData.swapFee, 18);

            const amt = SDK.StableMath._calcInGivenOut(
                this.ampAdjusted,
                balancesScaled,
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amtScaled,
                swapFeeScaled
            );

            return scale(amt, -18 + poolPairData.decimalsIn);
        } catch (err) {
            return bnum(0);
        }
    }

    _evmexactTokenInForBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // TO DO - Tidy this by adding scaled allBalances to poolPairData?
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const balancesScaled = poolPairData.allBalances.map(bal =>
                scale(bal, 18)
            );
            const bptTotalSupplyScaled = scale(poolPairData.balanceOut, 18);
            const swapFeeScaled = scale(poolPairData.swapFee, 18);
            // amountsIn must have same length as balances. Only need value for token in.
            const amountsIn = poolPairData.allBalances.map((bal, i) => {
                if (i === poolPairData.tokenIndexIn) return scale(amount, 18);
                else return bnum(0);
            });

            const amt = SDK.StableMath._calcBptOutGivenExactTokensIn(
                this.ampAdjusted,
                balancesScaled,
                amountsIn,
                bptTotalSupplyScaled,
                swapFeeScaled
            );

            return amt;
        } catch (err) {
            return bnum(0);
        }
    }

    _evmexactBPTInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // TO DO - Tidy this by adding scaled allBalances to poolPairData?
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const balancesScaled = poolPairData.allBalances.map(bal =>
                scale(bal, 18)
            );
            const bptAmountInScaled = scale(amount, 18);
            const bptTotalSupplyScaled = scale(poolPairData.balanceIn, 18);
            const swapFeeScaled = scale(poolPairData.swapFee, 18);

            const amt = SDK.StableMath._calcTokenOutGivenExactBptIn(
                this.ampAdjusted,
                balancesScaled,
                poolPairData.tokenIndexOut,
                bptAmountInScaled,
                bptTotalSupplyScaled,
                swapFeeScaled
            );

            return amt;
        } catch (err) {
            return bnum(0);
        }
    }

    _evmtokenInForExactBPTOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // TO DO - Tidy this by adding scaled allBalances to poolPairData?
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const balancesScaled = poolPairData.allBalances.map(bal =>
                scale(bal, 18)
            );
            const bptAmountOutScaled = scale(amount, 18);
            const bptTotalSupplyScaled = scale(poolPairData.balanceOut, 18);
            const swapFeeScaled = scale(poolPairData.swapFee, 18);

            const amt = SDK.StableMath._calcTokenInGivenExactBptOut(
                this.ampAdjusted,
                balancesScaled,
                poolPairData.tokenIndexIn,
                bptAmountOutScaled,
                bptTotalSupplyScaled,
                swapFeeScaled
            );

            return amt;
        } catch (err) {
            return bnum(0);
        }
    }

    _evmbptInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: BigNumber
    ): BigNumber {
        try {
            // TO DO - Tidy this by adding scaled allBalances to poolPairData?
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const balancesScaled = poolPairData.allBalances.map(bal =>
                scale(bal, 18)
            );
            // amountsOut must have same length as balances. Only need value for token out.
            const amountsOut = poolPairData.allBalances.map((bal, i) => {
                if (i === poolPairData.tokenIndexOut) return scale(amount, 18);
                else return bnum(0);
            });
            const bptTotalSupplyScaled = scale(poolPairData.balanceIn, 18);
            const swapFeeScaled = scale(poolPairData.swapFee, 18);

            const amt = SDK.StableMath._calcBptInGivenExactTokensOut(
                this.ampAdjusted,
                balancesScaled,
                amountsOut,
                bptTotalSupplyScaled,
                swapFeeScaled
            );

            return amt;
        } catch (err) {
            return bnum(0);
        }
    }
}
