import {
    getSpotPrice,
    getSlippageLinearizedSpotPriceAfterSwap,
    getLinearizedOutputAmountSwap,
} from './helpers';
import { BigNumber } from './utils/bignumber';
import { Pool, SwapAmount, EffectivePrice, Solution } from 'types';

export const linearizedSolution = (
    balancers: Pool[],
    swapType: string,
    targetInputAmount: BigNumber,
    maxBalancers: number,
    costOutputToken: BigNumber
): Solution => {
    balancers.forEach(b => {
        b.spotPrice = getSpotPrice(b);
        b.slippage = getSlippageLinearizedSpotPriceAfterSwap(b, swapType);
    });
    let sortedBalancers = balancers.sort((a, b) => {
        return a.spotPrice.minus(b.spotPrice).toNumber();
    });

    let epsOfInterest = getEpsOfInterest(sortedBalancers).sort((a, b) => {
        return a.price.minus(b.price).toNumber();
    });

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

            let inputAmountsAfter = epAfter.inputAmounts;
            let totalInputAmountAfter = inputAmountsAfter
                .slice(0, b)
                .reduce((a, b) => a.plus(b));

            if (totalInputAmountAfter.isGreaterThan(targetInputAmount)) {
                balancerIds = epBefore.bestBalancers.slice(0, b);
                inputAmountsEpBefore = epBefore.inputAmounts.slice(0, b);
                inputAmountsEpAfter = epAfter.inputAmounts.slice(0, b);

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
            balancerIds = epBefore.bestBalancers.slice(0, b);
            inputAmounts = getExactInputAmountsHighestEpNotEnough(
                balancers,
                b,
                epBefore,
                targetInputAmount
            );
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
                new BigNumber(balancerIds.length).times(costOutputToken)
            );
            improvementCondition =
                totalOutput.isGreaterThan(bestTotalOutput) ||
                bestTotalOutput === new BigNumber(0);
        } else {
            totalOutput = totalOutput.plus(
                new BigNumber(balancerIds.length).times(costOutputToken)
            );
            improvementCondition =
                totalOutput.isLessThan(bestTotalOutput) ||
                bestTotalOutput === new BigNumber(0);
        }

        if (improvementCondition === true) {
            bestInputAmounts = inputAmounts;
            bestBalancerIds = balancerIds;
            bestTotalOutput = totalOutput;
        } else {
            break;
        }
    }

    let solution: Solution;

    bestInputAmounts.forEach((amount, i) => {
        let swap: SwapAmount = {
            pool: bestBalancerIds[i],
            amount: amount,
        };
        solution.swaps.push(swap);
    });

    solution.totalOutput = bestTotalOutput;

    return solution;
};

function getEpsOfInterest(sortedBalancers: Pool[]): EffectivePrice[] {
    let epsOfInterest: EffectivePrice[];
    sortedBalancers.forEach((b, i) => {
        let epi: EffectivePrice;
        epi.price = b.spotPrice;
        epi.id = b.id;
        epsOfInterest.push(epi);

        for (let k = 0; k < i; k++) {
            let prevBal = sortedBalancers[k];

            if (b.slippage.isLessThan(prevBal.slippage)) {
                let epi: EffectivePrice;
                epi.price = prevBal.spotPrice.plus(
                    b.spotPrice
                        .minus(prevBal.spotPrice)
                        .times(
                            prevBal.slippage.div(
                                prevBal.slippage.minus(b.slippage)
                            )
                        )
                        .decimalPlaces(18)
                );
                epi.swap = [prevBal.id, b.id];
                epsOfInterest.push(epi);
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
    let inputAmounts: BigNumber[];
    bids.forEach((bid, i) => {
        let balancer = balancers.find(obj => {
            return obj.id === bid;
        });
        inputAmounts.push(ep.minus(balancer.spotPrice).div(balancer.slippage));
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
    let deltaInputAmounts: BigNumber[];

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

    let deltaTimesTarget: BigNumber[];
    deltaInputAmounts.forEach((a, i) => {
        let mult = a.times(targetTotalInput.minus(totalInputBefore));
        mult = mult.div(deltaTotalInput);
        deltaTimesTarget.push(mult);
    });

    let inputAmounts: BigNumber[];
    inputAmountsEpBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        inputAmounts.push(add);
    });
    return inputAmounts;
}

function getExactInputAmountsHighestEpNotEnough(
    balancers: Pool[],
    b: number,
    epBefore: EffectivePrice,
    targetInputAmount: BigNumber
): BigNumber[] {
    let balancerIds = epBefore.bestPools.slice(0, b);
    let inputAmountsEpBefore = epBefore.amounts.slice(0, b);
    let totalInputBefore = inputAmountsEpBefore.reduce((a, b) => a.plus(b));
    let deltaTotalInput = targetInputAmount.minus(totalInputBefore);
    let inverseSls = [];
    balancerIds.forEach((b, i) => {
        let balancer = balancers.find(obj => {
            return obj.id === b;
        });
        inverseSls.push(new BigNumber(1).div(balancer.slippage));
    });

    let sumInverseSls = inverseSls.reduce((a, b) => a.plus(b));
    let deltaEP = deltaTotalInput.div(sumInverseSls);

    let deltaTimesTarget = [];
    inverseSls.forEach((a, i) => {
        let mult = a.times(deltaEP).decimalPlaces(18);
        deltaTimesTarget.push(mult);
    });

    let inputAmounts = [];
    inputAmountsEpBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        inputAmounts.push(add);
    });
    return inputAmounts;
}
