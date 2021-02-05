import {
    getSpotPrice,
    getSpotPricePath,
    getSlippageLinearizedSpotPriceAfterSwapPath,
    getLimitAmountSwapPath,
    getReturnAmountSwap,
    getReturnAmountSwapPath,
    parsePoolPairData,
    getHighestLimitAmountsForPaths,
    getEffectivePriceSwapPath,
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
                poolPairData[id] = { poolPairData: poolPairDataSwap1 };
            }
            // TODO!
            // } else if (swaps.length == 2) {
            //     let swap1: Swap = swaps[0];
            //     let id = `${swap1.pool}${swap1.tokenIn}${swap1.tokenOut}`;
            //     if (poolPairData[id] === undefined) {
            //         let poolSwap1: Pool = pools[swap1.pool];
            //         let poolPairDataSwap1: PoolPairData = parsePoolPairData(
            //             poolSwap1,
            //             swap1.tokenIn,
            //             swap1.tokenOut
            //         );

            //         let sp = getSpotPrice(poolPairDataSwap1);
            //         poolPairData[id] = { poolPairData: poolPairDataSwap1, sp: sp };
            //     }

            //     let swap2: Swap = swaps[1];
            //     id = `${swap2.pool}${swap2.tokenIn}${swap2.tokenOut}`;
            //     if (poolPairData[id] === undefined) {
            //         let poolSwap2: Pool = pools[swap2.pool];
            //         let poolPairDataSwap2: PoolPairData = parsePoolPairData(
            //             poolSwap2,
            //             swap2.tokenIn,
            //             swap2.tokenOut
            //         );

            //         let sp = getSpotPrice(poolPairDataSwap2);
            //         poolPairData[id] = { poolPairData: poolPairDataSwap2, sp: sp };
            //     }
        }

        path.limitAmount = getLimitAmountSwapPath(
            pools,
            path,
            swapType,
            poolPairData
        );
    });

    let sortedPaths = paths.sort((a, b) => {
        return b.limitAmount.minus(a.limitAmount).toNumber();
    });

    return sortedPaths;
}

/* TODO: review
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
export const smartOrderRouter = (
    pools: PoolDictionary,
    paths: Path[],
    swapType: string,
    totalSwapAmount: BigNumber,
    maxPools: number,
    costReturnToken: BigNumber
): [Swap[][], BigNumber] => {
    let bestTotalReturn: BigNumber = new BigNumber(0);
    let bestTotalReturnConsideringFees: BigNumber = new BigNumber(0);
    let pathIds, totalReturn, totalReturnConsideringFees;
    let bestSwapAmounts = [],
        bestPathIds,
        swapAmounts;

    // Before we start the main loop, we first check if there is enough liquidity for this totalSwapAmount at all
    let highestLimitAmounts = getHighestLimitAmountsForPaths(
        paths,
        swapType,
        maxPools
    );

    //  We use the highest limits to define the initial number of pools considered and the initial guess for input_amounts. If the
    //  highest_limit is lower than totalSwapAmount, then we should obviously not waste time trying to calculate the SOR suggestion for 1 pool,
    //  Same for 2, 3 pools etc.
    let initialNumPools = -1; // Initializing
    for (let i = 1; i < maxPools; i++) {
        let sumHighestLimitAmounts = highestLimitAmounts
            .slice(0, i)
            .reduce((a, b) => a.plus(b));
        if (totalSwapAmount > sumHighestLimitAmounts) continue; // the i initial pools are not enough to get to totalSwapAmount, continue
        //  If above is false, it means we have enough liquidity with first i pools
        initialNumPools = i;
        swapAmounts = highestLimitAmounts.slice(0, initialNumPools);
        //  Since the sum of the first i highest limits will be less than totalSwapAmount, we remove the difference to the last input_amount
        //  so we are sure that the sum of swapAmounts will be equal to totalSwapAmount
        let difference = sumHighestLimitAmounts.minus(totalSwapAmount);
        swapAmounts[-1] = swapAmounts[-1].minus(difference);
        break; // No need to keep looping as this number of pools (i) has enough liquidity
    }
    if (initialNumPools == -1) {
        return [[], bnum(0)]; // return [swaps, bestTotalReturn];
    }

    // First get the optimal totalReturn to trade 'totalSwapAmount' with
    // one path only (b=1). Then increase the number of pools as long as
    // improvementCondition is true (see more information below)
    for (let b = initialNumPools; b <= paths.length + 1; b++) {
        totalReturn = 0;
        if (b != initialNumPools) {
            // We already had a previous iteration and are adding another pool this new iteration
            swapAmounts.push(bnum(0)); // We add amount 0 and the initial guess for the additional pool
        }

        //  iterate until we converge to the best pools for a given totalSwapAmount
        //  first initialize previousPathIds and pathIds
        let previousPathIds, historyOfSortedPathIds;
        let pathIds = getBestPathIds(pools, paths, swapType, swapAmounts);
        // Check if ids are in history of ids, but first sort and stringify to make comparison possible
        // Copy array https://stackoverflow.com/a/42442909
        let sortedPathIds = [...pathIds].sort();
        while (historyOfSortedPathIds.includes(sortedPathIds)) {
            historyOfSortedPathIds.push(sortedPathIds); // We store all previous paths ids to avoid infinite loops because of local minima
            previousPathIds = pathIds;
            swapAmounts = iterateSwapAmounts(
                pools,
                swapType,
                pathIds,
                swapAmounts
            ); // Stopped here
            //  print(price)
            //  print(swapAmounts)
            pathIds = getBestPathIds(pools, paths, swapType, swapAmounts);
            sortedPathIds = [...pathIds].sort();
        }

        pathIds = previousPathIds; // We want to keep the best pathIds used by iterateSwapAmounts to calculate swapAmounts
        //  since getBestPools might change the order of pool ids because spotPriceAfterTrade (used by iterateSwapAmounts) yields
        //  different results from getEffectivePriceSwap (used by getBestPools)

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

        // improvementCondition is true if we are improving the totalReturn
        // Notice that totalReturn has to be maximized for 'swapExactIn'
        // and MINIMIZED for 'swapExactOut'
        // This is because for the case of 'swapExactOut', totalReturn means the
        // amount of tokenIn needed to buy totalSwapAmount of tokenOut
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

//  For a given list of swapAmounts, gets list of pools with best effective price for these amounts
//  Always choose best pool for highest input_amount first, then 2nd input_amount and so on. This is
//  because it's best to use the best effective price for the highest amount to be traded
function getBestPathIds(
    pools: PoolDictionary,
    originalPaths: Path[],
    swapType: string,
    swapAmounts: BigNumber[]
): string[] {
    let bestPathIds, sortedSwapAmounts;
    let paths = JSON.parse(JSON.stringify(originalPaths)); // Deep copy to avoid changing the original path data

    // Sort swapAmounts in descending order
    sortedSwapAmounts = swapAmounts.sort((a, b) => {
        return b.minus(a).toNumber();
    });
    sortedSwapAmounts.forEach((swapAmount, i) => {
        // Find path that has best effective price
        let bestPathIndex = 0;
        let bestEffectivePrice = bnum('Infinity'); // Start with worst price possible
        paths.forEach((path, j) => {
            // Calculate effective price of this path for this swapAmount
            let effectivePrice = getEffectivePriceSwapPath(
                pools,
                path,
                swapType,
                swapAmount
            );
            if (effectivePrice < bestEffectivePrice) {
                bestEffectivePrice = effectivePrice;
                bestPathIndex = j;
            }
        });
        bestPathIds[i] = paths[bestPathIndex].id;
        paths.pop(bestPathIndex);
    });
    return bestPathIds;
}
