import {
    getSpotPrice,
    getSlippageLinearizedSpotPriceAfterSwap,
    getLimitAmountSwap,
    getLinearizedOutputAmountSwap,
    bmul,
    bdiv,
    BONE,
} from './helpers';
import { BigNumber } from './utils/bignumber';
import { Pool, SwapAmount, EffectivePrice } from './types';

export const smartOrderRouter = (
    balancers: Pool[],
    swapType: string,
    targetInputAmount: BigNumber,
    maxBalancers: number,
    costOutputToken: BigNumber
): SwapAmount[] => {
    balancers.forEach(b => {
        b.spotPrice = getSpotPrice(b);
        b.slippage = getSlippageLinearizedSpotPriceAfterSwap(b, swapType);
        b.limitAmount = getLimitAmountSwap(b, swapType);
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

    let bestTotalOutput: BigNumber = new BigNumber(0);
    let highestEpNotEnough: boolean = true;
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

        let improvementCondition: boolean = false;
        if (swapType === 'swapExactIn') {
            totalOutput = totalOutput.minus(
                bmul(
                    new BigNumber(balancerIds.length).times(BONE),
                    costOutputToken
                )
            );
            improvementCondition =
                totalOutput.isGreaterThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new BigNumber(0));
        } else {
            totalOutput = totalOutput.plus(
                bmul(
                    new BigNumber(balancerIds.length).times(BONE),
                    costOutputToken
                )
            );
            improvementCondition =
                totalOutput.isLessThan(bestTotalOutput) ||
                bestTotalOutput.isEqualTo(new BigNumber(0));
        }

        if (improvementCondition === true) {
            bestInputAmounts = inputAmounts;
            bestBalancerIds = balancerIds;
            bestTotalOutput = totalOutput;
        } else {
            break;
        }
    }

    let swaps: SwapAmount[] = [];

    bestInputAmounts.forEach((amount, i) => {
        let swap: SwapAmount = {
            pool: bestBalancerIds[i],
            amount: amount,
        };
        swaps.push(swap);
    });

    return swaps;
};

function getEpsOfInterest(
    sortedBalancers: Pool[],
    swapType: string
): EffectivePrice[] {
    let epsOfInterest: EffectivePrice[] = [];
    sortedBalancers.forEach((b, i) => {
        // New balancer pool
        let epi: EffectivePrice = {};
        epi.price = b.spotPrice;
        epi.id = b.id;
        epsOfInterest.push(epi);

        // Max amount for this balancer pool
        epi = {};
        epi.price = b.spotPrice.plus(
            bmul(b.limitAmount, bmul(b.slippage, b.spotPrice))
        );
        epi.maxAmount = b.id;
        epsOfInterest.push(epi);

        for (let k = 0; k < i; k++) {
            let prevBal = sortedBalancers[k];

            if (
                bmul(b.slippage, b.spotPrice).isLessThan(
                    bmul(prevBal.slippage, prevBal.spotPrice)
                )
            ) {
                let amountCross = bdiv(
                    b.spotPrice.minus(prevBal.spotPrice),
                    bmul(prevBal.slippage, prevBal.spotPrice).minus(
                        bmul(b.slippage, b.spotPrice)
                    )
                );

                if (
                    amountCross.isLessThan(b.limitAmount) &&
                    amountCross.isLessThan(prevBal.limitAmount)
                ) {
                    let epi1: EffectivePrice = {};
                    epi1.price = prevBal.spotPrice.plus(
                        bmul(
                            amountCross,
                            bmul(prevBal.slippage, prevBal.spotPrice)
                        )
                    );
                    epi1.swap = [prevBal.id, b.id];
                    epsOfInterest.push(epi1);
                }

                if (
                    prevBal.limitAmount.isLessThan(b.limitAmount) &&
                    prevBal.limitAmount.isLessThan(amountCross)
                ) {
                    let epi2: EffectivePrice = {};
                    epi2.price = b.spotPrice.plus(
                        bmul(prevBal.limitAmount, bmul(b.slippage, b.spotPrice))
                    );
                    epi2.swap = [prevBal.id, b.id];
                    epsOfInterest.push(epi2);
                }

                if (
                    b.limitAmount.isLessThan(prevBal.limitAmount) &&
                    amountCross.isLessThan(b.limitAmount)
                ) {
                    let epi3: EffectivePrice = {};
                    epi3.price = prevBal.spotPrice.plus(
                        bmul(
                            b.limitAmount,
                            bmul(prevBal.slippage, prevBal.spotPrice)
                        )
                    );
                    epi3.swap = [b.id, prevBal.id];
                    epsOfInterest.push(epi3);
                }
            } else {
                if (prevBal.limitAmount.isLessThan(b.limitAmount)) {
                    let epi4: EffectivePrice = {};
                    epi4.price = b.spotPrice.plus(
                        bmul(prevBal.limitAmount, bmul(b.slippage, b.spotPrice))
                    );
                    epi4.swap = [prevBal.id, b.id];
                    epsOfInterest.push(epi4);
                }
            }
        }
    });

    return epsOfInterest;
}

function calculateBestBalancersForEpsOfInterest(
    epsOfInterest: EffectivePrice[]
): EffectivePrice[] {
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
                    bestBalancers[index1] = e.swap[2];
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

function getInputAmountsForEp(
    balancers: Pool[],
    bids: string[],
    ep: BigNumber
): BigNumber[] {
    let inputAmounts: BigNumber[] = [];
    bids.forEach((bid, i) => {
        let balancer = balancers.find(obj => {
            return obj.id === bid;
        });
        let inputAmount = bdiv(
            ep.minus(balancer.spotPrice),
            bmul(balancer.slippage, balancer.spotPrice)
        );
        if (balancer.limitAmount.isLessThan(inputAmount)) {
            inputAmount = balancer.limitAmount;
        }
        inputAmounts.push(inputAmount);
    });
    return inputAmounts;
}

function getLinearizedTotalOutput(
    balancers: Pool[],
    swapType: string,
    balancerIds: string[],
    inputAmounts: BigNumber[]
): BigNumber {
    let balancer;
    let totalOutput = new BigNumber(0);
    balancerIds.forEach((b, i) => {
        balancer = balancers.find(obj => {
            return obj.id === b;
        });
        totalOutput = totalOutput.plus(
            getLinearizedOutputAmountSwap(balancer, swapType, inputAmounts[i])
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
