import {
    getSpotPrice,
    getSpotPricePath,
    getSlippageLinearizedSpotPriceAfterSwapPath,
    getLimitAmountSwapPath,
    getReturnAmountSwap,
    getReturnAmountSwapPath,
    parsePoolPairData,
} from './helpers';
import { bmul, bdiv, bnum, BONE } from './bmath';
import { BigNumber } from './utils/bignumber';
import {
    PoolPairData,
    Path,
    Swap,
    Price,
    EffectivePrice,
    PoolDictionary,
    Pool,
} from './types';
import { MaxUint256 } from '@ethersproject/constants';

// TODO give the option to choose a % of slippage beyond current price?
export const MAX_UINT = MaxUint256;

const minAmountOut = 0;
const maxAmountIn = MAX_UINT;
const maxPrice = MAX_UINT;

export function processPaths(
    paths: Path[],
    pools: PoolDictionary,
    swapType: string
): Path[] {
    let poolPairData = {};
    paths.forEach(path => {
        let swaps: Swap[] = path.swaps;
        // Get and store PoolPairData for swaps in path as these are used across all following get functions
        if (swaps.length == 1) {
            let swap1: Swap = swaps[0];

            let id = `${swap1.pool}${swap1.tokenIn}${swap1.tokenOut}`;

            if (poolPairData[id] === undefined) {
                let poolSwap1: Pool = pools[swap1.pool];
                let poolPairDataSwap1: PoolPairData = parsePoolPairData(
                    poolSwap1,
                    swap1.tokenIn,
                    swap1.tokenOut
                );

                let sp = getSpotPrice(poolPairDataSwap1);
                poolPairData[id] = { poolPairData: poolPairDataSwap1, sp: sp };
            }
        } else if (swaps.length == 2) {
            let swap1: Swap = swaps[0];
            let id = `${swap1.pool}${swap1.tokenIn}${swap1.tokenOut}`;
            if (poolPairData[id] === undefined) {
                let poolSwap1: Pool = pools[swap1.pool];
                let poolPairDataSwap1: PoolPairData = parsePoolPairData(
                    poolSwap1,
                    swap1.tokenIn,
                    swap1.tokenOut
                );

                let sp = getSpotPrice(poolPairDataSwap1);
                poolPairData[id] = { poolPairData: poolPairDataSwap1, sp: sp };
            }

            let swap2: Swap = swaps[1];
            id = `${swap2.pool}${swap2.tokenIn}${swap2.tokenOut}`;
            if (poolPairData[id] === undefined) {
                let poolSwap2: Pool = pools[swap2.pool];
                let poolPairDataSwap2: PoolPairData = parsePoolPairData(
                    poolSwap2,
                    swap2.tokenIn,
                    swap2.tokenOut
                );

                let sp = getSpotPrice(poolPairDataSwap2);
                poolPairData[id] = { poolPairData: poolPairDataSwap2, sp: sp };
            }
        }

        path.spotPrice = getSpotPricePath(pools, path, poolPairData);
        path.slippage = getSlippageLinearizedSpotPriceAfterSwapPath(
            pools,
            path,
            swapType,
            poolPairData
        );
        path.limitAmount = getLimitAmountSwapPath(
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

export function processEpsOfInterestMultiHop(
    sortedPaths: Path[],
    swapType: string,
    maxPools: number
): EffectivePrice[] {
    let pricesOfInterest: Price[] = getPricesOfInterest(sortedPaths, swapType);

    pricesOfInterest = pricesOfInterest.sort((a, b) => {
        return a.price.minus(b.price).toNumber();
    });

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

    return pricesOfInterest;
}

export const smartOrderRouterMultiHopEpsOfInterest = (
    pools: PoolDictionary,
    paths: Path[],
    swapType: string,
    totalSwapAmount: BigNumber,
    maxPools: number,
    costReturnToken: BigNumber,
    pricesOfInterest: EffectivePrice[]
): [Swap[][], BigNumber] => {
    let bestTotalReturn: BigNumber = new BigNumber(0);
    let bestTotalReturnConsideringFees: BigNumber = new BigNumber(0);
    let highestPoiNotEnough: boolean = true;
    let pathIds, totalReturn, totalReturnConsideringFees;
    let bestSwapAmounts = [],
        bestPathIds,
        swapAmounts;

    let bmin = paths.length + 1;
    for (let b = 1; b <= bmin; b++) {
        totalReturn = 0;

        let priceBefore, swapAmountsPriceBefore, swapAmountsPriceAfter;
        for (let i = 0; i < pricesOfInterest.length; i++) {
            if (i === 0) {
                priceBefore = pricesOfInterest[i];
                continue;
            }

            let swapAmountsAfter = pricesOfInterest[i].amounts;
            let totalInputAmountAfter = swapAmountsAfter
                .slice(0, b)
                .reduce((a, b) => a.plus(b));

            if (totalInputAmountAfter.isGreaterThan(totalSwapAmount)) {
                pathIds = priceBefore.bestPathsIds.slice(0, b);
                swapAmountsPriceBefore = priceBefore.amounts.slice(0, b);
                swapAmountsPriceAfter = pricesOfInterest[i].amounts.slice(0, b);

                swapAmounts = getExactSwapAmounts(
                    swapAmountsPriceBefore,
                    swapAmountsPriceAfter,
                    totalSwapAmount
                );

                highestPoiNotEnough = false;
                break;
            }

            priceBefore = pricesOfInterest[i];
        }

        if (highestPoiNotEnough) {
            pathIds = [];
            swapAmounts = [];
        }

        totalReturn = calcTotalReturn(
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

        let improvementCondition: boolean = false;
        if (totalNumberOfPools <= maxPools) {
            if (swapType === 'swapExactIn') {
                totalReturnConsideringFees = totalReturn.minus(
                    bmul(
                        new BigNumber(totalNumberOfPools).times(BONE),
                        costReturnToken
                    )
                );
                improvementCondition =
                    totalReturnConsideringFees.isGreaterThan(
                        bestTotalReturnConsideringFees
                    ) || b === 1; // b === 1 means its the first iteration so bestTotalReturnConsideringFees isn't currently a value
            } else {
                totalReturnConsideringFees = totalReturn.plus(
                    bmul(
                        new BigNumber(totalNumberOfPools).times(BONE),
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
    let swaps: Swap[][] = [];
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
            let swap: Swap = {
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
            let poolPairDataSwap1 = parsePoolPairData(
                poolSwap1,
                swap1.tokenIn,
                swap1.tokenOut
            );

            let swap2 = path.swaps[1];
            let poolSwap2 = pools[swap2.pool];
            let poolPairDataSwap2 = parsePoolPairData(
                poolSwap2,
                swap2.tokenIn,
                swap2.tokenOut
            );

            // Add swap from first pool
            let swap1hop: Swap = {
                pool: path.swaps[0].pool,
                tokenIn: path.swaps[0].tokenIn,
                tokenOut: path.swaps[0].tokenOut,
                swapAmount:
                    swapType === 'swapExactIn'
                        ? swapAmount.toString()
                        : getReturnAmountSwap(
                              pools,
                              poolPairDataSwap2,
                              swapType,
                              swapAmount
                          ).toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
            };

            // Add swap from second pool
            let swap2hop: Swap = {
                pool: path.swaps[1].pool,
                tokenIn: path.swaps[1].tokenIn,
                tokenOut: path.swaps[1].tokenOut,
                swapAmount:
                    swapType === 'swapExactIn'
                        ? getReturnAmountSwap(
                              pools,
                              poolPairDataSwap1,
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
            swaps.push([swap1hop, swap2hop]);
        }
        // Updates the pools in the path with the swaps so that if
        // the new paths use these pools they will have the updated balances
        getReturnAmountSwapPath(pools, path, swapType, swapAmount);
    });

    // Since the individual swapAmounts for each path are integers, the sum of all swapAmounts
    // might not be exactly equal to the totalSwapAmount the user requested. We need to correct that rounding error
    // and we do that by adding the rounding error to the first path.
    if (swaps.length > 0) {
        dust = totalSwapAmount.minus(totalSwapAmountWithRoundingErrors);
        if (swapType === 'swapExactIn') {
            swaps[0][0].swapAmount = new BigNumber(swaps[0][0].swapAmount)
                .plus(dust)
                .toString(); // Add dust to first swapExactIn
        } else {
            if (lenghtFirstPath == 1)
                // First path is a direct path (only one pool)
                swaps[0][0].swapAmount = new BigNumber(swaps[0][0].swapAmount)
                    .plus(dust)
                    .toString();
            // Add dust to first swapExactOut
            // First path is a multihop path (two pools)
            else
                swaps[0][1].swapAmount = new BigNumber(swaps[0][1].swapAmount)
                    .plus(dust)
                    .toString(); // Add dust to second swapExactOut
        }
    }
    return [swaps, bestTotalReturn];
};

function getPricesOfInterest(sortedPaths: Path[], swapType: string): Price[] {
    let pricesOfInterest: Price[] = [];
    // let slippageFactors = {};
    sortedPaths.forEach((path, i) => {
        // New pool
        let pi: Price = {};
        pi.price = path.spotPrice;
        pi.id = path.id;
        pricesOfInterest.push(pi);

        // Max amount for this pool
        pi = {};
        pi.price = path.spotPrice.plus(
            bmul(bmul(path.limitAmount, path.slippage), path.spotPrice)
        );
        pi.maxAmount = path.id;
        pricesOfInterest.push(pi);
        path.slippagePriceFactor = bmul(path.slippage, path.spotPrice);

        for (let k = 0; k < i; k++) {
            let prevPath = sortedPaths[k];
            // let prevSlippageFactor = slippageFactors[prevPath.id];
            let prevSlippageFactor = prevPath.slippagePriceFactor;

            if (path.slippagePriceFactor.isLessThan(prevSlippageFactor)) {
                let amountCross = bdiv(
                    path.spotPrice.minus(prevPath.spotPrice),
                    prevSlippageFactor.minus(path.slippagePriceFactor)
                );

                if (
                    amountCross.isLessThan(path.limitAmount) &&
                    amountCross.isLessThan(prevPath.limitAmount)
                ) {
                    let epiA: Price = {};
                    epiA.price = path.spotPrice.plus(
                        bmul(amountCross, path.slippagePriceFactor)
                    );
                    epiA.swap = [prevPath.id, path.id];
                    pricesOfInterest.push(epiA);
                }

                if (
                    prevPath.limitAmount.isLessThan(path.limitAmount) &&
                    prevPath.limitAmount.isLessThan(amountCross)
                ) {
                    let epiB: Price = {};
                    epiB.price = path.spotPrice.plus(
                        bmul(prevPath.limitAmount, path.slippagePriceFactor)
                    );
                    epiB.swap = [prevPath.id, path.id];
                    pricesOfInterest.push(epiB);
                }

                if (
                    path.limitAmount.isLessThan(prevPath.limitAmount) &&
                    amountCross.isLessThan(path.limitAmount)
                ) {
                    let epiC: Price = {};
                    epiC.price = prevPath.spotPrice.plus(
                        bmul(path.limitAmount, prevSlippageFactor)
                    );
                    epiC.swap = [path.id, prevPath.id];
                    pricesOfInterest.push(epiC);
                }
            } else {
                if (prevPath.limitAmount.isLessThan(path.limitAmount)) {
                    let epiD: Price = {};
                    epiD.price = path.spotPrice.plus(
                        bmul(prevPath.limitAmount, path.slippagePriceFactor)
                    );
                    epiD.swap = [prevPath.id, path.id];
                    pricesOfInterest.push(epiD);
                }
            }
        }
    });

    return pricesOfInterest;
}

function calculateBestPathIdsForPricesOfInterest(
    pricesOfInterest: Price[],
    maxPools: number
): Price[] {
    let bestPathsIds: string[] = [];
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
                    let bestPath1 = bestPathsIds[index1];
                    let bestPath2 = bestPathsIds[index2];
                    bestPathsIds[index1] = bestPath2;
                    bestPathsIds[index2] = bestPath1;
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
            path.slippagePriceFactor
        );

        if (inputAmount.isNaN()) inputAmount = bnum(0);

        if (path.limitAmount.isLessThan(inputAmount)) {
            inputAmount = path.limitAmount;
        }
        swapAmounts.push(inputAmount);
    });
    return swapAmounts;
}

export const calcTotalReturn = (
    pools: PoolDictionary,
    paths: Path[],
    swapType: string,
    pathIds: string[],
    swapAmounts: BigNumber[]
): BigNumber => {
    let path;
    let totalReturn = new BigNumber(0);
    let poolsClone = JSON.parse(JSON.stringify(pools)); // we create a clone to avoid
    // changing the contents of pools (parameter passed as reference)
    pathIds.forEach((b, i) => {
        path = paths.find(obj => {
            return obj.id === b;
        });
        totalReturn = totalReturn.plus(
            getReturnAmountSwapPath(poolsClone, path, swapType, swapAmounts[i])
        );
    });
    return totalReturn;
};

function getExactSwapAmounts(
    swapAmountsPriceBefore: BigNumber[],
    swapAmountsPriceAfter: BigNumber[],
    totalSwapAmountWithRoundingErrors: BigNumber
): BigNumber[] {
    let deltaBeforeAfterAmounts: BigNumber[] = [];

    if (
        swapAmountsPriceAfter[swapAmountsPriceAfter.length - 1].isEqualTo(
            new BigNumber(0)
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
    let deltaTimesTarget: BigNumber[] = [];
    deltaBeforeAfterAmounts.forEach((a, i) => {
        let ratio = bdiv(
            totalSwapAmountWithRoundingErrors.minus(totalInputBefore),
            deltaTotalInput
        );

        let deltaAmount = bmul(ratio, a);
        deltaTimesTarget.push(deltaAmount);
    });

    let swapAmounts: BigNumber[] = [];
    swapAmountsPriceBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        swapAmounts.push(add);
    });
    return swapAmounts;
}
