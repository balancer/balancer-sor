import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import {
    BigNumber as OldBigNumber,
    bnum,
    integerToFloating,
    ZERO,
} from '../../utils/bignumber';
import {
    isSameAddress,
    normaliseBalance,
    normaliseAmount,
    denormaliseAmount,
    safeParseFixed,
} from '../../utils';
import { universalNormalizedLiquidity } from '../liquidity';
import {
    _computeScalingFactor,
    _downscaleDown,
    _downscaleUp,
} from '../../utils/basicOperations';
import {
    PoolBase,
    PoolTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import {
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from './stableMath';
import {
    _calcOutGivenIn,
    _calcInGivenOut,
    _calcBptOutGivenExactTokensIn,
    _calcTokensOutGivenExactBptIn,
} from './stableMathBigInt';

export type StablePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export type StablePoolPairData = PoolPairBase & {
    allBalances: OldBigNumber[];
    allBalancesScaled: BigNumber[]; // EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    amp: BigNumber;
    tokenIndexIn: number;
    tokenIndexOut: number;
    tokenInScalingFactor: bigint;
    tokenOutScalingFactor: bigint;
};

export class StablePool implements PoolBase<StablePoolPairData> {
    poolType: PoolTypes = PoolTypes.Stable;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: StablePoolToken[];
    tokensList: string[];
    ALMOST_ONE = parseFixed('0.99', 18);
    SWAP_FEE_MATHS = BigInt(0);

    static AMP_DECIMALS = 3;

    static fromPool(pool: SubgraphPoolBase): StablePool {
        if (!pool.amp) throw new Error('StablePool missing amp factor');
        return new StablePool(
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
        tokens: StablePoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.address = address;
        this.amp = parseFixed(amp, StablePool.AMP_DECIMALS);
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
    }

    findTokenIndex<Token extends { address: string }>(
        list: Token[],
        tokenAddress: string
    ): number {
        const index = list.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenAddress)
        );
        if (index < 0) throw 'Pool does not contain tokenIn';
        return index;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): StablePoolPairData {
        const tokenIndexIn = this.findTokenIndex(this.tokens, tokenIn);
        const tI = this.tokens[tokenIndexIn];

        const tokenIndexOut = this.findTokenIndex(this.tokens, tokenOut);
        const tO = this.tokens[tokenIndexOut];

        // Get all token balances
        const allBalances = this.tokens.map(({ balance }) => bnum(balance));
        const allBalancesScaled = this.tokens.map(({ balance }) =>
            parseFixed(balance, 18)
        );

        const poolPairData: StablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: parseFixed(tI.balance, tI.decimals),
            balanceOut: parseFixed(tO.balance, tO.decimals),
            swapFee: this.swapFee,
            allBalances,
            allBalancesScaled, // TO DO - Change to BigInt??
            amp: this.amp,
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            decimalsIn: tI.decimals,
            decimalsOut: tO.decimals,
            tokenInScalingFactor: _computeScalingFactor(BigInt(tI.decimals)),
            tokenOutScalingFactor: _computeScalingFactor(BigInt(tO.decimals)),
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: StablePoolPairData): OldBigNumber {
        return universalNormalizedLiquidity(
            this._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                ZERO
            )
        );
    }

    /**
     * Calculate Limit for Swap
     * @param poolPairData
     * @param swapType
     * @returns Limit (Floating point)
     */
    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            const limit = poolPairData.balanceIn.mul(this.ALMOST_ONE).div(ONE);
            return integerToFloating(limit.toString(), poolPairData.decimalsIn);
        } else {
            const limit = poolPairData.balanceOut.mul(this.ALMOST_ONE).div(ONE);
            return integerToFloating(
                limit.toString(),
                poolPairData.decimalsOut
            );
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (isSameAddress(this.address, token)) {
            this.updateTotalShares(newBalance);
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => isSameAddress(t.address, token));
            if (!T) throw Error('Pool does not contain this token');
            T.balance = formatFixed(newBalance, T.decimals);
        }
    }

    updateTotalShares(newTotalShares: BigNumber): void {
        this.totalShares = newTotalShares;
    }

    /**
     *
     * @param poolPairData
     * @param amount Amount of token in. Floating point number.
     * @returns Amount out. Floating point number.
     */
    _exactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;

            // Maths uses normalised to 1e18 fixed point i.e. 1USDC => 1e18 not 1e6
            const amountNormalised = safeParseFixed(amount.toString(), 18);
            const amountMinusFee = this.subtractSwapFeeAmount(
                amountNormalised,
                poolPairData.swapFee
            );

            const amountOutNormalised = _calcOutGivenIn(
                this.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((balance) =>
                    balance.toBigInt()
                ),
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountMinusFee.toBigInt(),
                this.SWAP_FEE_MATHS
            );
            const amountDownscaled = _downscaleDown(
                amountOutNormalised,
                poolPairData.tokenOutScalingFactor
            );
            return integerToFloating(
                amountDownscaled.toString(),
                poolPairData.decimalsOut,
                false
            );
        } catch (err) {
            // console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    /**
     *
     * @param poolPairData
     * @param amount Amount of token out. Floating point number.
     * @returns Amount in. Floating point number.
     */
    _tokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;
            // Maths uses normalised to 1e18 fixed point i.e. 1USDC => 1e18 not 1e6
            const amountOutNormalised = safeParseFixed(amount.toString(), 18);

            const amountInNormalised = _calcInGivenOut(
                this.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((balance) =>
                    balance.toBigInt()
                ),
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountOutNormalised.toBigInt(),
                this.SWAP_FEE_MATHS
            );
            const amountDownscaled = _downscaleUp(
                amountInNormalised,
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
        // balances and amounts must be normalized to 1e18 fixed point - e.g. 1USDC => 1e18 not 1e6
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
            // We want to return denormalised amounts. e.g. 1USDC => 1e6 not 1e18
            const amountsOut = amountsOutNormalised.map((a, i) =>
                denormaliseAmount(a, this.tokens[i])
            );
            return amountsOut.map((a) => BigNumber.from(a));
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
            // balances and amounts must be normalized to 1e18 fixed point - e.g. 1USDC => 1e18 not 1e6
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
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
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
