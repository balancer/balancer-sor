import {
    getSpotPrice,
    getSlippageLinearizedSpotPriceAfterSwap,
    getLimitAmountSwap,
    getSpotPricePath,
    getSlippageLinearizedSpotPriceAfterSwapPath,
    getLimitAmountSwapPath,
    getNormalizedLiquidity,
    getReturnAmountSwap,
    getReturnAmountSwapPath,
} from './helpers';
import {
    bmul,
    bdiv,
    bnum,
    BONE,
    calcOutGivenIn,
    calcInGivenOut,
} from './bmath';
import { BigNumber } from './utils/bignumber';
import { PoolPairData, Path, Swap, Price } from './types';

// TODO give the option to choose a % of slippage beyond current price?
const MAX_UINT = new BigNumber(
    115792089237316195423570985008687907853269984665640564039457584007913129639935
);
const minAmountOut = 0;
const maxAmountIn = MAX_UINT;
const maxPrice = MAX_UINT;

export const smartOrderRouterMultiHop = (
    paths: Path[],
    swapType: string,
    totalSwapAmount: BigNumber,
    maxPools: number,
    costReturnToken: BigNumber
): [Swap[], BigNumber] => {
    paths.forEach(b => {
        b.spotPrice = getSpotPricePath(b);
        b.slippage = getSlippageLinearizedSpotPriceAfterSwapPath(b, swapType);
        b.limitAmount = getLimitAmountSwapPath(b, swapType);
    });

    let sortedPaths = paths.sort((a, b) => {
        return a.spotPrice.minus(b.spotPrice).toNumber();
    });

    // console.log(sortedPaths);

    let pricesOfInterest = getPricesOfInterest(sortedPaths, swapType).sort(
        (a, b) => {
            return a.price.minus(b.price).toNumber();
        }
    );

    pricesOfInterest = calculateBestPathIdsForPricesOfInterest(
        pricesOfInterest
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

    // console.log(pricesOfInterest);

    let bestTotalReturn: BigNumber = new BigNumber(0);
    let highestPoiNotEnough: boolean = true;
    let pathIds, totalReturn;
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

                highestPoiNotEnough = false;
                break;
            }

            priceBefore = priceAfter;
        }

        if (highestPoiNotEnough) {
            pathIds = [];
            swapAmounts = [];
        }

        totalReturn = calcTotalReturn(paths, swapType, pathIds, swapAmounts);

        // Calculates the number of pools in all the paths to include the gas costs
        let totalNumberOfPools = 0;
        pathIds.forEach((pathId, i) => {
            // Find path data
            const path = paths.find(p => p.id === pathId);
            totalNumberOfPools += path.poolPairDataList.length;
        });

        // console.log("Number of pools in all paths: ")
        // console.log(totalNumberOfPools)

        let improvementCondition: boolean = false;
        if (totalNumberOfPools <= maxPools) {
            if (swapType === 'swapExactIn') {
                totalReturn = totalReturn.minus(
                    bmul(
                        new BigNumber(totalNumberOfPools).times(BONE),
                        costReturnToken
                    )
                );
                improvementCondition =
                    totalReturn.isGreaterThan(bestTotalReturn) ||
                    bestTotalReturn.isEqualTo(new BigNumber(0));
            } else {
                totalReturn = totalReturn.plus(
                    bmul(
                        new BigNumber(totalNumberOfPools).times(BONE),
                        costReturnToken
                    )
                );
                improvementCondition =
                    totalReturn.isLessThan(bestTotalReturn) ||
                    bestTotalReturn.isEqualTo(new BigNumber(0));
            }
        }

        if (improvementCondition === true) {
            bestSwapAmounts = swapAmounts;
            bestPathIds = pathIds;
            bestTotalReturn = totalReturn;
        } else {
            break;
        }
    }

    // console.log(bestSwapAmounts);
    // console.log(bestPathIds);
    // console.log(bestTotalReturn);

    //// Prepare swap data from paths
    let swaps: Swap[] = [];
    let totalSwapAmountWithRoundingErrors: BigNumber = new BigNumber(0);
    let dust: BigNumber = new BigNumber(0);
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
                '[Invariant] No pool found for selected pool index'
            );
        }

        // // TODO: remove. To debug only!
        // printSpotPricePathBeforeAndAfterSwap(path, swapType, swapAmount);

        if (i == 0)
            // Store lenght of first path to add dust to correct rounding error at the end
            lenghtFirstPath = path.poolPairDataList.length;

        if (path.poolPairDataList.length == 1) {
            // Direct trade: add swap from only pool
            let swap: Swap = {
                pool: path.poolPairDataList[0].id,
                tokenIn: path.poolPairDataList[0].tokenIn,
                tokenOut: path.poolPairDataList[0].tokenOut,
                swapAmount: swapAmount.toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push(swap);
        } else {
            // Multi-hop:
            // Add swap from first pool
            let swap1hop: Swap = {
                pool: path.poolPairDataList[0].id,
                tokenIn: path.poolPairDataList[0].tokenIn,
                tokenOut: path.poolPairDataList[0].tokenOut,
                swapAmount:
                    swapType === 'swapExactIn'
                        ? swapAmount.toString()
                        : getReturnAmountSwap(
                              path.poolPairDataList[1],
                              swapType,
                              swapAmount
                          ).toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push(swap1hop);

            // Add swap from second pool
            let swap2hop: Swap = {
                pool: path.poolPairDataList[1].id,
                tokenIn: path.poolPairDataList[1].tokenIn,
                tokenOut: path.poolPairDataList[1].tokenOut,
                swapAmount:
                    swapType === 'swapExactIn'
                        ? getReturnAmountSwap(
                              path.poolPairDataList[0],
                              swapType,
                              swapAmount
                          ).toString()
                        : swapAmount.toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push(swap2hop);
        }
    });

    // Since the individual swapAmounts for each path are integers, the sum of all swapAmounts
    // might not be exactly equal to the totalSwapAmount the user requested. We need to correct that rounding error
    // and we do that by adding the rounding error to the first path.
    if (swaps.length > 0) {
        dust = totalSwapAmount.minus(totalSwapAmountWithRoundingErrors);
        if (swapType === 'swapExactIn') {
            swaps[0].swapAmount = new BigNumber(swaps[0].swapAmount)
                .plus(dust)
                .toString(); // Add dust to first swapExactIn
        } else {
            if (lenghtFirstPath == 1)
                // First path is a direct path (only one pool)
                swaps[0].swapAmount = new BigNumber(swaps[0].swapAmount)
                    .plus(dust)
                    .toString();
            // Add dust to first swapExactOut
            // First path is a multihop path (two pools)
            else
                swaps[1].swapAmount = new BigNumber(swaps[1].swapAmount)
                    .plus(dust)
                    .toString(); // Add dust to second swapExactOut
        }
    }
    return [swaps, bestTotalReturn];
};

function getPricesOfInterest(sortedPaths: Path[], swapType: string): Price[] {
    let pricesOfInterest: Price[] = [];
    sortedPaths.forEach((b, i) => {
        // New pool
        let pi: Price = {};
        pi.price = b.spotPrice;
        pi.id = b.id;
        pricesOfInterest.push(pi);

        // Max amount for this pool
        pi = {};
        pi.price = b.spotPrice.plus(
            bmul(b.limitAmount, bmul(b.slippage, b.spotPrice))
        );
        pi.maxAmount = b.id;
        pricesOfInterest.push(pi);

        for (let k = 0; k < i; k++) {
            let prevPath = sortedPaths[k];

            if (
                bmul(b.slippage, b.spotPrice).isLessThan(
                    bmul(prevPath.slippage, prevPath.spotPrice)
                )
            ) {
                let amountCross = bdiv(
                    b.spotPrice.minus(prevPath.spotPrice),
                    bmul(prevPath.slippage, prevPath.spotPrice).minus(
                        bmul(b.slippage, b.spotPrice)
                    )
                );

                if (
                    amountCross.isLessThan(b.limitAmount) &&
                    amountCross.isLessThan(prevPath.limitAmount)
                ) {
                    let epi1: Price = {};
                    epi1.price = prevPath.spotPrice.plus(
                        bmul(
                            amountCross,
                            bmul(prevPath.slippage, prevPath.spotPrice)
                        )
                    );
                    epi1.swap = [prevPath.id, b.id];
                    pricesOfInterest.push(epi1);
                }

                if (
                    prevPath.limitAmount.isLessThan(b.limitAmount) &&
                    prevPath.limitAmount.isLessThan(amountCross)
                ) {
                    let epi2: Price = {};
                    epi2.price = b.spotPrice.plus(
                        bmul(
                            prevPath.limitAmount,
                            bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epi2.swap = [prevPath.id, b.id];
                    pricesOfInterest.push(epi2);
                }

                if (
                    b.limitAmount.isLessThan(prevPath.limitAmount) &&
                    amountCross.isLessThan(b.limitAmount)
                ) {
                    let epi3: Price = {};
                    epi3.price = prevPath.spotPrice.plus(
                        bmul(
                            b.limitAmount,
                            bmul(prevPath.slippage, prevPath.spotPrice)
                        )
                    );
                    epi3.swap = [b.id, prevPath.id];
                    pricesOfInterest.push(epi3);
                }
            } else {
                if (prevPath.limitAmount.isLessThan(b.limitAmount)) {
                    let epi4: Price = {};
                    epi4.price = b.spotPrice.plus(
                        bmul(
                            prevPath.limitAmount,
                            bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epi4.swap = [prevPath.id, b.id];
                    pricesOfInterest.push(epi4);
                }
            }
        }
    });

    return pricesOfInterest;
}

function calculateBestPathIdsForPricesOfInterest(
    pricesOfInterest: Price[]
): Price[] {
    let bestPathsIds = [];
    pricesOfInterest.forEach((e, i) => {
        if (e.id != null) {
            bestPathsIds.push(e.id);
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
                    bestPathsIds[index1] = e.swap[2];
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
    });
    return pricesOfInterest;
}

function getSwapAmountsForPriceOfInterest(
    paths: Path[],
    pathIds: string[],
    poi: BigNumber
): BigNumber[] {
    let swapAmounts: BigNumber[] = [];
    pathIds.forEach((bid, i) => {
        let path = paths.find(obj => {
            return obj.id === bid;
        });
        let inputAmount = bdiv(
            poi.minus(path.spotPrice),
            bmul(path.slippage, path.spotPrice)
        );
        if (path.limitAmount.isLessThan(inputAmount)) {
            inputAmount = path.limitAmount;
        }
        swapAmounts.push(inputAmount);
    });
    return swapAmounts;
}

export const calcTotalReturn = (
    paths: Path[],
    swapType: string,
    pathIds: string[],
    swapAmounts: BigNumber[]
): BigNumber => {
    let path;
    let totalReturn = new BigNumber(0);
    pathIds.forEach((b, i) => {
        path = paths.find(obj => {
            return obj.id === b;
        });
        totalReturn = totalReturn.plus(
            getReturnAmountSwapPath(path, swapType, swapAmounts[i])
        );
    });
    return totalReturn;
};

function getExactSwapAmounts(
    swapAmountsPriceBefore: BigNumber[],
    swapAmountsPriceAfter: BigNumber[],
    totalSwapAmountWithRoundingErrors: BigNumber
): BigNumber[] {
    let deltaSwapAmounts: BigNumber[] = [];

    if (
        swapAmountsPriceAfter[swapAmountsPriceAfter.length - 1].isEqualTo(
            new BigNumber(0)
        )
    )
        swapAmountsPriceAfter.pop();
    swapAmountsPriceAfter.forEach((a, i) => {
        let diff = a.minus(swapAmountsPriceBefore[i]);
        deltaSwapAmounts.push(diff);
    });
    let totalInputBefore = swapAmountsPriceBefore.reduce((a, b) => a.plus(b));
    let totalInputAfter = swapAmountsPriceAfter.reduce((a, b) => a.plus(b));
    let deltaTotalInput = totalInputAfter.minus(totalInputBefore);

    let deltaTimesTarget: BigNumber[] = [];
    deltaSwapAmounts.forEach((a, i) => {
        let mult = bmul(
            a,
            totalSwapAmountWithRoundingErrors.minus(totalInputBefore)
        );
        mult = bdiv(mult, deltaTotalInput);
        deltaTimesTarget.push(mult);
    });

    let swapAmounts: BigNumber[] = [];
    swapAmountsPriceBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        swapAmounts.push(add);
    });
    return swapAmounts;
}

//// TODO Remove: to debug only!
function printSpotPricePathBeforeAndAfterSwap(
    path: Path,
    swapType: string,
    swapAmount: BigNumber
) {
    console.log(path.id);
    console.log('spotPrice BEFORE trade');
    console.log(getSpotPricePath(path).toString());

    let pathAfterTrade: Path;
    pathAfterTrade = path;
    if (path.poolPairDataList.length == 1) {
        if (swapType === 'swapExactIn') {
            path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
                swapAmount
            );
            path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    swapAmount
                )
            );
        } else {
            path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    swapAmount
                )
            );
            path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
                swapAmount
            );
        }
    } else {
        if (swapType === 'swapExactIn') {
            path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
                swapAmount
            );
            path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    swapAmount
                )
            );

            path.poolPairDataList[1].balanceIn = path.poolPairDataList[1].balanceIn.plus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    swapAmount
                )
            );
            path.poolPairDataList[1].balanceOut = path.poolPairDataList[1].balanceOut.minus(
                getReturnAmountSwap(
                    path.poolPairDataList[1],
                    swapType,
                    getReturnAmountSwap(
                        path.poolPairDataList[0],
                        swapType,
                        swapAmount
                    )
                )
            );
        } else {
            path.poolPairDataList[0].balanceIn = path.poolPairDataList[0].balanceIn.plus(
                getReturnAmountSwap(
                    path.poolPairDataList[0],
                    swapType,
                    getReturnAmountSwap(
                        path.poolPairDataList[1],
                        swapType,
                        swapAmount
                    )
                )
            );
            path.poolPairDataList[0].balanceOut = path.poolPairDataList[0].balanceOut.minus(
                getReturnAmountSwap(
                    path.poolPairDataList[1],
                    swapType,
                    swapAmount
                )
            );

            path.poolPairDataList[1].balanceIn = path.poolPairDataList[1].balanceIn.plus(
                getReturnAmountSwap(
                    path.poolPairDataList[1],
                    swapType,
                    swapAmount
                )
            );
            path.poolPairDataList[1].balanceOut = path.poolPairDataList[1].balanceOut.minus(
                swapAmount
            );
        }
    }

    console.log('spotPrice AFTER  trade');
    console.log(getSpotPricePath(path).toString());
}
