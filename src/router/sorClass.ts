import cloneDeep from 'lodash.clonedeep';
import { PRICE_ERROR_TOLERANCE } from '../config';
import { bnum, ZERO, ONE, INFINITY } from '../utils/bignumber';
import { BigNumber } from '../utils/bignumber';
import { SwapTypes, NewPath, PoolDictionary, Swap } from '../types';
import {
    getEffectivePriceSwapForPath,
    getSpotPriceAfterSwapForPath,
    getDerivativeSpotPriceAfterSwapForPath,
    getOutputAmountSwapForPath,
    EVMgetOutputAmountSwap,
} from './helpersClass';
import { MaxUint256 } from '@ethersproject/constants';

// TODO get max price from slippage tolerance given by user options
export const MAX_UINT = MaxUint256.toString();

const minAmountOut = 0;
const maxAmountIn: string = MAX_UINT;
const maxPrice: string = MAX_UINT;

export const optimizeSwapAmounts = (
    paths: NewPath[],
    swapType: SwapTypes,
    totalSwapAmount: BigNumber,
    initialSwapAmounts: BigNumber[],
    highestLimitAmounts: BigNumber[],
    initialNumPaths: number,
    maxPools: number,
    costReturnToken: BigNumber
): [NewPath[], BigNumber[], BigNumber] => {
    // First get the optimal totalReturn to trade 'totalSwapAmount' with
    // one path only (b=1). Then increase the number of pools as long as
    // improvementCondition is true (see more information below)
    let bestTotalReturnConsideringFees =
        swapType === SwapTypes.SwapExactIn ? INFINITY.times(-1) : INFINITY;
    let bestSwapAmounts: BigNumber[] = [];
    let bestPaths: NewPath[] = [];
    let swapAmounts = initialSwapAmounts;
    for (let b = initialNumPaths; b <= paths.length; b++) {
        console.log('starting search with ', b, 'paths');
        if (b != initialNumPaths) {
            // We already had a previous iteration and are adding another pool this new iteration
            // swapAmounts.push(ONE); // Initialize new swapAmount with 1 wei to
            // make sure that it won't be considered as a non viable amount (which would
            // be the case if it started at 0)

            // Start new path at 1/b of totalSwapAmount (i.e. if this is the 5th pool, we start with
            // 20% of the totalSwapAmount for this new swapAmount added). However, we need to make sure
            // that this value is not higher then the bth limit of the paths available otherwise there
            // won't be any possible path to process this swapAmount:
            const newSwapAmount = BigNumber.min.apply(null, [
                totalSwapAmount.times(bnum(1 / b)),
                highestLimitAmounts[b - 1],
            ]);
            // We need then to multiply all current
            // swapAmounts by 1-newSwapAmount/totalSwapAmount.
            swapAmounts.forEach((swapAmount, i) => {
                swapAmounts[i] = swapAmounts[i].times(
                    ONE.minus(newSwapAmount.div(totalSwapAmount))
                );
            });
            swapAmounts.push(newSwapAmount);
        }

        //  iterate until we converge to the best pools for a given totalSwapAmount
        //  first initialize variables
        const historyOfSortedPathIds: string[] = [];
        let selectedPaths: NewPath[] = [];
        let [
            newSelectedPaths,
            exceedingAmounts,
            selectedPathLimitAmounts,
            pathIds,
        ] = getBestPathIds(paths, swapType, swapAmounts);

        // Check if ids are in history of ids, but first sort and stringify to make comparison possible
        // Copy array https://stackoverflow.com/a/42442909
        let sortedPathIdsJSON = JSON.stringify([...pathIds].sort()); // Just to check if this set of paths has already been chosen
        // We now loop to iterateSwapAmounts until we converge. This is not necessary
        // for just 1 path because swapAmount will always be totalSwapAmount
        while (!historyOfSortedPathIds.includes(sortedPathIdsJSON) && b > 1) {
            historyOfSortedPathIds.push(sortedPathIdsJSON); // We store all previous paths ids to avoid infinite loops because of local minima
            selectedPaths = newSelectedPaths;
            [swapAmounts, exceedingAmounts] = iterateSwapAmounts(
                selectedPaths,
                swapType,
                totalSwapAmount,
                swapAmounts,
                exceedingAmounts
            );
            [
                newSelectedPaths,
                exceedingAmounts,
                selectedPathLimitAmounts,
                pathIds,
            ] = getBestPathIds(paths, swapType, swapAmounts);

            if (pathIds.length === 0) break;

            sortedPathIdsJSON = JSON.stringify([...pathIds].sort());
        }
        // In case b = 1 the while above was skipped and we need to define selectedPaths
        if (b == 1) selectedPaths = newSelectedPaths;

        const totalReturn = calcTotalReturn(
            selectedPaths,
            swapType,
            swapAmounts
        );

        // Calculates the number of pools in all the paths to include the gas costs
        const totalNumberOfPools = selectedPaths.reduce(
            (acc, path) => acc + path.swaps.length,
            0
        );

        // improvementCondition is true if we are improving the totalReturn
        // Notice that totalReturn has to be maximized for 'swapExactIn'
        // and MINIMIZED for 'swapExactOut'
        // This is because for the case of 'swapExactOut', totalReturn means the
        // amount of tokenIn needed to buy totalSwapAmount of tokenOut
        let improvementCondition = false;
        let totalReturnConsideringFees = ZERO;
        const gasFees = bnum(totalNumberOfPools).times(costReturnToken);
        if (swapType === SwapTypes.SwapExactIn) {
            totalReturnConsideringFees = totalReturn.minus(gasFees);
            improvementCondition = totalReturnConsideringFees.isGreaterThan(
                bestTotalReturnConsideringFees
            );
        } else {
            totalReturnConsideringFees = totalReturn.plus(gasFees);
            improvementCondition = totalReturnConsideringFees.isLessThan(
                bestTotalReturnConsideringFees
            );
        }

        // Stop if improvement has stopped
        if (!improvementCondition) break;

        bestSwapAmounts = [...swapAmounts]; // Copy to avoid linking variables
        bestPaths = [...selectedPaths];
        bestTotalReturnConsideringFees = totalReturnConsideringFees;

        // Stop if max number of pools has been reached
        if (totalNumberOfPools >= maxPools) break;
    }

    console.log(
        'bestTotalReturnConsideringFees:',
        bestTotalReturnConsideringFees.toString()
    );
    // 0 swap amounts can occur due to rounding errors but we don't want to pass those on so filter out
    bestPaths = bestPaths.filter((_, i) => !bestSwapAmounts[i].isZero());
    bestSwapAmounts = bestSwapAmounts.filter(
        (swapAmount) => !swapAmount.isZero()
    );

    return [bestPaths, bestSwapAmounts, bestTotalReturnConsideringFees];
};

export const formatSwaps = (
    bestPaths: NewPath[],
    swapType: SwapTypes,
    totalSwapAmount: BigNumber,
    bestSwapAmounts: BigNumber[]
): [Swap[][], BigNumber, BigNumber] => {
    //// Prepare swap data from paths
    const swaps: Swap[][] = [];
    let highestSwapAmt = bestSwapAmounts[0];
    let largestSwapPath: NewPath = bestPaths[0];
    let bestTotalReturn = ZERO; // Reset totalReturn as this time it will be
    // calculated with the EVM maths so the return is exactly what the user will get
    // after executing the transaction (given there are no front-runners)

    // TO DO
    console.log('\nPaths and swap amounts have been chosen now');
    console.log('Number of paths: ', bestPaths.length);
    for (let i = 0; i < bestPaths.length; i++) {
        console.log('Length of path', i, ':', bestPaths[i].pools.length);
        for (let j = 0; j < bestPaths[i].pools.length; j++) {
            console.log('pool address:', bestPaths[i].pools[j].address);
        }
    }

    console.log(`!!!!!!! bestSwapAmounts`);
    console.log(JSON.stringify(bestSwapAmounts));

    bestPaths.forEach((path, i) => {
        const swapAmount = bestSwapAmounts[i];

        if (swapAmount.gt(highestSwapAmt)) {
            highestSwapAmt = swapAmount;
            largestSwapPath = path;
        }

        // // TODO: remove. To debug only!
        /*
        console.log(
            'Prices should be all very close (unless one of the paths is on the limit!'
        );
        console.log(
            getSpotPriceAfterSwapForPath(path, swapType, swapAmount).toNumber()
        );
        */
        const poolPairData = path.poolPairData;
        const pathSwaps: Swap[] = [];
        const amounts: BigNumber[] = [];
        let returnAmount: BigNumber;
        const n = poolPairData.length;
        amounts.push(swapAmount);
        if (swapType === SwapTypes.SwapExactIn) {
            for (let i = 0; i < n; i++) {
                amounts.push(
                    EVMgetOutputAmountSwap(
                        path.pools[i],
                        poolPairData[i],
                        SwapTypes.SwapExactIn,
                        amounts[amounts.length - 1]
                    )
                );
                const swap: Swap = {
                    pool: path.swaps[i].pool,
                    tokenIn: path.swaps[i].tokenIn,
                    tokenOut: path.swaps[i].tokenOut,
                    swapAmount: amounts[i].toString(),
                    limitReturnAmount: minAmountOut.toString(),
                    maxPrice: maxPrice,
                    tokenInDecimals: path.poolPairData[i].decimalsIn,
                    tokenOutDecimals: path.poolPairData[i].decimalsOut,
                };
                pathSwaps.push(swap);
            }
            returnAmount = amounts[n];
            console.log('i: ', i, 'amounts: ', amounts.toString());
            console.log('returnAmount: ', returnAmount.toString());
        } else {
            for (let i = 0; i < n; i++) {
                amounts.unshift(
                    EVMgetOutputAmountSwap(
                        path.pools[n - 1 - i],
                        poolPairData[n - 1 - i],
                        SwapTypes.SwapExactOut,
                        amounts[0]
                    )
                );
                const swap: Swap = {
                    pool: path.swaps[n - 1 - i].pool,
                    tokenIn: path.swaps[n - 1 - i].tokenIn,
                    tokenOut: path.swaps[n - 1 - i].tokenOut,
                    swapAmount: amounts[1].toString(),
                    limitReturnAmount: maxAmountIn,
                    maxPrice: maxPrice,
                    tokenInDecimals: path.poolPairData[n - 1 - i].decimalsIn,
                    tokenOutDecimals: path.poolPairData[n - 1 - i].decimalsOut,
                };
                pathSwaps.unshift(swap);
            }
            returnAmount = amounts[0];
        }
        swaps.push(pathSwaps);
        bestTotalReturn = bestTotalReturn.plus(returnAmount);
    });

    // Since the individual swapAmounts for each path are integers, the sum of all swapAmounts
    // might not be exactly equal to the totalSwapAmount the user requested. We need to correct that rounding error
    // and we do that by adding the rounding error to the first path.
    if (swaps.length > 0) {
        const totalSwapAmountWithRoundingErrors = bestSwapAmounts.reduce(
            (a, b) => a.plus(b),
            ZERO
        );
        const dust = totalSwapAmount.minus(totalSwapAmountWithRoundingErrors);
        if (swapType === SwapTypes.SwapExactIn) {
            // As swap is ExactIn, add dust to input pool
            swaps[0][0].swapAmount = bnum(swaps[0][0].swapAmount as string)
                .plus(dust)
                .toString();
        } else {
            // As swap is ExactOut, add dust to output pool
            const firstPathLastPoolIndex = bestPaths[0].swaps.length - 1;
            swaps[0][firstPathLastPoolIndex].swapAmount = bnum(
                swaps[0][firstPathLastPoolIndex].swapAmount as string
            )
                .plus(dust)
                .toString();
        }
    }

    if (bestTotalReturn.eq(0)) return [[], ZERO, ZERO];

    const marketSp = getSpotPriceAfterSwapForPath(
        largestSwapPath,
        swapType,
        ZERO
    );

    return [swaps, bestTotalReturn, marketSp];
};

//  For a given list of swapAmounts, gets list of pools with best effective price for these amounts
//  Always choose best pool for highest swapAmount first, then 2nd swapAmount and so on. This is
//  because it's best to use the best effective price for the highest amount to be traded
function getBestPathIds(
    originalPaths: NewPath[],
    swapType: SwapTypes,
    swapAmounts: BigNumber[]
): [NewPath[], BigNumber[], BigNumber[], string[]] {
    const bestPathIds: string[] = [];
    const selectedPaths: NewPath[] = [];
    const selectedPathLimitAmounts: BigNumber[] = [];
    const selectedPathExceedingAmounts: BigNumber[] = [];
    const paths = cloneDeep(originalPaths); // Deep copy to avoid changing the original path data

    // Sort swapAmounts in descending order without changing original: https://stackoverflow.com/a/42442909
    const sortedSwapAmounts = [...swapAmounts].sort((a, b) => {
        return b.minus(a).toNumber();
    });

    for (let i = 0; i < sortedSwapAmounts.length; i++) {
        const swapAmount: BigNumber = sortedSwapAmounts[i];
        // Find path that has best effective price
        let bestPathIndex = -1;
        let bestEffectivePrice = INFINITY; // Start with worst price possible
        paths.forEach((path, j) => {
            // Do not consider this path if its limit is below swapAmount
            if (path.limitAmount.gte(swapAmount)) {
                // Calculate effective price of this path for this swapAmount
                // If path.limitAmount = swapAmount we set effectivePrice as
                // Infinity because we know this path is maxed out and we want
                // to select other paths that can still be improved on
                let effectivePrice;
                if (path.limitAmount.eq(swapAmount)) {
                    effectivePrice = INFINITY;
                } else {
                    // TODO for optimization: pass already calculated limitAmount as input
                    // to getEffectivePriceSwapForPath()
                    effectivePrice = getEffectivePriceSwapForPath(
                        path,
                        swapType,
                        swapAmount
                    );
                }
                if (effectivePrice.lte(bestEffectivePrice)) {
                    bestEffectivePrice = effectivePrice;
                    bestPathIndex = j;
                }
            }
        });

        if (bestPathIndex === -1) {
            return [[], [], [], []];
        }
        bestPathIds.push(paths[bestPathIndex].id);
        selectedPaths.push(paths[bestPathIndex]);
        selectedPathLimitAmounts.push(paths[bestPathIndex].limitAmount);
        selectedPathExceedingAmounts.push(
            swapAmount.minus(paths[bestPathIndex].limitAmount)
        );
        paths.splice(bestPathIndex, 1); // Remove path from list
    }
    return [
        selectedPaths,
        selectedPathExceedingAmounts,
        selectedPathLimitAmounts,
        bestPathIds,
    ];
}

// This functions finds the swapAmounts such that all the paths that have viable swapAmounts (i.e.
// that are not negative or equal to limitAmount) bring their respective prices after swap to the
// same price (which means that this is the optimal solution for the paths analyzed)
function iterateSwapAmounts(
    selectedPaths: NewPath[],
    swapType: SwapTypes,
    totalSwapAmount: BigNumber,
    swapAmounts: BigNumber[],
    exceedingAmounts: BigNumber[]
): [BigNumber[], BigNumber[]] {
    let priceError = ONE; // Initialize priceError just so that while starts
    let prices: BigNumber[] = [];
    // // Since this is the beginning of an iteration with a new set of paths, we
    // // set any swapAmounts that were 0 previously to 1 wei or at the limit
    // // to limit minus 1 wei just so that they
    // // are considered as viable for iterateSwapAmountsApproximation(). If they were
    // // left at 0 iterateSwapAmountsApproximation() would consider them already outside
    // // the viable range and would not iterate on them. This is useful when
    // // iterateSwapAmountsApproximation() is being repeatedly called within the while loop
    // // below, but not when a new execution of iterateSwapAmounts() happens with new
    // // paths.
    // for (let i = 0; i < swapAmounts.length; ++i) {
    //     if (swapAmounts[i].isZero()) {
    //         // Very small amount: TODO put in config file
    //         const epsilon = totalSwapAmount.times(INFINITESIMAL);
    //         swapAmounts[i] = epsilon;
    //         exceedingAmounts[i] = exceedingAmounts[i].plus(epsilon);
    //     }
    //     if (exceedingAmounts[i].isZero()) {
    //         // Very small amount: TODO put in config file
    //         const epsilon = totalSwapAmount.times(INFINITESIMAL);
    //         swapAmounts[i] = swapAmounts[i].minus(epsilon); // Very small amount
    //         exceedingAmounts[i] = exceedingAmounts[i].minus(epsilon);
    //     }
    // }
    let iterationCount = 0;
    while (priceError.isGreaterThan(PRICE_ERROR_TOLERANCE)) {
        [prices, swapAmounts, exceedingAmounts] =
            iterateSwapAmountsApproximation(
                selectedPaths,
                swapType,
                totalSwapAmount,
                swapAmounts,
                exceedingAmounts,
                iterationCount
            );
        const maxPrice = BigNumber.max.apply(null, prices);
        const minPrice = BigNumber.min.apply(null, prices);
        priceError = maxPrice.minus(minPrice).div(minPrice);
        iterationCount++;
        if (iterationCount > 100) break;
    }
    return [swapAmounts, exceedingAmounts];
}

function iterateSwapAmountsApproximation(
    selectedPaths: NewPath[],
    swapType: SwapTypes,
    totalSwapAmount: BigNumber,
    swapAmounts: BigNumber[],
    exceedingAmounts: BigNumber[], // This is the amount by which swapAmount exceeds the pool limit_amount
    iterationCount: number
): [BigNumber[], BigNumber[], BigNumber[]] {
    let sumInverseDerivativeSPaSs = ZERO;
    let sumSPaSDividedByDerivativeSPaSs = ZERO;
    const SPaSs: BigNumber[] = [];
    const derivativeSPaSs: BigNumber[] = [];

    // We only iterate on the swapAmounts that are viable (i.e. no negative or > than path limit)
    // OR if this is the first time "iterateSwapAmountsApproximation" is called
    // within "iterateSwapAmounts()". In this case swapAmounts should be considered viable
    // also if they are on the limit.
    swapAmounts.forEach((swapAmount, i) => {
        // if (swapAmount.gt(ZERO) && exceedingAmounts[i].lt(ZERO)) {
        if (
            (iterationCount == 0 &&
                swapAmount.gte(ZERO) &&
                exceedingAmounts[i].lte(ZERO)) ||
            (iterationCount != 0 &&
                swapAmount.gt(ZERO) &&
                exceedingAmounts[i].lt(ZERO))
        ) {
            const path = selectedPaths[i];
            const SPaS = getSpotPriceAfterSwapForPath(
                path,
                swapType,
                swapAmount
            );
            SPaSs.push(SPaS);
            const derivative_SPaS = getDerivativeSpotPriceAfterSwapForPath(
                path,
                swapType,
                swapAmount
            );
            derivativeSPaSs.push(derivative_SPaS);
            sumInverseDerivativeSPaSs = sumInverseDerivativeSPaSs.plus(
                ONE.div(derivative_SPaS)
            );
            sumSPaSDividedByDerivativeSPaSs =
                sumSPaSDividedByDerivativeSPaSs.plus(SPaS.div(derivative_SPaS));
        } else {
            // This swapAmount is not viable but we push to keep list length consistent
            derivativeSPaSs.push(bnum('NaN'));
            SPaSs.push(bnum('NaN'));
        }
    });
    // // This division using BigNumber below lost precision. Its result was for example
    // 1.042818e-12 while using normal js math operations it was
    // 1.0428184989387553e-12. This loss of precision caused an important bug

    // let weighted_average_SPaS = sumSPaSDividedByDerivativeSPaSs.div(
    //     sumInverseDerivativeSPaSs
    // );
    const weighted_average_SPaS = bnum(
        sumSPaSDividedByDerivativeSPaSs.toNumber() /
            sumInverseDerivativeSPaSs.toNumber()
    );

    swapAmounts.forEach((swapAmount, i) => {
        if (
            (iterationCount == 0 &&
                swapAmount.gte(ZERO) &&
                exceedingAmounts[i].lte(ZERO)) ||
            (iterationCount != 0 &&
                swapAmount.gt(ZERO) &&
                exceedingAmounts[i].lt(ZERO))
        ) {
            const deltaSwapAmount = weighted_average_SPaS
                .minus(SPaSs[i])
                .div(derivativeSPaSs[i]);
            swapAmounts[i] = swapAmounts[i].plus(deltaSwapAmount);
            exceedingAmounts[i] = exceedingAmounts[i].plus(deltaSwapAmount);
        }
    });

    // Make sure no input amount is negative or above the path limit
    while (
        BigNumber.min.apply(null, swapAmounts).lt(ZERO) ||
        BigNumber.max.apply(null, exceedingAmounts).gt(ZERO)
    ) {
        [swapAmounts, exceedingAmounts] = redistributeInputAmounts(
            swapAmounts,
            exceedingAmounts,
            derivativeSPaSs
        );
    }

    const pricesForViableAmounts: BigNumber[] = []; // Get prices for all non-negative AND below-limit input amounts
    let swapAmountsSumWithRoundingErrors = ZERO;
    swapAmounts.forEach((swapAmount, i) => {
        swapAmountsSumWithRoundingErrors =
            swapAmountsSumWithRoundingErrors.plus(swapAmount);
        if (
            (iterationCount == 0 &&
                swapAmount.gte(ZERO) &&
                exceedingAmounts[i].lte(ZERO)) ||
            (iterationCount != 0 &&
                swapAmount.gt(ZERO) &&
                exceedingAmounts[i].lt(ZERO))
        )
            pricesForViableAmounts.push(
                getSpotPriceAfterSwapForPath(
                    selectedPaths[i],
                    swapType,
                    swapAmount
                )
            );
    });

    const roundingError = totalSwapAmount.minus(
        swapAmountsSumWithRoundingErrors
    );
    // console.log("Rounding error")
    // console.log(roundingError.div(totalSwapAmount).toNumber())
    // // let errorLimit = totalSwapAmount.times(bnum(0.001))
    // // if(roundingError>errorLimit)
    // //     throw "Rounding error in iterateSwapAmountsApproximation() too large";

    // Add rounding error to make sum be exactly equal to totalSwapAmount to avoid error compounding
    // Add to the first swapAmount that is already not zero or at the limit
    // AND only if swapAmount would not leave the viable range (i.e. swapAmoung
    // would still be >0 and <limit) after adding the error
    // I.d. we need: (swapAmount+error)>0 AND (exceedingAmount+error)<0
    for (let i = 0; i < swapAmounts.length; ++i) {
        if (swapAmounts[i].gt(ZERO) && exceedingAmounts[i].lt(ZERO)) {
            if (
                swapAmounts[i].plus(roundingError).gt(ZERO) &&
                exceedingAmounts[i].plus(roundingError).lt(ZERO)
            ) {
                swapAmounts[i] = swapAmounts[i].plus(roundingError);
                exceedingAmounts[i] = exceedingAmounts[i].plus(roundingError);
                break;
            }
        }
    }

    return [pricesForViableAmounts, swapAmounts, exceedingAmounts];
}

function redistributeInputAmounts(
    swapAmounts: BigNumber[],
    exceedingAmounts: BigNumber[],
    derivativeSPaSs: BigNumber[]
): [BigNumber[], BigNumber[]] {
    let sumInverseDerivativeSPaSsForViableAmounts = ZERO;
    let sumInverseDerivativeSPaSsForNegativeAmounts = ZERO;
    let sumInverseDerivativeSPaSsForExceedingAmounts = ZERO;
    let sumNegativeOrExceedingSwapAmounts = ZERO;
    swapAmounts.forEach((swapAmount, i) => {
        // Amount is negative
        if (swapAmount.lte(ZERO)) {
            sumNegativeOrExceedingSwapAmounts =
                sumNegativeOrExceedingSwapAmounts.plus(swapAmount);
            sumInverseDerivativeSPaSsForNegativeAmounts =
                sumInverseDerivativeSPaSsForNegativeAmounts.plus(
                    ONE.div(derivativeSPaSs[i])
                );
        }
        // Amount is above limit (exceeding > 0)
        else if (exceedingAmounts[i].gte(ZERO)) {
            sumNegativeOrExceedingSwapAmounts =
                sumNegativeOrExceedingSwapAmounts.plus(exceedingAmounts[i]);
            sumInverseDerivativeSPaSsForExceedingAmounts =
                sumInverseDerivativeSPaSsForExceedingAmounts.plus(
                    ONE.div(derivativeSPaSs[i])
                );
        }
        // Sum the inverse of the derivative if the swapAmount is viable,
        // i.e. if swapAmount > 0 or swapAmount < limit
        else
            sumInverseDerivativeSPaSsForViableAmounts =
                sumInverseDerivativeSPaSsForViableAmounts.plus(
                    ONE.div(derivativeSPaSs[i])
                );
    });

    // Now redestribute sumNegativeOrExceedingSwapAmounts
    // to non-exceeding pools if sumNegativeOrExceedingSwapAmounts > 0
    // or to non zero swapAmount pools if sumNegativeOrExceedingSwapAmounts < 0
    swapAmounts.forEach((swapAmount, i) => {
        if (swapAmount.lte(ZERO)) {
            swapAmounts[i] = ZERO;
            exceedingAmounts[i] = exceedingAmounts[i].minus(swapAmount);
        } else if (exceedingAmounts[i].gte(ZERO)) {
            swapAmounts[i] = swapAmounts[i].minus(exceedingAmounts[i]); // This is the same as swapAmounts[i] = pathLimitAmounts[i]
            exceedingAmounts[i] = ZERO;
        } else {
            const deltaSwapAmount = sumNegativeOrExceedingSwapAmounts
                .times(ONE.div(derivativeSPaSs[i]))
                .div(sumInverseDerivativeSPaSsForViableAmounts);
            swapAmounts[i] = swapAmounts[i].plus(deltaSwapAmount);
            exceedingAmounts[i] = exceedingAmounts[i].plus(deltaSwapAmount);
        }
    });

    // If there were no viable amounts (i.e all amounts were either negative or above limit)
    // We run this extra loop to redistribute the excess
    if (sumInverseDerivativeSPaSsForViableAmounts.isZero()) {
        if (sumNegativeOrExceedingSwapAmounts.lt(ZERO)) {
            // This means we need to redistribute to the exceeding amounts that
            // were now set to the limit
            swapAmounts.forEach((swapAmount, i) => {
                if (exceedingAmounts[i].isZero()) {
                    const deltaSwapAmount = sumNegativeOrExceedingSwapAmounts
                        .times(ONE.div(derivativeSPaSs[i]))
                        .div(sumInverseDerivativeSPaSsForExceedingAmounts);
                    swapAmounts[i] = swapAmounts[i].plus(deltaSwapAmount);
                    exceedingAmounts[i] =
                        exceedingAmounts[i].plus(deltaSwapAmount);
                }
            });
        } else {
            // This means we need to redistribute to the negative amounts that
            // were now set to zero
            swapAmounts.forEach((swapAmount, i) => {
                if (swapAmounts[i].isZero()) {
                    const deltaSwapAmount = sumNegativeOrExceedingSwapAmounts
                        .times(ONE.div(derivativeSPaSs[i]))
                        .div(sumInverseDerivativeSPaSsForNegativeAmounts);
                    swapAmounts[i] = swapAmounts[i].plus(deltaSwapAmount);
                    exceedingAmounts[i] =
                        exceedingAmounts[i].plus(deltaSwapAmount);
                }
            });
        }
    }
    return [swapAmounts, exceedingAmounts];
}

// TODO: calculate EVM return (use bmath) and update pool balances like current SOR
export const calcTotalReturn = (
    paths: NewPath[],
    swapType: SwapTypes,
    swapAmounts: BigNumber[]
): BigNumber => {
    let totalReturn = new BigNumber(0);
    // changing the contents of pools (parameter passed as reference)
    paths.forEach((path, i) => {
        totalReturn = totalReturn.plus(
            getOutputAmountSwapForPath(path, swapType, swapAmounts[i])
        );
    });
    return totalReturn;
};
