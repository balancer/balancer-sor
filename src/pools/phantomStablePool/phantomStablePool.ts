import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { isSameAddress, safeParseFixed } from '../../utils';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SubgraphPoolBase,
    SubgraphToken,
    SwapTypes,
} from '../../types';
import {
    _calcBptOutGivenExactTokensIn,
    _calcTokenOutGivenExactBptIn,
    _calcOutGivenIn,
    _calcTokenInGivenExactBptOut,
    _calcBptInGivenExactTokensOut,
    _calcInGivenOut,
} from '../stablePool/stableMathBigInt';
import {
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _spotPriceAfterSwapExactBPTInForTokenOut,
    _spotPriceAfterSwapExactTokenInForBPTOut,
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut,
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
    _spotPriceAfterSwapBPTInForExactTokenOut,
    _spotPriceAfterSwapTokenInForExactBPTOut,
} from '../stablePool/stableMath';
import cloneDeep from 'lodash.clonedeep';
import {
    StablePool,
    StablePoolPairData,
    StablePoolToken,
} from '../stablePool/stablePool';
import { MathSol } from '../../utils/basicOperations';

export enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

export type PhantomStablePoolToken = StablePoolToken &
    Pick<SubgraphToken, 'priceRate'>;

export type PhantomStablePoolPairData = StablePoolPairData & {
    tokenInPriceRate: BigNumber;
    tokenOutPriceRate: BigNumber;
    tokenInPriceRateFloating: OldBigNumber;
    tokenOutPriceRateFloating: OldBigNumber;
    pairType: PairTypes;
    bptIndex: number;
    virtualBptSupply: BigNumber;
};
export class PhantomStablePool
    extends StablePool
    implements PoolBase<PhantomStablePoolPairData>
{
    poolType: PoolTypes = PoolTypes.MetaStable;
    tokens: PhantomStablePoolToken[];

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
        super(id, address, amp, swapFee, totalShares, tokens, tokensList);
        this.tokens = tokens;
    }

    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): PhantomStablePoolPairData {
        const stablePoolPairData = super.parsePoolPairData(tokenIn, tokenOut);
        const tI = this.tokens[stablePoolPairData.tokenIndexIn];
        const tokenInPriceRate = parseFixed(tI.priceRate, 18);
        const balanceIn = MathSol.mulDownFixed(
            stablePoolPairData.balanceIn.toBigInt(),
            tokenInPriceRate.toBigInt()
        );
        const tO = this.tokens[stablePoolPairData.tokenIndexOut];
        const tokenOutPriceRate = parseFixed(tO.priceRate, 18);
        const balanceOut = MathSol.mulDownFixed(
            stablePoolPairData.balanceOut.toBigInt(),
            tokenOutPriceRate.toBigInt()
        );
        // Get all token balances with priceRate taken into consideration
        const allBalances = stablePoolPairData.allBalances.map((balance, i) =>
            balance.times(bnum(this.tokens[i].priceRate))
        );
        const allBalancesScaled = allBalances.map((balance) =>
            safeParseFixed(balance.toString(), 18)
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

        // VirtualBPTSupply must be used for the maths
        const virtualBptSupply = this.totalShares;

        const poolPairData: PhantomStablePoolPairData = {
            ...stablePoolPairData,
            balanceIn: BigNumber.from(balanceIn.toString()),
            balanceOut: BigNumber.from(balanceOut.toString()),
            allBalances,
            allBalancesScaled,
            tokenInPriceRate,
            tokenOutPriceRate,
            tokenInPriceRateFloating: bnum(tI.priceRate),
            tokenOutPriceRateFloating: bnum(tO.priceRate),
            pairType,
            bptIndex,
            virtualBptSupply,
        };
        return PhantomStablePool.removeBPT(poolPairData);
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is underlying in the pool
        const T = this.tokens.find((t) => isSameAddress(t.address, token));
        if (!T) throw Error('Pool does not contain this token');

        // update total shares with BPT balance diff
        if (isSameAddress(this.address, token)) {
            const parsedTokenBalance = parseFixed(T.balance, T.decimals);
            const diff = parsedTokenBalance.sub(newBalance);
            const newTotalShares = this.totalShares.add(diff);
            this.updateTotalShares(newTotalShares);
        }
        // update token balance with new balance
        T.balance = formatFixed(newBalance, T.decimals);
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

    handleScalingAndFeeTokenIn(
        swapFee: BigNumber,
        amount: string,
        priceRate: BigNumber
    ): bigint {
        // Amount is floating point here and must be normalised for maths i.e. 1USDC => 1e18 not 1e6
        // For exact token in we subtract the fee from the amount in
        const amountNormalised = safeParseFixed(amount, 18);
        const amtWithFeeEvm = this.subtractSwapFeeAmount(
            amountNormalised,
            swapFee
        );
        return amtWithFeeEvm.mul(priceRate).div(ONE).toBigInt();
    }

    handleScalingAndFeeTokenOut(
        swapFee: BigNumber,
        amount: string,
        priceRate: BigNumber,
        decimalsOut: number
    ): OldBigNumber {
        // Amount is normalised here (straight from maths)
        // For exact token out we add the fee to the amount in
        const returnWithRate = BigNumber.from(amount).mul(ONE).div(priceRate);

        const returnWithFee = this.addSwapFeeAmount(
            returnWithRate,
            swapFee
        ).toBigInt();
        return bnum(formatFixed(returnWithFee, 18)).dp(decimalsOut);
    }

    /**
     *
     * @param poolPairData
     * @param amount Amount of token in (floating point)
     * @returns Amount of token out (floating point)
     */
    _exactTokenInForTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;

            const amountNormalised = this.handleScalingAndFeeTokenIn(
                poolPairData.swapFee,
                amount.toString(),
                poolPairData.tokenInPriceRate
            );

            let returnEvm: BigInt;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                const amountsInBigInt = Array(
                    poolPairData.allBalancesScaled.length
                ).fill(BigInt(0));
                amountsInBigInt[poolPairData.tokenIndexIn] = amountNormalised;

                returnEvm = _calcBptOutGivenExactTokensIn(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    amountsInBigInt,
                    poolPairData.virtualBptSupply.toBigInt(),
                    this.SWAP_FEE_MATHS
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                returnEvm = _calcTokenOutGivenExactBptIn(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexOut,
                    amountNormalised,
                    poolPairData.virtualBptSupply.toBigInt(),
                    this.SWAP_FEE_MATHS
                );
            } else {
                returnEvm = _calcOutGivenIn(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    amountNormalised,
                    this.SWAP_FEE_MATHS
                );
            }

            const returnEvmWithRate = BigNumber.from(returnEvm)
                .mul(ONE)
                .div(poolPairData.tokenOutPriceRate);

            // Return human scaled
            return bnum(formatFixed(returnEvmWithRate, 18));
        } catch (err) {
            // console.error(`PhantomStable _evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    /**
     *
     * @param poolPairData
     * @param amount Amount of token out (floating point)
     * @returns Amount of token in (floating point)
     */
    _tokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amountConvertedEvm = parseFixed(amount.dp(18).toString(), 18)
                .mul(poolPairData.tokenOutPriceRate)
                .div(ONE);

            let returnEvm: BigInt;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                returnEvm = _calcTokenInGivenExactBptOut(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexIn,
                    amountConvertedEvm.toBigInt(),
                    poolPairData.virtualBptSupply.toBigInt(),
                    this.SWAP_FEE_MATHS
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                const amountsOutBigInt = Array(
                    poolPairData.allBalancesScaled.length
                ).fill(BigInt(0));
                amountsOutBigInt[poolPairData.tokenIndexOut] =
                    amountConvertedEvm.toBigInt();

                returnEvm = _calcBptInGivenExactTokensOut(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    amountsOutBigInt,
                    poolPairData.virtualBptSupply.toBigInt(),
                    this.SWAP_FEE_MATHS
                );
            } else {
                returnEvm = _calcInGivenOut(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    amountConvertedEvm.toBigInt(),
                    this.SWAP_FEE_MATHS
                );
            }

            // Return floating point with fees and price rate handled
            return this.handleScalingAndFeeTokenOut(
                poolPairData.swapFee,
                returnEvm.toString(),
                poolPairData.tokenInPriceRate,
                poolPairData.decimalsOut
            );
        } catch (err) {
            console.error(`PhantomStable _evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    /**
     * _calcTokensOutGivenExactBptIn
     * @param bptAmountIn EVM scale.
     * @returns EVM scale.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // PhantomStables can only be exited by using BPT > token swaps
        throw new Error(
            'PhantomPool does not have exit pool (_calcTokensOutGivenExactBptIn).'
        );
    }

    /**
     * _calcBptOutGivenExactTokensIn
     * @param amountsIn EVM Scale
     * @returns EVM Scale
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        // PhantomStables can only be joined by using token > BPT swaps
        throw new Error(
            'PhantomPool does not have join pool (_calcBptOutGivenExactTokensIn).'
        );
    }

    // this is the multiplicative inverse of the derivative of _exactTokenInForTokenOut
    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const amountConverted = amount.times(
            poolPairData.tokenInPriceRateFloating
        );
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _spotPriceAfterSwapExactTokenInForBPTOut(
                amountConverted,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _spotPriceAfterSwapExactBPTInForTokenOut(
                amountConverted,
                poolPairData
            );
        } else {
            result = _spotPriceAfterSwapExactTokenInForTokenOut(
                amountConverted,
                poolPairData
            );
        }
        return result
            .div(poolPairData.tokenInPriceRateFloating)
            .times(poolPairData.tokenOutPriceRateFloating);
    }

    // this is the derivative of _tokenInForExactTokenOut
    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const amountConverted = amount.times(
            poolPairData.tokenOutPriceRateFloating
        );
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _spotPriceAfterSwapTokenInForExactBPTOut(
                amountConverted,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _spotPriceAfterSwapBPTInForExactTokenOut(
                amountConverted,
                poolPairData
            );
        } else {
            result = _spotPriceAfterSwapTokenInForExactTokenOut(
                amountConverted,
                poolPairData
            );
        }
        return result
            .div(poolPairData.tokenInPriceRateFloating)
            .times(poolPairData.tokenOutPriceRateFloating);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const amountConverted = amount.times(
            poolPairData.tokenInPriceRateFloating
        );
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                amountConverted,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                amountConverted,
                poolPairData
            );
        } else {
            result = _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                amountConverted,
                poolPairData
            );
        }
        return result.times(poolPairData.tokenOutPriceRateFloating);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const amountConverted = amount.times(
            poolPairData.tokenOutPriceRateFloating
        );
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                amountConverted,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                amountConverted,
                poolPairData
            );
        } else {
            result = _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                amountConverted,
                poolPairData
            );
        }
        return result
            .div(poolPairData.tokenInPriceRateFloating)
            .times(poolPairData.tokenOutPriceRateFloating)
            .times(poolPairData.tokenOutPriceRateFloating);
    }
}
