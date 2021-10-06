import { BigNumber as OldBigNumber, bnum, ZERO } from '../utils/bignumber';
import { getHighestLimitAmountsForPaths } from './helpersClass';
import { formatSwaps, optimizeSwapAmounts } from './sorClass';
import { NewPath, Swap, SwapTypes } from '../types';
import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { Zero } from '@ethersproject/constants';

export const getBestPaths = (
    paths: NewPath[],
    swapType: SwapTypes,
    totalSwapAmount: BigNumber,
    inputDecimals: number,
    outputDecimals: number,
    maxPools: number,
    costReturnToken: BigNumber
): [Swap[][], OldBigNumber, OldBigNumber, OldBigNumber] => {
    // No paths available or totalSwapAmount == 0, return empty solution
    if (paths.length == 0 || totalSwapAmount.isZero()) {
        return [[], ZERO, ZERO, ZERO];
    }

    // Before we start the main loop, we first check if there is enough liquidity for this totalSwapAmount
    const highestLimitAmounts = getHighestLimitAmountsForPaths(paths, maxPools);
    const sumLimitAmounts = highestLimitAmounts.reduce(
        (r: BigNumber[], pathLimit: BigNumber) => {
            r.push(pathLimit.add(r[r.length - 1] || Zero));
            return r;
        },
        []
    );

    // If the cumulative limit across all paths is lower than totalSwapAmount then no solution is possible
    if (totalSwapAmount.gt(sumLimitAmounts[sumLimitAmounts.length - 1])) {
        return [[], ZERO, ZERO, ZERO]; // Not enough liquidity, return empty
    }

    // We use the highest limits to define the initial number of pools considered and the initial guess for swapAmounts.
    const initialNumPaths =
        sumLimitAmounts.findIndex((cumulativeLimit) =>
            // If below is true, it means we have enough liquidity
            totalSwapAmount.lte(cumulativeLimit)
        ) + 1;

    const initialSwapAmounts = highestLimitAmounts.slice(0, initialNumPaths);

    //  Since the sum of the first i highest limits will be less than totalSwapAmount, we remove the difference to the last swapAmount
    //  so we are sure that the sum of swapAmounts will be equal to totalSwapAmount
    const difference =
        sumLimitAmounts[initialNumPaths - 1].sub(totalSwapAmount);
    initialSwapAmounts[initialSwapAmounts.length - 1] =
        initialSwapAmounts[initialSwapAmounts.length - 1].sub(difference);

    const [bestPaths, bestSwapAmounts, bestTotalReturnConsideringFees] =
        optimizeSwapAmounts(
            paths,
            swapType,
            totalSwapAmount,
            initialSwapAmounts,
            highestLimitAmounts,
            inputDecimals,
            outputDecimals,
            initialNumPaths,
            maxPools,
            costReturnToken
        );

    const [swaps, bestTotalReturn, marketSp] = formatSwaps(
        bestPaths,
        swapType,
        bnum(formatFixed(totalSwapAmount, inputDecimals)),
        bestSwapAmounts
    );

    if (bestTotalReturn.eq(0)) return [[], ZERO, ZERO, ZERO];

    return [swaps, bestTotalReturn, marketSp, bestTotalReturnConsideringFees];
};
