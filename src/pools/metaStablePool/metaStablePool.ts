import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
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
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from '../stablePool/stableMath';
import {
    _calcOutGivenIn,
    _calcInGivenOut,
} from '../stablePool/stableMathBigInt';
import { StablePoolPairData } from '../stablePool/stablePool';

type MetaStablePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals' | 'priceRate'
>;

export type MetaStablePoolPairData = StablePoolPairData & {
    tokenInPriceRate: BigNumber;
    tokenOutPriceRate: BigNumber;
};

export class MetaStablePool implements PoolBase<MetaStablePoolPairData> {
    poolType: PoolTypes = PoolTypes.MetaStable;
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

        const poolPairData: MetaStablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
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
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6

            const amtWithFee = this.subtractSwapFeeAmount(
                parseFixed(
                    amount.dp(poolPairData.decimalsIn).toString(),
                    poolPairData.decimalsIn
                ),
                poolPairData.swapFee
            );

            const amountConverted = amtWithFee
                .mul(poolPairData.tokenInPriceRate)
                .div(ONE);

            const returnAmt = _calcOutGivenIn(
                this.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((balance) =>
                    balance.toBigInt()
                ),
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountConverted.toBigInt(),
                BigInt(0)
            );

            const returnEvmWithRate = BigNumber.from(returnAmt)
                .mul(ONE)
                .div(poolPairData.tokenOutPriceRate);

            return bnum(formatFixed(returnEvmWithRate, 18));
        } catch (err) {
            // console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: MetaStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            if (amount.isZero()) return ZERO;
            const decimalsIn = poolPairData.decimalsIn;
            const decimalsOut = poolPairData.decimalsOut;

            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const scalingFactorIn =
                poolPairData.tokenInPriceRate.toBigInt() *
                BigInt(10 ** (18 - decimalsIn));

            const scalingFactorOut =
                poolPairData.tokenOutPriceRate.toBigInt() *
                BigInt(10 ** (18 - decimalsOut));

            // eslint-disable-next-line prettier/prettier
            const amountBigInt = BigInt(
                amount
                    .times(10 ** decimalsOut)
                    .dp(0)
                    .toString()
            );
            const amountConverted =
                (amountBigInt * scalingFactorOut) / BigInt(10 ** 18);

            const returnAmount = _calcInGivenOut(
                this.amp.toBigInt(),
                poolPairData.allBalancesScaled.map((balance) =>
                    balance.toBigInt()
                ),
                poolPairData.tokenIndexIn,
                poolPairData.tokenIndexOut,
                amountConverted,
                BigInt(0)
            );

            const returnAmountConverted =
                (returnAmount * BigInt(10 ** 18)) / scalingFactorIn;

            const returnAmtWithFee = this.addSwapFeeAmount(
                BigNumber.from(returnAmountConverted),
                poolPairData.swapFee
            );
            return bnum(returnAmtWithFee.toString()).div(
                10 ** poolPairData.decimalsIn
            );
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
