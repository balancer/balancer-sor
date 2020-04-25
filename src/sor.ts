import {
    getSpotPrice,
    getSlippageLinearizedSpotPriceAfterSwap,
    getLimitAmountSwap,
    getLinearizedOutputAmountSwap,
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
import { Pool, Swap, SwapAmount, Price } from './types';

export const smartOrderRouter = (
    pools: Pool[],
    swapType: string,
    targetInputAmount: BigNumber,
    maxPools: number,
    costOutputToken: BigNumber
): SwapAmount[] => {
    pools.forEach(b => {
        b.spotPrice = getSpotPrice(b);
        b.slippage = getSlippageLinearizedSpotPriceAfterSwap(b, swapType);
        b.limitAmount = getLimitAmountSwap(b, swapType);
    });
    let sortedPools = pools.sort((a, b) => {
        return a.spotPrice.minus(b.spotPrice).toNumber();
    });

    let pricesOfInterest = getPricesOfInterest(sortedPools, swapType).sort(
        (a, b) => {
            return a.price.minus(b.price).toNumber();
        }
    );

    pricesOfInterest = calculateBestPoolsForPricesOfInterest(pricesOfInterest);

    pricesOfInterest.forEach(e => {
        let bids = e.bestPools;
        let ep = e.price;
        e.amounts = getInputAmountsForEp(sortedPools, bids, ep);
    });

    let bestTotalOutput: BigNumber = new BigNumber(0);
    let highestEpNotEnough: boolean = true;
    let poolIds, totalOutput;
    let bestInputAmounts, bestPoolIds, inputAmounts;

    let bmin = Math.min(maxPools, pools.length + 1);
    for (let b = 1; b <= bmin; b++) {
        totalOutput = 0;

        let e, epAfter, epBefore, inputAmountsEpBefore, inputAmountsEpAfter;
        for (let i = 0; i < pricesOfInterest.length; i++) {
            e = pricesOfInterest[i];

            epAfter = e;

            if (i === 0) {
                epBefore = epAfter;
                continue;
            }

            let inputAmountsAfter = epAfter.amounts;
            let totalInputAmountAfter = inputAmountsAfter
                .slice(0, b)
                .reduce((a, b) => a.plus(b));

            if (totalInputAmountAfter.isGreaterThan(targetInputAmount)) {
                poolIds = epBefore.bestPools.slice(0, b);
                inputAmountsEpBefore = epBefore.amounts.slice(0, b);
                inputAmountsEpAfter = epAfter.amounts.slice(0, b);

                inputAmounts = getExactInputAmounts(
                    inputAmountsEpBefore,
                    inputAmountsEpAfter,
                    targetInputAmount
                );

                highestEpNotEnough = false;
                break;
            }

            epBefore = epAfter;
        }

        if (highestEpNotEnough) {
            poolIds = [];
            inputAmounts = [];
        }

        totalOutput = getLinearizedTotalOutput(
            pools,
            swapType,
            poolIds,
            inputAmounts
        );

        let improvementCondition: boolean = false;
        if (swapType === 'swapExactIn') {
            totalOutput = totalOutput.minus(
                bmul(new BigNumber(poolIds.length).times(BONE), costOutputToken)
            );
            improvementCondition =
                totalOutput.isGreaterThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new BigNumber(0));
        } else {
            totalOutput = totalOutput.plus(
                bmul(new BigNumber(poolIds.length).times(BONE), costOutputToken)
            );
            improvementCondition =
                totalOutput.isLessThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new BigNumber(0));
        }

        if (improvementCondition === true) {
            bestInputAmounts = inputAmounts;
            bestPoolIds = poolIds;
            bestTotalOutput = totalOutput;
        } else {
            break;
        }
    }

    let swaps: SwapAmount[] = [];
    let totalSwapAmount: BigNumber = new BigNumber(0);
    let dust: BigNumber = new BigNumber(0);

    bestInputAmounts.forEach((amount, i) => {
        let swap: SwapAmount = {
            pool: bestPoolIds[i],
            amount: amount,
        };
        totalSwapAmount = totalSwapAmount.plus(amount);
        swaps.push(swap);
    });

    if (swaps.length > 0) {
        dust = targetInputAmount.minus(totalSwapAmount);
        swaps[0].amount = swaps[0].amount.plus(dust);
    }

    return swaps;
};

function getPricesOfInterest(sortedPools: Pool[], swapType: string): Price[] {
    let pricesOfInterest: Price[] = [];
    sortedPools.forEach((b, i) => {
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
            let prevPool = sortedPools[k];

            if (
                bmul(b.slippage, b.spotPrice).isLessThan(
                    bmul(prevPool.slippage, prevPool.spotPrice)
                )
            ) {
                let amountCross = bdiv(
                    b.spotPrice.minus(prevPool.spotPrice),
                    bmul(prevPool.slippage, prevPool.spotPrice).minus(
                        bmul(b.slippage, b.spotPrice)
                    )
                );

                if (
                    amountCross.isLessThan(b.limitAmount) &&
                    amountCross.isLessThan(prevPool.limitAmount)
                ) {
                    let epi1: Price = {};
                    epi1.price = prevPool.spotPrice.plus(
                        bmul(
                            amountCross,
                            bmul(prevPool.slippage, prevPool.spotPrice)
                        )
                    );
                    epi1.swap = [prevPool.id, b.id];
                    pricesOfInterest.push(epi1);
                }

                if (
                    prevPool.limitAmount.isLessThan(b.limitAmount) &&
                    prevPool.limitAmount.isLessThan(amountCross)
                ) {
                    let epi2: Price = {};
                    epi2.price = b.spotPrice.plus(
                        bmul(
                            prevPool.limitAmount,
                            bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epi2.swap = [prevPool.id, b.id];
                    pricesOfInterest.push(epi2);
                }

                if (
                    b.limitAmount.isLessThan(prevPool.limitAmount) &&
                    amountCross.isLessThan(b.limitAmount)
                ) {
                    let epi3: Price = {};
                    epi3.price = prevPool.spotPrice.plus(
                        bmul(
                            b.limitAmount,
                            bmul(prevPool.slippage, prevPool.spotPrice)
                        )
                    );
                    epi3.swap = [b.id, prevPool.id];
                    pricesOfInterest.push(epi3);
                }
            } else {
                if (prevPool.limitAmount.isLessThan(b.limitAmount)) {
                    let epi4: Price = {};
                    epi4.price = b.spotPrice.plus(
                        bmul(
                            prevPool.limitAmount,
                            bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epi4.swap = [prevPool.id, b.id];
                    pricesOfInterest.push(epi4);
                }
            }
        }
    });

    return pricesOfInterest;
}

export const calcTotalOutput = (swaps: Swap[], poolData: Pool[]): BigNumber => {
    try {
        let totalAmountOut = bnum(0);
        swaps.forEach(swap => {
            const swapAmount = swap.tokenInParam;

            const pool = poolData.find(p => p.id === swap.pool);
            if (!pool) {
                throw new Error(
                    '[Invariant] No pool found for selected pool index'
                );
            }

            const preview = calcOutGivenIn(
                pool.balanceIn,
                pool.weightIn,
                pool.balanceOut,
                pool.weightOut,
                bnum(swapAmount),
                pool.swapFee
            );

            totalAmountOut = totalAmountOut.plus(preview);
        });
        return totalAmountOut;
    } catch (e) {
        throw new Error(e);
    }
};

export const calcTotalInput = (swaps: Swap[], poolData: Pool[]): BigNumber => {
    try {
        let totalAmountIn = bnum(0);
        swaps.forEach(swap => {
            const swapAmount = swap.tokenOutParam;
            const pool = poolData.find(p => p.id === swap.pool);
            if (!pool) {
                throw new Error(
                    '[Invariant] No pool found for selected pool index'
                );
            }

            const preview = calcInGivenOut(
                pool.balanceIn,
                pool.weightIn,
                pool.balanceOut,
                pool.weightOut,
                bnum(swapAmount),
                pool.swapFee
            );

            totalAmountIn = totalAmountIn.plus(preview);
        });

        return totalAmountIn;
    } catch (e) {
        throw new Error(e);
    }
};

export const formatSwapsExactAmountIn = (
    sorSwaps: SwapAmount[],
    maxPrice: BigNumber,
    minAmountOut: BigNumber
): Swap[] => {
    const swaps: Swap[] = [];
    for (let i = 0; i < sorSwaps.length; i++) {
        let swapAmount = sorSwaps[i].amount;
        let swap: Swap = {
            pool: sorSwaps[i].pool,
            tokenInParam: swapAmount.toString(),
            tokenOutParam: minAmountOut.toString(),
            maxPrice: maxPrice.toString(),
        };
        swaps.push(swap);
    }
    return swaps;
};

export const formatSwapsExactAmountOut = (
    sorSwaps: SwapAmount[],
    maxPrice: BigNumber,
    maxAmountIn: BigNumber
): Swap[] => {
    const swaps: Swap[] = [];
    for (let i = 0; i < sorSwaps.length; i++) {
        let swapAmount = sorSwaps[i].amount;
        let swap: Swap = {
            pool: sorSwaps[i].pool,
            tokenInParam: maxAmountIn.toString(),
            tokenOutParam: swapAmount.toString(),
            maxPrice: maxPrice.toString(),
        };
        swaps.push(swap);
    }
    return swaps;
};

function calculateBestPoolsForPricesOfInterest(
    pricesOfInterest: Price[]
): Price[] {
    let bestPools = [];
    pricesOfInterest.forEach((e, i) => {
        if (e.id != null) {
            bestPools.push(e.id);
        } else if (e.swap) {
            let index1 = bestPools.indexOf(e.swap[0]);
            let index2 = bestPools.indexOf(e.swap[1]);

            if (index1 != -1) {
                if (index2 != -1) {
                    let bestBal1 = bestPools[index1];
                    let bestBal2 = bestPools[index2];
                    bestPools[index1] = bestBal2;
                    bestPools[index2] = bestBal1;
                } else {
                    bestPools[index1] = e.swap[2];
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
        pricesOfInterest[i].bestPools = bestPools.slice();
    });
    return pricesOfInterest;
}

function getInputAmountsForEp(
    pools: Pool[],
    bids: string[],
    ep: BigNumber
): BigNumber[] {
    let inputAmounts: BigNumber[] = [];
    bids.forEach((bid, i) => {
        let pool = pools.find(obj => {
            return obj.id === bid;
        });
        let inputAmount = bdiv(
            ep.minus(pool.spotPrice),
            bmul(pool.slippage, pool.spotPrice)
        );
        if (pool.limitAmount.isLessThan(inputAmount)) {
            inputAmount = pool.limitAmount;
        }
        inputAmounts.push(inputAmount);
    });
    return inputAmounts;
}

function getLinearizedTotalOutput(
    pools: Pool[],
    swapType: string,
    poolIds: string[],
    inputAmounts: BigNumber[]
): BigNumber {
    let pool;
    let totalOutput = new BigNumber(0);
    poolIds.forEach((b, i) => {
        pool = pools.find(obj => {
            return obj.id === b;
        });
        totalOutput = totalOutput.plus(
            getLinearizedOutputAmountSwap(pool, swapType, inputAmounts[i])
        );
    });
    return totalOutput;
}

function getExactInputAmounts(
    inputAmountsEpBefore: BigNumber[],
    inputAmountsEpAfter: BigNumber[],
    targetTotalInput: BigNumber
): BigNumber[] {
    let deltaInputAmounts: BigNumber[] = [];

    if (
        inputAmountsEpAfter[inputAmountsEpAfter.length - 1].isEqualTo(
            new BigNumber(0)
        )
    )
        inputAmountsEpAfter.pop();
    inputAmountsEpAfter.forEach((a, i) => {
        let diff = a.minus(inputAmountsEpBefore[i]);
        deltaInputAmounts.push(diff);
    });
    let totalInputBefore = inputAmountsEpBefore.reduce((a, b) => a.plus(b));
    let totalInputAfter = inputAmountsEpAfter.reduce((a, b) => a.plus(b));
    let deltaTotalInput = totalInputAfter.minus(totalInputBefore);

    let deltaTimesTarget: BigNumber[] = [];
    deltaInputAmounts.forEach((a, i) => {
        let mult = bmul(a, targetTotalInput.minus(totalInputBefore));
        mult = bdiv(mult, deltaTotalInput);
        deltaTimesTarget.push(mult);
    });

    let inputAmounts: BigNumber[] = [];
    inputAmountsEpBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        inputAmounts.push(add);
    });
    return inputAmounts;
}
