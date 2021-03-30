import { bnum } from './bmath';
import { BigNumber } from './utils/bignumber';
import { SwapTypes, PoolPairBase, NewPath, PoolBase, PairTypes } from './types';
import { MAX_IN_RATIO, MAX_OUT_RATIO } from './bmath';

export function calculatePathLimits(
    paths: NewPath[],
    swapType: SwapTypes
): [NewPath[], BigNumber] {
    let maxLiquidityAvailable = bnum(0);
    paths.forEach(path => {
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

export function getLimitAmountSwap(
    poolPairData: PoolPairBase,
    swapType: SwapTypes
): BigNumber {
    // We multiply ratios by 10**-18 because we are in normalized space
    // so 0.5 should be 0.5 and not 500000000000000000
    // TODO: update bmath to use everything normalized
    if (swapType === SwapTypes.SwapExactIn) {
        return poolPairData.balanceIn.times(MAX_IN_RATIO.times(10 ** -18));
    } else {
        return poolPairData.balanceOut.times(MAX_OUT_RATIO.times(10 ** -18));
    }
}

export function getLimitAmountSwapForPath(
    path: NewPath,
    swapType: SwapTypes
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getLimitAmountSwap(poolPairData[0], swapType);
    } else if (poolPairData.length == 2) {
        if (swapType === SwapTypes.SwapExactIn) {
            let limitAmountSwap1 = getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            let limitAmountSwap2 = getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            let limitOutputAmountSwap1 = getOutputAmountSwap(
                path.pools[0],
                swapType,
                limitAmountSwap1
            );
            if (limitOutputAmountSwap1.gt(limitAmountSwap2))
                if (limitAmountSwap2.isZero())
                    // This means second hop is limiting the path
                    return bnum(0);
                // this is necessary to avoid return NaN
                else
                    return getOutputAmountSwap(
                        path.pools[0],
                        SwapTypes.SwapExactOut,
                        limitAmountSwap2
                    );
            // This means first hop is limiting the path
            else return limitAmountSwap1;
        } else {
            let limitAmountSwap1 = getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            let limitAmountSwap2 = getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            let limitOutputAmountSwap2 = getOutputAmountSwap(
                path.pools[1],
                swapType,
                limitAmountSwap2
            );
            if (limitOutputAmountSwap2.gt(limitAmountSwap1))
                // This means first hop is limiting the path
                return getOutputAmountSwap(
                    path.pools[1],
                    SwapTypes.SwapExactIn,
                    limitAmountSwap1
                );
            // This means second hop is limiting the path
            else return limitAmountSwap2;
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getOutputAmountSwap(
    pool: PoolBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    let pairType = pool.poolPairData.pairType;

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (pool.poolPairData.balanceIn.isZero()) {
            return bnum(0);
        } else if (pairType === PairTypes.TokenToToken) {
            return pool._exactTokenInForTokenOut(amount);
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._exactTokenInForBPTOut(amount);
        } else if (pairType == PairTypes.BptToToken) {
            return pool._exactBPTInForTokenOut(amount);
        }
    } else {
        if (pool.poolPairData.balanceOut.isZero()) {
            return bnum(0);
        } else if (amount.gte(pool.poolPairData.balanceOut)) {
            return bnum('Infinity');
        } else if (pairType === PairTypes.TokenToToken) {
            return pool._tokenInForExactTokenOut(amount);
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._tokenInForExactBPTOut(amount);
        } else if (pairType === PairTypes.BptToToken) {
            return pool._BPTInForExactTokenOut(amount);
        }
    }
}
/*
export const smartOrderRouter = (
    pools: SubGraphPoolDictionary,
    paths: Path[],
    swapType: string,
    totalSwapAmount: BigNumber,
    maxPools: number,
    costReturnToken: BigNumber
): [Swap[][], BigNumber, BigNumber] => {
    let bestTotalReturn: BigNumber = new BigNumber(0);
    let bestTotalReturnConsideringFees: BigNumber = new BigNumber(0);
    let totalReturn, totalReturnConsideringFees;
    let bestSwapAmounts, bestPathIds, bestPaths, swapAmounts;

    // No paths available or totalSwapAmount == 0, return empty solution
    if (paths.length == 0 || totalSwapAmount.isZero()) {
        return [[], bnum(0), bnum(0)];
    }
    // Before we start the main loop, we first check if there is enough liquidity for this totalSwapAmount at all
    let highestLimitAmounts = getHighestLimitAmountsForPaths(paths, maxPools);

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
        swapAmounts[swapAmounts.length - 1] = swapAmounts[
            swapAmounts.length - 1
        ].minus(difference);
        break; // No need to keep looping as this number of pools (i) has enough liquidity
    }
    if (initialNumPaths == -1) {
        return [[], bnum(0), bnum(0)]; // Not enough liquidity, return empty
    }

    // First get the optimal totalReturn to trade 'totalSwapAmount' with
    // one path only (b=1). Then increase the number of pools as long as
    // improvementCondition is true (see more information below)
    for (let b = initialNumPaths; b <= paths.length; b++) {
        totalReturn = 0;
        if (b != initialNumPaths) {
            // We already had a previous iteration and are adding another pool this new iteration
            // swapAmounts.push(bnum(1)); // Initialize new swapAmount with 1 wei to
            // // make sure that it won't be considered as a non viable amount (which would
            // // be the case if it started at 0)

            // Start new path at 1/b of totalSwapAmount (i.e. if this is the 5th pool, we start with
            // 20% of the totalSwapAmount for this new swapAmount added). However, we need to make sure
            // that this value is not higher then the bth limit of the paths available otherwise there
            // won't be any possible path to process this swapAmount:
            let newSwapAmount = BigNumber.min.apply(null, [
                totalSwapAmount.times(bnum(1 / b)),
                highestLimitAmounts[b - 1],
            ]);
            // We need then to multiply all current
            // swapAmounts by 1-newSwapAmount/totalSwapAmount.
            swapAmounts.forEach((swapAmount, i) => {
                swapAmounts[i] = swapAmounts[i].times(
                    bnum(1).minus(newSwapAmount.div(totalSwapAmount))
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
            sortedPathIdsJSON = JSON.stringify([...pathIds].sort());
        }
        // In case b = 1 the while above was skipped and we need to define selectedPaths
        if (b == 1) selectedPaths = newSelectedPaths;

        totalReturn = calcTotalReturn(
            pools,
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
        let improvementCondition: boolean = false;
        if (swapType === 'swapExactIn') {
            totalReturnConsideringFees = totalReturn.minus(
                bnum(totalNumberOfPools).times(costReturnToken)
            );
            improvementCondition =
                totalReturnConsideringFees.isGreaterThan(
                    bestTotalReturnConsideringFees
                ) || b === initialNumPaths; // b === initialNumPaths means its the first iteration so bestTotalReturnConsideringFees isn't currently a value
        } else {
            totalReturnConsideringFees = totalReturn.plus(
                bnum(totalNumberOfPools).times(costReturnToken)
            );
            improvementCondition =
                totalReturnConsideringFees.isLessThan(
                    bestTotalReturnConsideringFees
                ) || b === initialNumPaths; // b === initialNumPaths means its the first iteration so bestTotalReturnConsideringFees isn't currently a value
        }
        if (improvementCondition === true) {
            bestSwapAmounts = [...swapAmounts]; // Copy to avoid linking variables
            bestPathIds = [...pathIds];
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
    let swaps: Swap[][] = [];
    let totalSwapAmountWithRoundingErrors: BigNumber = new BigNumber(0);
    let dust: BigNumber = new BigNumber(0);
    let lenghtFirstPath;
    let highestSwapAmt = bnum(0);
    let largestSwapPath: Path;
    bestTotalReturn = bnum(0); // Reset totalReturn as this time it will be
    // calculated with the EVM maths so the return is exactly what the user will get
    // after executing the transaction (given there are no front-runners)
    bestPaths.forEach((path, i) => {
        let swapAmount = bestSwapAmounts[i];
        console.log(swapAmount.toString());
        if (swapAmount.gt(highestSwapAmt)) {
            highestSwapAmt = swapAmount;
            largestSwapPath = path;
        }
        totalSwapAmountWithRoundingErrors = totalSwapAmountWithRoundingErrors.plus(
            swapAmount
        );

        // // TODO: remove. To debug only!

        console.log(
            'Prices should be all very close (unless one of the paths is on the limit!'
        );
        console.log(
            getSpotPriceAfterSwapForPath(
                pools,
                path,
                swapType,
                swapAmount
            ).toNumber()
        );

        let poolPairData = path.poolPairData;

        if (i == 0)
            // Store lenght of first path to add dust to correct rounding error at the end
            lenghtFirstPath = path.swaps.length;

        let returnAmount;
        if (poolPairData.length == 1) {
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
                tokenInDecimals: path.poolPairData[0].decimalsIn,
                tokenOutDecimals: path.poolPairData[0].decimalsOut,
            };
            swaps.push([swap]);
            // Call EVMgetOutputAmountSwap to guarantee pool state is updated
            returnAmount = EVMgetOutputAmountSwap(
                pools,
                poolPairData[0],
                swapType,
                swapAmount
            );
        } else {
            // Multi-hop:

            let swap1 = path.swaps[0];
            let poolSwap1 = pools[swap1.pool];

            let swap2 = path.swaps[1];
            let poolSwap2 = pools[swap2.pool];

            let amountSwap1, amountSwap2;
            if (swapType === 'swapExactIn') {
                amountSwap1 = swapAmount;
                amountSwap2 = EVMgetOutputAmountSwap(
                    pools,
                    poolPairData[0],
                    swapType,
                    swapAmount
                );
                // Call EVMgetOutputAmountSwap to update the pool state
                // for the second hop as well (the first was updated above)
                returnAmount = EVMgetOutputAmountSwap(
                    pools,
                    poolPairData[1],
                    swapType,
                    amountSwap2
                );
            } else {
                amountSwap1 = EVMgetOutputAmountSwap(
                    pools,
                    poolPairData[1],
                    swapType,
                    swapAmount
                );
                amountSwap2 = swapAmount;
                // Call EVMgetOutputAmountSwap to update the pool state
                // for the second hop as well (the first was updated above)
                returnAmount = EVMgetOutputAmountSwap(
                    pools,
                    poolPairData[0],
                    swapType,
                    amountSwap1
                );
            }

            // Add swap from first pool
            let swap1hop: Swap = {
                pool: path.swaps[0].pool,
                tokenIn: path.swaps[0].tokenIn,
                tokenOut: path.swaps[0].tokenOut,
                swapAmount: amountSwap1.toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
                tokenInDecimals: path.poolPairData[0].decimalsIn,
                tokenOutDecimals: path.poolPairData[0].decimalsOut,
            };

            // Add swap from second pool
            let swap2hop: Swap = {
                pool: path.swaps[1].pool,
                tokenIn: path.swaps[1].tokenIn,
                tokenOut: path.swaps[1].tokenOut,
                swapAmount: amountSwap2.toString(),
                limitReturnAmount:
                    swapType === 'swapExactIn'
                        ? minAmountOut.toString()
                        : maxAmountIn.toString(),
                maxPrice: maxPrice.toString(),
                tokenInDecimals: path.poolPairData[1].decimalsIn,
                tokenOutDecimals: path.poolPairData[1].decimalsOut,
            };
            swaps.push([swap1hop, swap2hop]);
        }
        // Update bestTotalReturn with EVM return
        bestTotalReturn = bestTotalReturn.plus(returnAmount);
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
    console.log('Number of paths: ' + bestPaths.length.toString());

    const marketSp = getSpotPriceAfterSwapForPath(
        pools,
        largestSwapPath,
        swapType,
        bnum(0)
    );

    return [swaps, bestTotalReturn, marketSp];
};*/
