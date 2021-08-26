import { BigNumber, ZERO } from '../utils/bignumber';
import { SwapTypes, NewPath } from '../types';
import { getOutputAmountSwap } from '../pools';

export function calculatePathLimits(
    paths: NewPath[],
    swapType: SwapTypes
): [NewPath[], BigNumber] {
    let maxLiquidityAvailable = ZERO;
    paths.forEach(path => {
        // Original parsedPoolPairForPath here but this has already been done.
        path.limitAmount = getLimitAmountSwapForPath(path, swapType);
        if (path.limitAmount.isNaN()) throw 'path.limitAmount.isNaN';
        // console.log(path.limitAmount.toNumber())
        maxLiquidityAvailable = maxLiquidityAvailable.plus(path.limitAmount);
    });
    const sortedPaths = paths.sort((a, b) => {
        return b.limitAmount.minus(a.limitAmount).toNumber();
    });
    return [sortedPaths, maxLiquidityAvailable];
}

export function getLimitAmountSwapForPath(
    path: NewPath,
    swapType: SwapTypes
): BigNumber {
    const poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return path.pools[0].getLimitAmountSwap(poolPairData[0], swapType);
    } else if (poolPairData.length == 2) {
        if (swapType === SwapTypes.SwapExactIn) {
            const limitAmountSwap1 = path.pools[0].getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            const limitAmountSwap2 = path.pools[1].getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            const limitOutputAmountSwap1 = getOutputAmountSwap(
                path.pools[0],
                path.poolPairData[0],
                swapType,
                limitAmountSwap1
            );
            if (limitOutputAmountSwap1.gt(limitAmountSwap2))
                if (limitAmountSwap2.isZero())
                    // This means second hop is limiting the path
                    return ZERO;
                // this is necessary to avoid return NaN
                else
                    return getOutputAmountSwap(
                        path.pools[0],
                        path.poolPairData[0],
                        SwapTypes.SwapExactOut,
                        limitAmountSwap2
                    );
            // This means first hop is limiting the path
            else return limitAmountSwap1;
        } else {
            const limitAmountSwap1 = path.pools[0].getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            const limitAmountSwap2 = path.pools[1].getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            const limitOutputAmountSwap2 = getOutputAmountSwap(
                path.pools[1],
                path.poolPairData[1],
                swapType,
                limitAmountSwap2
            );
            if (limitOutputAmountSwap2.gt(limitAmountSwap1))
                // This means first hop is limiting the path
                return getOutputAmountSwap(
                    path.pools[1],
                    path.poolPairData[1],
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
