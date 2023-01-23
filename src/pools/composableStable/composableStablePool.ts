import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { isSameAddress } from '../../utils';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../../utils/bignumber';
import { SubgraphPoolBase } from '../../types';
import {
    _calcBptOutGivenExactTokensIn,
    _calcTokenOutGivenExactBptIn,
    _calcOutGivenIn,
    _calcTokenInGivenExactBptOut,
    _calcBptInGivenExactTokensOut,
    _calcInGivenOut,
    _calcTokensOutGivenExactBptIn,
} from '../stablePool/stableMathBigInt';
import {
    PhantomStablePool,
    PhantomStablePoolPairData,
    PhantomStablePoolToken,
    PairTypes,
} from '../phantomStablePool/phantomStablePool';
export class ComposableStablePool extends PhantomStablePool {
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
    }

    static fromPool(pool: SubgraphPoolBase): ComposableStablePool {
        if (!pool.amp)
            throw new Error('ComposableStablePool missing amp factor');
        return new ComposableStablePool(
            pool.id,
            pool.address,
            pool.amp,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList
        );
    }

    _exactTokenInForTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // This code needs decimalsIn and decimalsOut as 18
            // It will scale decimalsIn and decimalsOut to 18 and revert them back to original after calculation

            if (amount.isZero()) return ZERO;
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amountConvertedEvm = parseFixed(amount.dp(18).toString(), 18)
                .mul(poolPairData.tokenInPriceRate)
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
                    poolPairData.virtualBptSupply.toBigInt(),
                    poolPairData.swapFee.toBigInt()
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                returnEvm = _calcTokenOutGivenExactBptIn(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexOut,
                    amountConvertedEvm.toBigInt(),
                    poolPairData.virtualBptSupply.toBigInt(),
                    poolPairData.swapFee.toBigInt()
                );
            } else {
                returnEvm = _calcOutGivenIn(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    amountConvertedEvm.toBigInt(),
                    poolPairData.swapFee.toBigInt()
                );
            }

            const returnEvmWithRate = BigNumber.from(returnEvm)
                .mul(ONE)
                .div(poolPairData.tokenOutPriceRate);

            // Return human scaled
            return bnum(formatFixed(returnEvmWithRate, 18)).dp(
                poolPairData.decimalsOut
            );
        } catch (err) {
            // console.error(`PhantomStable _evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // This code needs decimalsIn and decimalsOut as 18
            // It will scale decimalsIn and decimalsOut to 18 and revert them back to original after calculation

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
                    poolPairData.swapFee.toBigInt()
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
                    poolPairData.swapFee.toBigInt()
                );
            } else {
                returnEvm = _calcInGivenOut(
                    this.amp.toBigInt(),
                    poolPairData.allBalancesScaled.map((b) => b.toBigInt()),
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    amountConvertedEvm.toBigInt(),
                    poolPairData.swapFee.toBigInt()
                );
            }
            // In Phantom Pools every time there is a swap (token per token, bpt per token or token per bpt), we substract the fee from the amount in
            const returnEvmWithRate = BigNumber.from(returnEvm)
                .mul(ONE)
                .div(poolPairData.tokenInPriceRate);

            // return human number
            return bnum(formatFixed(returnEvmWithRate, 18)).dp(
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
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // token balances are stored in human scale and must be EVM for maths
        // Must take priceRate into consideration
        const balancesEvm = this.tokens
            .filter((t) => !isSameAddress(t.address, this.address))
            .map(({ balance, priceRate }) =>
                parseFixed(balance, 18)
                    .mul(parseFixed(priceRate, 18))
                    .div(ONE)
                    .toBigInt()
            );
        try {
            const amountsOutWithRate = _calcTokensOutGivenExactBptIn(
                balancesEvm,
                bptAmountIn.toBigInt(),
                this.totalShares.toBigInt()
            );
            const amountsOutEvm = amountsOutWithRate.map((amount, i) => {
                // remove price rate from amounts out
                const amountOut = BigNumber.from(amount.toString())
                    .mul(ONE)
                    .div(this.tokens[i].priceRate);
                // scale down from 18 decimals to token decimals
                const amountOutHuman = bnum(formatFixed(amountOut, 18))
                    .dp(this.tokens[i].decimals)
                    .toString();
                // parse to EVM scale
                return parseFixed(amountOutHuman, this.tokens[i].decimals);
            });
            return amountsOutEvm;
        } catch (err) {
            return new Array(balancesEvm.length).fill(ZERO);
        }
    }

    /**
     * _calcBptOutGivenExactTokensIn
     * @param amountsIn EVM Scale (Should not have value for BPT token)
     * @returns EVM Scale
     */
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        try {
            const amountsInHuman = amountsIn.map((amount, i) =>
                formatFixed(amount, this.tokens[i].decimals)
            );
            const amountsInWithRate = new Array(amountsIn.length).fill(
                BigInt(0)
            );
            const balancesEvm = new Array(amountsIn.length).fill(BigInt(0));
            // token balances are stored in human scale and must be EVM for maths
            // Must take priceRate into consideration
            this.tokens
                .filter((t) => !isSameAddress(t.address, this.address))
                .forEach(({ balance, priceRate }, i) => {
                    amountsInWithRate[i] = parseFixed(amountsInHuman[i], 18) // 18 decimals required for maths
                        .mul(parseFixed(priceRate, 18))
                        .div(ONE)
                        .toBigInt();
                    balancesEvm[i] = parseFixed(balance, 18)
                        .mul(parseFixed(priceRate, 18))
                        .div(ONE)
                        .toBigInt();
                });
            const bptAmountOut = _calcBptOutGivenExactTokensIn(
                this.amp.toBigInt(),
                balancesEvm,
                amountsInWithRate,
                this.totalShares.toBigInt(),
                this.swapFee.toBigInt()
            );
            return BigNumber.from(bptAmountOut.toString());
        } catch (err) {
            console.error(err);
            return Zero;
        }
    }
}
