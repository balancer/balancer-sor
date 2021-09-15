import { BigNumber, ZERO } from '../utils/bignumber';
import { SwapTypes, NewPath } from '../types';
import { getOutputAmountSwap } from '../pools';

export function calculatePathLimits(
    paths: NewPath[],
    swapType: SwapTypes
): [NewPath[], BigNumber] {
    let maxLiquidityAvailable = ZERO;
    paths.forEach((path) => {
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
    let limit: BigNumber = ZERO;
    if (swapType === SwapTypes.SwapExactIn) {
        for (let i = 0; i < poolPairData.length; i++) {
            const poolLimit = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactIn
            );
            let pulledPoolLimit = poolLimit;
            for (let j = i; j > 0; j--) {
                pulledPoolLimit = getOutputAmountSwap(
                    path.pools[j - 1],
                    path.poolPairData[j - 1],
                    SwapTypes.SwapExactOut,
                    pulledPoolLimit
                );
            }
            if (pulledPoolLimit.lt(limit) || i === 0) {
                limit = pulledPoolLimit;
            }
        }
        if (limit.isZero()) return ZERO;
    } else {
        for (let i = 0; i < poolPairData.length; i++) {
            const poolLimit = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactOut
            );
            let pushedPoolLimit = poolLimit;
            for (let j = i + 1; j < poolPairData.length; j++) {
                pushedPoolLimit = getOutputAmountSwap(
                    path.pools[j],
                    path.poolPairData[j],
                    SwapTypes.SwapExactIn,
                    pushedPoolLimit
                );
            }
            if (pushedPoolLimit.lt(limit) || i === 0) {
                limit = pushedPoolLimit;
            }
        }
        if (limit.isZero()) return ZERO;
    }
    return limit;
}
