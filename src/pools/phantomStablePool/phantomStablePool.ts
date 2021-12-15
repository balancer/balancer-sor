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
import * as phantomStableMath from '../phantomStablePool/phantomStableMath';
import { MetaStablePoolPairData } from '../metaStablePool/metaStablePool';
import cloneDeep from 'lodash.clonedeep';

enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

type PhantomStablePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals' | 'priceRate'
>;

export type PhantomStablePoolPairData = MetaStablePoolPairData & {
    pairType: PairTypes;
    bptIndex: number;
    virtualBptSupply: BigNumber;
};

export class PhantomStablePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.MetaStable;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: PhantomStablePoolToken[];
    tokensList: string[];
    ALMOST_ONE = parseFixed('0.99', 18);
    // Used for VirutalBpt and can be removed if SG is updated with VirtualBpt value
    MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');

    static AMP_DECIMALS = 3;

    static fromPool(pool: SubgraphPoolBase): PhantomStablePool {
        if (!pool.amp) throw new Error('PhantomStablePool missing amp factor');
        return new PhantomStablePool(
            pool.id,
            pool.address,
            pool.amp,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList
        );
    }

    // Remove BPT from Balances and update indices
    static removeBPT(
        poolPairData: PhantomStablePoolPairData
    ): PhantomStablePoolPairData {
        const poolPairDataNoBpt = cloneDeep(poolPairData);
        const bptIndex = poolPairData.bptIndex;
        if (bptIndex != -1) {
            poolPairDataNoBpt.allBalances.splice(bptIndex, 1);
            poolPairDataNoBpt.allBalancesScaled.splice(bptIndex, 1);
            if (bptIndex < poolPairData.tokenIndexIn)
                poolPairDataNoBpt.tokenIndexIn -= 1;
            if (bptIndex < poolPairData.tokenIndexOut)
                poolPairDataNoBpt.tokenIndexOut -= 1;
        }
        return poolPairDataNoBpt;
    }

    constructor(
        id: string,
        address: string,
        amp: string,
        swapFee: string,
        totalShares: string,
        tokens: PhantomStablePoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.address = address;
        this.amp = parseFixed(amp, PhantomStablePool.AMP_DECIMALS);
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
    ): PhantomStablePoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = bnum(tI.balance)
            .times(bnum(tI.priceRate))
            .dp(tI.decimals)
            .toString();
        const decimalsIn = tI.decimals;
        const tokenInPriceRate = parseFixed(tI.priceRate, 18);

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = bnum(tO.balance)
            .times(bnum(tO.priceRate))
            .dp(tO.decimals)
            .toString();
        const decimalsOut = tO.decimals;
        const tokenOutPriceRate = parseFixed(tO.priceRate, 18);

        // Get all token balances
        const allBalances = this.tokens.map(({ balance, priceRate }) =>
            bnum(balance).times(priceRate)
        );
        const allBalancesScaled = this.tokens.map(({ balance, priceRate }) =>
            parseFixed(balance, 18).mul(parseFixed(priceRate, 18)).div(ONE)
        );

        // Phantom pools allow trading between token and pool BPT
        let pairType: PairTypes;
        if (isSameAddress(tokenIn, this.address)) {
            pairType = PairTypes.BptToToken;
        } else if (isSameAddress(tokenOut, this.address)) {
            pairType = PairTypes.TokenToBpt;
        } else {
            pairType = PairTypes.TokenToToken;
        }

        const bptIndex = this.tokensList.indexOf(this.address);
        const inv = phantomStableMath._invariant(this.amp, allBalances);

        // VirtualBPTSupply must be used for the maths
        // TO DO - SG should be updated to so that totalShares should return VirtualSupply
        const virtualBptSupply = this.MAX_TOKEN_BALANCE.sub(
            allBalancesScaled[bptIndex]
        );

        const poolPairData: PhantomStablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            bptIndex: bptIndex,
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
            virtualBptSupply,
        };

        return PhantomStablePool.removeBPT(poolPairData);
    }

    getNormalizedLiquidity(
        poolPairData: PhantomStablePoolPairData
    ): OldBigNumber {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return bnum(
            formatFixed(
                poolPairData.balanceOut.mul(poolPairData.amp),
                poolPairData.decimalsOut + PhantomStablePool.AMP_DECIMALS
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: PhantomStablePoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        // PoolPairData is using balances that have already been exchanged so need to convert back
        if (swapType === SwapTypes.SwapExactIn) {
            // Return max valid amount of tokenIn
            // As an approx - use almost the total balance of token out as we can add any amount of tokenIn and expect some back
            return bnum(
                formatFixed(
                    poolPairData.balanceOut
                        .mul(this.ALMOST_ONE)
                        .div(poolPairData.tokenOutPriceRate),
                    poolPairData.decimalsOut
                )
            );
        } else {
            // Return max amount of tokenOut - approx is almost all balance
            return bnum(
                formatFixed(
                    poolPairData.balanceOut
                        .mul(this.ALMOST_ONE)
                        .div(poolPairData.tokenOutPriceRate),
                    poolPairData.decimalsOut
                )
            );
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is underlying in the pool
        const T = this.tokens.find((t) => isSameAddress(t.address, token));
        if (!T) throw Error('Pool does not contain this token');
        T.balance = formatFixed(newBalance, T.decimals);
    }

    _exactTokenInForTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            // In Phantom Pools every time there is a swap (token per token, bpt per token or token per bpt), we substract the fee from the amount in
            const amtWithFee = this.subtractSwapFeeAmount(
                BigNumber.from(amtScaled.toString()),
                poolPairData.swapFee
            );
            const amountConverted = bnum(amtWithFee.toString())
                .times(formatFixed(poolPairData.tokenInPriceRate, 18))
                .dp(0);

            let amt: OldBigNumber;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                const amountsIn = Array(
                    poolPairData.allBalancesScaled.length
                ).fill(ZERO);
                amountsIn[poolPairData.tokenIndexIn] = bnum(
                    amountConverted.toString()
                );

                amt = SDK.StableMath._calcBptOutGivenExactTokensIn(
                    bnum(this.amp.toString()),
                    poolPairData.allBalancesScaled.map((b) =>
                        bnum(b.toString())
                    ),
                    amountsIn,
                    bnum(poolPairData.virtualBptSupply.toString()),
                    ZERO // Fee is handled above
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                amt = SDK.StableMath._calcTokenOutGivenExactBptIn(
                    bnum(this.amp.toString()),
                    poolPairData.allBalancesScaled.map((b) =>
                        bnum(b.toString())
                    ),
                    poolPairData.tokenIndexOut,
                    bnum(amountConverted.toString()),
                    bnum(poolPairData.virtualBptSupply.toString()),
                    ZERO // Fee is handled above
                );
            } else {
                amt = SDK.StableMath._calcOutGivenIn(
                    bnum(this.amp.toString()),
                    poolPairData.allBalancesScaled.map((b) =>
                        bnum(b.toString())
                    ),
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    bnum(amountConverted.toString()),
                    ZERO // Fee is handled above
                );
            }
            // return normalised amount
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(
                amt.div(formatFixed(poolPairData.tokenOutPriceRate, 18)),
                -18
            ).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            console.error(`PhantomStable _evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            const amountConverted = amtScaled
                .times(formatFixed(poolPairData.tokenOutPriceRate, 18))
                .dp(0);

            let amt: OldBigNumber;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                amt = SDK.StableMath._calcTokenInGivenExactBptOut(
                    bnum(this.amp.toString()),
                    poolPairData.allBalancesScaled.map((b) =>
                        bnum(b.toString())
                    ),
                    poolPairData.tokenIndexIn,
                    bnum(amountConverted.toString()),
                    bnum(poolPairData.virtualBptSupply.toString()),
                    ZERO // Fee is handled above
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                const amountsOut = Array(
                    poolPairData.allBalancesScaled.length
                ).fill(ZERO);
                amountsOut[poolPairData.tokenIndexOut] = bnum(
                    amountConverted.toString()
                );

                amt = SDK.StableMath._calcBptInGivenExactTokensOut(
                    bnum(this.amp.toString()),
                    poolPairData.allBalancesScaled.map((b) =>
                        bnum(b.toString())
                    ),
                    amountsOut,
                    bnum(poolPairData.virtualBptSupply.toString()),
                    ZERO // Fee is handled above
                );
            } else {
                amt = SDK.StableMath._calcInGivenOut(
                    bnum(this.amp.toString()),
                    poolPairData.allBalancesScaled.map((b) =>
                        bnum(b.toString())
                    ),
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    amountConverted,
                    ZERO // Fee is handled above
                );
            }
            const returnScaled = amt
                .div(formatFixed(poolPairData.tokenInPriceRate, 18))
                .dp(0);

            // In Phantom Pools every time there is a swap (token per token, bpt per token or token per bpt), we substract the fee from the amount in
            const returnWithFee = bnum(
                this.addSwapFeeAmount(
                    BigNumber.from(returnScaled.toString()),
                    poolPairData.swapFee
                ).toString()
            );
            // return human number
            return scale(returnWithFee, -18);
        } catch (err) {
            console.error(`PhantomStable _evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    // this is the multiplicative inverse of the derivative of _exactTokenInForTokenOut
    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateIn = formatFixed(poolPairData.tokenInPriceRate, 18);
        const priceRateOut = formatFixed(poolPairData.tokenOutPriceRate, 18);
        const amountConverted = amount.times(
            formatFixed(poolPairData.tokenInPriceRate, 18)
        );
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = phantomStableMath._spotPriceAfterSwapExactTokenInForBPTOut(
                amountConverted,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = phantomStableMath._spotPriceAfterSwapExactBPTInForTokenOut(
                amountConverted,
                poolPairData
            );
        } else {
            result =
                phantomStableMath._spotPriceAfterSwapExactTokenInForTokenOut(
                    amountConverted,
                    poolPairData
                );
        }
        return result.div(priceRateIn).times(priceRateOut);
    }

    // this is the derivative of _tokenInForExactTokenOut
    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateIn = formatFixed(poolPairData.tokenInPriceRate, 18);
        const priceRateOut = formatFixed(poolPairData.tokenOutPriceRate, 18);
        const amountConverted = amount.times(
            formatFixed(poolPairData.tokenOutPriceRate, 18)
        );
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = phantomStableMath._spotPriceAfterSwapTokenInForExactBPTOut(
                amountConverted,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = phantomStableMath._spotPriceAfterSwapBPTInForExactTokenOut(
                amountConverted,
                poolPairData
            );
        } else {
            result =
                phantomStableMath._spotPriceAfterSwapTokenInForExactTokenOut(
                    amountConverted,
                    poolPairData
                );
        }
        return result.div(priceRateIn).times(priceRateOut);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateOut = formatFixed(poolPairData.tokenOutPriceRate, 18);
        const amountConverted = amount.times(
            formatFixed(poolPairData.tokenInPriceRate, 18)
        );
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result =
                phantomStableMath._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                    amountConverted,
                    poolPairData
                );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result =
                phantomStableMath._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                    amountConverted,
                    poolPairData
                );
        } else {
            result =
                phantomStableMath._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    amountConverted,
                    poolPairData
                );
        }
        return result.times(priceRateOut);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateIn = formatFixed(poolPairData.tokenInPriceRate, 18);
        const priceRateOut = formatFixed(poolPairData.tokenOutPriceRate, 18);
        const amountConverted = amount.times(
            formatFixed(poolPairData.tokenOutPriceRate, 18)
        );
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result =
                phantomStableMath._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                    amountConverted,
                    poolPairData
                );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result =
                phantomStableMath._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                    amountConverted,
                    poolPairData
                );
        } else {
            result =
                phantomStableMath._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                    amountConverted,
                    poolPairData
                );
        }
        return result.div(priceRateIn).times(priceRateOut).times(priceRateOut);
    }

    subtractSwapFeeAmount(amount: BigNumber, swapFee: BigNumber): BigNumber {
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/c18ff2686c61a8cbad72cdcfc65e9b11476fdbc3/pkg/pool-utils/contracts/BasePool.sol#L466
        const feeAmount = amount.mul(swapFee).div(ONE);
        return amount.sub(feeAmount);
    }

    addSwapFeeAmount(amount: BigNumber, swapFee: BigNumber): BigNumber {
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/c18ff2686c61a8cbad72cdcfc65e9b11476fdbc3/pkg/pool-utils/contracts/BasePool.sol#L458
        const feeAmount = ONE.sub(swapFee);
        return amount.mul(ONE).add(feeAmount.sub(1)).div(feeAmount);
    }
}
