import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PairTypes,
    PoolPairBase,
    SwapTypes,
} from '../../types';
import { getAddress } from '@ethersproject/address';
import { bnum, MAX_IN_RATIO, MAX_OUT_RATIO } from '../../bmath';
import {
    _exactTokenInForTokenOut,
    _tokenInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
} from './elementMath';

export interface ElementPoolToken {
    address: string;
    balance: string;
    decimals: string | number;
}

export interface ElementPoolPairData extends PoolPairBase {
    id: string;
    poolType: PoolTypes;
    pairType: PairTypes;
    tokenIn: string;
    tokenOut: string;
    balanceIn: BigNumber;
    balanceOut: BigNumber;
    swapFee: BigNumber;
    decimalsIn: number;
    decimalsOut: number;
    // Element specific fields
    lpShares: BigNumber;
    time: BigNumber;
    principalToken: string;
    baseToken: string;
}

export class ElementPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Element;
    swapPairType: SwapPairType;
    id: string;
    swapFee: string;
    totalShares: string;
    tokens: ElementPoolToken[];
    tokensList: string[];
    // Element specific
    lpShares: BigNumber;
    time: BigNumber;
    principalToken: string;
    baseToken: string;

    constructor(
        id: string,
        swapFee: string,
        totalShares: string,
        tokens: ElementPoolToken[],
        tokensList: string[],
        lpShares: BigNumber,
        time: BigNumber,
        principalToken: string,
        baseToken: string
    ) {
        this.id = id;
        this.swapFee = swapFee;
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.lpShares = lpShares;
        this.time = time;
        this.principalToken = principalToken;
        this.baseToken = baseToken;
    }

    setTypeForSwap(type: SwapPairType) {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): ElementPoolPairData {
        let pairType: PairTypes;
        let tI: ElementPoolToken;
        let tO: ElementPoolToken;
        let balanceIn: string;
        let balanceOut: string;
        let decimalsOut: string | number;
        let decimalsIn: string | number;
        let tokenIndexIn: number;
        let tokenIndexOut: number;

        // Check if tokenIn is the pool token itself (BPT)
        if (tokenIn == this.id) {
            pairType = PairTypes.BptToToken;
            balanceIn = this.totalShares;
            decimalsIn = '18'; // Not used but has to be defined
        } else if (tokenOut == this.id) {
            pairType = PairTypes.TokenToBpt;
            balanceOut = this.totalShares;
            decimalsOut = '18'; // Not used but has to be defined
        } else {
            pairType = PairTypes.TokenToToken;
        }

        if (pairType != PairTypes.BptToToken) {
            tokenIndexIn = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenIn)
            );
            if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
            tI = this.tokens[tokenIndexIn];
            balanceIn = tI.balance;
            decimalsIn = tI.decimals;
        }
        if (pairType != PairTypes.TokenToBpt) {
            tokenIndexOut = this.tokens.findIndex(
                t => getAddress(t.address) === getAddress(tokenOut)
            );
            if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
            tO = this.tokens[tokenIndexOut];
            balanceOut = tO.balance;
            decimalsOut = tO.decimals;
        }

        // We already add the virtual LP shares to the right balance
        let bnumBalanceIn = bnum(balanceIn);
        let bnumBalanceOut = bnum(balanceOut);
        if (tokenIn == this.principalToken) {
            bnumBalanceIn = bnumBalanceIn.plus(bnum(this.lpShares));
        } else if (tokenOut == this.principalToken) {
            bnumBalanceOut = bnumBalanceOut.plus(bnum(this.lpShares));
        }
        const poolPairData: ElementPoolPairData = {
            id: this.id,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            principalToken: this.principalToken,
            baseToken: this.baseToken,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: bnumBalanceIn,
            balanceOut: bnumBalanceOut,
            swapFee: bnum(this.swapFee),
            lpShares: bnum(this.lpShares),
            time: bnum(this.time),
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: ElementPoolPairData): BigNumber {
        // TO DO This needs added
        return bnum(0);
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): BigNumber {
        // We multiply ratios by 10**-18 because we are in normalized space
        // so 0.5 should be 0.5 and not 500000000000000000
        // TODO: update bmath to use everything normalized
        if (swapType === SwapTypes.SwapExactIn) {
            return poolPairData.balanceIn.times(MAX_IN_RATIO.times(10 ** -18));
        } else {
            return poolPairData.balanceOut.times(
                MAX_OUT_RATIO.times(10 ** -18)
            );
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
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _exactTokenInForTokenOut(amount, poolPairData);
    }

    _exactTokenInForBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _exactBPTInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _tokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _tokenInForExactTokenOut(amount, poolPairData);
    }

    _tokenInForExactBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _BPTInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        throw 'Element pool does not support SOR add/remove liquidity';
        return bnum(-1);
    }

    // TODO - These need updated with real maths
    _evmoutGivenIn: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmexactTokenInForBPTOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmexactBPTInForTokenOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evminGivenOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmtokenInForExactBPTOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
    _evmbptInForExactTokenOut: (
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ) => BigNumber;
}
