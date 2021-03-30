import { bnum } from './bmath';
import { BigNumber } from './utils/bignumber';

import {
    SwapTypes,
    PoolPairBase,
    NewPath,
    PoolBase,
    PoolTypes,
    PairTypes,
} from './types';
import { MAX_IN_RATIO, MAX_OUT_RATIO } from './bmath';

export function calculatePathLimits(
    paths: NewPath[],
    swapType: SwapTypes
): [NewPath[], BigNumber] {
    let maxLiquidityAvailable = bnum(0);
    paths.forEach(path => {
        path.limitAmount = getLimitAmountSwapForPath(path, swapType);
        if (path.limitAmount.isNaN()) throw 'path.limitAmount.isNaN';
        // console.log(path.limitAmount.toNumber())
        maxLiquidityAvailable = maxLiquidityAvailable.plus(path.limitAmount);
    });
    let sortedPaths = paths.sort((a, b) => {
        return b.limitAmount.minus(a.limitAmount).toNumber();
    });
    return [sortedPaths, maxLiquidityAvailable];
}

export function getLimitAmountSwap(
    poolPairData: PoolPairBase,
    swapType: SwapTypes
): BigNumber {
    // We multiply ratios by 10**-18 because we are in normalized space
    // so 0.5 should be 0.5 and not 500000000000000000
    // TODO: update bmath to use everything normalized
    if (swapType === SwapTypes.SwapExactIn) {
        return poolPairData.balanceIn.times(MAX_IN_RATIO.times(10 ** -18));
    } else {
        return poolPairData.balanceOut.times(MAX_OUT_RATIO.times(10 ** -18));
    }
}

export function getLimitAmountSwapForPath(
    path: NewPath,
    swapType: SwapTypes
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getLimitAmountSwap(poolPairData[0], swapType);
    } else if (poolPairData.length == 2) {
        if (swapType === SwapTypes.SwapExactIn) {
            let limitAmountSwap1 = getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            let limitAmountSwap2 = getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            let limitOutputAmountSwap1 = getOutputAmountSwap(
                path.pools[0],
                poolPairData[0],
                swapType,
                limitAmountSwap1
            );
            if (limitOutputAmountSwap1.gt(limitAmountSwap2))
                if (limitAmountSwap2.isZero())
                    // This means second hop is limiting the path
                    return bnum(0);
                // this is necessary to avoid return NaN
                else
                    return getOutputAmountSwap(
                        path.pools[0],
                        poolPairData[0],
                        SwapTypes.SwapExactOut,
                        limitAmountSwap2
                    );
            // This means first hop is limiting the path
            else return limitAmountSwap1;
        } else {
            let limitAmountSwap1 = getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            let limitAmountSwap2 = getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            let limitOutputAmountSwap2 = getOutputAmountSwap(
                path.pools[1],
                poolPairData[1],
                swapType,
                limitAmountSwap2
            );
            if (limitOutputAmountSwap2.gt(limitAmountSwap1))
                // This means first hop is limiting the path
                return getOutputAmountSwap(
                    path.pools[1],
                    poolPairData[1],
                    SwapTypes.SwapExactIn,
                    limitAmountSwap1
                );
            // This means second hop is limiting the path
            else return limitAmountSwap2;
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getOutputAmountSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    let poolType = poolPairData.poolType;
    let pairType = poolPairData.pairType;
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return bnum(0);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bnum(0);
        }
        if (amount.gte(poolPairData.balanceOut)) return bnum('Infinity');
    }
    if (swapType === SwapTypes.SwapExactIn) {
        if (poolType === PoolTypes.Weighted) {
            if (pairType === PairTypes.TokenToToken) {
                return pool._exactTokenInForTokenOut(amount);
            } else if (pairType === PairTypes.TokenToBpt) {
                return pool._exactTokenInForBPTOut(amount);
            } else if (pairType == PairTypes.BptToToken) {
                return pool._exactBPTInForTokenOut(amount);
            }
        } else if (poolType === PoolTypes.Stable) {
            if (pairType === PairTypes.TokenToToken) {
                return pool._exactTokenInForTokenOut(amount);
            } else if (pairType === PairTypes.TokenToBpt) {
                return pool._exactTokenInForBPTOut(amount);
            } else if (pairType === PairTypes.BptToToken) {
                return pool._exactBPTInForTokenOut(amount);
            }
        }
    } else {
        if (poolType === PoolTypes.Weighted) {
            if (pairType === PairTypes.TokenToToken) {
                return pool._tokenInForExactTokenOut(amount);
            } else if (pairType === PairTypes.TokenToBpt) {
                return pool._tokenInForExactBPTOut(amount);
            } else if (pairType === PairTypes.BptToToken) {
                return pool._BPTInForExactTokenOut(amount);
            }
        } else if (poolType === PoolTypes.Stable) {
            if (pairType === PairTypes.TokenToToken) {
                return pool._tokenInForExactTokenOut(amount);
            } else if (pairType === PairTypes.TokenToBpt) {
                return pool._tokenInForExactBPTOut(amount);
            } else if (pairType === PairTypes.BptToToken) {
                return pool._BPTInForExactTokenOut(amount);
            }
        }
    }
}
