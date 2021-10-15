import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { bnum, scale, ZERO } from '../../utils/bignumber';
import { BigNumber as OldBigNumber } from '../../utils/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { isSameAddress } from '../../utils';
import * as SDK from '@georgeroman/balancer-v2-pools';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import {
    _exactTokenInForBPTOut,
    _exactBPTInForTokenOut,
    _tokenInForExactBPTOut,
    _BPTInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapExactTokenInForBPTOut,
    _spotPriceAfterSwapExactBPTInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _spotPriceAfterSwapTokenInForExactBPTOut,
    _spotPriceAfterSwapBPTInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut,
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut,
} from './linearMath';

export enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

type LinearPoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals' | 'priceRate'
>;

export type LinearPoolPairData = PoolPairBase & {
    pairType: PairTypes;
    wrappedBalance: OldBigNumber; // If main token is USDC then wrapped token is aUSDC (or a wrapped version of it)
    wrappedDecimals: number;
    rate: OldBigNumber; // PriceRate of wrapped token
    target1: BigNumber; // Target determine the range where there are positive, zero or negative fees
    target2: BigNumber; // when the "main token" has a balance below target1, there are negative fees when adding main token
};

export class LinearPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Linear;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: LinearPoolToken[];
    tokensList: string[];

    wrappedIndex: number;
    wrappedDecimals: number;
    target1: BigNumber;
    target2: BigNumber;
    MAX_RATIO = parseFixed('10', 18); // Specific for Linear pool types
    ALMOST_ONE = parseFixed('0.99', 18);

    static fromPool(pool: SubgraphPoolBase): LinearPool {
        if (!pool.wrappedIndex)
            throw new Error('LinearPool missing wrappedIndex');
        if (!pool.target1) throw new Error('LinearPool missing target1');
        if (!pool.target2) throw new Error('LinearPool missing target2');
        return new LinearPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.wrappedIndex,
            pool.target1,
            pool.target2
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: LinearPoolToken[],
        tokensList: string[],
        wrappedIndex: number,
        target1: string,
        target2: string
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.wrappedIndex = wrappedIndex;
        this.wrappedDecimals = this.tokens[this.wrappedIndex].decimals;

        this.target1 = parseFixed(target1, this.wrappedDecimals); // Wrapped token will have same decimals as underlying
        this.target2 = parseFixed(target2, this.wrappedDecimals);
    }

    setTypeForSwap(type: SwapPairType): void {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): LinearPoolPairData {
        let pairType: PairTypes;

        const tI = this.tokens.find((t) => isSameAddress(t.address, tokenIn));
        if (!tI) throw Error(`Pool does not contain token in ${tokenIn}`);
        const decimalsIn = tI.decimals;
        const balanceIn = parseFixed(tI.balance, decimalsIn);

        const tO = this.tokens.find((t) => isSameAddress(t.address, tokenOut));
        if (!tO) throw Error(`Pool does not contain token out ${tokenOut}`);
        const decimalsOut = tO.decimals;
        const balanceOut = parseFixed(tO.balance, decimalsOut);

        // Linear pools allow trading between token and pool BPT (phantom BPT)
        if (isSameAddress(tokenIn, this.address)) {
            pairType = PairTypes.BptToToken;
        } else if (isSameAddress(tokenOut, this.address)) {
            pairType = PairTypes.TokenToBpt;
        } else {
            pairType = PairTypes.TokenToToken;
        }

        const poolPairData: LinearPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: balanceIn,
            balanceOut: balanceOut,
            swapFee: this.swapFee,
            wrappedBalance: scale(
                bnum(this.tokens[this.wrappedIndex].balance),
                this.wrappedDecimals
            ),
            wrappedDecimals: this.wrappedDecimals,
            rate: scale(bnum(this.tokens[this.wrappedIndex].priceRate), 18),
            target1: this.target1,
            target2: this.target2,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: LinearPoolPairData): OldBigNumber {
        return bnum(0);
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        // Needs to return human scaled numbers
        const linearPoolPairData = poolPairData as LinearPoolPairData;

        if (swapType === SwapTypes.SwapExactIn) {
            if (linearPoolPairData.pairType === PairTypes.TokenToBpt) {
                const limit = bnum(
                    poolPairData.balanceIn
                        .mul(this.MAX_RATIO)
                        .div(ONE)
                        .toString()
                );
                return scale(limit, -poolPairData.decimalsIn);
            } else if (linearPoolPairData.pairType === PairTypes.BptToToken) {
                // Limit is amount of BPT in for pool balance of tokenOut

                // Amount must be in human scale
                const balanceOutHuman = scale(
                    bnum(poolPairData.balanceOut.toString()),
                    -poolPairData.decimalsOut
                );

                const limit = _BPTInForExactTokenOut(
                    balanceOutHuman,
                    linearPoolPairData
                )
                    .times(bnum(this.ALMOST_ONE.toString()))
                    .div(bnum(ONE.toString()));
                return limit;
            } else return bnum(0); // LinearPool does not support TokenToToken
        } else {
            if (linearPoolPairData.pairType === PairTypes.TokenToBpt) {
                const limit = bnum(
                    poolPairData.balanceOut
                        .mul(this.MAX_RATIO)
                        .div(ONE)
                        .toString()
                );
                return scale(limit, -poolPairData.decimalsOut);
            } else if (linearPoolPairData.pairType === PairTypes.BptToToken) {
                const limit = bnum(
                    poolPairData.balanceOut
                        .mul(this.ALMOST_ONE)
                        .div(ONE)
                        .toString()
                );
                return scale(limit, -poolPairData.decimalsOut);
            } else return bnum(0); // LinearPool does not support TokenToToken
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        const T = this.tokens.find((t) => isSameAddress(t.address, token));
        if (!T) throw Error('Pool does not contain this token');
        T.balance = newBalance.toString();
    }

    _exactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return this._exactTokenInForBPTOut(poolPairData, amount, exact);
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return this._exactBPTInForTokenOut(poolPairData, amount, exact);
        } else return bnum(0); // LinearPool does not support TokenToToken
    }

    _exactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // poolPair balances are human readable so must be scaled before use
                const amt = SDK.LinearMath._calcBptOutPerMainIn(
                    scale(amount, poolPairData.decimalsIn),
                    bnum(poolPairData.balanceIn.toString()),
                    poolPairData.wrappedBalance,
                    bnum(poolPairData.balanceOut.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        rate: poolPairData.rate,
                        lowerTarget: bnum(poolPairData.target1.toString()),
                        upperTarget: bnum(poolPairData.target2.toString()),
                    }
                );
                // return human readable number
                return scale(amt, -poolPairData.decimalsOut);
            } catch (err) {
                return ZERO;
            }
        } else {
            return _exactTokenInForBPTOut(amount, poolPairData);
        }
    }

    // bug alert: exact and "not exact" differ more than they should
    _exactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // poolPair balances are human readable so must be scaled before use
                const amt = SDK.LinearMath._calcMainOutPerBptIn(
                    scale(amount, poolPairData.decimalsIn),
                    bnum(poolPairData.balanceOut.toString()),
                    poolPairData.wrappedBalance,
                    bnum(poolPairData.balanceIn.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        rate: poolPairData.rate,
                        lowerTarget: bnum(poolPairData.target1.toString()),
                        upperTarget: bnum(poolPairData.target2.toString()),
                    }
                );
                // return human readable number
                return scale(amt, -poolPairData.decimalsOut);
            } catch (err) {
                return ZERO;
            }
        } else {
            return _exactBPTInForTokenOut(amount, poolPairData);
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return this._tokenInForExactBPTOut(poolPairData, amount, exact);
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return this._BPTInForExactTokenOut(poolPairData, amount, exact);
        } else return bnum(0); // LinearPool does not support TokenToToken
    }

    _tokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // poolPair balances are human readable so must be scaled before use
                // in = main
                // out = BPT
                const amt = SDK.LinearMath._calcMainInPerBptOut(
                    scale(amount, poolPairData.decimalsOut),
                    bnum(poolPairData.balanceIn.toString()),
                    poolPairData.wrappedBalance,
                    bnum(poolPairData.balanceOut.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        rate: poolPairData.rate,
                        lowerTarget: bnum(poolPairData.target1.toString()),
                        upperTarget: bnum(poolPairData.target2.toString()),
                    }
                );
                // return human readable number
                return scale(amt, -poolPairData.decimalsIn);
            } catch (err) {
                return ZERO;
            }
        }
        return _tokenInForExactBPTOut(amount, poolPairData);
    }

    // bug alert: exact and "not exact" differ more than they should
    _BPTInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // poolPair balances are human readable so must be scaled before use
                // in = BPT
                // out = main
                const amt = SDK.LinearMath._calcBptInPerMainOut(
                    scale(amount, poolPairData.decimalsOut),
                    bnum(poolPairData.balanceOut.toString()),
                    poolPairData.wrappedBalance,
                    bnum(poolPairData.balanceIn.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        rate: poolPairData.rate,
                        lowerTarget: bnum(poolPairData.target1.toString()),
                        upperTarget: bnum(poolPairData.target2.toString()),
                    }
                );
                // return human readable number
                return scale(amt, -poolPairData.decimalsIn);
            } catch (err) {
                return ZERO;
            }
        }
        return _BPTInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return this._spotPriceAfterSwapExactTokenInForBPTOut(
                poolPairData,
                amount
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return this._spotPriceAfterSwapExactBPTInForTokenOut(
                poolPairData,
                amount
            );
        } else
            return _spotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                poolPairData
            );
    }

    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapExactTokenInForBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapExactBPTInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return this._spotPriceAfterSwapTokenInForExactBPTOut(
                poolPairData,
                amount
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return this._spotPriceAfterSwapBPTInForExactTokenOut(
                poolPairData,
                amount
            );
        } else
            return _spotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                poolPairData
            );
    }

    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapTokenInForExactBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapBPTInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return this._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                poolPairData,
                amount
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return this._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                poolPairData,
                amount
            );
        } else
            return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                poolPairData
            );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            return this._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                poolPairData,
                amount
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            return this._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                poolPairData,
                amount
            );
        } else
            return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                poolPairData
            );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}
