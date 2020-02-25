import {
    getSpotPrice,
    getSlippageLinearizedSpotPriceAfterSwap,
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
            balancerIds = epBefore.bestPools.slice(0, b);
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

function getEpsOfInterest(sortedBalancers: Pool[]): EffectivePrice[] {
    let epsOfInterest: EffectivePrice[] = [];
    sortedBalancers.forEach((b, i) => {
        let epi: EffectivePrice = {};
        epi.price = b.spotPrice;
        epi.id = b.id;
        epsOfInterest.push(epi);

        for (let k = 0; k < i; k++) {
            let prevBal = sortedBalancers[k];

            if (b.slippage.isLessThan(prevBal.slippage)) {
                let epi: EffectivePrice = {};
                epi.price = prevBal.spotPrice.plus(
                    bmul(
                        b.spotPrice.minus(prevBal.spotPrice),
                        bdiv(
                            prevBal.slippage,
                            prevBal.slippage.minus(b.slippage)
                        )
                    )
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
    let inputAmounts: BigNumber[] = [];
    bids.forEach((bid, i) => {
        let balancer = balancers.find(obj => {
            return obj.id === bid;
        });
        inputAmounts.push(
            bdiv(
                ep.minus(balancer.spotPrice),
                bmul(balancer.slippage, balancer.spotPrice)
            )
        );
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
    let inverseSl_SPs = [];
    balancerIds.forEach((b, i) => {
        let balancer = balancers.find(obj => {
            return obj.id === b;
        });
        inverseSl_SPs.push(
            bdiv(BONE, bmul(balancer.slippage, balancer.spotPrice))
        );
    });

    let sumInverseSls = inverseSl_SPs.reduce((a, b) => a.plus(b));
    let deltaEP = bdiv(deltaTotalInput, sumInverseSls);

    let deltaTimesTarget = [];
    inverseSl_SPs.forEach((a, i) => {
        let mult = bmul(a, deltaEP);
        deltaTimesTarget.push(mult);
    });

    let inputAmounts = [];
    inputAmountsEpBefore.forEach((a, i) => {
        let add = a.plus(deltaTimesTarget[i]);
        inputAmounts.push(add);
    });
    return inputAmounts;
}
