import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { isSameAddress } from '../../utils';
import { BigNumber as OldBigNumber, bnum, ZERO } from '../../utils/bignumber';
import {
    PoolBase,
    PoolTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import { getAddress } from '@ethersproject/address';
import {
    _exactTokenInForTokenOut,
    _tokenInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    getTimeTillExpiry,
} from './elementMath';
import { universalNormalizedLiquidity } from '../liquidity';

type ElementPoolToken = Pick<SubgraphToken, 'address' | 'balance' | 'decimals'>;

export type ElementPoolPairData = PoolPairBase & {
    totalShares: BigNumber;
    expiryTime: number;
    unitSeconds: number;
    principalToken: string;
    baseToken: string;
    currentBlockTimestamp: number;
};

export class ElementPool implements PoolBase<ElementPoolPairData> {
    poolType: PoolTypes = PoolTypes.Element;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
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
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
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

    parsePoolPairData(tokenIn: string, tokenOut: string): ElementPoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const decimalsIn = tI.decimals;

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const decimalsOut = tO.decimals;

        // We already add the virtual LP shares to the right balance
        const realBalanceIn = parseFixed(tI.balance, decimalsIn);
        const realBalanceOut = parseFixed(tO.balance, decimalsOut);
        let balanceIn = realBalanceIn;
        let balanceOut = realBalanceOut;
        if (tokenIn == this.principalToken) {
            balanceIn = realBalanceIn.add(this.totalShares);
        } else if (tokenOut == this.principalToken) {
            balanceOut = realBalanceOut.add(this.totalShares);
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
            balanceIn,
            balanceOut,
            swapFee: this.swapFee,
            totalShares: this.totalShares,
            expiryTime: this.expiryTime,
            unitSeconds: this.unitSeconds,
            currentBlockTimestamp: this.currentBlockTimestamp,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: ElementPoolPairData): OldBigNumber {
        return universalNormalizedLiquidity(
            this._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                ZERO
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: ElementPoolPairData,
        swapType: SwapTypes
    ): OldBigNumber {
        const MAX_OUT_RATIO = parseFixed('0.3', 18);
        if (swapType === SwapTypes.SwapExactIn) {
            // "Ai < (Bi**(1-t)+Bo**(1-t))**(1/(1-t))-Bi" must hold in order for
            // base of root to be non-negative
            const Bi = parseFloat(
                formatFixed(poolPairData.balanceIn, poolPairData.decimalsIn)
            );
            const Bo = parseFloat(
                formatFixed(poolPairData.balanceOut, poolPairData.decimalsOut)
            );
            const t = getTimeTillExpiry(
                this.expiryTime,
                this.currentBlockTimestamp,
                this.unitSeconds
            );
            return bnum((Bi ** (1 - t) + Bo ** (1 - t)) ** (1 / (1 - t)) - Bi);
        } else {
            return bnum(
                formatFixed(
                    poolPairData.balanceOut.mul(MAX_OUT_RATIO).div(ONE),
                    poolPairData.decimalsOut
                )
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

    _exactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _exactTokenInForTokenOut(amount, poolPairData);
    }

    _tokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _tokenInForExactTokenOut(amount, poolPairData);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // Missing maths for this
        return new Array(this.tokens.length).fill(Zero);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        // Missing maths for this
        return Zero;
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _spotPriceAfterSwapExactTokenInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _spotPriceAfterSwapTokenInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: ElementPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: ElementPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        poolPairData.currentBlockTimestamp = this.currentBlockTimestamp;
        return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}
