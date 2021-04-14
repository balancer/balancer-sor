import { getAddress } from '@ethersproject/address';
import { bnum, scale } from '../../bmath';
import { BigNumber } from '../../utils/bignumber';
import * as weightedSolidity from './weightedMathEvm';
import { FixedPointNumber } from '../../math/FixedPointNumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    PoolPairDictionary,
} from '../../types';
import {
    _exactTokenInForTokenOut,
    _exactTokenInForBPTOut,
    _exactBPTInForTokenOut,
    _tokenInForExactTokenOut,
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
} from './weightedMath';

export interface WeightedPoolToken {
    address: string;
    balance: string;
    decimals: string | number;
    weight?: string;
}

export interface WeightedPoolPairData extends PoolPairBase {
    id: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    weightIn: BigNumber; // Weights are only defined for weighted pools
    weightOut: BigNumber; // Weights are only defined for weighted pools
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
}

export class WeightedPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Weighted;
    swapPairType: SwapPairType;
    id: string;
    swapFee: string;
    totalShares: string;
    tokens: WeightedPoolToken[];
    totalWeight: string;
    tokensList: string[];

    constructor(
        id: string,
        swapFee: string,
        totalWeight: string,
        totalShares: string,
        tokens: WeightedPoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.swapFee = swapFee;
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.totalWeight = totalWeight;
    }

    setTypeForSwap(type: SwapPairType) {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): WeightedPoolPairData {
        let pairType: PairTypes;
        let tI: WeightedPoolToken;
        let tO: WeightedPoolToken;
        let balanceIn: string;
        let balanceOut: string;
        let decimalsOut: string | number;
        let decimalsIn: string | number;
        let weightIn: BigNumber;
        let weightOut: BigNumber;

        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn == this.id) {
            pairType = PairTypes.BptToToken;
            if (this.totalShares === undefined)
                throw 'Pool missing totalShares field';
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
            weightIn = bnum(1); // Not used but has to be defined
        } else if (tokenOut == this.id) {
            pairType = PairTypes.TokenToBpt;
            if (this.totalShares === undefined)
                throw 'Pool missing totalShares field';
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
            weightOut = bnum(1); // Not used but has to be defined
        } else {
            pairType = PairTypes.TokenToToken;
        }

        if (pairType != PairTypes.BptToToken) {
            let tokenIndexIn = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenIn)
            );
            if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
            tI = this.tokens[tokenIndexIn];
            balanceIn = tI.balance;
            decimalsIn = tI.decimals;
            weightIn = bnum(tI.weight).div(bnum(this.totalWeight));
        }
        if (pairType != PairTypes.TokenToBpt) {
            let tokenIndexOut = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
            weightOut = bnum(tO.weight).div(bnum(this.totalWeight));
        }

        const poolPairData: WeightedPoolPairData = {
            id: this.id,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: bnum(balanceIn),
            balanceOut: bnum(balanceOut),
            weightIn: weightIn,
            weightOut: weightOut,
            swapFee: bnum(this.swapFee),
        };

        return poolPairData;
    }

    // Normalized liquidity is an abstract term that can be thought of the
    // inverse of the slippage. It is proportional to the token balances in the
    // pool but also depends on the shape of the invariant curve.
    // As a standard, we define normalized liquidity in tokenOut
    getNormalizedLiquidity(poolPairData: WeightedPoolPairData) {
        if (poolPairData.pairType == PairTypes.TokenToToken) {
            return poolPairData.balanceOut
                .times(poolPairData.weightIn)
                .div(poolPairData.weightIn.plus(poolPairData.weightOut));
        } else if (poolPairData.pairType == PairTypes.TokenToBpt) {
            return poolPairData.balanceOut; // Liquidity in tokenOut is totalShares
        } else if (poolPairData.pairType == PairTypes.BptToToken) {
            return poolPairData.balanceOut.div(
                bnum(1).plus(poolPairData.weightOut)
            ); // Liquidity in tokenOut is Bo/wo
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (this.id == token) {
            this.totalShares = newBalance.toString();
        } else {
            // token is underlying in the pool
            const T = this.tokens.find(t => t.address === token);
            T.balance = newBalance.toString();
        }
    }

    _exactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactTokenInForTokenOut(amount, poolPairData);
    }

    _exactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactTokenInForBPTOut(amount, poolPairData);
    }

    _exactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactBPTInForTokenOut(amount, poolPairData);
    }

    _tokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _tokenInForExactTokenOut(amount, poolPairData);
    }

    _tokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _tokenInForExactBPTOut(amount, poolPairData);
    }

    _BPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _BPTInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactTokenInForBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactBPTInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapTokenInForExactBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapBPTInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }

    _evmoutGivenIn(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        const amt = weightedSolidity._exactTokenInForTokenOut(
            new FixedPointNumber(
                scale(poolPairData.balanceIn, poolPairData.decimalsIn)
            ),
            new FixedPointNumber(scale(poolPairData.weightIn, 18)),
            new FixedPointNumber(
                scale(poolPairData.balanceOut, poolPairData.decimalsOut)
            ),
            new FixedPointNumber(scale(poolPairData.weightOut, 18)),
            new FixedPointNumber(scale(amount, poolPairData.decimalsIn)),
            new FixedPointNumber(scale(poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evmexactTokenInForBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        const amt = weightedSolidity._exactTokenInForBPTOut(
            new FixedPointNumber(
                scale(poolPairData.balanceIn, poolPairData.decimalsIn)
            ),
            new FixedPointNumber(scale(poolPairData.weightIn, 18)),
            new FixedPointNumber(scale(amount, poolPairData.decimalsIn)),
            new FixedPointNumber(scale(poolPairData.balanceOut, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evmexactBPTInForTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        const amt = weightedSolidity._exactBPTInForTokenOut(
            new FixedPointNumber(
                scale(poolPairData.balanceOut, poolPairData.decimalsOut)
            ),
            new FixedPointNumber(scale(poolPairData.weightOut, 18)),
            new FixedPointNumber(scale(amount, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(poolPairData.balanceIn, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evminGivenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        const amt = weightedSolidity._tokenInForExactTokenOut(
            new FixedPointNumber(
                scale(poolPairData.balanceIn, poolPairData.decimalsIn)
            ),
            new FixedPointNumber(scale(poolPairData.weightIn, 18)),
            new FixedPointNumber(
                scale(poolPairData.balanceOut, poolPairData.decimalsOut)
            ),
            new FixedPointNumber(scale(poolPairData.weightOut, 18)),
            new FixedPointNumber(scale(amount, poolPairData.decimalsOut)),
            new FixedPointNumber(scale(poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evmtokenInForExactBPTOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        const amt = weightedSolidity._tokenInForExactBPTOut(
            new FixedPointNumber(
                scale(poolPairData.balanceIn, poolPairData.decimalsIn)
            ),
            new FixedPointNumber(scale(poolPairData.weightIn, 18)),
            new FixedPointNumber(scale(amount, 18)),
            new FixedPointNumber(scale(poolPairData.balanceOut, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evmbptInForExactTokenOut(
        poolPairData: WeightedPoolPairData,
        amount: BigNumber
    ): BigNumber {
        const amt = weightedSolidity._bptInForExactTokenOut(
            new FixedPointNumber(
                scale(poolPairData.balanceOut, poolPairData.decimalsOut)
            ),
            new FixedPointNumber(scale(poolPairData.weightOut, 18)),
            new FixedPointNumber(scale(amount, poolPairData.decimalsOut)),
            new FixedPointNumber(scale(poolPairData.balanceIn, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }
}
