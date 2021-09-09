'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const config_1 = require('./config');
const bmath_1 = require('./bmath');
const bignumber_1 = require('./utils/bignumber');
const types_1 = require('./types');
const helpersClass_1 = require('./helpersClass');
const constants_1 = require('@ethersproject/constants');
// TODO get max price from slippage tolerance given by user options
exports.MAX_UINT = constants_1.MaxUint256.toString();
const minAmountOut = 0;
const maxAmountIn = exports.MAX_UINT;
const maxPrice = exports.MAX_UINT;
function calculatePathLimits(paths, swapType) {
    let maxLiquidityAvailable = bmath_1.ZERO;
    paths.forEach((path) => {
        // Original parsedPoolPairForPath here but this has already been done.
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
exports.calculatePathLimits = calculatePathLimits;
function getLimitAmountSwapForPath(path, swapType) {
    let poolPairData = path.poolPairData;
    let limit;
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        for (let i = 0; i < poolPairData.length; i++) {
            let poolLimit = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                types_1.SwapTypes.SwapExactIn
            );
            let pulledPoolLimit = poolLimit;
            for (let j = i; j > 0; j--) {
                pulledPoolLimit = helpersClass_1.getOutputAmountSwap(
                    path.pools[j - 1],
                    path.poolPairData[j - 1],
                    types_1.SwapTypes.SwapExactOut,
                    pulledPoolLimit
                );
            }
            if (pulledPoolLimit.lt(limit) || i === 0) {
                limit = pulledPoolLimit;
            }
        }
        if (limit.isZero()) return bmath_1.ZERO;
    } else {
        for (let i = 0; i < poolPairData.length; i++) {
            let poolLimit = path.pools[i].getLimitAmountSwap(
                poolPairData[i],
                types_1.SwapTypes.SwapExactOut
            );
            let pushedPoolLimit = poolLimit;
            for (let j = i + 1; j < poolPairData.length; j++) {
                pushedPoolLimit = helpersClass_1.getOutputAmountSwap(
                    path.pools[j],
                    path.poolPairData[j],
                    types_1.SwapTypes.SwapExactIn,
                    pushedPoolLimit
                );
            }
            if (pushedPoolLimit.lt(limit) || i === 0) {
                limit = pushedPoolLimit;
            }
        }
        if (limit.isZero()) return bmath_1.ZERO;
    }
    return limit;
}
exports.getLimitAmountSwapForPath = getLimitAmountSwapForPath;
exports.smartOrderRouter = (
    pools,
    paths,
    swapType,
    totalSwapAmount,
    maxPools,
    costReturnToken
) => {
    let bestTotalReturn = new bignumber_1.BigNumber(0);
    let bestTotalReturnConsideringFees = new bignumber_1.BigNumber(0);
    let totalReturn, totalReturnConsideringFees;
    let bestSwapAmounts, bestPaths, swapAmounts;
    // No paths available or totalSwapAmount == 0, return empty solution
    if (paths.length == 0 || totalSwapAmount.isZero()) {
        return [[], bmath_1.ZERO, bmath_1.ZERO, bmath_1.ZERO];
    }
    // Before we start the main loop, we first check if there is enough liquidity for this totalSwapAmount at all
    let highestLimitAmounts = helpersClass_1.getHighestLimitAmountsForPaths(
        paths,
        maxPools
    );
    //  We use the highest limits to define the initial number of pools considered and the initial guess for swapAmounts. If the
    //  highest_limit is lower than totalSwapAmount, then we should obviously not waste time trying to calculate the SOR suggestion for 1 pool,
    //  Same for 2, 3 pools etc.
    let initialNumPaths = -1; // Initializing
    for (let i = 0; i < maxPools; i++) {
        let sumHighestLimitAmounts = highestLimitAmounts
            .slice(0, i + 1)
            .reduce((a, b) => a.plus(b));
        if (totalSwapAmount.gt(sumHighestLimitAmounts)) continue; // the i initial pools are not enough to get to totalSwapAmount, continue
        //  If above is false, it means we have enough liquidity with first i pools
        initialNumPaths = i + 1;
        swapAmounts = highestLimitAmounts.slice(0, initialNumPaths);
        //  Since the sum of the first i highest limits will be less than totalSwapAmount, we remove the difference to the last swapAmount
        //  so we are sure that the sum of swapAmounts will be equal to totalSwapAmount
        let difference = sumHighestLimitAmounts.minus(totalSwapAmount);
        swapAmounts[swapAmounts.length - 1] =
            swapAmounts[swapAmounts.length - 1].minus(difference);
        break; // No need to keep looping as this number of pools (i) has enough liquidity
    }
    if (initialNumPaths == -1) {
        return [[], bmath_1.ZERO, bmath_1.ZERO, bmath_1.ZERO]; // Not enough liquidity, return empty
    }
    // First get the optimal totalReturn to trade 'totalSwapAmount' with
    // one path only (b=1). Then increase the number of pools as long as
    // improvementCondition is true (see more information below)
    for (let b = initialNumPaths; b <= paths.length; b++) {
        totalReturn = 0;
        if (b != initialNumPaths) {
            // We already had a previous iteration and are adding another pool this new iteration
            // swapAmounts.push(ONE); // Initialize new swapAmount with 1 wei to
            // // make sure that it won't be considered as a non viable amount (which would
            // // be the case if it started at 0)
            // Start new path at 1/b of totalSwapAmount (i.e. if this is the 5th pool, we start with
            // 20% of the totalSwapAmount for this new swapAmount added). However, we need to make sure
            // that this value is not higher then the bth limit of the paths available otherwise there
            // won't be any possible path to process this swapAmount:
            let newSwapAmount = bignumber_1.BigNumber.min.apply(null, [
                totalSwapAmount.times(bmath_1.bnum(1 / b)),
                highestLimitAmounts[b - 1],
            ]);
            // We need then to multiply all current
            // swapAmounts by 1-newSwapAmount/totalSwapAmount.
            swapAmounts.forEach((swapAmount, i) => {
                swapAmounts[i] = swapAmounts[i].times(
                    bmath_1.ONE.minus(newSwapAmount.div(totalSwapAmount))
                );
            });
            swapAmounts.push(newSwapAmount);
        }
        //  iterate until we converge to the best pools for a given totalSwapAmount
        //  first initialize variables
        let historyOfSortedPathIds = [];
        let selectedPaths;
        let [
            newSelectedPaths,
            exceedingAmounts,
            selectedPathLimitAmounts,
            pathIds,
        ] = getBestPathIds(pools, paths, swapType, swapAmounts);
        // Check if ids are in history of ids, but first sort and stringify to make comparison possible
        // Copy array https://stackoverflow.com/a/42442909
        let sortedPathIdsJSON = JSON.stringify([...pathIds].sort()); // Just to check if this set of paths has already been chosen
        // We now loop to iterateSwapAmounts until we converge. This is not necessary
        // for just 1 path because swapAmount will always be totalSwapAmount
        while (!historyOfSortedPathIds.includes(sortedPathIdsJSON) && b > 1) {
            historyOfSortedPathIds.push(sortedPathIdsJSON); // We store all previous paths ids to avoid infinite loops because of local minima
            selectedPaths = newSelectedPaths;
            [swapAmounts, exceedingAmounts] = iterateSwapAmounts(
                pools,
                selectedPaths,
                swapType,
                totalSwapAmount,
                swapAmounts,
                exceedingAmounts,
                selectedPathLimitAmounts
            );
            [
                newSelectedPaths,
                exceedingAmounts,
                selectedPathLimitAmounts,
                pathIds,
            ] = getBestPathIds(pools, paths, swapType, swapAmounts);
            if (pathIds.length === 0) break;
            sortedPathIdsJSON = JSON.stringify([...pathIds].sort());
        }
        // In case b = 1 the while above was skipped and we need to define selectedPaths
        if (b == 1) selectedPaths = newSelectedPaths;
        totalReturn = exports.calcTotalReturn(
            selectedPaths,
            swapType,
            swapAmounts
        );
        // Calculates the number of pools in all the paths to include the gas costs
        let totalNumberOfPools = 0;
        selectedPaths.forEach((path, i) => {
            totalNumberOfPools += path.swaps.length;
        });
        // improvementCondition is true if we are improving the totalReturn
        // Notice that totalReturn has to be maximized for 'swapExactIn'
        // and MINIMIZED for 'swapExactOut'
        // This is because for the case of 'swapExactOut', totalReturn means the
        // amount of tokenIn needed to buy totalSwapAmount of tokenOut
        let improvementCondition = false;
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            totalReturnConsideringFees = totalReturn.minus(
                bmath_1.bnum(totalNumberOfPools).times(costReturnToken)
            );
            improvementCondition =
                totalReturnConsideringFees.isGreaterThan(
                    bestTotalReturnConsideringFees
                ) || b === initialNumPaths; // b === initialNumPaths means its the first iteration so bestTotalReturnConsideringFees isn't currently a value
        } else {
            totalReturnConsideringFees = totalReturn.plus(
                bmath_1.bnum(totalNumberOfPools).times(costReturnToken)
            );
            improvementCondition =
                totalReturnConsideringFees.isLessThan(
                    bestTotalReturnConsideringFees
                ) || b === initialNumPaths; // b === initialNumPaths means its the first iteration so bestTotalReturnConsideringFees isn't currently a value
        }
        if (improvementCondition === true) {
            bestSwapAmounts = [...swapAmounts]; // Copy to avoid linking variables
            bestPaths = [...selectedPaths];
            bestTotalReturn = totalReturn;
            bestTotalReturnConsideringFees = totalReturnConsideringFees;
        } else {
            break;
        }
        // Stop if max number of pools has been reached
        if (totalNumberOfPools >= maxPools) break;
    }
    //// Prepare swap data from paths
    let swaps = [];
    let totalSwapAmountWithRoundingErrors = new bignumber_1.BigNumber(0);
    let dust = new bignumber_1.BigNumber(0);
    let lenghtFirstPath;
    let highestSwapAmt = bmath_1.ZERO;
    let largestSwapPath;
    bestTotalReturn = bmath_1.ZERO; // Reset totalReturn as this time it will be
    // calculated with the EVM maths so the return is exactly what the user will get
    // after executing the transaction (given there are no front-runners)
    console.log('Number of paths: ', bestPaths.length);
    for (let i = 0; i < bestPaths.length; i++) {
        console.log('Length of path', i, ':', bestPaths[i].pools.length);
    }
    bestPaths.forEach((path, i) => {
        let swapAmount = bestSwapAmounts[i];
        // 0 swap amounts can occur due to rounding errors but we don't want to pass those on so filter out
        if (swapAmount.isZero()) return;
        if (swapAmount.gt(highestSwapAmt)) {
            highestSwapAmt = swapAmount;
            largestSwapPath = path;
        }
        totalSwapAmountWithRoundingErrors =
            totalSwapAmountWithRoundingErrors.plus(swapAmount);
        // // TODO: remove. To debug only!
        /*
        console.log(
            'Prices should be all very close (unless one of the paths is on the limit!'
        );
        console.log(
            getSpotPriceAfterSwapForPath(path, swapType, swapAmount).toNumber()
        );
            */
        let poolPairData = path.poolPairData;
        if (i == 0)
            // Store lenght of first path to add dust to correct rounding error at the end
            lenghtFirstPath = path.swaps.length;
        let pathSwaps = [];
        let amounts = [];
        let returnAmount;
        let n = poolPairData.length;
        amounts.push(swapAmount);
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            for (let i = 0; i < n; i++) {
                amounts.push(
                    helpersClass_1.EVMgetOutputAmountSwap(
                        path.pools[i],
                        poolPairData[i],
                        types_1.SwapTypes.SwapExactIn,
                        amounts[amounts.length - 1]
                    )
                );
                let swap = {
                    pool: path.swaps[i].pool,
                    tokenIn: path.swaps[i].tokenIn,
                    tokenOut: path.swaps[i].tokenOut,
                    swapAmount: amounts[i].toString(),
                    limitReturnAmount: minAmountOut.toString(),
                    maxPrice: maxPrice,
                    tokenInDecimals: path.poolPairData[i].decimalsIn.toString(),
                    tokenOutDecimals:
                        path.poolPairData[i].decimalsOut.toString(),
                };
                pathSwaps.push(swap);
            }
            returnAmount = amounts[n];
        } else {
            for (let i = 0; i < n; i++) {
                amounts.unshift(
                    helpersClass_1.EVMgetOutputAmountSwap(
                        path.pools[n - 1 - i],
                        poolPairData[n - 1 - i],
                        types_1.SwapTypes.SwapExactOut,
                        amounts[0]
                    )
                );
                let swap = {
                    pool: path.swaps[n - 1 - i].pool,
                    tokenIn: path.swaps[n - 1 - i].tokenIn,
                    tokenOut: path.swaps[n - 1 - i].tokenOut,
                    swapAmount: amounts[1].toString(),
                    limitReturnAmount: maxAmountIn,
                    maxPrice: maxPrice,
                    tokenInDecimals:
                        path.poolPairData[n - 1 - i].decimalsIn.toString(),
                    tokenOutDecimals:
                        path.poolPairData[n - 1 - i].decimalsOut.toString(),
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
        dust = totalSwapAmount.minus(totalSwapAmountWithRoundingErrors);
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            swaps[0][0].swapAmount = new bignumber_1.BigNumber(
                swaps[0][0].swapAmount
            )
                .plus(dust)
                .toString(); // Add dust to first swapExactIn
        } else {
            if (lenghtFirstPath == 1)
                // First path is a direct path (only one pool)
                swaps[0][0].swapAmount = new bignumber_1.BigNumber(
                    swaps[0][0].swapAmount
                )
                    .plus(dust)
                    .toString();
            // Add dust to first swapExactOut
            // First path is a multihop path (two pools)
            else
                swaps[0][1].swapAmount = new bignumber_1.BigNumber(
                    swaps[0][1].swapAmount
                )
                    .plus(dust)
                    .toString(); // Add dust to second swapExactOut
        }
    }
    let marketSp = bmath_1.ZERO;
    if (!bestTotalReturn.eq(0))
        marketSp = helpersClass_1.getSpotPriceAfterSwapForPath(
            largestSwapPath,
            swapType,
            bmath_1.ZERO
        );
    else {
        swaps = [];
        marketSp = bmath_1.ZERO;
        bestTotalReturnConsideringFees = bmath_1.ZERO;
    }
    return [swaps, bestTotalReturn, marketSp, bestTotalReturnConsideringFees];
};
//  For a given list of swapAmounts, gets list of pools with best effective price for these amounts
//  Always choose best pool for highest swapAmount first, then 2nd swapAmount and so on. This is
//  because it's best to use the best effective price for the highest amount to be traded
function getBestPathIds(pools, originalPaths, swapType, swapAmounts) {
    let sortedSwapAmounts;
    let bestPathIds = [];
    let selectedPaths = [];
    let selectedPathLimitAmounts = [];
    let selectedPathExceedingAmounts = [];
    // TODO find out which deep copy way is better: JSON.parse breaks bignumbers!!
    // let paths = JSON.parse(JSON.stringify(originalPaths)); // Deep copy to avoid changing the original path data
    let paths = [...originalPaths]; // Deep copy to avoid changing the original path data
    // Sort swapAmounts in descending order without changing original: https://stackoverflow.com/a/42442909
    sortedSwapAmounts = [...swapAmounts].sort((a, b) => {
        return b.minus(a).toNumber();
    });
    for (let i = 0; i < sortedSwapAmounts.length; i++) {
        let swapAmount = sortedSwapAmounts[i];
        // Find path that has best effective price
        let bestPathIndex = -1;
        let bestEffectivePrice = bmath_1.INFINITY; // Start with worst price possible
        paths.forEach((path, j) => {
            // Do not consider this path if its limit is below swapAmount
            if (path.limitAmount.gte(swapAmount)) {
                // Calculate effective price of this path for this swapAmount
                // If path.limitAmount = swapAmount we set effectivePrice as
                // Infinity because we know this path is maxed out and we want
                // to select other paths that can still be improved on
                let effectivePrice;
                if (path.limitAmount.eq(swapAmount)) {
                    effectivePrice = bmath_1.INFINITY;
                } else {
                    // TODO for optimization: pass already calculated limitAmount as input
                    // to getEffectivePriceSwapForPath()
                    effectivePrice =
                        helpersClass_1.getEffectivePriceSwapForPath(
                            pools,
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
    pools,
    selectedPaths,
    swapType,
    totalSwapAmount,
    swapAmounts,
    exceedingAmounts,
    pathLimitAmounts
) {
    let priceError = bmath_1.ONE; // Initialize priceError just so that while starts
    let prices = [];
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
    while (priceError.isGreaterThan(config_1.PRICE_ERROR_TOLERANCE)) {
        [prices, swapAmounts, exceedingAmounts] =
            iterateSwapAmountsApproximation(
                pools,
                selectedPaths,
                swapType,
                totalSwapAmount,
                swapAmounts,
                exceedingAmounts,
                pathLimitAmounts,
                iterationCount
            );
        let maxPrice = bignumber_1.BigNumber.max.apply(null, prices);
        let minPrice = bignumber_1.BigNumber.min.apply(null, prices);
        priceError = maxPrice.minus(minPrice).div(minPrice);
        iterationCount++;
        if (iterationCount > 100) break;
    }
    return [swapAmounts, exceedingAmounts];
}
function iterateSwapAmountsApproximation(
    pools,
    selectedPaths,
    swapType,
    totalSwapAmount,
    swapAmounts,
    exceedingAmounts, // This is the amount by which swapAmount exceeds the pool limit_amount
    pathLimitAmounts,
    iterationCount
) {
    let sumInverseDerivativeSPaSs = bmath_1.ZERO;
    let sumSPaSDividedByDerivativeSPaSs = bmath_1.ZERO;
    let SPaSs = [];
    let derivativeSPaSs = [];
    // We only iterate on the swapAmounts that are viable (i.e. no negative or > than path limit)
    // OR if this is the first time "iterateSwapAmountsApproximation" is called
    // within "iterateSwapAmounts()". In this case swapAmounts should be considered viable
    // also if they are on the limit.
    swapAmounts.forEach((swapAmount, i) => {
        // if (swapAmount.gt(ZERO) && exceedingAmounts[i].lt(ZERO)) {
        if (
            (iterationCount == 0 &&
                swapAmount.gte(bmath_1.ZERO) &&
                exceedingAmounts[i].lte(bmath_1.ZERO)) ||
            (iterationCount != 0 &&
                swapAmount.gt(bmath_1.ZERO) &&
                exceedingAmounts[i].lt(bmath_1.ZERO))
        ) {
            let path = selectedPaths[i];
            let SPaS = helpersClass_1.getSpotPriceAfterSwapForPath(
                path,
                swapType,
                swapAmount
            );
            SPaSs.push(SPaS);
            let derivative_SPaS =
                helpersClass_1.getDerivativeSpotPriceAfterSwapForPath(
                    path,
                    swapType,
                    swapAmount
                );
            derivativeSPaSs.push(derivative_SPaS);
            sumInverseDerivativeSPaSs = sumInverseDerivativeSPaSs.plus(
                bmath_1.ONE.div(derivative_SPaS)
            );
            sumSPaSDividedByDerivativeSPaSs =
                sumSPaSDividedByDerivativeSPaSs.plus(SPaS.div(derivative_SPaS));
        } else {
            // This swapAmount is not viable but we push to keep list length consistent
            derivativeSPaSs.push(bmath_1.bnum('NaN'));
            SPaSs.push(bmath_1.bnum('NaN'));
        }
    });
    // // This division using BigNumber below lost precision. Its result was for example
    // 1.042818e-12 while using normal js math operations it was
    // 1.0428184989387553e-12. This loss of precision caused an important bug
    // let weighted_average_SPaS = sumSPaSDividedByDerivativeSPaSs.div(
    //     sumInverseDerivativeSPaSs
    // );
    let weighted_average_SPaS = bmath_1.bnum(
        sumSPaSDividedByDerivativeSPaSs.toNumber() /
            sumInverseDerivativeSPaSs.toNumber()
    );
    swapAmounts.forEach((swapAmount, i) => {
        if (
            (iterationCount == 0 &&
                swapAmount.gte(bmath_1.ZERO) &&
                exceedingAmounts[i].lte(bmath_1.ZERO)) ||
            (iterationCount != 0 &&
                swapAmount.gt(bmath_1.ZERO) &&
                exceedingAmounts[i].lt(bmath_1.ZERO))
        ) {
            let deltaSwapAmount = weighted_average_SPaS
                .minus(SPaSs[i])
                .div(derivativeSPaSs[i]);
            swapAmounts[i] = swapAmounts[i].plus(deltaSwapAmount);
            exceedingAmounts[i] = exceedingAmounts[i].plus(deltaSwapAmount);
        }
    });
    // Make sure no input amount is negative or above the path limit
    while (
        bignumber_1.BigNumber.min.apply(null, swapAmounts).lt(bmath_1.ZERO) ||
        bignumber_1.BigNumber.max.apply(null, exceedingAmounts).gt(bmath_1.ZERO)
    ) {
        [swapAmounts, exceedingAmounts] = redistributeInputAmounts(
            swapAmounts,
            exceedingAmounts,
            derivativeSPaSs
        );
    }
    let pricesForViableAmounts = []; // Get prices for all non-negative AND below-limit input amounts
    let swapAmountsSumWithRoundingErrors = bmath_1.ZERO;
    swapAmounts.forEach((swapAmount, i) => {
        swapAmountsSumWithRoundingErrors =
            swapAmountsSumWithRoundingErrors.plus(swapAmount);
        if (
            (iterationCount == 0 &&
                swapAmount.gte(bmath_1.ZERO) &&
                exceedingAmounts[i].lte(bmath_1.ZERO)) ||
            (iterationCount != 0 &&
                swapAmount.gt(bmath_1.ZERO) &&
                exceedingAmounts[i].lt(bmath_1.ZERO))
        )
            pricesForViableAmounts.push(
                helpersClass_1.getSpotPriceAfterSwapForPath(
                    selectedPaths[i],
                    swapType,
                    swapAmount
                )
            );
    });
    let roundingError = totalSwapAmount.minus(swapAmountsSumWithRoundingErrors);
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
        if (
            swapAmounts[i].gt(bmath_1.ZERO) &&
            exceedingAmounts[i].lt(bmath_1.ZERO)
        ) {
            if (
                swapAmounts[i].plus(roundingError).gt(bmath_1.ZERO) &&
                exceedingAmounts[i].plus(roundingError).lt(bmath_1.ZERO)
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
    swapAmounts,
    exceedingAmounts,
    derivativeSPaSs
) {
    let sumInverseDerivativeSPaSsForViableAmounts = bmath_1.ZERO;
    let sumInverseDerivativeSPaSsForNegativeAmounts = bmath_1.ZERO;
    let sumInverseDerivativeSPaSsForExceedingAmounts = bmath_1.ZERO;
    let sumNegativeOrExceedingSwapAmounts = bmath_1.ZERO;
    swapAmounts.forEach((swapAmount, i) => {
        // Amount is negative
        if (swapAmount.lte(bmath_1.ZERO)) {
            sumNegativeOrExceedingSwapAmounts =
                sumNegativeOrExceedingSwapAmounts.plus(swapAmount);
            sumInverseDerivativeSPaSsForNegativeAmounts =
                sumInverseDerivativeSPaSsForNegativeAmounts.plus(
                    bmath_1.ONE.div(derivativeSPaSs[i])
                );
        }
        // Amount is above limit (exceeding > 0)
        else if (exceedingAmounts[i].gte(bmath_1.ZERO)) {
            sumNegativeOrExceedingSwapAmounts =
                sumNegativeOrExceedingSwapAmounts.plus(exceedingAmounts[i]);
            sumInverseDerivativeSPaSsForExceedingAmounts =
                sumInverseDerivativeSPaSsForExceedingAmounts.plus(
                    bmath_1.ONE.div(derivativeSPaSs[i])
                );
        }
        // Sum the inverse of the derivative if the swapAmount is viable,
        // i.e. if swapAmount > 0 or swapAmount < limit
        else
            sumInverseDerivativeSPaSsForViableAmounts =
                sumInverseDerivativeSPaSsForViableAmounts.plus(
                    bmath_1.ONE.div(derivativeSPaSs[i])
                );
    });
    // Now redestribute sumNegativeOrExceedingSwapAmounts
    // to non-exceeding pools if sumNegativeOrExceedingSwapAmounts > 0
    // or to non zero swapAmount pools if sumNegativeOrExceedingSwapAmounts < 0
    swapAmounts.forEach((swapAmount, i) => {
        if (swapAmount.lte(bmath_1.ZERO)) {
            swapAmounts[i] = bmath_1.ZERO;
            exceedingAmounts[i] = exceedingAmounts[i].minus(swapAmount);
        } else if (exceedingAmounts[i].gte(bmath_1.ZERO)) {
            swapAmounts[i] = swapAmounts[i].minus(exceedingAmounts[i]); // This is the same as swapAmounts[i] = pathLimitAmounts[i]
            exceedingAmounts[i] = bmath_1.ZERO;
        } else {
            let deltaSwapAmount = sumNegativeOrExceedingSwapAmounts
                .times(bmath_1.ONE.div(derivativeSPaSs[i]))
                .div(sumInverseDerivativeSPaSsForViableAmounts);
            swapAmounts[i] = swapAmounts[i].plus(deltaSwapAmount);
            exceedingAmounts[i] = exceedingAmounts[i].plus(deltaSwapAmount);
        }
    });
    // If there were no viable amounts (i.e all amounts were either negative or above limit)
    // We run this extra loop to redistribute the excess
    if (sumInverseDerivativeSPaSsForViableAmounts.isZero()) {
        if (sumNegativeOrExceedingSwapAmounts.lt(bmath_1.ZERO)) {
            // This means we need to redistribute to the exceeding amounts that
            // were now set to the limit
            swapAmounts.forEach((swapAmount, i) => {
                if (exceedingAmounts[i].isZero()) {
                    let deltaSwapAmount = sumNegativeOrExceedingSwapAmounts
                        .times(bmath_1.ONE.div(derivativeSPaSs[i]))
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
                    let deltaSwapAmount = sumNegativeOrExceedingSwapAmounts
                        .times(bmath_1.ONE.div(derivativeSPaSs[i]))
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
exports.calcTotalReturn = (paths, swapType, swapAmounts) => {
    let totalReturn = new bignumber_1.BigNumber(0);
    // changing the contents of pools (parameter passed as reference)
    paths.forEach((path, i) => {
        totalReturn = totalReturn.plus(
            helpersClass_1.getOutputAmountSwapForPath(
                path,
                swapType,
                swapAmounts[i]
            )
        );
    });
    return totalReturn;
};
