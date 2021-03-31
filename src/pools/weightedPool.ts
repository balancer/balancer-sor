import { BigNumber } from '../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    TypesForSwap,
    PairTypes,
    PoolPairBase,
} from '../types';
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
} from '../poolMath/weightedMath';
import { getAddress } from '@ethersproject/address';
import { bnum, scale } from '../bmath';
import * as weightedSolidity from '../solidityHelpers/pools/weighted';
import { FixedPointNumber } from '../solidityHelpers/math/FixedPointNumber';

export interface WeightedPoolToken {
    address: string;
    balance: string;
    decimals: string | number;
    denormWeight?: string;
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
    typeForSwap: TypesForSwap;
    id: string;
    swapFee: string;
    totalShares: string;
    tokens: WeightedPoolToken[];
    totalWeight: string;
    tokensList: string[];
    poolPairData: WeightedPoolPairData;

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
        this.totalWeight = totalWeight;
        this.tokensList = tokensList;
    }

    setTypeForSwap(type: TypesForSwap) {
        this.typeForSwap = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): void {
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
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
            weightIn = bnum(1); // Not used but has to be defined
        } else if (tokenOut == this.id) {
            pairType = PairTypes.TokenToBpt;
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
            weightIn = bnum(tI.denormWeight).div(bnum(this.totalWeight));
        }
        if (pairType != PairTypes.TokenToBpt) {
            let tokenIndexOut = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
            weightOut = bnum(tO.denormWeight).div(bnum(this.totalWeight));
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

        this.poolPairData = poolPairData;
    }

    getNormalizedLiquidity() {
        if (this.poolPairData.pairType == PairTypes.TokenToToken) {
            return this.poolPairData.balanceOut
                .times(this.poolPairData.weightIn)
                .div(
                    this.poolPairData.weightIn.plus(this.poolPairData.weightOut)
                );
        } else if (this.poolPairData.pairType == PairTypes.TokenToBpt) {
            return this.poolPairData.balanceOut; // Liquidity in tokenOut is balanceBpt
        } else if (this.poolPairData.pairType == PairTypes.BptToToken) {
            return this.poolPairData.balanceOut.div(
                bnum(1).plus(this.poolPairData.weightOut)
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

        // Also need to update poolPairData if relevant
        if (this.poolPairData.tokenIn === token)
            this.poolPairData.balanceIn = newBalance;
        else if (this.poolPairData.tokenOut === token)
            this.poolPairData.balanceOut = newBalance;
    }

    _exactTokenInForTokenOut(amount: BigNumber): BigNumber {
        return _exactTokenInForTokenOut(amount, this.poolPairData);
    }

    _exactTokenInForBPTOut(amount: BigNumber): BigNumber {
        return _exactTokenInForBPTOut(amount, this.poolPairData);
    }

    _exactBPTInForTokenOut(amount: BigNumber): BigNumber {
        return _exactBPTInForTokenOut(amount, this.poolPairData);
    }

    _tokenInForExactTokenOut(amount: BigNumber): BigNumber {
        return _tokenInForExactTokenOut(amount, this.poolPairData);
    }

    _tokenInForExactBPTOut(amount: BigNumber): BigNumber {
        return _tokenInForExactBPTOut(amount, this.poolPairData);
    }

    _BPTInForExactTokenOut(amount: BigNumber): BigNumber {
        return _exactBPTInForTokenOut(amount, this.poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(amount: BigNumber): BigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            this.poolPairData
        );
    }

    _spotPriceAfterSwapExactTokenInForBPTOut(amount: BigNumber): BigNumber {
        return _spotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            this.poolPairData
        );
    }

    _spotPriceAfterSwapExactBPTInForTokenOut(amount: BigNumber): BigNumber {
        return _spotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            this.poolPairData
        );
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(amount: BigNumber): BigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            this.poolPairData
        );
    }

    _spotPriceAfterSwapTokenInForExactBPTOut(amount: BigNumber): BigNumber {
        return _spotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            this.poolPairData
        );
    }

    _spotPriceAfterSwapBPTInForExactTokenOut(amount: BigNumber): BigNumber {
        return _spotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            this.poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            this.poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            this.poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            this.poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            this.poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            this.poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            this.poolPairData
        );
    }

    _evmoutGivenIn(amount: BigNumber): BigNumber {
        const amt = weightedSolidity._outGivenIn(
            new FixedPointNumber(
                scale(this.poolPairData.balanceIn, this.poolPairData.decimalsIn)
            ),
            new FixedPointNumber(scale(this.poolPairData.weightIn, 18)),
            new FixedPointNumber(
                scale(
                    this.poolPairData.balanceOut,
                    this.poolPairData.decimalsOut
                )
            ),
            new FixedPointNumber(scale(this.poolPairData.weightOut, 18)),
            new FixedPointNumber(scale(amount, this.poolPairData.decimalsIn)),
            new FixedPointNumber(scale(this.poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evmexactTokenInForBPTOut(amount: BigNumber): BigNumber {
        const amt = weightedSolidity._exactTokenInForBPTOut(
            new FixedPointNumber(
                scale(this.poolPairData.balanceIn, this.poolPairData.decimalsIn)
            ),
            new FixedPointNumber(scale(this.poolPairData.weightIn, 18)),
            new FixedPointNumber(scale(amount, this.poolPairData.decimalsIn)),
            new FixedPointNumber(scale(this.poolPairData.balanceOut, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(this.poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evmexactBPTInForTokenOut(amount: BigNumber): BigNumber {
        const amt = weightedSolidity._exactBPTInForTokenOut(
            new FixedPointNumber(
                scale(
                    this.poolPairData.balanceOut,
                    this.poolPairData.decimalsOut
                )
            ),
            new FixedPointNumber(scale(this.poolPairData.weightOut, 18)),
            new FixedPointNumber(scale(amount, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(this.poolPairData.balanceIn, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(this.poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evminGivenOut(amount: BigNumber): BigNumber {
        const amt = weightedSolidity._inGivenOut(
            new FixedPointNumber(
                scale(this.poolPairData.balanceIn, this.poolPairData.decimalsIn)
            ),
            new FixedPointNumber(scale(this.poolPairData.weightIn, 18)),
            new FixedPointNumber(
                scale(
                    this.poolPairData.balanceOut,
                    this.poolPairData.decimalsOut
                )
            ),
            new FixedPointNumber(scale(this.poolPairData.weightOut, 18)),
            new FixedPointNumber(scale(amount, this.poolPairData.decimalsOut)),
            new FixedPointNumber(scale(this.poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evmtokenInForExactBPTOut(amount: BigNumber): BigNumber {
        const amt = weightedSolidity._tokenInForExactBPTOut(
            new FixedPointNumber(
                scale(this.poolPairData.balanceIn, this.poolPairData.decimalsIn)
            ),
            new FixedPointNumber(scale(this.poolPairData.weightIn, 18)),
            new FixedPointNumber(scale(amount, 18)),
            new FixedPointNumber(scale(this.poolPairData.balanceOut, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(this.poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }

    _evmbptInForExactTokenOut(amount: BigNumber): BigNumber {
        const amt = weightedSolidity._exactBPTInForTokenOut(
            new FixedPointNumber(
                scale(
                    this.poolPairData.balanceOut,
                    this.poolPairData.decimalsOut
                )
            ),
            new FixedPointNumber(scale(this.poolPairData.weightOut, 18)),
            new FixedPointNumber(scale(amount, this.poolPairData.decimalsOut)),
            new FixedPointNumber(scale(this.poolPairData.balanceIn, 18)), // BPT is always 18 decimals
            new FixedPointNumber(scale(this.poolPairData.swapFee, 18))
        );

        return bnum(amt.toString());
    }
}
