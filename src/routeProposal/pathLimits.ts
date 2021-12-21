import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { SwapTypes, NewPath } from '../types';
import { getOutputAmountSwap } from '../pools';
import { bnum, ZERO, BigNumber as OldBigNumber } from '../utils/bignumber';

export function calculatePathLimits(
    paths: NewPath[],
    swapType: SwapTypes
): [NewPath[], BigNumber] {
    let maxLiquidityAvailable = Zero;
    paths.forEach((path) => {
        // Original parsedPoolPairForPath here but this has already been done.
        path.limitAmount = getLimitAmountSwapForPath(path, swapType);
        // if (path.limitAmount.isNaN()) throw 'path.limitAmount.isNaN';
        maxLiquidityAvailable = maxLiquidityAvailable.add(path.limitAmount);
    });
    const sortedPaths = paths.sort((a, b) => {
        return b.limitAmount.gt(a.limitAmount) ? 1 : -1;
    });
    return [sortedPaths, maxLiquidityAvailable];
}

export function getLimitAmountSwapForPath(
    path: NewPath,
    swapType: SwapTypes
): BigNumber {
    const poolPairData = path.poolPairData;
    let limit: OldBigNumber;
    if (swapType === SwapTypes.SwapExactIn) {
        limit = path.pools[poolPairData.length - 1].getLimitAmountSwap(
            poolPairData[poolPairData.length - 1],
            SwapTypes.SwapExactIn
        );

        for (let i = poolPairData.length - 2; i >= 0; i--) {
            const poolLimitExactIn = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactIn
            );
            const poolLimitExactOut = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactOut
            );
            if (poolLimitExactOut.lte(limit)) {
                limit = poolLimitExactIn;
            } else {
                const pulledLimit = getOutputAmountSwap(
                    path.pools[i],
                    path.poolPairData[i],
                    SwapTypes.SwapExactOut,
                    limit
                );
                limit = OldBigNumber.min(pulledLimit, poolLimitExactIn);
            }
        }
        if (limit.isZero()) return Zero;
        const result = parseFixed(
            limit.dp(poolPairData[0].decimalsIn).toString(),
            poolPairData[0].decimalsIn
        );
        return result;
    } else {
        limit = path.pools[0].getLimitAmountSwap(
            poolPairData[0],
            SwapTypes.SwapExactOut
        );
        for (let i = 1; i < poolPairData.length; i++) {
            const poolLimitExactIn = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactIn
            );
            const poolLimitExactOut = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactOut
            );
            if (poolLimitExactIn.lte(limit)) {
                limit = poolLimitExactOut;
            } else {
                const pushedLimit = getOutputAmountSwap(
                    path.pools[i],
                    path.poolPairData[i],
                    SwapTypes.SwapExactIn,
                    limit
                );
                limit = OldBigNumber.min(pushedLimit, poolLimitExactOut);
            }
        }
        if (limit.isZero()) return Zero;
        return parseFixed(
            limit
                .dp(poolPairData[poolPairData.length - 1].decimalsOut)
                .toString(),
            poolPairData[poolPairData.length - 1].decimalsOut
        );
    }
}
