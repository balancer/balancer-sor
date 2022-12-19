import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { isSameAddress } from '../../utils';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import { getAddress } from '@ethersproject/address';
import {
    _calcBptOutGivenExactTokensIn,
    _calcTokenOutGivenExactBptIn,
    _calcOutGivenIn,
    _calcTokenInGivenExactBptOut,
    _calcBptInGivenExactTokensOut,
    _calcInGivenOut,
    _calcTokensOutGivenExactBptIn,
} from '../stablePool/stableMathBigInt';
import * as stableMath from '../stablePool/stableMath';
import cloneDeep from 'lodash.clonedeep';
import { StablePoolPairData } from 'pools/stablePool/stablePool';

enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

type PhantomStablePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals' | 'priceRate'
>;

export class PhantomStablePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.MetaStable;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: PhantomStablePoolToken[];
    tokensList: string[];
    ALMOST_ONE = parseFixed('0.99', 18);

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
    static removeBPT(poolPairData: StablePoolPairData): StablePoolPairData {
        const poolPairDataNoBpt = cloneDeep(poolPairData);
        const bptIndex = poolPairData.bptIndex as number;
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

    parsePoolPairData(tokenIn: string, tokenOut: string): StablePoolPairData {
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
            bnum(balance).times(bnum(priceRate))
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

        // VirtualBPTSupply must be used for the maths
        const totalShares = this.totalShares;

        const poolPairData: StablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            bptIndex: bptIndex,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            swapFee: this.swapFee,
            allBalances,
            allBalancesScaled,
            amp: this.amp,
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            totalShares,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            tokenInPriceRate,
            tokenOutPriceRate,
        };

        return PhantomStablePool.removeBPT(poolPairData);
    }

    getNormalizedLiquidity(poolPairData: StablePoolPairData): OldBigNumber {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return bnum(
            formatFixed(
                poolPairData.balanceOut.mul(poolPairData.amp),
                poolPairData.decimalsOut + PhantomStablePool.AMP_DECIMALS
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: StablePoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        const tokenOutPriceRate = poolPairData.tokenOutPriceRate as BigNumber;
        // PoolPairData is using balances that have already been exchanged so need to convert back
        if (swapType === SwapTypes.SwapExactIn) {
            // Return max valid amount of tokenIn
            // As an approx - use almost the total balance of token out as we can add any amount of tokenIn and expect some back
            return bnum(
                formatFixed(
                    poolPairData.balanceOut
                        .mul(this.ALMOST_ONE)
                        .div(tokenOutPriceRate),
                    poolPairData.decimalsOut
                )
            );
        } else {
            // Return max amount of tokenOut - approx is almost all balance
            return bnum(
                formatFixed(
                    poolPairData.balanceOut
                        .mul(this.ALMOST_ONE)
                        .div(tokenOutPriceRate),
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
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenInPriceRate = poolPairData.tokenInPriceRate as BigNumber;
        const tokenOutPriceRate = poolPairData.tokenOutPriceRate as BigNumber;
        try {
            // This code assumes that decimalsIn and decimalsOut is 18

            if (amount.isZero()) return ZERO;
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            // In Phantom Pools every time there is a swap (token per token, bpt per token or token per bpt), we substract the fee from the amount in
            const amtWithFeeEvm = this.subtractSwapFeeAmount(
                parseFixed(amount.dp(18).toString(), 18),
                poolPairData.swapFee
            );
            const amountConvertedEvm = amtWithFeeEvm
                .mul(tokenInPriceRate)
                .div(ONE);

            let returnEvm: BigInt;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                const amountsInBigInt = Array(
                    poolPairData.allBalancesScaled.length
                ).fill(BigInt(0));
                amountsInBigInt[poolPairData.tokenIndexIn] =
                    amountConvertedEvm.toBigInt();

                returnEvm = _calcBptOutGivenExactTokensIn(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    amountsInBigInt,
                    this.totalShares.toBigInt(),
                    BigInt(0)
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                returnEvm = _calcTokenOutGivenExactBptIn(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexOut,
                    amountConvertedEvm.toBigInt(),
                    this.totalShares.toBigInt(),
                    BigInt(0)
                );
            } else {
                returnEvm = _calcOutGivenIn(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    amountConvertedEvm.toBigInt(),
                    BigInt(0)
                );
            }

            const returnEvmWithRate = BigNumber.from(returnEvm)
                .mul(ONE)
                .div(tokenOutPriceRate);

            // Return human scaled
            return bnum(formatFixed(returnEvmWithRate, 18));
        } catch (err) {
            // console.error(`PhantomStable _evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenInPriceRate = poolPairData.tokenInPriceRate as BigNumber;
        const tokenOutPriceRate = poolPairData.tokenOutPriceRate as BigNumber;
        try {
            // This code assumes that decimalsIn and decimalsOut is 18

            if (amount.isZero()) return ZERO;
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amountConvertedEvm = parseFixed(amount.dp(18).toString(), 18)
                .mul(tokenOutPriceRate)
                .div(ONE);

            let returnEvm: BigInt;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                returnEvm = _calcTokenInGivenExactBptOut(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexIn,
                    amountConvertedEvm.toBigInt(),
                    this.totalShares.toBigInt(),
                    BigInt(0)
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
                    this.totalShares.toBigInt(),
                    BigInt(0) // Fee is handled below
                );
            } else {
                returnEvm = _calcInGivenOut(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    amountConvertedEvm.toBigInt(),
                    BigInt(0) // Fee is handled below
                );
            }
            // In Phantom Pools every time there is a swap (token per token, bpt per token or token per bpt), we substract the fee from the amount in
            const returnEvmWithRate = BigNumber.from(returnEvm)
                .mul(ONE)
                .div(tokenInPriceRate);

            const returnEvmWithFee = this.addSwapFeeAmount(
                returnEvmWithRate,
                poolPairData.swapFee
            );

            // return human number
            return bnum(formatFixed(returnEvmWithFee, 18));
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
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // token balances are stored in human scale and must be EVM for maths
        // Must take priceRate into consideration
        const balancesEvm = this.tokens
            .filter((t) => !isSameAddress(t.address, this.address))
            .map(({ balance, priceRate, decimals }) =>
                parseFixed(balance, 18)
                    .mul(parseFixed(priceRate, decimals))
                    .div(ONE)
                    .toBigInt()
            );
        let returnAmt: bigint[];
        try {
            returnAmt = _calcTokensOutGivenExactBptIn(
                balancesEvm,
                bptAmountIn.toBigInt(),
                this.totalShares.toBigInt()
            );
            return returnAmt.map((a) => BigNumber.from(a.toString()));
        } catch (err) {
            return new Array(balancesEvm.length).fill(ZERO);
        }
    }

    /**
     * _calcBptOutGivenExactTokensIn
     * @param amountsIn EVM Scale
     * @returns EVM Scale
     */
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        try {
            // token balances are stored in human scale and must be EVM for maths
            // Must take priceRate into consideration
            const balancesEvm = this.tokens
                .filter((t) => !isSameAddress(t.address, this.address))
                .map(({ balance, priceRate, decimals }) =>
                    parseFixed(balance, decimals)
                        .mul(parseFixed(priceRate, 18))
                        .div(ONE)
                        .toBigInt()
                );
            const bptAmountOut = _calcBptOutGivenExactTokensIn(
                this.amp.toBigInt(),
                balancesEvm,
                amountsIn.map((a) => a.toBigInt()),
                this.totalShares.toBigInt(),
                BigInt(0)
            );
            return BigNumber.from(bptAmountOut.toString());
        } catch (err) {
            return Zero;
        }
    }

    // this is the multiplicative inverse of the derivative of _exactTokenInForTokenOut
    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenInPriceRate = poolPairData.tokenInPriceRate as BigNumber;
        const tokenOutPriceRate = poolPairData.tokenOutPriceRate as BigNumber;
        const priceRateIn = bnum(formatFixed(tokenInPriceRate, 18));
        const priceRateOut = bnum(formatFixed(tokenOutPriceRate, 18));
        const amountConverted = amount.times(priceRateIn);
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = stableMath._spotPriceAfterSwapExactTokenInForBPTOut(
                amountConverted,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = stableMath._spotPriceAfterSwapExactBPTInForTokenOut(
                amountConverted,
                poolPairData
            );
        } else {
            result = stableMath._spotPriceAfterSwapExactTokenInForTokenOut(
                amountConverted,
                poolPairData
            );
        }
        return result.div(priceRateIn).times(priceRateOut);
    }

    // this is the derivative of _tokenInForExactTokenOut
    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenInPriceRate = poolPairData.tokenInPriceRate as BigNumber;
        const tokenOutPriceRate = poolPairData.tokenOutPriceRate as BigNumber;
        const priceRateIn = bnum(formatFixed(tokenInPriceRate, 18));
        const priceRateOut = bnum(formatFixed(tokenOutPriceRate, 18));
        const amountConverted = amount.times(priceRateOut);
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = stableMath._spotPriceAfterSwapTokenInForExactBPTOut(
                amountConverted,
                poolPairData
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = stableMath._spotPriceAfterSwapBPTInForExactTokenOut(
                amountConverted,
                poolPairData
            );
        } else {
            result = stableMath._spotPriceAfterSwapTokenInForExactTokenOut(
                amountConverted,
                poolPairData
            );
        }
        return result.div(priceRateIn).times(priceRateOut);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenInPriceRate = poolPairData.tokenInPriceRate as BigNumber;
        const tokenOutPriceRate = poolPairData.tokenOutPriceRate as BigNumber;
        const priceRateIn = bnum(formatFixed(tokenInPriceRate, 18));
        const priceRateOut = bnum(formatFixed(tokenOutPriceRate, 18));
        const amountConverted = amount.times(priceRateIn);
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result =
                stableMath._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                    amountConverted,
                    poolPairData
                );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result =
                stableMath._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                    amountConverted,
                    poolPairData
                );
        } else {
            result =
                stableMath._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    amountConverted,
                    poolPairData
                );
        }
        return result.times(priceRateOut);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const tokenInPriceRate = poolPairData.tokenInPriceRate as BigNumber;
        const tokenOutPriceRate = poolPairData.tokenOutPriceRate as BigNumber;
        const priceRateIn = bnum(formatFixed(tokenInPriceRate, 18));
        const priceRateOut = bnum(formatFixed(tokenOutPriceRate, 18));
        const amountConverted = amount.times(priceRateOut);
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result =
                stableMath._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                    amountConverted,
                    poolPairData
                );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result =
                stableMath._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                    amountConverted,
                    poolPairData
                );
        } else {
            result =
                stableMath._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                    amountConverted,
                    poolPairData
                );
        }
        return result.div(priceRateIn).times(priceRateOut).times(priceRateOut);
    }

    subtractSwapFeeAmount(amount: BigNumber, swapFee: BigNumber): BigNumber {
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/c18ff2686c61a8cbad72cdcfc65e9b11476fdbc3/pkg/pool-utils/contracts/BasePool.sol#L466
        const feeAmount = amount.mul(swapFee).add(ONE.sub(1)).div(ONE);
        return amount.sub(feeAmount);
    }

    addSwapFeeAmount(amount: BigNumber, swapFee: BigNumber): BigNumber {
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/c18ff2686c61a8cbad72cdcfc65e9b11476fdbc3/pkg/pool-utils/contracts/BasePool.sol#L458
        const feeAmount = ONE.sub(swapFee);
        return amount.mul(ONE).add(feeAmount.sub(1)).div(feeAmount);
    }
}
