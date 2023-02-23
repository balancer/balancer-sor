import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import {
    isSameAddress,
    normaliseBalance,
    normaliseAmount,
    denormaliseAmount,
    safeParseFixed,
} from '../../utils';
import {
    BigNumber as OldBigNumber,
    bnum,
    ZERO,
    integerToFloating,
} from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import {
    _downscaleDown,
    _downscaleUp,
    _upscale,
} from '../../utils/basicOperations';
import {
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from '../stablePool/stableMath';
import {
    _calcOutGivenIn,
    _calcInGivenOut,
    _calcBptOutGivenExactTokensIn,
    _calcTokensOutGivenExactBptIn,
} from '../stablePool/stableMathBigInt';
import {
    StablePool,
    StablePoolPairData,
    StablePoolToken,
} from '../stablePool/stablePool';
import { MathSol } from '../../utils/basicOperations';

export type MetaStablePoolToken = StablePoolToken &
    Pick<SubgraphToken, 'priceRate'>;

export type MetaStablePoolPairData = StablePoolPairData & {
    tokenInPriceRate: BigNumber;
    tokenOutPriceRate: BigNumber;
};

export class MetaStablePool
    extends StablePool
    implements PoolBase<MetaStablePoolPairData>
{
    poolType: PoolTypes = PoolTypes.MetaStable;
    tokens: MetaStablePoolToken[];

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
        super(id, address, amp, swapFee, totalShares, tokens, tokensList);
        this.tokens = tokens;
    }

    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): MetaStablePoolPairData {
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

        const poolPairData: MetaStablePoolPairData = {
            ...stablePoolPairData,
            balanceIn: BigNumber.from(balanceIn.toString()),
            balanceOut: BigNumber.from(balanceOut.toString()),
            allBalances,
            allBalancesScaled,
            tokenInPriceRate,
            tokenOutPriceRate,
        };

        return poolPairData;
    }

    _exactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;
            // Maths uses normalised to 1e18 fixed point i.e. 1USDC => 1e18 not 1e6
            const amountMinusFee = this.subtractSwapFeeAmount(
                safeParseFixed(amount.toString(), poolPairData.decimalsIn),
                poolPairData.swapFee
            );
            const amountConverted = amountMinusFee
                .mul(poolPairData.tokenInPriceRate)
                .div(ONE);
            const amountNormalised = _upscale(
                amountConverted.toBigInt(),
                poolPairData.tokenInScalingFactor
            );

            const amountOutNormalised = _calcOutGivenIn(
                this.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((balance) =>
                    balance.toBigInt()
                ),
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountNormalised,
                BigInt(0)
            );
            const returnEvmWithRate = BigNumber.from(amountOutNormalised)
                .mul(ONE)
                .div(poolPairData.tokenOutPriceRate);
            const amountDownscaled = _downscaleDown(
                returnEvmWithRate.toBigInt(),
                poolPairData.tokenOutScalingFactor
            );
            return integerToFloating(
                amountDownscaled.toString(),
                poolPairData.decimalsOut,
                false
            );
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;

            // Maths uses normalised to 1e18 fixed point i.e. 1USDC => 1e18 not 1e6
            const amountOutNormalised = safeParseFixed(amount.toString(), 18);

            const amountConverted = amountOutNormalised
                .mul(poolPairData.tokenOutPriceRate)
                .div(ONE);

            const amountInNormalised = _calcInGivenOut(
                this.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((balance) =>
                    balance.toBigInt()
                ),
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountConverted.toBigInt(),
                BigInt(0)
            );

            const returnEvmWithRate = BigNumber.from(amountInNormalised)
                .mul(ONE)
                .div(poolPairData.tokenInPriceRate);
            const amountDownscaled = _downscaleUp(
                returnEvmWithRate.toBigInt(),
                poolPairData.tokenInScalingFactor
            );
            const amtWithFee = this.addSwapFeeAmount(
                BigNumber.from(amountDownscaled),
                poolPairData.swapFee
            );
            return integerToFloating(
                amtWithFee.toString(),
                poolPairData.decimalsIn
            );
        } catch (err) {
            console.error(`_evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    /**
     * _calcTokensOutGivenExactBptIn
     * @param bptAmountIn EVM scale.
     * @returns EVM scale.
     */
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // balances and amounts must be normalized as if it had 18 decimals for maths
        // takes price rate into account
        const balancesNormalised = this.tokens
            .filter((t) => !isSameAddress(t.address, this.address))
            .map((t) => normaliseBalance(t));
        try {
            const amountsOutNormalised = _calcTokensOutGivenExactBptIn(
                balancesNormalised,
                bptAmountIn.toBigInt(),
                this.totalShares.toBigInt()
            );
            const amountsOut = amountsOutNormalised.map((a, i) =>
                BigNumber.from(denormaliseAmount(a, this.tokens[i]).toString())
            );
            return amountsOut;
        } catch (err) {
            return new Array(balancesNormalised.length).fill(ZERO);
        }
    }

    /**
     * _calcBptOutGivenExactTokensIn
     * @param amountsIn EVM Scale
     * @returns EVM Scale
     */
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        try {
            // balances and amounts must be normalized as if it had 18 decimals for maths
            // takes price rate into account
            const amountsInNormalised = new Array(amountsIn.length).fill(
                BigInt(0)
            );
            const balancesNormalised = new Array(amountsIn.length).fill(
                BigInt(0)
            );
            this.tokens
                .filter((t) => !isSameAddress(t.address, this.address))
                .forEach((token, i) => {
                    amountsInNormalised[i] = normaliseAmount(
                        BigInt(amountsIn[i].toString()),
                        token
                    );
                    balancesNormalised[i] = normaliseBalance(token);
                });
            const bptAmountOut = _calcBptOutGivenExactTokensIn(
                this.amp.toBigInt(),
                balancesNormalised,
                amountsInNormalised,
                this.totalShares.toBigInt(),
                this.swapFee.toBigInt()
            );
            return BigNumber.from(bptAmountOut.toString());
        } catch (err) {
            return Zero;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateIn = bnum(
            formatFixed(poolPairData.tokenInPriceRate, 18)
        );
        const priceRateOut = bnum(
            formatFixed(poolPairData.tokenOutPriceRate, 18)
        );
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
        const priceRateIn = bnum(
            formatFixed(poolPairData.tokenInPriceRate, 18)
        );
        const priceRateOut = bnum(
            formatFixed(poolPairData.tokenOutPriceRate, 18)
        );
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
        const priceRateOut = bnum(
            formatFixed(poolPairData.tokenOutPriceRate, 18)
        );
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        ).times(priceRateOut);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const priceRateIn = bnum(
            formatFixed(poolPairData.tokenInPriceRate, 18)
        );
        const priceRateOut = bnum(
            formatFixed(poolPairData.tokenOutPriceRate, 18)
        );
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        )
            .div(priceRateIn)
            .times(priceRateOut)
            .times(priceRateOut);
    }
}
