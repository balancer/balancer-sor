import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { SwapTypes, NewPath } from '../types';
import { getOutputAmountSwap } from '../pools';

export function calculatePathLimits(
    paths: NewPath[],
    swapType: SwapTypes
): [NewPath[], BigNumber] {
    let maxLiquidityAvailable = Zero;
    paths.forEach((path) => {
        // Original parsedPoolPairForPath here but this has already been done.
        path.limitAmount = getLimitAmountSwapForPath(path, swapType);
        // if (path.limitAmount.isNaN()) throw 'path.limitAmount.isNaN';
        // console.log(path.limitAmount.toNumber())
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
    if (poolPairData.length == 1) {
        if (swapType === SwapTypes.SwapExactIn) {
            return parseFixed(
                path.pools[0]
                    .getLimitAmountSwap(poolPairData[0], swapType)
                    .dp(poolPairData[0].decimalsIn)
                    .toString(),
                poolPairData[0].decimalsIn
            );
        } else {
            return parseFixed(
                path.pools[0]
                    .getLimitAmountSwap(poolPairData[0], swapType)
                    .dp(poolPairData[0].decimalsOut)
                    .toString(),
                poolPairData[0].decimalsOut
            );
        }
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
                    return Zero;
                // this is necessary to avoid return NaN
                else
                    return parseFixed(
                        getOutputAmountSwap(
                            path.pools[0],
                            path.poolPairData[0],
                            SwapTypes.SwapExactOut,
                            limitAmountSwap2
                        )
                            .dp(poolPairData[0].decimalsIn)
                            .toString(),
                        poolPairData[0].decimalsIn
                    );
            // This means first hop is limiting the path
            else
                return parseFixed(
                    limitAmountSwap1.toString(),
                    poolPairData[0].decimalsIn
                );
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
                return parseFixed(
                    getOutputAmountSwap(
                        path.pools[1],
                        path.poolPairData[1],
                        SwapTypes.SwapExactIn,
                        limitAmountSwap1
                    )
                        .dp(poolPairData[1].decimalsOut)
                        .toString(),
                    poolPairData[1].decimalsOut
                );
            // This means second hop is limiting the path
            else
                return parseFixed(
                    limitAmountSwap2.dp(poolPairData[1].decimalsOut).toString(),
                    poolPairData[1].decimalsOut
                );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}
