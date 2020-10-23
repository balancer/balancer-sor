'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const helpers_1 = require('./helpers');
const bmath_1 = require('./bmath');
const bignumber_1 = require('./utils/bignumber');
const ethers_1 = require('ethers');
// TODO give the option to choose a % of slippage beyond current price?
exports.MAX_UINT = ethers_1.utils.bigNumberify(
    ethers_1.ethers.constants.MaxUint256
);
const minAmountOut = 0;
const maxAmountIn = exports.MAX_UINT;
const maxPrice = exports.MAX_UINT;
// TODO: build sortedPaths inside forEach loop to avoid having to do an expensive sort() operation
function processPaths(paths, pools, swapType) {
    paths.forEach(b => {
        b.spotPrice = helpers_1.getSpotPricePath(pools, b);
        b.slippage = helpers_1.getSlippageLinearizedSpotPriceAfterSwapPath(
            pools,
            b,
            swapType
        );
        b.limitAmount = helpers_1.getLimitAmountSwapPath(pools, b, swapType);
    });
    let sortedPaths = paths.sort((a, b) => {
        return a.spotPrice.minus(b.spotPrice).toNumber();
    });
    return sortedPaths;
}
exports.processPaths = processPaths;
function processEpsOfInterestMultiHop(sortedPaths, swapType, maxPools) {
    let pricesOfInterest = getPricesOfInterest(sortedPaths, swapType).sort(
        (a, b) => {
            return a.price.minus(b.price).toNumber();
        }
    );
    pricesOfInterest = calculateBestPathIdsForPricesOfInterest(
        pricesOfInterest,
        maxPools
    );
    pricesOfInterest.forEach(poi => {
        let pathIds = poi.bestPathsIds;
        let price = poi.price;
        poi.amounts = getSwapAmountsForPriceOfInterest(
            sortedPaths,
            pathIds,
            price
        );
    });
    console.log(`************ POI 3 **************`);
    console.log(pricesOfInterest);
    pricesOfInterest.forEach(price => {
        console.log(price.id);
        console.log(price.price.toString());
        console.log(price.amounts.toString());
    });
    console.log(`**************************`);
    return pricesOfInterest;
}
exports.processEpsOfInterestMultiHop = processEpsOfInterestMultiHop;
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
    let bestSwapAmounts, bestPathIds, swapAmounts;
    let bmin = paths.length + 1;
    for (let b = 1; b <= bmin; b++) {
        totalReturn = 0;
        let price,
            priceAfter,
            priceBefore,
            swapAmountsPriceBefore,
            swapAmountsPriceAfter;
        for (let i = 0; i < pricesOfInterest.length; i++) {
            price = pricesOfInterest[i];
            priceAfter = price;
            if (i === 0) {
                priceBefore = priceAfter;
                continue;
            }
            let swapAmountsAfter = priceAfter.amounts;
            let totalInputAmountAfter = swapAmountsAfter
                .slice(0, b)
                .reduce((a, b) => a.plus(b));
            if (totalInputAmountAfter.isGreaterThan(totalSwapAmount)) {
                pathIds = priceBefore.bestPathsIds.slice(0, b);
                swapAmountsPriceBefore = priceBefore.amounts.slice(0, b);
                swapAmountsPriceAfter = priceAfter.amounts.slice(0, b);
                swapAmounts = getExactSwapAmounts(
                    swapAmountsPriceBefore,
                    swapAmountsPriceAfter,
                    totalSwapAmount
                );
                // console.log("swapAmountsPriceBefore");
                // console.log(swapAmountsPriceBefore.toString());
                // console.log("swapAmountsPriceAfter");
                // console.log(swapAmountsPriceAfter.toString());
                // console.log("totalSwapAmount");
                // console.log(totalSwapAmount.toString());
                // console.log("swapAmounts");
                // console.log(swapAmounts.toString());
                highestPoiNotEnough = false;
                break;
            }
            priceBefore = priceAfter;
        }
        if (highestPoiNotEnough) {
            pathIds = [];
            swapAmounts = [];
        }
        // console.log("calcTotalReturn")
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
        // console.log("Number of pools in all paths: ")
        // console.log(totalNumberOfPools)
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
                    ) ||
                    bestTotalReturnConsideringFees.isEqualTo(
                        new bignumber_1.BigNumber(0)
                    );
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
                    ) ||
                    bestTotalReturnConsideringFees.isEqualTo(
                        new bignumber_1.BigNumber(0)
                    );
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
    // console.log("Best solution found")
    // console.log(bestSwapAmounts.toString());
    // console.log(bestPathIds);
    // console.log(bestTotalReturn.toString());
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
    return [swaps, bestTotalReturn];
};
function getPricesOfInterest(sortedPaths, swapType) {
    let pricesOfInterest = [];
    sortedPaths.forEach((b, i) => {
        // New pool
        let pi = {};
        pi.price = b.spotPrice;
        pi.id = b.id;
        pricesOfInterest.push(pi);
        // Max amount for this pool
        pi = {};
        console.log(`getPricesOfInterest`);
        console.log(`limitAmt: ${b.limitAmount.toString()}`);
        console.log(`slippage: ${b.slippage.toString()}`);
        console.log(`spotPrice: ${b.spotPrice.toString()}`);
        pi.price = b.spotPrice.plus(
            bmath_1.bmul(b.limitAmount, bmath_1.bmul(b.slippage, b.spotPrice))
        );
        console.log(`calc price: ${pi.price.toString()}`);
        pi.maxAmount = b.id;
        pricesOfInterest.push(pi);
        for (let k = 0; k < i; k++) {
            let prevPath = sortedPaths[k];
            if (
                bmath_1
                    .bmul(b.slippage, b.spotPrice)
                    .isLessThan(
                        bmath_1.bmul(prevPath.slippage, prevPath.spotPrice)
                    )
            ) {
                let amountCross = bmath_1.bdiv(
                    b.spotPrice.minus(prevPath.spotPrice),
                    bmath_1
                        .bmul(prevPath.slippage, prevPath.spotPrice)
                        .minus(bmath_1.bmul(b.slippage, b.spotPrice))
                );
                if (
                    amountCross.isLessThan(b.limitAmount) &&
                    amountCross.isLessThan(prevPath.limitAmount)
                ) {
                    let epiA = {};
                    epiA.price = b.spotPrice.plus(
                        bmath_1.bmul(
                            amountCross,
                            bmath_1.bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epiA.swap = [prevPath.id, b.id];
                    pricesOfInterest.push(epiA);
                }
                if (
                    prevPath.limitAmount.isLessThan(b.limitAmount) &&
                    prevPath.limitAmount.isLessThan(amountCross)
                ) {
                    let epiB = {};
                    epiB.price = b.spotPrice.plus(
                        bmath_1.bmul(
                            prevPath.limitAmount,
                            bmath_1.bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epiB.swap = [prevPath.id, b.id];
                    pricesOfInterest.push(epiB);
                }
                if (
                    b.limitAmount.isLessThan(prevPath.limitAmount) &&
                    amountCross.isLessThan(b.limitAmount)
                ) {
                    let epiC = {};
                    epiC.price = prevPath.spotPrice.plus(
                        bmath_1.bmul(
                            b.limitAmount,
                            bmath_1.bmul(prevPath.slippage, prevPath.spotPrice)
                        )
                    );
                    epiC.swap = [b.id, prevPath.id];
                    pricesOfInterest.push(epiC);
                }
            } else {
                if (prevPath.limitAmount.isLessThan(b.limitAmount)) {
                    let epiD = {};
                    epiD.price = b.spotPrice.plus(
                        bmath_1.bmul(
                            prevPath.limitAmount,
                            bmath_1.bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epiD.swap = [prevPath.id, b.id];
                    pricesOfInterest.push(epiD);
                }
            }
        }
    });
    return pricesOfInterest;
}
function calculateBestPathIdsForPricesOfInterest(pricesOfInterest, maxPools) {
    let bestPathsIds = [];
    pricesOfInterest.forEach((e, i) => {
        if (e.id != null) {
            // Only add to bestPathsIds if the amount of paths length hasn't reached maxPools
            // This is a conservative choice as with with number of paths = maxPools we guarantee we have information
            // necessary to find up to maxPools pools, as each path has at least 1 pool.
            if (bestPathsIds.length < maxPools) bestPathsIds.push(e.id);
        } else if (e.swap) {
            let index1 = bestPathsIds.indexOf(e.swap[0]);
            let index2 = bestPathsIds.indexOf(e.swap[1]);
            if (index1 != -1) {
                if (index2 != -1) {
                    let bestPath1 = bestPathsIds[index1];
                    let bestPath2 = bestPathsIds[index2];
                    bestPathsIds[index1] = bestPath2;
                    bestPathsIds[index2] = bestPath1;
                } else {
                    bestPathsIds[index1] = e.swap[1];
                }
            }
        } else if (e.maxAmount) {
            // Do nothing
        } else {
            console.log(e);
            console.error(
                'ERROR: poolID or swap not found in pricesOfInterest'
            );
        }
        pricesOfInterest[i].bestPathsIds = bestPathsIds.slice();
        // console.log(bestPathsIds)
    });
    return pricesOfInterest;
}
function getSwapAmountsForPriceOfInterest(paths, pathIds, poi) {
    let swapAmounts = [];
    pathIds.forEach((bid, i) => {
        let path = paths.find(obj => {
            return obj.id === bid;
        });
        console.log(`!!!!!! DEBUG`);
        console.log(poi.toString());
        console.log(path.spotPrice.toString());
        console.log(poi.minus(path.spotPrice).toString());
        console.log(path.slippage.toString());
        console.log(path.spotPrice.toString());
        console.log(bmath_1.bmul(path.slippage, path.spotPrice).toString());
        let inputAmount = bmath_1.bdiv(
            poi.minus(path.spotPrice),
            bmath_1.bmul(path.slippage, path.spotPrice)
        );
        console.log(`Input Amount: ${inputAmount.toString()}`);
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
    // console.log("deltaTotalInput")
    // console.log(deltaTotalInput)
    // console.log("deltaBeforeAfterAmounts")
    // console.log(deltaBeforeAfterAmounts)
    let deltaTimesTarget = [];
    deltaBeforeAfterAmounts.forEach((a, i) => {
        let ratio = bmath_1.bdiv(
            totalSwapAmountWithRoundingErrors.minus(totalInputBefore),
            deltaTotalInput
        );
        // console.log("a")
        // console.log(a)
        // console.log("totalSwapAmountWithRoundingErrors.minus(totalInputBefore)")
        // console.log(totalSwapAmountWithRoundingErrors.minus(totalInputBefore))
        // console.log("mult")
        // console.log(mult)
        let deltaAmount = bmath_1.bmul(ratio, a);
        deltaTimesTarget.push(deltaAmount);
    });
    // console.log("deltaTimesTarget")
    // console.log(deltaTimesTarget)
    let swapAmounts = [];
    swapAmountsPriceBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        swapAmounts.push(add);
    });
    return swapAmounts;
}
// //// TODO Remove: to debug only!
// function printSpotPricePathBeforeAndAfterSwap(
//     path: Path,
//     swapType: string,
//     swapAmount: BigNumber
// ) {
//     console.log(path.id);
//     console.log('spotPrice BEFORE trade');
//     console.log(getSpotPricePath(path).toString());
//     let pathAfterTrade: Path;
//     pathAfterTrade = path;
//     if (path.poolPairDataList.length == 1) {
//         if (swapType === 'swapExactIn') {
//             path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
//                 swapAmount
//             );
//             path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
//                 getReturnAmountSwap(
//                     path.poolPairDataList[0],
//                     swapType,
//                     swapAmount
//                 )
//             );
//         } else {
//             path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
//                 getReturnAmountSwap(
//                     path.poolPairDataList[0],
//                     swapType,
//                     swapAmount
//                 )
//             );
//             path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
//                 swapAmount
//             );
//         }
//     } else {
//         if (swapType === 'swapExactIn') {
//             path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
//                 swapAmount
//             );
//             path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
//                 getReturnAmountSwap(
//                     path.poolPairDataList[0],
//                     swapType,
//                     swapAmount
//                 )
//             );
//             path.poolPairDataList[1].balanceIn = path.poolPairDataList[1].balanceIn.plus(
//                 getReturnAmountSwap(
//                     path.poolPairDataList[0],
//                     swapType,
//                     swapAmount
//                 )
//             );
//             path.poolPairDataList[1].balanceOut = path.poolPairDataList[1].balanceOut.minus(
//                 getReturnAmountSwap(
//                     path.poolPairDataList[1],
//                     swapType,
//                     getReturnAmountSwap(
//                         path.poolPairDataList[0],
//                         swapType,
//                         swapAmount
//                     )
//                 )
//             );
//         } else {
//             path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
//                 getReturnAmountSwap(
//                     path.poolPairDataList[0],
//                     swapType,
//                     getReturnAmountSwap(
//                         path.poolPairDataList[1],
//                         swapType,
//                         swapAmount
//                     )
//                 )
//             );
//             path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
//                 getReturnAmountSwap(
//                     path.poolPairDataList[1],
//                     swapType,
//                     swapAmount
//                 )
//             );
//             path.poolPairDataList[1].balanceIn = path.poolPairDataList[1].balanceIn.plus(
//                 getReturnAmountSwap(
//                     path.poolPairDataList[1],
//                     swapType,
//                     swapAmount
//                 )
//             );
//             path.poolPairDataList[1].balanceOut = path.poolPairDataList[1].balanceOut.minus(
//                 swapAmount
//             );
//         }
//     }
//     console.log('spotPrice AFTER  trade');
//     console.log(getSpotPricePath(path).toString());
// }
