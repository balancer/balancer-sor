import { getAddress } from '@ethersproject/address';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { parseFixed, formatFixed, BigNumber } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, bnum } from '../../utils/bignumber';

import {
    PoolBase,
    PoolPairBase,
    PoolTypes,
    SwapPairType,
    SubgraphToken,
    SwapTypes,
    SubgraphPoolBase,
    PriceBoundData,
} from 'types';
import { isSameAddress } from '../../utils';
import {
    _calculateInvariant,
    _calcOutGivenIn,
    _calcInGivenOut,
    _findVirtualParams,
    _calculateNewSpotPrice,
    _reduceFee,
    _addFee,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _getNormalizedLiquidity,
} from './gyro2Math';

export type Gyro2PoolPairData = PoolPairBase & {
    sqrtAlpha: BigNumber;
    sqrtBeta: BigNumber;
};

export type Gyro2PoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export class Gyro2Pool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Gyro2;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    tokensList: string[];
    tokens: Gyro2PoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;
    priceBounds: PriceBoundData;

    // Max In/Out Ratios
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static fromPool(pool: SubgraphPoolBase): Gyro2Pool {
        if (!pool.priceBounds) throw new Error('Gyro2Pool missing priceBounds');
        const addresses = pool.tokens.map((t) => t.address);
        if (!addresses.includes(pool.priceBounds.tokenInAddress))
            throw new Error('Gyro2Pool priceBounds tokenIn not in tokens');
        if (!addresses.includes(pool.priceBounds.tokenOutAddress))
            throw new Error('Gyro2Pool priceBounds tokenOut not in tokens');

        return new Gyro2Pool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens as Gyro2PoolToken[],
            pool.tokensList,
            pool.priceBounds as PriceBoundData
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: Gyro2PoolToken[],
        tokensList: string[],
        priceBounds: PriceBoundData
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.priceBounds = priceBounds;
    }

    setTypeForSwap(type: SwapPairType): void {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): Gyro2PoolPairData {
        const tokenInIndex = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenInIndex < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenInIndex];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tokenOutIndex = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenOutIndex < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenOutIndex];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        const sqrtAlpha =
            tI.address === this.priceBounds.tokenInAddress
                ? parseFixed(this.priceBounds.lowerBound, 18).pow(1 / 2)
                : ONE.div(parseFixed(this.priceBounds.upperBound, 18)).pow(
                      1 / 2
                  );

        const sqrtBeta =
            tI.address === this.priceBounds.tokenInAddress
                ? parseFixed(this.priceBounds.upperBound, 18).pow(1 / 2)
                : ONE.div(parseFixed(this.priceBounds.lowerBound, 18)).pow(
                      1 / 2
                  );

        // TODO: sqrtAlpha, sqrtBeta to be added
        const poolPairData: Gyro2PoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            swapFee: this.swapFee,
            sqrtAlpha,
            sqrtBeta,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: Gyro2PoolPairData): OldBigNumber {
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const invariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn] = _findVirtualParams(
            invariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const normalisedLiquidity = _getNormalizedLiquidity(
            balances,
            virtualParamIn,
            poolPairData.swapFee
        );

        return bnum(formatFixed(normalisedLiquidity, poolPairData.decimalsOut));
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        if (swapType === SwapTypes.SwapExactIn) {
            return bnum(
                formatFixed(
                    poolPairData.balanceIn.mul(this.MAX_IN_RATIO).div(ONE),
                    poolPairData.decimalsIn
                )
            );
        } else {
            return bnum(
                formatFixed(
                    poolPairData.balanceOut.mul(this.MAX_OUT_RATIO).div(ONE),
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
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const invariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn, virtualParamOut] = _findVirtualParams(
            invariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const inAmount = parseFixed(amount.toString(), poolPairData.decimalsIn);
        const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);

        const outAmount = _calcOutGivenIn(
            poolPairData.balanceIn,
            poolPairData.balanceOut,
            inAmountLessFee,
            virtualParamIn,
            virtualParamOut,
            invariant
        );

        return bnum(formatFixed(outAmount, poolPairData.decimalsOut));
    }

    _tokenInForExactTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        const outAmount = parseFixed(
            amount.toString(),
            poolPairData.decimalsOut
        );
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const invariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn, virtualParamOut] = _findVirtualParams(
            invariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const inAmountLessFee = _calcInGivenOut(
            poolPairData.balanceIn,
            poolPairData.balanceOut,
            outAmount,
            virtualParamIn,
            virtualParamOut,
            invariant
        );
        const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

        return bnum(formatFixed(inAmount, poolPairData.decimalsIn));
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const invariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn, virtualParamOut] = _findVirtualParams(
            invariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const inAmount = parseFixed(amount.toString(), poolPairData.decimalsIn);
        const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
        const outAmount = _calcOutGivenIn(
            poolPairData.balanceIn,
            poolPairData.balanceOut,
            inAmountLessFee,
            virtualParamIn,
            virtualParamOut,
            invariant
        );
        const newSpotPrice = _calculateNewSpotPrice(
            balances,
            inAmount,
            outAmount,
            virtualParamIn,
            virtualParamOut,
            poolPairData.swapFee
        );
        return bnum(formatFixed(newSpotPrice, poolPairData.decimalsIn));
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const outAmount = parseFixed(
            amount.toString(),
            poolPairData.decimalsOut
        );
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const invariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn, virtualParamOut] = _findVirtualParams(
            invariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const inAmountLessFee = _calcInGivenOut(
            poolPairData.balanceIn,
            poolPairData.balanceOut,
            outAmount,
            virtualParamIn,
            virtualParamOut,
            invariant
        );
        const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);
        const newSpotPrice = _calculateNewSpotPrice(
            balances,
            inAmount,
            outAmount,
            virtualParamIn,
            virtualParamOut,
            poolPairData.swapFee
        );

        return bnum(formatFixed(newSpotPrice, poolPairData.decimalsIn));
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const invariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn, virtualParamOut] = _findVirtualParams(
            invariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const inAmount = parseFixed(amount.toString(), poolPairData.decimalsIn);
        const inAmountLessFee = _reduceFee(inAmount, poolPairData.swapFee);
        const outAmount = _calcOutGivenIn(
            poolPairData.balanceIn,
            poolPairData.balanceOut,
            inAmountLessFee,
            virtualParamIn,
            virtualParamOut,
            invariant
        );
        const derivative = _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            balances,
            outAmount,
            virtualParamOut
        );

        return bnum(formatFixed(derivative, poolPairData.decimalsIn));
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const outAmount = parseFixed(
            amount.toString(),
            poolPairData.decimalsOut
        );
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const invariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn, virtualParamOut] = _findVirtualParams(
            invariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const inAmountLessFee = _calcInGivenOut(
            poolPairData.balanceIn,
            poolPairData.balanceOut,
            outAmount,
            virtualParamIn,
            virtualParamOut,
            invariant
        );
        const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

        const derivative = _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            balances,
            inAmount,
            virtualParamIn,
            outAmount,
            virtualParamOut,
            poolPairData.swapFee
        );

        return bnum(formatFixed(derivative, poolPairData.decimalsIn));
    }
}
