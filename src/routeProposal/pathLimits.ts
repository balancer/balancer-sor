import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';
import { SwapTypes, NewPath } from '../types';
import { getOutputAmountSwap } from '../pools';
import { ZERO } from '../utils/bignumber';

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
    let limit = ZERO;
    let index = 0;
    if (swapType === SwapTypes.SwapExactIn) {
        for (let i = 0; i < poolPairData.length; i++) {
            const poolLimit = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactIn
            );
            let pulledPoolLimit = poolLimit;
            let pulledIndex = i;
            for (let j = i; j > 0; j--) {
                pulledPoolLimit = getOutputAmountSwap(
                    path.pools[j - 1],
                    path.poolPairData[j - 1],
                    SwapTypes.SwapExactOut,
                    pulledPoolLimit
                );
                pulledIndex = j - 1;
            }
            if (pulledPoolLimit.lt(limit) || i === 0) {
                limit = pulledPoolLimit;
                index = pulledIndex;
            }
        }
        if (limit.isZero()) return Zero;
        return parseFixed(
            limit.dp(poolPairData[index].decimalsIn).toString(),
            poolPairData[index].decimalsIn
        );
    } else {
        for (let i = 0; i < poolPairData.length; i++) {
            const poolLimit = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactOut
            );
            let pushedPoolLimit = poolLimit;
            let pulledIndex = i;
            for (let j = i + 1; j < poolPairData.length; j++) {
                pushedPoolLimit = getOutputAmountSwap(
                    path.pools[j],
                    path.poolPairData[j],
                    SwapTypes.SwapExactIn,
                    pushedPoolLimit
                );
                pulledIndex = j;
            }
            if (pushedPoolLimit.lt(limit) || i === 0) {
                limit = pushedPoolLimit;
                index = pulledIndex;
            }
        }
        if (limit.isZero()) return Zero;
        return parseFixed(
            limit.dp(poolPairData[index].decimalsOut).toString(),
            poolPairData[index].decimalsOut
        );
    }
}
