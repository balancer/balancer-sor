import { BigNumber } from './utils/bignumber';
import { getAddress } from '@ethersproject/address';
import {
    PoolPairData,
    Path,
    Pool,
    PoolDictionary,
    Swap,
    DisabledOptions,
} from './types';
import {
    BONE,
    MAX_IN_RATIO,
    MAX_OUT_RATIO,
    bmul,
    bdiv,
    bnum,
    calcOutGivenIn,
    calcInGivenOut,
    scale,
} from './bmath';
import * as stableMath_sol from './stableMath_sol';
import disabledTokensDefault from './disabled-tokens.json';

export function getLimitAmountSwap(
    poolPairData: PoolPairData,
    swapType: string
): BigNumber {
    // We multiply ratios by 10**-18 because we are in normalized space
    // so 0.5 should be 0.5 and not 500000000000000000
    // TODO: update bmath to use everything normalized
    if (swapType === 'swapExactIn') {
        return poolPairData.balanceIn.times(MAX_IN_RATIO.times(10 ** -18));
    } else {
        return poolPairData.balanceOut.times(MAX_OUT_RATIO.times(10 ** -18));
    }
}

export function getLimitAmountSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getLimitAmountSwap(poolPairData[0], swapType);
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            let limitAmountSwap1 = getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            let limitAmountSwap2 = getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            let limitOutputAmountSwap1 = getOutputAmountSwap(
                poolPairData[0],
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
                        poolPairData[0],
                        'swapExactOut',
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
                poolPairData[1],
                swapType,
                limitAmountSwap2
            );
            if (limitOutputAmountSwap2.gt(limitAmountSwap1))
                // This means first hop is limiting the path
                return getOutputAmountSwap(
                    poolPairData[1],
                    'swapExactIn',
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
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let poolType = poolPairData.poolType;
    let Bi = poolPairData.balanceIn;
    let Bo = poolPairData.balanceOut;
    let f = poolPairData.swapFee.div(bnum(1000000000000000000));
    let wi, wo, amp, allBalances, tokenIndexIn, tokenIndexOut;
    if (poolType == 'Weighted') {
        wi = poolPairData.weightIn;
        wo = poolPairData.weightOut;
    } else {
        amp = poolPairData.amp;
        allBalances = poolPairData.allBalances;
        tokenIndexIn = poolPairData.tokenIndexIn;
        tokenIndexOut = poolPairData.tokenIndexOut;
    }

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (Bi.toNumber() == 0) {
            return bnum(0);
        } else {
            let Ai = amount;
            if (poolType == 'Weighted') {
                // Bo * (1 - (Bi / (Bi + Ai * (1 - f))) ** (wi / wo));
                return Bo.times(
                    bnum(1).minus(
                        bnum(
                            Bi.div(
                                Bi.plus(Ai.times(bnum(1).minus(f)))
                            ).toNumber() ** wi.div(wo).toNumber()
                        )
                    )
                );
            } else if (poolType == 'Stable') {
                return stableMath_sol._outGivenIn(
                    amp,
                    allBalances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amount
                );
            }
        }
    } else {
        if (Bo.isZero()) {
            return bnum(0);
        } else {
            let Ao = amount;
            if (Ao.gte(Bo)) return bnum('Infinity');
            if (poolType == 'Weighted') {
                // return (Bi*(-1 + (Bo/(-Ao + Bo))**(wo/wi)))/(1 - f)
                return Bi.times(
                    bnum(-1).plus(
                        Bo.div(Bo.minus(Ao)).toNumber() ** wo.div(wi).toNumber()
                    )
                ).div(bnum(1).minus(f));
            } else if (poolType == 'Stable') {
                // return -Bi+(DD*(A-n**(-n))+((4*A*Bi*Bo*DD**(1+n))/((-Ao+Bo)*n**(2*n)*P)+(DD/n**n-A*(Ao+Bi+DD-S))**2)**0.5+A*(Ao+Bi-S))/(2.*A)
                return stableMath_sol._inGivenOut(
                    amp,
                    allBalances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amount
                );
            }
        }
    }
}

export function getOutputAmountSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    // First of all check if the amount is above limit, if so, return 0 for
    // 'swapExactIn' or Inf for swapExactOut
    if (amount.gt(path.limitAmount)) {
        if (swapType === 'swapExactIn') {
            return bnum(0);
        } else {
            return bnum(Infinity);
        }
    }
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getOutputAmountSwap(poolPairData[0], swapType, amount);
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            // The outputAmount is number of tokenOut we receive from the second poolPairData
            let outputAmountSwap1 = getOutputAmountSwap(
                poolPairData[0],
                swapType,
                amount
            );
            return getOutputAmountSwap(
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
        } else {
            // The outputAmount is number of tokenIn we send to the first poolPairData
            let outputAmountSwap2 = getOutputAmountSwap(
                poolPairData[1],
                swapType,
                amount
            );
            return getOutputAmountSwap(
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

export function getEffectivePriceSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    if (amount.isZero()) {
        // Return spot price as code below would be 0/0 = undefined
        return getSpotPriceAfterSwapForPath(pools, path, swapType, amount);
    }
    let outputAmountSwap = getOutputAmountSwapForPath(
        pools,
        path,
        swapType,
        amount
    );
    if (swapType === 'swapExactIn') {
        return amount.div(outputAmountSwap); // amountIn/AmountOut
    } else {
        return outputAmountSwap.div(amount); // amountIn/AmountOut
    }
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getSpotPriceAfterSwap(
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let poolType = poolPairData.poolType;
    let Bi = poolPairData.balanceIn;
    let Bo = poolPairData.balanceOut;
    let f = poolPairData.swapFee.div(bnum(1000000000000000000));
    let wi, wo, amp, allBalances, tokenIndexIn, tokenIndexOut;
    if (poolType == 'Weighted') {
        wi = poolPairData.weightIn;
        wo = poolPairData.weightOut;
    } else {
        amp = poolPairData.amp;
        allBalances = poolPairData.allBalances;
        tokenIndexIn = poolPairData.tokenIndexIn;
        tokenIndexOut = poolPairData.tokenIndexOut;
    }

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (Bi.isZero()) {
            return bnum(0);
        } else {
            if (poolType == 'Weighted') {
                // return -((Bi*wo)/(Bo*(-1+f)*(Bi/(Ai+Bi-Ai*f))**((wi+wo)/wo)*wi))
                // TODO: decide if we need to convert the formula below to BigNumber
                let Bi = poolPairData.balanceIn.toNumber();
                let Bo = poolPairData.balanceOut.toNumber();
                let wi = poolPairData.weightIn.toNumber();
                let wo = poolPairData.weightOut.toNumber();
                let Ai = amount.toNumber();
                let f = poolPairData.swapFee
                    .div(bnum(1000000000000000000))
                    .toNumber();
                return bnum(
                    -(
                        (Bi * wo) /
                        (Bo *
                            (-1 + f) *
                            (Bi / (Ai + Bi - Ai * f)) ** ((wi + wo) / wo) *
                            wi)
                    )
                );
            } else if (poolType == 'Stable') {
                return stableMath_sol._spotPriceAfterSwapOutGivenIn(
                    amp,
                    allBalances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amount
                );
            }
        }
    } else {
        if (Bo.isZero()) {
            return bnum(0);
        } else {
            let Ao = amount;
            if (Ao.gte(Bo)) return bnum('Infinity');
            if (poolType == 'Weighted') {
                // TODO: decide if we need to convert the formula below to BigNumber
                let Bi = poolPairData.balanceIn.toNumber();
                let Bo = poolPairData.balanceOut.toNumber();
                let wi = poolPairData.weightIn.toNumber();
                let wo = poolPairData.weightOut.toNumber();
                let Ao = amount.toNumber();
                let f = poolPairData.swapFee
                    .div(bnum(1000000000000000000))
                    .toNumber();
                // return -((Bi*(Bo/(-Ao+Bo))**((wi+wo)/wi)*wo)/(Bo*(-1+f)*wi))
                return bnum(
                    -(
                        (Bi * (Bo / (-Ao + Bo)) ** ((wi + wo) / wi) * wo) /
                        (Bo * (-1 + f) * wi)
                    )
                );
            } else if (poolType == 'Stable') {
                return stableMath_sol._spotPriceAfterSwapInGivenOut(
                    amp,
                    allBalances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amount
                );
            }
        }
    }
}

export function getSpotPriceAfterSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getSpotPriceAfterSwap(poolPairData[0], swapType, amount);
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            let outputAmountSwap1 = getOutputAmountSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let spotPriceAfterSwap1 = getSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let spotPriceAfterSwap2 = getSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
            return spotPriceAfterSwap1.times(spotPriceAfterSwap2);
        } else {
            let outputAmountSwap2 = getOutputAmountSwap(
                poolPairData[1],
                swapType,
                amount
            );
            let spotPriceAfterSwap1 = getSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let spotPriceAfterSwap2 = getSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                amount
            );
            return spotPriceAfterSwap1.times(spotPriceAfterSwap2);
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getDerivativeSpotPriceAfterSwap(
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let poolType = poolPairData.poolType;
    let Bi = poolPairData.balanceIn;
    let Bo = poolPairData.balanceOut;
    let f = poolPairData.swapFee.div(bnum(1000000000000000000));
    let wi, wo, amp, allBalances, tokenIndexIn, tokenIndexOut;
    if (poolType == 'Weighted') {
        wi = poolPairData.weightIn;
        wo = poolPairData.weightOut;
    } else {
        amp = poolPairData.amp;
        allBalances = poolPairData.allBalances;
        tokenIndexIn = poolPairData.tokenIndexIn;
        tokenIndexOut = poolPairData.tokenIndexOut;
    }

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (Bi.isZero()) {
            return bnum(0);
        } else {
            let Ai = amount;
            if (poolType == 'Weighted') {
                // TODO: decide if we need to convert the formula below to BigNumber
                let Bi = poolPairData.balanceIn.toNumber();
                let Bo = poolPairData.balanceOut.toNumber();
                let wi = poolPairData.weightIn.toNumber();
                let wo = poolPairData.weightOut.toNumber();
                let Ai = amount.toNumber();
                let f = poolPairData.swapFee
                    .div(bnum(1000000000000000000))
                    .toNumber();
                // return (wi+wo)/(Bo*(Bi/(Ai+Bi-Ai*f))**(wi/wo)*wi)
                return bnum(
                    (wi + wo) /
                        (Bo * (Bi / (Ai + Bi - Ai * f)) ** (wi / wo) * wi)
                );
            } else if (poolType == 'Stable') {
                return stableMath_sol._derivativeSpotPriceAfterSwapOutGivenIn(
                    amp,
                    allBalances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amount
                );
            }
        }
    } else {
        if (Bo.isZero()) {
            return bnum(0);
        } else {
            let Ao = amount;
            if (Ao.gte(Bo)) return bnum('Infinity');
            if (poolType == 'Weighted') {
                // TODO: decide if we need to convert the formula below to BigNumber
                let Bi = poolPairData.balanceIn.toNumber();
                let Bo = poolPairData.balanceOut.toNumber();
                let wi = poolPairData.weightIn.toNumber();
                let wo = poolPairData.weightOut.toNumber();
                let Ao = amount.toNumber();
                let f = poolPairData.swapFee
                    .div(bnum(1000000000000000000))
                    .toNumber();
                // return -((Bi*(Bo/(-Ao + Bo))**(wo/wi)*wo*(wi + wo))/((Ao - Bo)**2*(-1 + f)*wi**2))
                return bnum(
                    -(
                        (Bi * (Bo / (-Ao + Bo)) ** (wo / wi) * wo * (wi + wo)) /
                        ((Ao - Bo) ** 2 * (-1 + f) * wi ** 2)
                    )
                );
            } else if (poolType == 'Stable') {
                return stableMath_sol._derivativeSpotPriceAfterSwapInGivenOut(
                    amp,
                    allBalances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amount
                );
            }
        }
    }
}

export function getDerivativeSpotPriceAfterSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getDerivativeSpotPriceAfterSwap(
            poolPairData[0],
            swapType,
            amount
        );
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            let outputAmountSwap1 = getOutputAmountSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let SPaS1 = getSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let SPaS2 = getSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
            let dSPaS1 = getDerivativeSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let dSPaS2 = getDerivativeSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
            // Using the rule of the derivative of the multiplication: d[f(x)*g(x)] = d[f(x)]*g(x) + f(x)*d[g(x)]
            // where SPaS1 is SpotPriceAfterSwap of pool 1 and OA1 is OutputAmount of pool 1. We then have:
            // d[SPaS1(x) * SPaS2(OA1(x))] = d[SPaS1(x)] * SPaS2(OA1(x)) + SPaS1(x) * d[SPaS2(OA1(x))]
            // Let's expand the term d[SPaS2(OA1(x))] which is trickier:
            // d[SPaS2(OA1(x))] at x0 = d[SPaS2(x)] at OA1(x0) * d[OA1(x)] at x0,
            // Since d[OA1(x)] = 1/SPaS1(x) we then have:
            // d[SPaS2(OA1(x))] = d[SPaS2(x)] * 1/SPaS1(x). Which leads us to:
            // d[SPaS1(x) * SPaS2(OA1(x))] = d[SPaS1(x)] * SPaS2(OA1(x)) + d[SPaS2(OA1(x))]
            // return dSPaS1 * SPaS2 + dSPaS2
            return dSPaS1.times(SPaS2).plus(dSPaS2);
        } else {
            let outputAmountSwap2 = getOutputAmountSwap(
                poolPairData[1],
                swapType,
                amount
            );
            let SPaS1 = getSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let SPaS2 = getSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                amount
            );
            let dSPaS1 = getDerivativeSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let dSPaS2 = getDerivativeSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                amount
            );
            // For swapExactOut we the outputToken is the amount of tokenIn necessary to buy a given amount of tokenOut
            // Using the rule of the derivative of the multiplication: d[f(x)*g(x)] = d[f(x)]*g(x) + f(x)*d[g(x)]
            // where SPaS1 is SpotPriceAfterSwap of pool 1 and OA2 is OutputAmount of pool 2. We then have:
            // d[SPaS1(OA2(x)) * SPaS2(x)] = d[SPaS1(OA2(x))] * SPaS2(x) + SPaS1(OA2(x)) * d[SPaS2(x)]
            // Let's expand the term d[SPaS1(OA2(x))] which is trickier:
            // d[SPaS1(OA2(x))] at x0 = d[SPaS1(x)] at OA2(x0) * d[OA2(x)] at x0,
            // Since d[OA2(x)] = SPaS2(x) we then have:
            // d[SPaS1(OA2(x))] = d[SPaS1(x)] * SPaS2(x). Which leads us to:
            // d[SPaS1(OA2(x)) * SPaS2(x)] = d[SPaS1(x)] * SPaS2(x) * SPaS2(x) + SPaS1(OA2(x)) * d[SPaS2(x)]
            // return dSPaS2 * SPaS1 + dSPaS1 * SPaS2 * SPaS2
            return dSPaS2.times(SPaS1).plus(SPaS2.times(SPaS2).times(dSPaS1));
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

export function getHighestLimitAmountsForPaths(
    paths: Path[],
    maxPools: number
): BigNumber[] {
    if (paths.length === 0) return [];
    let limitAmounts = [];
    for (let i = 0; i < maxPools; i++) {
        if (i < paths.length) {
            let limitAmount = paths[i].limitAmount;
            limitAmounts.push(limitAmount);
        }
    }
    return limitAmounts;
}

export const parsePoolPairData = (
    p: Pool,
    tokenIn: string,
    tokenOut: string
): PoolPairData => {
    let tokenIndexIn = p.tokens.findIndex(
        t => getAddress(t.address) === getAddress(tokenIn)
    );
    let tI = p.tokens[tokenIndexIn];
    // console.log("tI")
    // console.log(tI.balance.toString());
    // console.log(tI)
    let tokenIndexOut = p.tokens.findIndex(
        t => getAddress(t.address) === getAddress(tokenOut)
    );
    let tO = p.tokens[tokenIndexOut];

    // console.log("tO")
    // console.log(tO.balance.toString());
    // console.log(tO)

    let poolPairData, poolType;
    // Todo: the pool type should be already on subgraph
    if (typeof p.amp === 'undefined') poolType = 'Weighted';
    else poolType = 'Stable';

    if (poolType == 'Weighted') {
        poolPairData = {
            id: p.id,
            poolType: poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: tI.decimals,
            decimalsOut: tO.decimals,
            balanceIn: bnum(tI.balance),
            balanceOut: bnum(tO.balance),
            weightIn: scale(bnum(tI.denormWeight).div(bnum(p.totalWeight)), 18),
            weightOut: scale(
                bnum(tO.denormWeight).div(bnum(p.totalWeight)),
                18
            ),
            swapFee: bnum(p.swapFee),
        };
    } else if (poolType == 'Stable') {
        // Get all token balances
        let allBalances = [];
        for (let i = 0; i < p.tokens.length; i++) {
            allBalances.push(bnum(p.tokens[i].balance));
        }

        let inv = stableMath_sol._invariant(bnum(p.amp), allBalances);
        // Just to debug we confirm that the invariant value function is extremely close to zero as it should:
        // let invVF = stableMath_sol._invariantValueFunction(
        //     bnum(p.amp),
        //     allBalances,
        //     inv
        // );

        poolPairData = {
            id: p.id,
            poolType: poolType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: tI.decimals,
            decimalsOut: tO.decimals,
            balanceIn: bnum(tI.balance),
            balanceOut: bnum(tO.balance),
            invariant: stableMath_sol._invariant(bnum(p.amp), allBalances),
            swapFee: bnum(p.swapFee),
            allBalances: allBalances,
            amp: bnum(p.amp),
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
        };
    } else {
        throw 'Pool type unknown';
    }

    return poolPairData;
};

// Transfors path information into poolPairData list
export function parsePoolPairDataForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string
): PoolPairData[] {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return [poolPairDataSwap1];
    } else if (swaps.length == 2) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        let swap2 = swaps[1];
        let poolSwap2 = pools[swap2.pool];
        let poolPairDataSwap2 = parsePoolPairData(
            poolSwap2,
            swap2.tokenIn,
            swap2.tokenOut
        );
        return [poolPairDataSwap1, poolPairDataSwap2];
    }
}

// TODO calculate exact EVM result using solidity maths (for V1 it's bmath)
export function EVMgetOutputAmountSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    // First of all check if the amount is above limit, if so, return 0 for
    // 'swapExactIn' or Inf for swapExactOut
    if (amount.gt(path.limitAmount)) {
        if (swapType === 'swapExactIn') {
            return bnum(0);
        } else {
            return bnum(Infinity);
        }
    }

    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return EVMgetOutputAmountSwap(pools, poolPairData[0], swapType, amount);
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            // The outputAmount is number of tokenOut we receive from the second poolPairData
            let outputAmountSwap1 = EVMgetOutputAmountSwap(
                pools,
                poolPairData[0],
                swapType,
                amount
            );
            return EVMgetOutputAmountSwap(
                pools,
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
        } else {
            // The outputAmount is number of tokenIn we send to the first poolPairData
            let outputAmountSwap2 = EVMgetOutputAmountSwap(
                pools,
                poolPairData[1],
                swapType,
                amount
            );
            return EVMgetOutputAmountSwap(
                pools,
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

// We need do pass 'pools' here because this function has to update the pools state
// in case a pool is used twice in two different paths
export function EVMgetOutputAmountSwap(
    pools: PoolDictionary,
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let {
        weightIn,
        weightOut,
        balanceIn,
        balanceOut,
        swapFee,
        tokenIn,
        tokenOut,
    } = poolPairData;
    let returnAmount: BigNumber;

    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            // TODO: Add EVM calculation implemented in V2 so numbers match perfectly
            returnAmount = getOutputAmountSwap(poolPairData, swapType, amount);
            // Update balances of tokenIn and tokenOut
            pools[poolPairData.id] = updateTokenBalanceForPool(
                pools[poolPairData.id],
                tokenIn,
                balanceIn.plus(amount)
            );
            pools[poolPairData.id] = updateTokenBalanceForPool(
                pools[poolPairData.id],
                tokenOut,
                balanceOut.minus(returnAmount)
            );
            return returnAmount;
        }
    } else {
        if (balanceOut.isEqualTo(bnum(0))) {
            return bnum(0);
        } else if (amount.times(3).gte(balanceOut)) {
            // The maximum amoutOut you can have is 1/3 of the balanceOut to ensure binomial approximation diverges
            return bnum(0);
        } else {
            // TODO: Add EVM calculation implemented in V2 so numbers match perfectly
            returnAmount = getOutputAmountSwap(poolPairData, swapType, amount);
            // Update balances of tokenIn and tokenOut
            pools[poolPairData.id] = updateTokenBalanceForPool(
                pools[poolPairData.id],
                tokenIn,
                balanceIn.plus(returnAmount)
            );
            pools[poolPairData.id] = updateTokenBalanceForPool(
                pools[poolPairData.id],
                tokenOut,
                balanceOut.minus(amount)
            );
            return returnAmount;
        }
    }
}

// Updates the balance of a given token for a given pool passed as parameter
export function updateTokenBalanceForPool(
    pool: any,
    token: string,
    balance: BigNumber
): any {
    // console.log("pool")
    // console.log(pool)
    // console.log("token")
    // console.log(token)
    // console.log("balance")
    // console.log(balance)

    // Scale down back as balances are stored scaled down by the decimals
    let T = pool.tokens.find(t => t.address === token);
    T.balance = balance;
    return pool;
}

// Based on the function of same name of file onchain-sor in file: BRegistry.sol
// Normalized liquidity is not used in any calculationf, but instead for comparison between poolPairDataList only
// so we can find the most liquid poolPairData considering the effect of uneven weigths
export function getNormalizedLiquidity(poolPairData: PoolPairData): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    return balanceOut.times(weightIn).div(weightIn.plus(weightOut));
}

// LEGACY FUNCTION - Keep Input/Output Format
export const parsePoolData = (
    directPools: PoolDictionary,
    tokenIn: string,
    tokenOut: string,
    mostLiquidPoolsFirstHop: Pool[] = [],
    mostLiquidPoolsSecondHop: Pool[] = [],
    hopTokens: string[] = []
): [PoolDictionary, Path[]] => {
    let pathDataList: Path[] = [];
    let pools: PoolDictionary = {};

    // First add direct pair paths
    for (let idKey in directPools) {
        let p: Pool = directPools[idKey];
        // Add pool to the set with all pools (only adds if it's still not present in dict)
        pools[idKey] = p;

        let swap: Swap = {
            pool: p.id,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
        };

        let path: Path = {
            id: p.id,
            swaps: [swap],
        };
        pathDataList.push(path);
    }

    // Now add multi-hop paths.
    // mostLiquidPoolsFirstHop and mostLiquidPoolsSecondHop always has the same
    // lengh of hopTokens
    for (let i = 0; i < hopTokens.length; i++) {
        // Add pools to the set with all pools (only adds if it's still not present in dict)
        pools[mostLiquidPoolsFirstHop[i].id] = mostLiquidPoolsFirstHop[i];
        pools[mostLiquidPoolsSecondHop[i].id] = mostLiquidPoolsSecondHop[i];

        let swap1: Swap = {
            pool: mostLiquidPoolsFirstHop[i].id,
            tokenIn: tokenIn,
            tokenOut: hopTokens[i],
        };

        let swap2: Swap = {
            pool: mostLiquidPoolsSecondHop[i].id,
            tokenIn: hopTokens[i],
            tokenOut: tokenOut,
        };

        let path: Path = {
            id: mostLiquidPoolsFirstHop[i].id + mostLiquidPoolsSecondHop[i].id, // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
            swaps: [swap1, swap2],
        };
        pathDataList.push(path);
    }
    return [pools, pathDataList];
};

// function filterPoolsWithoutToken(pools, token) {
//     let found;
//     let OutputPools = {};
//     for (let i in pools) {
//         found = false;
//         for (let k = 0; k < pools[i].tokensList.length; k++) {
//             if (pools[i].tokensList[k].toLowerCase() == token.toLowerCase()) {
//                 found = true;
//                 break;
//             }
//         }
//         //Add pool if token not found
//         if (!found) OutputPools[i] = pools[i];
//     }
//     return OutputPools;
// }

export const formatSubgraphPools = pools => {
    for (let pool of pools.pools) {
        pool.swapFee = scale(bnum(pool.swapFee), 18);
        pool.totalWeight = scale(bnum(pool.totalWeight), 18);
        pool.tokens.forEach(token => {
            token.balance = scale(bnum(token.balance), token.decimals);
            token.denormWeight = scale(bnum(token.denormWeight), 18);
        });
    }
};

export function filterPools(
    allPools: Pool[], // The complete information of the pools
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
): [PoolDictionary, string[], PoolDictionary, PoolDictionary] {
    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let poolsDirect: PoolDictionary = {};
    let poolsTokenOne: PoolDictionary = {};
    let poolsTokenTwo: PoolDictionary = {};
    let tokenInPairedTokens: Set<string> = new Set();
    let tokenOutPairedTokens: Set<string> = new Set();

    let disabledTokens = disabledTokensDefault.tokens;
    if (disabledOptions.isOverRide)
        disabledTokens = disabledOptions.disabledTokens;

    allPools.forEach(pool => {
        let tokenListSet = new Set(pool.tokensList);
        disabledTokens.forEach(token => tokenListSet.delete(token.address));

        if (
            (tokenListSet.has(tokenIn) && tokenListSet.has(tokenOut)) ||
            (tokenListSet.has(tokenIn.toLowerCase()) &&
                tokenListSet.has(tokenOut.toLowerCase()))
        ) {
            poolsDirect[pool.id] = pool;
            return;
        }

        if (maxPools > 1) {
            let containsTokenIn = tokenListSet.has(tokenIn);
            let containsTokenOut = tokenListSet.has(tokenOut);

            if (containsTokenIn && !containsTokenOut) {
                tokenInPairedTokens = new Set([
                    ...tokenInPairedTokens,
                    ...tokenListSet,
                ]);
                poolsTokenOne[pool.id] = pool;
            } else if (!containsTokenIn && containsTokenOut) {
                tokenOutPairedTokens = new Set([
                    ...tokenOutPairedTokens,
                    ...tokenListSet,
                ]);
                poolsTokenTwo[pool.id] = pool;
            }
        }
    });

    // We find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    const hopTokensSet = [...tokenInPairedTokens].filter(x =>
        tokenOutPairedTokens.has(x)
    );

    // Transform set into Array
    const hopTokens: string[] = [...hopTokensSet];

    return [poolsDirect, hopTokens, poolsTokenOne, poolsTokenTwo];
}

export function sortPoolsMostLiquid(
    tokenIn: string,
    tokenOut: string,
    hopTokens: string[],
    poolsTokenInNoTokenOut: PoolDictionary,
    poolsTokenOutNoTokenIn: PoolDictionary
): [Pool[], Pool[]] {
    // Find the most liquid pool for each pair (tokenIn -> hopToken). We store an object in the form:
    // mostLiquidPoolsFirstHop = {hopToken1: mostLiquidPool, hopToken2: mostLiquidPool, ... , hopTokenN: mostLiquidPool}
    // Here we could query subgraph for all pools with pair (tokenIn -> hopToken), but to
    // minimize subgraph calls we loop through poolsTokenInNoTokenOut, and check the liquidity
    // only for those that have hopToken
    let mostLiquidPoolsFirstHop: Pool[] = [];
    let mostLiquidPoolsSecondHop: Pool[] = [];
    let poolPair = {}; // Store pair liquidity incase it is reused

    for (let i = 0; i < hopTokens.length; i++) {
        let highestNormalizedLiquidityFirst = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityFirstPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)

        for (let k in poolsTokenInNoTokenOut) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenInNoTokenOut[k].tokensList).has(hopTokens[i])
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    parsePoolPairData(
                        poolsTokenInNoTokenOut[k],
                        tokenIn,
                        hopTokens[i].toString()
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        // Cannot be strictly greater otherwise
                        // highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                        highestNormalizedLiquidityFirst
                    )
                ) {
                    highestNormalizedLiquidityFirst = normalizedLiquidity;
                    highestNormalizedLiquidityFirstPoolId = k;
                }
            }
        }

        mostLiquidPoolsFirstHop[i] =
            poolsTokenInNoTokenOut[highestNormalizedLiquidityFirstPoolId];

        let highestNormalizedLiquidity = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)

        for (let k in poolsTokenOutNoTokenIn) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenOutNoTokenIn[k].tokensList).has(hopTokens[i])
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    parsePoolPairData(
                        poolsTokenOutNoTokenIn[k],
                        hopTokens[i].toString(),
                        tokenOut
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        // Cannot be strictly greater otherwise
                        // highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                        highestNormalizedLiquidity
                    )
                ) {
                    highestNormalizedLiquidity = normalizedLiquidity;
                    highestNormalizedLiquidityPoolId = k;
                }
            }
        }
        mostLiquidPoolsSecondHop[i] =
            poolsTokenOutNoTokenIn[highestNormalizedLiquidityPoolId];
    }

    return [mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop];
}
