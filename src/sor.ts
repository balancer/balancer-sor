import {
    getSpotPrice,
    getSlippageLinearizedSpotPriceAfterSwap,
    getLimitAmountSwap,
    getSpotPricePath,
    getSlippageLinearizedSpotPriceAfterSwapPath,
    getLimitAmountSwapPath,
    getNormalizedLiquidity,
    getOutputAmountSwap,
    getOutputAmountSwapPath,
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
import { Pool, Path, Swap, SwapAmount, Price } from './types';

// TODO give the option to choose a % of slippage beyond current price?
const MAX_UINT = new BigNumber(
    115792089237316195423570985008687907853269984665640564039457584007913129639935
);
const minAmountOut = 0;
const maxAmountIn = MAX_UINT;
const maxPrice = MAX_UINT;

export const smartOrderRouterMultiHop = (
    pools: Pool[],
    paths: Path[],
    swapType: string,
    targetInputAmount: BigNumber,
    maxPaths: number,
    costOutputToken: BigNumber
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
        poi.amounts = getInputAmountsForPriceOfInterest(
            sortedPaths,
            pathIds,
            price
        );
    });

    // console.log(pricesOfInterest);

    let bestTotalOutput: BigNumber = new BigNumber(0);
    let highestPoiNotEnough: boolean = true;
    let pathIds, totalOutput;
    let bestInputAmounts, bestPathIds, inputAmounts;

    let bmin = Math.min(maxPaths, paths.length + 1);
    for (let b = 1; b <= bmin; b++) {
        totalOutput = 0;

        let price,
            priceAfter,
            priceBefore,
            inputAmountsPriceBefore,
            inputAmountsPriceAfter;
        for (let i = 0; i < pricesOfInterest.length; i++) {
            price = pricesOfInterest[i];

            priceAfter = price;

            if (i === 0) {
                priceBefore = priceAfter;
                continue;
            }

            let inputAmountsAfter = priceAfter.amounts;
            let totalInputAmountAfter = inputAmountsAfter
                .slice(0, b)
                .reduce((a, b) => a.plus(b));

            if (totalInputAmountAfter.isGreaterThan(targetInputAmount)) {
                pathIds = priceBefore.bestPathsIds.slice(0, b);
                inputAmountsPriceBefore = priceBefore.amounts.slice(0, b);
                inputAmountsPriceAfter = priceAfter.amounts.slice(0, b);

                inputAmounts = getExactInputAmounts(
                    inputAmountsPriceBefore,
                    inputAmountsPriceAfter,
                    targetInputAmount
                );

                highestPoiNotEnough = false;
                break;
            }

            priceBefore = priceAfter;
        }

        if (highestPoiNotEnough) {
            pathIds = [];
            inputAmounts = [];
        }

        // TODO replace output for return everywhere
        totalOutput = calcTotalReturn(paths, swapType, pathIds, inputAmounts);

        let improvementCondition: boolean = false;
        if (swapType === 'swapExactIn') {
            totalOutput = totalOutput.minus(
                bmul(new BigNumber(pathIds.length).times(BONE), costOutputToken)
            );
            improvementCondition =
                totalOutput.isGreaterThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new BigNumber(0));
        } else {
            totalOutput = totalOutput.plus(
                bmul(new BigNumber(pathIds.length).times(BONE), costOutputToken)
            );
            improvementCondition =
                totalOutput.isLessThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new BigNumber(0));
        }

        if (improvementCondition === true) {
            bestInputAmounts = inputAmounts;
            bestPathIds = pathIds;
            bestTotalOutput = totalOutput;
        } else {
            break;
        }
    }

    console.log(bestInputAmounts);
    console.log(bestPathIds);
    console.log(bestTotalOutput);

    //// Prepare swap data from paths
    let swaps: Swap[] = [];
    let totalSwapAmount: BigNumber = new BigNumber(0);
    let dust: BigNumber = new BigNumber(0);

    // TODO: change all inputAmount variable names to swapAmount
    bestInputAmounts.forEach((swapAmount, i) => {
        totalSwapAmount = totalSwapAmount.plus(swapAmount);

        // Find path data
        const path = paths.find(p => p.id === bestPathIds[i]);
        if (!path) {
            throw new Error(
                '[Invariant] No pool found for selected pool index'
            );
        }

        if (path.pools.length == 1) {
            // Direct trade: add swap from only pool
            let swap: Swap = {
                pool: path.pools[0].id,
                tokenInParam:
                    swapType === 'swapExactIn'
                        ? swapAmount.toString()
                        : maxAmountIn.toString(),
                tokenOutParam:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : swapAmount.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push(swap);
        } else {
            // Multi-hop:
            // Add swap from first pool
            let swap1hop: Swap = {
                pool: path.pools[0].id,
                tokenInParam:
                    swapType === 'swapExactIn'
                        ? swapAmount.toString()
                        : maxAmountIn.toString(),
                tokenOutParam:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : getOutputAmountSwap(
                              path.pools[1],
                              swapType,
                              swapAmount
                          ).toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push(swap1hop);

            // Add swap from second pool
            let swap2hop: Swap = {
                pool: path.pools[1].id,
                tokenInParam:
                    swapType === 'swapExactIn'
                        ? getOutputAmountSwap(
                              path.pools[0],
                              swapType,
                              swapAmount
                          ).toString()
                        : maxAmountIn.toString(),
                tokenOutParam:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : swapAmount.toString(),
                maxPrice: maxPrice.toString(),
            };
            swaps.push(swap2hop);
        }
    });

    // TODO recheck the logic when swapExactOut -> has to go to second pool when Multi-hop
    // if (swaps.length > 0) {
    //     dust = targetInputAmount.minus(totalSwapAmount);
    //     (swapType === 'swapExactIn')? swaps[0].tokenInParam =
    //         new BigNumber(swaps[0].tokenInParam).plus(dust).toString() : new BigNumber(swaps[0].tokenOutParam).plus(dust).toString();
    // }

    return [swaps, bestTotalOutput];
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

// export const calcTotalOutput = (swaps: Swap[], pathData: Path[]): BigNumber => {
//     try {
//         let totalAmountOut = bnum(0);
//         swaps.forEach(swap => {
//             const swapAmount = swap.tokenInParam;

//             const path = pathData.find(p => p.id === swap.pool);
//             if (!path) {
//                 throw new Error(
//                     '[Invariant] No pool found for selected pool index'
//                 );
//             }

//             // TODO correct for multihop
//             const preview = calcOutGivenIn(
//                 path.pools[0].balanceIn,
//                 path.pools[0].weightIn,
//                 path.pools[0].balanceOut,
//                 path.pools[0].weightOut,
//                 bnum(swapAmount),
//                 path.pools[0].swapFee
//             );

//             totalAmountOut = totalAmountOut.plus(preview);
//         });
//         return totalAmountOut;
//     } catch (e) {
//         throw new Error(e);
//     }
// };

// export const calcTotalInput = (swaps: Swap[], pathData: Path[]): BigNumber => {
//     try {
//         let totalAmountIn = bnum(0);
//         swaps.forEach(swap => {
//             const swapAmount = swap.tokenOutParam;
//             const path = pathData.find(p => p.id === swap.pool);
//             if (!path) {
//                 throw new Error(
//                     '[Invariant] No pool found for selected pool index'
//                 );
//             }

//             const preview = calcInGivenOut(
//                 path.pools[0].balanceIn,
//                 path.pools[0].weightIn,
//                 path.pools[0].balanceOut,
//                 path.pools[0].weightOut,
//                 bnum(swapAmount),
//                 path.pools[0].swapFee
//             );

//             totalAmountIn = totalAmountIn.plus(preview);
//         });

//         return totalAmountIn;
//     } catch (e) {
//         throw new Error(e);
//     }
// };

// export const formatSwapsExactAmountIn = (
//     sorSwaps: SwapAmount[],
//     maxPrice: BigNumber,
//     minAmountOut: BigNumber
// ): Swap[] => {
//     const swaps: Swap[] = [];
//     for (let i = 0; i < sorSwaps.length; i++) {
//         let swapAmount = sorSwaps[i].amount;
//         let swap: Swap = {
//             pool: sorSwaps[i].pool,
//             tokenInParam: swapAmount.toString(),
//             tokenOutParam: minAmountOut.toString(),
//             maxPrice: maxPrice.toString(),
//         };
//         swaps.push(swap);
//     }
//     return swaps;
// };

// export const formatSwapsExactAmountOut = (
//     sorSwaps: SwapAmount[],
//     maxPrice: BigNumber,
//     maxAmountIn: BigNumber
// ): Swap[] => {
//     const swaps: Swap[] = [];
//     for (let i = 0; i < sorSwaps.length; i++) {
//         let swapAmount = sorSwaps[i].amount;
//         let swap: Swap = {
//             pool: sorSwaps[i].pool,
//             tokenInParam: maxAmountIn.toString(),
//             tokenOutParam: swapAmount.toString(),
//             maxPrice: maxPrice.toString(),
//         };
//         swaps.push(swap);
//     }
//     return swaps;
// };

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

function getInputAmountsForPriceOfInterest(
    paths: Path[],
    pathIds: string[],
    poi: BigNumber
): BigNumber[] {
    let inputAmounts: BigNumber[] = [];
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
        inputAmounts.push(inputAmount);
    });
    return inputAmounts;
}

export const calcTotalReturn = (
    paths: Path[],
    swapType: string,
    pathIds: string[],
    inputAmounts: BigNumber[]
): BigNumber => {
    let path;
    let totalOutput = new BigNumber(0);
    pathIds.forEach((b, i) => {
        path = paths.find(obj => {
            return obj.id === b;
        });
        totalOutput = totalOutput.plus(
            getOutputAmountSwapPath(path, swapType, inputAmounts[i])
        );
    });
    return totalOutput;
};

function getExactInputAmounts(
    inputAmountsPriceBefore: BigNumber[],
    inputAmountsPriceAfter: BigNumber[],
    targetTotalInput: BigNumber
): BigNumber[] {
    let deltaInputAmounts: BigNumber[] = [];

    if (
        inputAmountsPriceAfter[inputAmountsPriceAfter.length - 1].isEqualTo(
            new BigNumber(0)
        )
    )
        inputAmountsPriceAfter.pop();
    inputAmountsPriceAfter.forEach((a, i) => {
        let diff = a.minus(inputAmountsPriceBefore[i]);
        deltaInputAmounts.push(diff);
    });
    let totalInputBefore = inputAmountsPriceBefore.reduce((a, b) => a.plus(b));
    let totalInputAfter = inputAmountsPriceAfter.reduce((a, b) => a.plus(b));
    let deltaTotalInput = totalInputAfter.minus(totalInputBefore);

    let deltaTimesTarget: BigNumber[] = [];
    deltaInputAmounts.forEach((a, i) => {
        let mult = bmul(a, targetTotalInput.minus(totalInputBefore));
        mult = bdiv(mult, deltaTotalInput);
        deltaTimesTarget.push(mult);
    });

    let inputAmounts: BigNumber[] = [];
    inputAmountsPriceBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        inputAmounts.push(add);
    });
    return inputAmounts;
}
