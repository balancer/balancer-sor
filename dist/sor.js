'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const helpers_1 = require('./helpers');
const bmath_1 = require('./bmath');
const bignumber_1 = require('./utils/bignumber');
const constants_1 = require('@ethersproject/constants');
// TODO give the option to choose a % of slippage beyond current price?
exports.MAX_UINT = constants_1.MaxUint256;
const minAmountOut = 0;
const maxAmountIn = exports.MAX_UINT;
const maxPrice = exports.MAX_UINT;
function processPaths(paths, pools, swapType) {
    let poolPairData = {};
    paths.forEach(path => {
        let swaps = path.swaps;
        // Get and store PoolPairData for swaps in path as these are used across all following get functions
        if (swaps.length == 1) {
            let swap1 = swaps[0];
            let id = `${swap1.pool}${swap1.tokenIn}${swap1.tokenOut}`;
            if (poolPairData[id] === undefined) {
                let poolSwap1 = pools[swap1.pool];
                let poolPairDataSwap1 = helpers_1.parsePoolPairData(
                    poolSwap1,
                    swap1.tokenIn,
                    swap1.tokenOut
                );
                let sp = helpers_1.getSpotPrice(poolPairDataSwap1);
                poolPairData[id] = { poolPairData: poolPairDataSwap1, sp: sp };
            }
        } else if (swaps.length == 2) {
            let swap1 = swaps[0];
            let id = `${swap1.pool}${swap1.tokenIn}${swap1.tokenOut}`;
            if (poolPairData[id] === undefined) {
                let poolSwap1 = pools[swap1.pool];
                let poolPairDataSwap1 = helpers_1.parsePoolPairData(
                    poolSwap1,
                    swap1.tokenIn,
                    swap1.tokenOut
                );
                let sp = helpers_1.getSpotPrice(poolPairDataSwap1);
                poolPairData[id] = { poolPairData: poolPairDataSwap1, sp: sp };
            }
            let swap2 = swaps[1];
            id = `${swap2.pool}${swap2.tokenIn}${swap2.tokenOut}`;
            if (poolPairData[id] === undefined) {
                let poolSwap2 = pools[swap2.pool];
                let poolPairDataSwap2 = helpers_1.parsePoolPairData(
                    poolSwap2,
                    swap2.tokenIn,
                    swap2.tokenOut
                );
                let sp = helpers_1.getSpotPrice(poolPairDataSwap2);
                poolPairData[id] = { poolPairData: poolPairDataSwap2, sp: sp };
            }
        }
        path.spotPrice = helpers_1.getSpotPricePath(pools, path, poolPairData);
        path.slippage = helpers_1.getSlippageLinearizedSpotPriceAfterSwapPath(
            pools,
            path,
            swapType,
            poolPairData
        );
        path.limitAmount = helpers_1.getLimitAmountSwapPath(
            pools,
            path,
            swapType,
            poolPairData
        );
    });
    let sortedPaths = paths.sort((a, b) => {
        return a.spotPrice.minus(b.spotPrice).toNumber();
    });
    return sortedPaths;
}
exports.processPaths = processPaths;
function processEpsOfInterestMultiHop(sortedPaths, swapType, maxPools) {
    // Given sortedPaths, this function builds the list of prices of interest
    // wich is composed of all the spot prices of each of the paths and also
    // all the swap prices, i.e. prices where the chart of spot price after trade vs.
    // amount traded of any two pools cross. This means that up until that swap price
    // it's better to trade with one pool, but after that swap price it's better to trade with
    // the other.
    let pricesOfInterest = getPricesOfInterest(sortedPaths, swapType);
    // Sort all prices of interest in ascending order
    pricesOfInterest = pricesOfInterest.sort((a, b) => {
        return a.price.minus(b.price).toNumber();
    });
    // For each price of interest we calculate the list of best paths.
    // This list is built based on the information of prices of interest where
    // paths cross (i.e. one becomes better that the other). We only keep a list
    // of up to maxPools pathIds as we know we won't ever need more than that
    // since each path has at least one pool
    pricesOfInterest = calculateBestPathIdsForPricesOfInterest(
        pricesOfInterest,
        maxPools
    );
    // For each price of interest and list of best path ids, calculate how much
    // each of these paths would trade in order to get to that price of interest
    pricesOfInterest.forEach(poi => {
        let pathIds = poi.bestPathsIds;
        let price = poi.price;
        poi.amounts = getSwapAmountsForPriceOfInterest(
            sortedPaths,
            pathIds,
            price
        );
    });
    return pricesOfInterest;
}
exports.processEpsOfInterestMultiHop = processEpsOfInterestMultiHop;
/*
< INPUTS >
pools: pools information
paths: paths information
swapType: 'swapExactIn' or 'swapExactOut'.
totalSwapAmount: the amount of tokenIn to sell if swapType == 'swapExactIn' OR
                 the amount of tokenOut to buy if swapType == 'swapExactOut'
maxPools: the maximum number of pools accepted for the SOR final swaps suggestion
costReturnToken: how much in outputToken the gas for trading with one pool costs
                 Notice that outputToken is tokenOut if swapType == 'swapExactIn'
                 and tokenIn if swapType == 'swapExactOut'
pricesOfInterest: pricesOfInterest built previously by other functions

< OUTPUTS >
swaps: information of the optimal swaps
bestTotalReturn: amount of tokenOut the swaps will return if swapType == 'swapExactIn'
                amount of tokenIn the swaps will pull if swapType == 'swapExactOut'
*/
exports.smartOrderRouterMultiHopEpsOfInterest = (
    pools,
    paths,
    swapType,
    totalSwapAmount,
    maxPools,
    costReturnToken,
    pricesOfInterest
) => {
    let bestTotalReturn = new bignumber_1.BigNumber(0);
    let bestTotalReturnConsideringFees = new bignumber_1.BigNumber(0);
    let highestPoiNotEnough = true;
    let pathIds, totalReturn, totalReturnConsideringFees;
    let bestSwapAmounts = [],
        bestPathIds,
        swapAmounts;
    let bmin = paths.length + 1;
    // First get the optimal totalReturn to trade 'totalSwapAmount' with
    // one path only (b=1). Then increase the number of pools as long as
    // improvementCondition is true (see more information below)
    for (let b = 1; b <= bmin; b++) {
        totalReturn = 0;
        let priceBefore, swapAmountsPriceBefore, swapAmountsPriceAfter;
        // Sweep all pricesOfInterest until we reach the amount we aim for (totalSwapAmount)
        for (let i = 0; i < pricesOfInterest.length; i++) {
            if (i === 0) {
                priceBefore = pricesOfInterest[i];
                continue;
            }
            let swapAmountsAfter = pricesOfInterest[i].amounts;
            let totalInputAmountAfter = swapAmountsAfter
                .slice(0, b)
                .reduce((a, b) => a.plus(b));
            // If totalInputAmountAfter is greater than totalSwapAmount we know
            // we found a solution to trade, now all we need to do is interpolate
            // between swapAmountsPriceBefore and swapAmountsPriceAfter
            if (totalInputAmountAfter.isGreaterThan(totalSwapAmount)) {
                pathIds = priceBefore.bestPathsIds.slice(0, b);
                swapAmountsPriceBefore = priceBefore.amounts.slice(0, b);
                swapAmountsPriceAfter = pricesOfInterest[i].amounts.slice(0, b);
                swapAmounts = getExactSwapAmounts(
                    swapAmountsPriceBefore,
                    swapAmountsPriceAfter,
                    totalSwapAmount
                );
                // We found a priceOfInterest that can yield enough amount for trade
                highestPoiNotEnough = false;
                break;
            }
            priceBefore = pricesOfInterest[i];
        }
        // If we swept the whole table with pricesOfInterest and didn't get enough amounts
        // it means that Balancer does not have enough liquidity for this totalSwapAmount.
        // We return an empty list of swaps to represent this exception case.
        if (highestPoiNotEnough) {
            pathIds = [];
            swapAmounts = [];
        }
        totalReturn = exports.calcTotalReturn(
            pools,
            paths,
            swapType,
            pathIds,
            swapAmounts
        );
        // Calculates the number of pools in all the paths to include the gas costs
        let totalNumberOfPools = 0;
        pathIds.forEach((pathId, i) => {
            // Find path data
            const path = paths.find(p => p.id === pathId);
            totalNumberOfPools += path.swaps.length;
        });
        // improvementCondition is true if we are improving the totalReturn
        // Notice that totalReturn has to be maximized for 'swapExactIn'
        // and MINIMIZED for 'swapExactOut'
        // This is because for the case of 'swapExactOut', totalReturn means the
        // amount of tokenIn needed to buy totalSwapAmount of tokenOut
        let improvementCondition = false;
        if (totalNumberOfPools <= maxPools) {
            if (swapType === 'swapExactIn') {
                totalReturnConsideringFees = totalReturn.minus(
                    bmath_1.bmul(
                        new bignumber_1.BigNumber(totalNumberOfPools).times(
                            bmath_1.BONE
                        ),
                        costReturnToken
                    )
                );
                improvementCondition =
                    totalReturnConsideringFees.isGreaterThan(
                        bestTotalReturnConsideringFees
                    ) || b === 1; // b === 1 means its the first iteration so bestTotalReturnConsideringFees isn't currently a value
            } else {
                totalReturnConsideringFees = totalReturn.plus(
                    bmath_1.bmul(
                        new bignumber_1.BigNumber(totalNumberOfPools).times(
                            bmath_1.BONE
                        ),
                        costReturnToken
                    )
                );
                improvementCondition =
                    totalReturnConsideringFees.isLessThan(
                        bestTotalReturnConsideringFees
                    ) || b === 1; // b === 1 means its the first iteration so bestTotalReturnConsideringFees isn't currently a value
            }
        }
        if (improvementCondition === true) {
            bestSwapAmounts = swapAmounts;
            bestPathIds = pathIds;
            bestTotalReturn = totalReturn;
            bestTotalReturnConsideringFees = totalReturnConsideringFees;
        } else {
            break;
        }
    }
    //// Prepare swap data from paths
    let swaps = [];
    let totalSwapAmountWithRoundingErrors = new bignumber_1.BigNumber(0);
    let dust = new bignumber_1.BigNumber(0);
    let lenghtFirstPath;
    // TODO: change all inputAmount variable names to swapAmount
    bestSwapAmounts.forEach((swapAmount, i) => {
        totalSwapAmountWithRoundingErrors = totalSwapAmountWithRoundingErrors.plus(
            swapAmount
        );
        // Find path data
        const path = paths.find(p => p.id === bestPathIds[i]);
        if (!path) {
            throw new Error(
                '[Invariant] No pool found for selected pool index' +
                    bestPathIds[i]
            );
        }
        // // TODO: remove. To debug only!
        // printSpotPricePathBeforeAndAfterSwap(path, swapType, swapAmount);
        if (i == 0)
            // Store lenght of first path to add dust to correct rounding error at the end
            lenghtFirstPath = path.swaps.length;
        if (path.swaps.length == 1) {
            // Direct trade: add swap from only pool
            let swap = {
                pool: path.swaps[0].pool,
                tokenIn: path.swaps[0].tokenIn,
                tokenOut: path.swaps[0].tokenOut,
                swapAmount: swapAmount.toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push([swap]);
        } else {
            // Multi-hop:
            let swap1 = path.swaps[0];
            let poolSwap1 = pools[swap1.pool];
            let poolPairDataSwap1 = helpers_1.parsePoolPairData(
                poolSwap1,
                swap1.tokenIn,
                swap1.tokenOut
            );
            let swap2 = path.swaps[1];
            let poolSwap2 = pools[swap2.pool];
            let poolPairDataSwap2 = helpers_1.parsePoolPairData(
                poolSwap2,
                swap2.tokenIn,
                swap2.tokenOut
            );
            // Add swap from first pool
            let swap1hop = {
                pool: path.swaps[0].pool,
                tokenIn: path.swaps[0].tokenIn,
                tokenOut: path.swaps[0].tokenOut,
                swapAmount:
                    swapType === 'swapExactIn'
                        ? swapAmount.toString()
                        : helpers_1
                              .getReturnAmountSwap(
                                  pools,
                                  poolPairDataSwap2,
                                  swapType,
                                  swapAmount
                              )
                              .toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };
            // Add swap from second pool
            let swap2hop = {
                pool: path.swaps[1].pool,
                tokenIn: path.swaps[1].tokenIn,
                tokenOut: path.swaps[1].tokenOut,
                swapAmount:
                    swapType === 'swapExactIn'
                        ? helpers_1
                              .getReturnAmountSwap(
                                  pools,
                                  poolPairDataSwap1,
                                  swapType,
                                  swapAmount
                              )
                              .toString()
                        : swapAmount.toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push([swap1hop, swap2hop]);
        }
        // Updates the pools in the path with the swaps so that if
        // the new paths use these pools they will have the updated balances
        helpers_1.getReturnAmountSwapPath(pools, path, swapType, swapAmount);
    });
    // Since the individual swapAmounts for each path are integers, the sum of all swapAmounts
    // might not be exactly equal to the totalSwapAmount the user requested. We need to correct that rounding error
    // and we do that by adding the rounding error to the first path.
    if (swaps.length > 0) {
        dust = totalSwapAmount.minus(totalSwapAmountWithRoundingErrors);
        if (swapType === 'swapExactIn') {
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
    console.log(`!!!!!!! SOR Debug`);
    console.log(swaps);
    console.log(totalReturnConsideringFees.toString());
    console.log(bestTotalReturnConsideringFees.toString());
    console.log(
        bmath_1
            .bmul(
                new bignumber_1.BigNumber(1.5).times(bmath_1.BONE),
                costReturnToken
            )
            .toString()
    );
    // totalReturnConsideringFees is used to compare V1 vs V2 liquidity
    // To consider the fact that V1 uses the exchangeProxy we should add a constant initial 150k gas
    // as we want for our UI to clearly choose V2 if both V1 and V2 have exactly the same liquidity and both are using a single pair swap
    // We currently have a swap cost set to 100k for V1 and to take the fees into account we use costOutputToken which is gasPrice * swapCost * tokenPriceWei
    // So we use 1.5 * costOutputToken as the extra 150k gas.
    let totalReturnWithFeesAndExtra;
    if (swapType === 'swapExactIn')
        totalReturnWithFeesAndExtra = bestTotalReturnConsideringFees.minus(
            bmath_1.bmul(
                new bignumber_1.BigNumber(1.5).times(bmath_1.BONE),
                costReturnToken
            )
        );
    else
        totalReturnWithFeesAndExtra = bestTotalReturnConsideringFees.plus(
            bmath_1.bmul(
                new bignumber_1.BigNumber(1.5).times(bmath_1.BONE),
                costReturnToken
            )
        );
    return [swaps, bestTotalReturn, totalReturnWithFeesAndExtra];
};
function getPricesOfInterest(sortedPaths, swapType) {
    let pricesOfInterest = [];
    sortedPaths.forEach((path, i) => {
        // For every new path we get the spotPrice of the path as a price of interest
        let pi = {};
        pi.price = path.spotPrice;
        pi.id = path.id;
        pricesOfInterest.push(pi);
        // Get the max amount that can be traded for this path
        pi = {};
        pi.price = path.spotPrice.plus(
            bmath_1.bmul(
                bmath_1.bmul(path.limitAmount, path.slippage),
                path.spotPrice
            )
        );
        pi.maxAmount = path.id;
        // Add price of interest
        pricesOfInterest.push(pi);
        // slippagePriceFactor is the slope of the chart for this path.
        // Slippage (SL) has to be multiplied by spotPrice (SP) because
        // we have defined the linearized spot price after trade (SPaT) as:
        // SPaT (A) = SP * (1 + SL * A)      so if we want the slope we do:
        // SPaT (A) = SP + SL*SP * A         the slope is therefore SL * SP
        path.slippagePriceFactor = bmath_1.bmul(path.slippage, path.spotPrice);
        // Now we have to check if this path we just added will cross with other
        // previously added paths. For that we need to run a for loop with all the
        // previous paths and analyse all the different possibilities of them crossing.
        // A detailed explanation of each of the cases can be found here:
        // https://drive.google.com/file/d/1vNWyfAMGtieWK6Vksj4oUJcOKF7FqanV/view
        for (let k = 0; k < i; k++) {
            let prevPath = sortedPaths[k];
            // let prevSlippageFactor = slippageFactors[prevPath.id];
            let prevSlippageFactor = prevPath.slippagePriceFactor;
            // If the slippagePriceFactor of this path is less than that of the
            // previous than they will cross at amountCross:
            if (path.slippagePriceFactor.isLessThan(prevSlippageFactor)) {
                let amountCross = bmath_1.bdiv(
                    path.spotPrice.minus(prevPath.spotPrice),
                    prevSlippageFactor.minus(path.slippagePriceFactor)
                );
                // Check for case A
                if (
                    amountCross.isLessThan(path.limitAmount) &&
                    amountCross.isLessThan(prevPath.limitAmount)
                ) {
                    let epiA = {};
                    epiA.price = path.spotPrice.plus(
                        bmath_1.bmul(amountCross, path.slippagePriceFactor)
                    );
                    // Add price of interest with the information of the paths ids
                    // that are crossing in the format [demoted path, promoted path],
                    // which means the first pathId is the one that's becoming worse after
                    // the cross, and the second path is becoming better.
                    epiA.swap = [prevPath.id, path.id]; // TODO change 'swap' for 'cross' to avoid confusion
                    pricesOfInterest.push(epiA);
                }
                // Check for case B
                if (
                    prevPath.limitAmount.isLessThan(path.limitAmount) &&
                    prevPath.limitAmount.isLessThan(amountCross)
                ) {
                    let epiB = {};
                    epiB.price = path.spotPrice.plus(
                        bmath_1.bmul(
                            prevPath.limitAmount,
                            path.slippagePriceFactor
                        )
                    );
                    // Add cross information similarly to case A above
                    epiB.swap = [prevPath.id, path.id];
                    pricesOfInterest.push(epiB);
                }
                // Check for case C
                if (
                    path.limitAmount.isLessThan(prevPath.limitAmount) &&
                    amountCross.isLessThan(path.limitAmount)
                ) {
                    let epiC = {};
                    epiC.price = prevPath.spotPrice.plus(
                        bmath_1.bmul(path.limitAmount, prevSlippageFactor)
                    );
                    // Add cross information similarly to case A above
                    epiC.swap = [path.id, prevPath.id];
                    pricesOfInterest.push(epiC);
                }
            } else {
                // This means the paths won't normally cross, so only case where
                // this could happen is if the limitAmount of the previous path
                // is lower than that of this path
                if (prevPath.limitAmount.isLessThan(path.limitAmount)) {
                    let epiD = {};
                    epiD.price = path.spotPrice.plus(
                        bmath_1.bmul(
                            prevPath.limitAmount,
                            path.slippagePriceFactor
                        )
                    );
                    // Add cross information similarly to case A above
                    epiD.swap = [prevPath.id, path.id];
                    pricesOfInterest.push(epiD);
                }
            }
        }
    });
    return pricesOfInterest;
}
function calculateBestPathIdsForPricesOfInterest(pricesOfInterest, maxPools) {
    let bestPathsIds = [];
    pricesOfInterest.forEach((poi, i) => {
        if (poi.id != null) {
            // Only add to bestPathsIds if the amount of paths length hasn't reached maxPools
            // This is a conservative choice as with with number of paths = maxPools we guarantee we have information
            // necessary to find up to maxPools pools, as each path has at least 1 pool.
            if (bestPathsIds.length < maxPools) bestPathsIds.push(poi.id);
        } else if (poi.swap) {
            let index1 = bestPathsIds.indexOf(poi.swap[0]);
            let index2 = bestPathsIds.indexOf(poi.swap[1]);
            if (index1 != -1) {
                if (index2 != -1) {
                    // If both paths are already in bestPaths then we have to
                    // make sure index1 < index2 to avoid a bug in an edge case
                    // where multiple paths swaps happen at the exact same priceOfInterest
                    if (index1 < index2) {
                        let bestPath1 = bestPathsIds[index1];
                        let bestPath2 = bestPathsIds[index2];
                        bestPathsIds[index1] = bestPath2;
                        bestPathsIds[index2] = bestPath1;
                    }
                } else {
                    bestPathsIds[index1] = poi.swap[1];
                }
            }
        } else if (poi.maxAmount) {
            // Do nothing
        } else {
            console.log(poi);
            console.error(
                'ERROR: poolID or swap not found in pricesOfInterest'
            );
        }
        pricesOfInterest[i].bestPathsIds = bestPathsIds.slice();
    });
    return pricesOfInterest;
}
function getSwapAmountsForPriceOfInterest(paths, pathIds, poi) {
    let swapAmounts = [];
    pathIds.forEach((bid, i) => {
        let path = paths.find(obj => {
            return obj.id === bid;
        });
        let inputAmount = bmath_1.bdiv(
            poi.minus(path.spotPrice),
            path.slippagePriceFactor
        );
        if (inputAmount.isNaN()) inputAmount = bmath_1.bnum(0);
        if (path.limitAmount.isLessThan(inputAmount)) {
            inputAmount = path.limitAmount;
        }
        swapAmounts.push(inputAmount);
    });
    return swapAmounts;
}
exports.calcTotalReturn = (pools, paths, swapType, pathIds, swapAmounts) => {
    let path;
    let totalReturn = new bignumber_1.BigNumber(0);
    let poolsClone = JSON.parse(JSON.stringify(pools)); // we create a clone to avoid
    // changing the contents of pools (parameter passed as reference)
    pathIds.forEach((b, i) => {
        path = paths.find(obj => {
            return obj.id === b;
        });
        totalReturn = totalReturn.plus(
            helpers_1.getReturnAmountSwapPath(
                poolsClone,
                path,
                swapType,
                swapAmounts[i]
            )
        );
    });
    return totalReturn;
};
function getExactSwapAmounts(
    swapAmountsPriceBefore,
    swapAmountsPriceAfter,
    totalSwapAmountWithRoundingErrors
) {
    let deltaBeforeAfterAmounts = [];
    if (
        swapAmountsPriceAfter[swapAmountsPriceAfter.length - 1].isEqualTo(
            new bignumber_1.BigNumber(0)
        )
    )
        swapAmountsPriceAfter.pop();
    swapAmountsPriceAfter.forEach((a, i) => {
        let diff = a.minus(swapAmountsPriceBefore[i]);
        deltaBeforeAfterAmounts.push(diff);
    });
    let totalInputBefore = swapAmountsPriceBefore.reduce((a, b) => a.plus(b));
    let totalInputAfter = swapAmountsPriceAfter.reduce((a, b) => a.plus(b));
    let deltaTotalInput = totalInputAfter.minus(totalInputBefore);
    let deltaTimesTarget = [];
    deltaBeforeAfterAmounts.forEach((a, i) => {
        let ratio = bmath_1.bdiv(
            totalSwapAmountWithRoundingErrors.minus(totalInputBefore),
            deltaTotalInput
        );
        let deltaAmount = bmath_1.bmul(ratio, a);
        deltaTimesTarget.push(deltaAmount);
    });
    let swapAmounts = [];
    swapAmountsPriceBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        swapAmounts.push(add);
    });
    return swapAmounts;
}
