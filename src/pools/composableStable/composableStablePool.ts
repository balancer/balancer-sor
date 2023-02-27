import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import {
    isSameAddress,
    normaliseBalance,
    normaliseAmount,
    denormaliseAmount,
    safeParseFixed,
} from '../../utils';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../../utils/bignumber';
import { SubgraphPoolBase } from '../../types';
import {
    _calcBptOutGivenExactTokensIn,
    _calcTokensOutGivenExactBptIn,
} from '../stablePool/stableMathBigInt';
import {
    PhantomStablePool,
    PhantomStablePoolToken,
} from '../phantomStablePool/phantomStablePool';
export class ComposableStablePool extends PhantomStablePool {
    SWAP_FEE_MATHS: bigint;
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
        this.SWAP_FEE_MATHS = this.swapFee.toBigInt();
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

    handleScalingAndFeeTokenIn(
        swapFee: BigNumber,
        amount: string,
        priceRate: BigNumber
    ): bigint {
        // Amount is floating point here and must be normalised for maths i.e. 1USDC => 1e18 not 1e6
        const amountNormalised = safeParseFixed(amount, 18);
        const amountWithRate = amountNormalised.mul(priceRate).div(ONE);
        // Fee is handled in maths not here
        return amountWithRate.toBigInt();
    }

    handleScalingAndFeeTokenOut(
        swapFee: BigNumber,
        amount: string,
        priceRate: BigNumber,
        decimalsOut: number
    ): OldBigNumber {
        // Amount is normalised here (straight from maths)
        const returnWithRate = BigNumber.from(amount).mul(ONE).div(priceRate);
        // Fee has already been handled in maths
        return bnum(formatFixed(returnWithRate, 18)).dp(decimalsOut);
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
     * @param amountsIn EVM Scale (Should not have value for BPT token)
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
            console.error(err);
            return Zero;
        }
    }
}
