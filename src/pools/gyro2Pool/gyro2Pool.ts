import { getAddress } from '@ethersproject/address';
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
} from './gyro2Math';
import { WeiPerEther as ONE } from '@ethersproject/constants';

export type Gyro2PoolPairData = PoolPairBase & {
    sqrtAlpha: BigNumber;
    sqrtBeta: BigNumber;
};

export type Gyro2PoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

// TODO: getNormalizedLiquidity, _derivativeSpotPriceAfterSwapExactTokenInForTokenOut, _derivativeSpotPriceAfterSwapTokenInForExactTokenOut implementations
export class Gyro2Pool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Gyro2;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    tokensList: string[];
    tokens: Gyro2PoolToken[];
    swapFee: BigNumber;
    totalShares: BigNumber;

    // Max In/Out Ratios
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static fromPool(pool: SubgraphPoolBase): Gyro2Pool {
        return new Gyro2Pool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: Gyro2PoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
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
        };

        return poolPairData;
    }

    // getNormalizedLiquidity(poolPairData: Gyro2PoolPairData): OldBigNumber {
    // }

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
        const currentInvariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn, virtualParamOut] = _findVirtualParams(
            currentInvariant,
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
            currentInvariant
        );

        return bnum(formatFixed(outAmount, poolPairData.decimalsOut));
    }

    _tokenInForExactTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        const balances = [poolPairData.balanceIn, poolPairData.balanceOut];
        const currentInvariant = _calculateInvariant(
            balances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );
        const [virtualParamIn, virtualParamOut] = _findVirtualParams(
            currentInvariant,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );

        const inAmountLessFee = _calcInGivenOut(
            poolPairData.balanceIn,
            poolPairData.balanceOut,
            parseFixed(amount.toString(), poolPairData.decimalsOut),
            virtualParamIn,
            virtualParamOut,
            currentInvariant
        );

        const inAmount = _addFee(inAmountLessFee, poolPairData.swapFee);

        return bnum(formatFixed(inAmount, poolPairData.decimalsIn));
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        // Compute the reserve balances of the two assets after the swap (say x and y). This should include any fees.
        const inAmount = parseFixed(amount.toString(), poolPairData.decimalsIn);

        const outAmount = parseFixed(
            this._exactTokenInForTokenOut(
                poolPairData,
                amount,
                false
            ).toString(),
            poolPairData.decimalsOut
        );

        const newBalances = [
            poolPairData.balanceIn.add(inAmount),
            poolPairData.balanceOut.sub(outAmount),
        ];

        const newSpotPrice = _calculateNewSpotPrice(
            newBalances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );

        return bnum(formatFixed(newSpotPrice, poolPairData.decimalsIn));
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: Gyro2PoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        // Compute the reserve balances of the two assets after the swap (say x and y). This should include any fees.
        const outAmount = parseFixed(
            amount.toString(),
            poolPairData.decimalsOut
        );

        const inAmount = parseFixed(
            this._tokenInForExactTokenOut(
                poolPairData,
                amount,
                false
            ).toString(),
            poolPairData.decimalsIn
        );

        const newBalances = [
            poolPairData.balanceIn.add(inAmount),
            poolPairData.balanceOut.sub(outAmount),
        ];

        const newSpotPrice = _calculateNewSpotPrice(
            newBalances,
            poolPairData.sqrtAlpha,
            poolPairData.sqrtBeta
        );

        return bnum(formatFixed(newSpotPrice, poolPairData.decimalsIn));
    }

    // _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
    //     poolPairData: Gyro2PoolPairData,
    //     amount: OldBigNumber
    // ): OldBigNumber {}

    // _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
    //     poolPairData: Gyro2PoolPairData,
    //     amount: OldBigNumber
    // ): OldBigNumber {}
}
