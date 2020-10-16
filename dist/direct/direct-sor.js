'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const helpers_1 = require('./helpers');
const bmath_1 = require('../bmath');
const bignumber_1 = require('../utils/bignumber');
exports.smartOrderRouter = (
    balancers,
    swapType,
    targetInputAmount,
    maxBalancers,
    costOutputToken
) => {
    balancers.forEach(b => {
        b.spotPrice = helpers_1.getSpotPrice(b);
        b.slippage = helpers_1.getSlippageLinearizedSpotPriceAfterSwap(
            b,
            swapType
        );
        b.limitAmount = helpers_1.getLimitAmountSwap(b, swapType);
    });
    let sortedBalancers = balancers.sort((a, b) => {
        return a.spotPrice.minus(b.spotPrice).toNumber();
    });
    let epsOfInterest = getEpsOfInterest(sortedBalancers, swapType).sort(
        (a, b) => {
            return a.price.minus(b.price).toNumber();
        }
    );
    epsOfInterest = calculateBestBalancersForEpsOfInterest(epsOfInterest);
    epsOfInterest.forEach(e => {
        let bids = e.bestPools;
        let ep = e.price;
        e.amounts = getInputAmountsForEp(sortedBalancers, bids, ep);
    });
    let bestTotalOutput = new bignumber_1.BigNumber(0);
    let highestEpNotEnough = true;
    let balancerIds, totalOutput;
    let bestInputAmounts, bestBalancerIds, inputAmounts;
    let bmin = Math.min(maxBalancers, balancers.length + 1);
    for (let b = 1; b <= bmin; b++) {
        totalOutput = 0;
        let e, epAfter, epBefore, inputAmountsEpBefore, inputAmountsEpAfter;
        for (let i = 0; i < epsOfInterest.length; i++) {
            e = epsOfInterest[i];
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
                balancerIds = epBefore.bestPools.slice(0, b);
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
            balancerIds = [];
            inputAmounts = [];
        }
        totalOutput = getLinearizedTotalOutput(
            balancers,
            swapType,
            balancerIds,
            inputAmounts
        );
        let improvementCondition = false;
        if (swapType === 'swapExactIn') {
            totalOutput = totalOutput.minus(
                bmath_1.bmul(
                    new bignumber_1.BigNumber(balancerIds.length).times(
                        bmath_1.BONE
                    ),
                    costOutputToken
                )
            );
            improvementCondition =
                totalOutput.isGreaterThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new bignumber_1.BigNumber(0));
        } else {
            totalOutput = totalOutput.plus(
                bmath_1.bmul(
                    new bignumber_1.BigNumber(balancerIds.length).times(
                        bmath_1.BONE
                    ),
                    costOutputToken
                )
            );
            improvementCondition =
                totalOutput.isLessThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new bignumber_1.BigNumber(0));
        }
        if (improvementCondition === true) {
            bestInputAmounts = inputAmounts;
            bestBalancerIds = balancerIds;
            bestTotalOutput = totalOutput;
        } else {
            break;
        }
    }
    let swaps = [];
    let totalSwapAmount = new bignumber_1.BigNumber(0);
    let dust = new bignumber_1.BigNumber(0);
    bestInputAmounts.forEach((amount, i) => {
        let swap = {
            pool: bestBalancerIds[i],
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
exports.smartOrderRouterEpsOfInterest = (
    balancers,
    swapType,
    targetInputAmount,
    maxBalancers,
    costOutputToken,
    epsOfInterest
) => {
    let bestTotalOutput = new bignumber_1.BigNumber(0);
    let highestEpNotEnough = true;
    let balancerIds, totalOutput;
    let bestInputAmounts, bestBalancerIds, inputAmounts;
    let bmin = Math.min(maxBalancers, balancers.length + 1);
    for (let b = 1; b <= bmin; b++) {
        totalOutput = 0;
        let e, epAfter, epBefore, inputAmountsEpBefore, inputAmountsEpAfter;
        for (let i = 0; i < epsOfInterest.length; i++) {
            e = epsOfInterest[i];
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
                balancerIds = epBefore.bestPools.slice(0, b);
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
            balancerIds = [];
            inputAmounts = [];
        }
        totalOutput = getLinearizedTotalOutput(
            balancers,
            swapType,
            balancerIds,
            inputAmounts
        );
        let improvementCondition = false;
        if (swapType === 'swapExactIn') {
            totalOutput = totalOutput.minus(
                bmath_1.bmul(
                    new bignumber_1.BigNumber(balancerIds.length).times(
                        bmath_1.BONE
                    ),
                    costOutputToken
                )
            );
            improvementCondition =
                totalOutput.isGreaterThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new bignumber_1.BigNumber(0));
        } else {
            totalOutput = totalOutput.plus(
                bmath_1.bmul(
                    new bignumber_1.BigNumber(balancerIds.length).times(
                        bmath_1.BONE
                    ),
                    costOutputToken
                )
            );
            improvementCondition =
                totalOutput.isLessThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new bignumber_1.BigNumber(0));
        }
        if (improvementCondition === true) {
            bestInputAmounts = inputAmounts;
            bestBalancerIds = balancerIds;
            bestTotalOutput = totalOutput;
        } else {
            break;
        }
    }
    let swaps = [];
    let totalSwapAmount = new bignumber_1.BigNumber(0);
    let dust = new bignumber_1.BigNumber(0);
    bestInputAmounts.forEach((amount, i) => {
        let swap = {
            pool: bestBalancerIds[i],
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
function getEpsOfInterest(sortedBalancers, swapType) {
    let epsOfInterest = [];
    sortedBalancers.forEach((b, i) => {
        // New balancer pool
        let epi = {};
        epi.price = b.spotPrice;
        epi.id = b.id;
        epsOfInterest.push(epi);
        // Max amount for this balancer pool
        epi = {};
        epi.price = b.spotPrice.plus(
            bmath_1.bmul(b.limitAmount, bmath_1.bmul(b.slippage, b.spotPrice))
        );
        epi.maxAmount = b.id;
        epsOfInterest.push(epi);
        for (let k = 0; k < i; k++) {
            let prevBal = sortedBalancers[k];
            if (
                bmath_1
                    .bmul(b.slippage, b.spotPrice)
                    .isLessThan(
                        bmath_1.bmul(prevBal.slippage, prevBal.spotPrice)
                    )
            ) {
                let amountCross = bmath_1.bdiv(
                    b.spotPrice.minus(prevBal.spotPrice),
                    bmath_1
                        .bmul(prevBal.slippage, prevBal.spotPrice)
                        .minus(bmath_1.bmul(b.slippage, b.spotPrice))
                );
                if (
                    amountCross.isLessThan(b.limitAmount) &&
                    amountCross.isLessThan(prevBal.limitAmount)
                ) {
                    let epi1 = {};
                    epi1.price = b.spotPrice.plus(
                        bmath_1.bmul(
                            amountCross,
                            bmath_1.bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epi1.swap = [prevBal.id, b.id];
                    epsOfInterest.push(epi1);
                }
                if (
                    prevBal.limitAmount.isLessThan(b.limitAmount) &&
                    prevBal.limitAmount.isLessThan(amountCross)
                ) {
                    let epi2 = {};
                    epi2.price = b.spotPrice.plus(
                        bmath_1.bmul(
                            prevBal.limitAmount,
                            bmath_1.bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epi2.swap = [prevBal.id, b.id];
                    epsOfInterest.push(epi2);
                }
                if (
                    b.limitAmount.isLessThan(prevBal.limitAmount) &&
                    amountCross.isLessThan(b.limitAmount)
                ) {
                    let epi3 = {};
                    epi3.price = prevBal.spotPrice.plus(
                        bmath_1.bmul(
                            b.limitAmount,
                            bmath_1.bmul(prevBal.slippage, prevBal.spotPrice)
                        )
                    );
                    epi3.swap = [b.id, prevBal.id];
                    epsOfInterest.push(epi3);
                }
            } else {
                if (prevBal.limitAmount.isLessThan(b.limitAmount)) {
                    let epi4 = {};
                    epi4.price = b.spotPrice.plus(
                        bmath_1.bmul(
                            prevBal.limitAmount,
                            bmath_1.bmul(b.slippage, b.spotPrice)
                        )
                    );
                    epi4.swap = [prevBal.id, b.id];
                    epsOfInterest.push(epi4);
                }
            }
        }
    });
    return epsOfInterest;
}
exports.calcTotalOutput = (swaps, poolData) => {
    try {
        let totalAmountOut = bmath_1.bnum(0);
        swaps.forEach(swap => {
            const swapAmount = swap.tokenInParam;
            const pool = poolData.find(p => p.id === swap.pool);
            if (!pool) {
                throw new Error(
                    '[Invariant] No pool found for selected balancer index'
                );
            }
            const preview = bmath_1.calcOutGivenIn(
                pool.balanceIn,
                pool.weightIn,
                pool.balanceOut,
                pool.weightOut,
                bmath_1.bnum(swapAmount),
                pool.swapFee
            );
            totalAmountOut = totalAmountOut.plus(preview);
        });
        return totalAmountOut;
    } catch (e) {
        throw new Error(e);
    }
};
exports.calcTotalInput = (swaps, poolData) => {
    try {
        let totalAmountIn = bmath_1.bnum(0);
        swaps.forEach(swap => {
            const swapAmount = swap.tokenOutParam;
            const pool = poolData.find(p => p.id === swap.pool);
            if (!pool) {
                throw new Error(
                    '[Invariant] No pool found for selected balancer index'
                );
            }
            const preview = bmath_1.calcInGivenOut(
                pool.balanceIn,
                pool.weightIn,
                pool.balanceOut,
                pool.weightOut,
                bmath_1.bnum(swapAmount),
                pool.swapFee
            );
            totalAmountIn = totalAmountIn.plus(preview);
        });
        return totalAmountIn;
    } catch (e) {
        throw new Error(e);
    }
};
exports.formatSwapsExactAmountIn = (sorSwaps, maxPrice, minAmountOut) => {
    const swaps = [];
    for (let i = 0; i < sorSwaps.length; i++) {
        let swapAmount = sorSwaps[i].amount;
        let swap = {
            pool: sorSwaps[i].pool,
            tokenInParam: swapAmount.toString(),
            tokenOutParam: minAmountOut.toString(),
            maxPrice: maxPrice.toString(),
        };
        swaps.push(swap);
    }
    return swaps;
};
exports.formatSwapsExactAmountOut = (sorSwaps, maxPrice, maxAmountIn) => {
    const swaps = [];
    for (let i = 0; i < sorSwaps.length; i++) {
        let swapAmount = sorSwaps[i].amount;
        let swap = {
            pool: sorSwaps[i].pool,
            tokenInParam: maxAmountIn.toString(),
            tokenOutParam: swapAmount.toString(),
            maxPrice: maxPrice.toString(),
        };
        swaps.push(swap);
    }
    return swaps;
};
function calculateBestBalancersForEpsOfInterest(epsOfInterest) {
    let bestBalancers = [];
    epsOfInterest.forEach((e, i) => {
        if (e.id != null) {
            bestBalancers.push(e.id);
        } else if (e.swap) {
            let index1 = bestBalancers.indexOf(e.swap[0]);
            let index2 = bestBalancers.indexOf(e.swap[1]);
            if (index1 != -1) {
                if (index2 != -1) {
                    let bestBal1 = bestBalancers[index1];
                    let bestBal2 = bestBalancers[index2];
                    bestBalancers[index1] = bestBal2;
                    bestBalancers[index2] = bestBal1;
                } else {
                    bestBalancers[index1] = e.swap[1];
                }
            }
        } else if (e.maxAmount) {
            // Do nothing
        } else {
            console.log(e);
            console.error(
                'ERROR: balancerID or swap not found in epsOfInterest'
            );
        }
        epsOfInterest[i].bestPools = bestBalancers.slice();
    });
    return epsOfInterest;
}
function getInputAmountsForEp(balancers, bids, ep) {
    let inputAmounts = [];
    bids.forEach((bid, i) => {
        let balancer = balancers.find(obj => {
            return obj.id === bid;
        });
        let inputAmount = bmath_1.bdiv(
            ep.minus(balancer.spotPrice),
            bmath_1.bmul(balancer.slippage, balancer.spotPrice)
        );
        if (balancer.limitAmount.isLessThan(inputAmount)) {
            inputAmount = balancer.limitAmount;
        }
        inputAmounts.push(inputAmount);
    });
    return inputAmounts;
}
function getLinearizedTotalOutput(
    balancers,
    swapType,
    balancerIds,
    inputAmounts
) {
    let balancer;
    let totalOutput = new bignumber_1.BigNumber(0);
    balancerIds.forEach((b, i) => {
        balancer = balancers.find(obj => {
            return obj.id === b;
        });
        totalOutput = totalOutput.plus(
            helpers_1.getLinearizedOutputAmountSwap(
                balancer,
                swapType,
                inputAmounts[i]
            )
        );
    });
    return totalOutput;
}
function getExactInputAmounts(
    inputAmountsEpBefore,
    inputAmountsEpAfter,
    targetTotalInput
) {
    let deltaInputAmounts = [];
    if (
        inputAmountsEpAfter[inputAmountsEpAfter.length - 1].isEqualTo(
            new bignumber_1.BigNumber(0)
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
    let deltaTimesTarget = [];
    deltaInputAmounts.forEach((a, i) => {
        let div = bmath_1.bdiv(
            targetTotalInput.minus(totalInputBefore),
            deltaTotalInput
        );
        let mult = bmath_1.bmul(div, a);
        deltaTimesTarget.push(mult);
    });
    let inputAmounts = [];
    inputAmountsEpBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        inputAmounts.push(add);
    });
    return inputAmounts;
}
function processBalancers(balancers, swapType) {
    balancers.forEach(b => {
        b.spotPrice = helpers_1.getSpotPrice(b);
        b.slippage = helpers_1.getSlippageLinearizedSpotPriceAfterSwap(
            b,
            swapType
        );
        b.limitAmount = helpers_1.getLimitAmountSwap(b, swapType);
    });
    let sortedBalancers = balancers.sort((a, b) => {
        return a.spotPrice.minus(b.spotPrice).toNumber();
    });
    return sortedBalancers;
}
exports.processBalancers = processBalancers;
function processEpsOfInterest(sortedBalancers, swapType) {
    let epsOfInterest = getEpsOfInterest(sortedBalancers, swapType).sort(
        (a, b) => {
            return a.price.minus(b.price).toNumber();
        }
    );
    epsOfInterest = calculateBestBalancersForEpsOfInterest(epsOfInterest);
    epsOfInterest.forEach(e => {
        let bids = e.bestPools;
        let ep = e.price;
        e.amounts = getInputAmountsForEp(sortedBalancers, bids, ep);
    });
    return epsOfInterest;
}
exports.processEpsOfInterest = processEpsOfInterest;
