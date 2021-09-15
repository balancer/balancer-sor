import { BigNumber } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import { getAddress } from '@ethersproject/address';
import { bnum } from '../../utils/bignumber';
import {
    _exactTokenInForTokenOut,
    _tokenInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    getTimeTillExpiry,
} from './elementMath';

type ElementPoolToken = Pick<SubgraphToken, 'address' | 'balance' | 'decimals'>;

export type ElementPoolPairData = PoolPairBase & {
    totalShares: BigNumber;
    expiryTime: number;
    unitSeconds: number;
    principalToken: string;
    baseToken: string;
    currentBlockTimestamp: number;
};

export class ElementPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Element;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    swapFee: string;
    totalShares: string;
    tokens: ElementPoolToken[];
    tokensList: string[];
    // Element specific
    expiryTime: number;
    unitSeconds: number;
    principalToken: string;
    baseToken: string;
    currentBlockTimestamp: number;

    static fromPool(pool: SubgraphPoolBase): ElementPool {
        if (!pool.expiryTime) throw new Error('ElementPool missing expiryTime');
        if (!pool.unitSeconds)
            throw new Error('ElementPool missing unitSeconds');
        if (!pool.principalToken)
            throw new Error('ElementPool missing principalToken');

        if (!pool.baseToken) throw new Error('ElementPool missing baseToken');

        return new ElementPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.expiryTime,
            pool.unitSeconds,
            pool.principalToken,
            pool.baseToken
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: ElementPoolToken[],
        tokensList: string[],
        expiryTime: number,
        unitSeconds: number,
        principalToken: string,
        baseToken: string
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = swapFee;
        this.totalShares = totalShares;
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.expiryTime = expiryTime;
        this.unitSeconds = unitSeconds;
        this.principalToken = principalToken;
        this.baseToken = baseToken;
        this.currentBlockTimestamp = 0;
    }

    setCurrentBlockTimestamp(timestamp: number): void {
        this.currentBlockTimestamp = timestamp;
    }

    setTypeForSwap(type: SwapPairType): void {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): ElementPoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        // We already add the virtual LP shares to the right balance
        let bnumBalanceIn = bnum(balanceIn);
        let bnumBalanceOut = bnum(balanceOut);
        if (tokenIn == this.principalToken) {
            bnumBalanceIn = bnumBalanceIn.plus(bnum(this.totalShares));
        } else if (tokenOut == this.principalToken) {
            bnumBalanceOut = bnumBalanceOut.plus(bnum(this.totalShares));
        }
        const poolPairData: ElementPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            principalToken: this.principalToken,
            baseToken: this.baseToken,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: bnumBalanceIn,
            balanceOut: bnumBalanceOut,
            swapFee: bnum(this.swapFee),
            totalShares: bnum(this.totalShares),
            expiryTime: this.expiryTime,
            unitSeconds: this.unitSeconds,
            currentBlockTimestamp: this.currentBlockTimestamp,
        };

        return poolPairData;
    }

    // Normalized liquidity is an abstract term that can be thought of the
    // inverse of the slippage. It is proportional to the token balances in the
    // pool but also depends on the shape of the invariant curve.
    // As a standard, we define normalized liquidity in tokenOut
    getNormalizedLiquidity(poolPairData: ElementPoolPairData): BigNumber {
        // This could be refined by using the inverse of the slippage, but
        // in practice this won't have a big impact in path selection for
        // multi-hops so not a big priority
        return poolPairData.balanceOut;
    }

    getLimitAmountSwap(
        poolPairData: ElementPoolPairData,
        swapType: SwapTypes
    ): BigNumber {
        const MAX_OUT_RATIO = bnum(0.3);
        if (swapType === SwapTypes.SwapExactIn) {
            // "Ai < (Bi**(1-t)+Bo**(1-t))**(1/(1-t))-Bi" must hold in order for
            // base of root to be non-negative
            const Bi = poolPairData.balanceIn.toNumber();
            const Bo = poolPairData.balanceOut.toNumber();
            const t = getTimeTillExpiry(
                this.expiryTime,
                this.currentBlockTimestamp,
                this.unitSeconds
            );
            return bnum((Bi ** (1 - t) + Bo ** (1 - t)) ** (1 / (1 - t)) - Bi);
        } else {
            return poolPairData.balanceOut.times(MAX_OUT_RATIO);
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (this.address == token) {
            this.totalShares = newBalance.toString();
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => t.address === token);
            if (!T) throw Error('Pool does not contain this token');
            T.balance = newBalance.toString();
        }
    }

    _exactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber,
        exact: boolean
    ): BigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _exactTokenInForTokenOut(amount, poolPairData);
    }

    _tokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber,
        exact: boolean
    ): BigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _tokenInForExactTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: BigNumber
    ): BigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}
