import { BigNumber } from './utils/bignumber';
import { getAddress } from '@ethersproject/address';
import {
    PoolPairData,
    Path,
    Swap,
    DisabledOptions,
    SubGraphPool,
    SubGraphPoolDictionary,
    SwapInfo,
    SwapV2,
} from './types';
import { MAX_IN_RATIO, MAX_OUT_RATIO, bnum, scale } from './bmath';
import * as stableMath from './poolMath/stableMath';
import * as weightedMath from './poolMath/weightedMath';
import * as weightedSolidity from './solidityHelpers/pools/weighted';
import { FixedPoint } from './solidityHelpers/math/FixedPoint';

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
    pools: SubGraphPoolDictionary,
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
    let pairType = poolPairData.pairType;
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (poolPairData.balanceIn.isZero()) {
            return bnum(0);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bnum(0);
        }
        if (amount.gte(poolPairData.balanceOut)) return bnum('Infinity');
    }
    if (swapType === 'swapExactIn') {
        if (poolType == 'Weighted') {
            if (pairType == 'token->token') {
                return weightedMath._exactTokenInForTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return weightedMath._exactTokenInForBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return weightedMath._exactBPTInForTokenOut(
                    amount,
                    poolPairData
                );
            }
        } else if (poolType == 'Stable') {
            if (pairType == 'token->token') {
                return stableMath._exactTokenInForTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return stableMath._exactTokenInForBPTOut(amount, poolPairData);
            } else if (pairType == 'BPT->token') {
                return stableMath._exactBPTInForTokenOut(amount, poolPairData);
            }
        }
    } else {
        if (poolType == 'Weighted') {
            if (pairType == 'token->token') {
                return weightedMath._tokenInForExactTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return weightedMath._tokenInForExactBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return weightedMath._BPTInForExactTokenOut(
                    amount,
                    poolPairData
                );
            }
        } else if (poolType == 'Stable') {
            if (pairType == 'token->token') {
                return stableMath._tokenInForExactTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return stableMath._tokenInForExactBPTOut(amount, poolPairData);
            } else if (pairType == 'BPT->token') {
                return stableMath._BPTInForExactTokenOut(amount, poolPairData);
            }
        }
    }
}

export function getOutputAmountSwapForPath(
    pools: SubGraphPoolDictionary,
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
    pools: SubGraphPoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    if (amount.lt(bnum(10 ** -10))) {
        // Return spot price as code below would be 0/0 = undefined
        // or small_amount/0 or 0/small_amount which would cause bugs
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
    let pairType = poolPairData.pairType;
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (poolPairData.balanceIn.isZero()) {
            return bnum(0);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bnum(0);
        }
        if (amount.gte(poolPairData.balanceOut)) return bnum('Infinity');
    }
    if (swapType === 'swapExactIn') {
        if (poolType == 'Weighted') {
            if (pairType == 'token->token') {
                return weightedMath._spotPriceAfterSwapExactTokenInForTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return weightedMath._spotPriceAfterSwapExactTokenInForBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return weightedMath._spotPriceAfterSwapExactBPTInForTokenOut(
                    amount,
                    poolPairData
                );
            }
        } else if (poolType == 'Stable') {
            if (pairType == 'token->token') {
                return stableMath._spotPriceAfterSwapExactTokenInForTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return stableMath._spotPriceAfterSwapExactTokenInForBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return stableMath._spotPriceAfterSwapExactBPTInForTokenOut(
                    amount,
                    poolPairData
                );
            }
        }
    } else {
        if (poolType == 'Weighted') {
            if (pairType == 'token->token') {
                return weightedMath._spotPriceAfterSwapTokenInForExactTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return weightedMath._spotPriceAfterSwapTokenInForExactBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return weightedMath._spotPriceAfterSwapBPTInForExactTokenOut(
                    amount,
                    poolPairData
                );
            }
        } else if (poolType == 'Stable') {
            if (pairType == 'token->token') {
                return stableMath._spotPriceAfterSwapTokenInForExactTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return stableMath._spotPriceAfterSwapTokenInForExactBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return stableMath._spotPriceAfterSwapBPTInForExactTokenOut(
                    amount,
                    poolPairData
                );
            }
        }
    }
}

export function getSpotPriceAfterSwapForPath(
    pools: SubGraphPoolDictionary,
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
    let pairType = poolPairData.pairType;
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (poolPairData.balanceIn.isZero()) {
            return bnum(0);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bnum(0);
        }
        if (amount.gte(poolPairData.balanceOut)) return bnum('Infinity');
    }
    if (swapType === 'swapExactIn') {
        if (poolType == 'Weighted') {
            if (pairType == 'token->token') {
                return weightedMath._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return weightedMath._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return weightedMath._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                    amount,
                    poolPairData
                );
            }
        } else if (poolType == 'Stable') {
            if (pairType == 'token->token') {
                return stableMath._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return stableMath._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return stableMath._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                    amount,
                    poolPairData
                );
            }
        }
    } else {
        if (poolType == 'Weighted') {
            if (pairType == 'token->token') {
                return weightedMath._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return weightedMath._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return weightedMath._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                    amount,
                    poolPairData
                );
            }
        } else if (poolType == 'Stable') {
            if (pairType == 'token->token') {
                return stableMath._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'token->BPT') {
                return stableMath._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                    amount,
                    poolPairData
                );
            } else if (pairType == 'BPT->token') {
                return stableMath._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                    amount,
                    poolPairData
                );
            }
        }
    }
}

export function getDerivativeSpotPriceAfterSwapForPath(
    pools: SubGraphPoolDictionary,
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
    p: SubGraphPool,
    tokenIn: string,
    tokenOut: string
): PoolPairData => {
    let poolPairData,
        poolType,
        pairType,
        tI,
        tO,
        tokenIndexIn,
        tokenIndexOut,
        balanceIn,
        balanceOut,
        decimalsOut,
        decimalsIn,
        weightIn,
        weightOut;

    // Check if tokenIn is the pool token itself (BPT)
    if (tokenIn == p.id) {
        pairType = 'BPT->token';
        balanceIn = p.balanceBpt;
        decimalsIn = bnum(18); // Not used but has to be defined
        weightIn = bnum(1); // Not used but has to be defined
    } else if (tokenOut == p.id) {
        pairType = 'token->BPT';
        balanceOut = p.balanceBpt;
        decimalsOut = bnum(18); // Not used but has to be defined
        weightOut = bnum(1); // Not used but has to be defined
    } else {
        pairType = 'token->token';
    }

    if (pairType != 'BPT->token') {
        tokenIndexIn = p.tokens.findIndex(
            t => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        tI = p.tokens[tokenIndexIn];
        balanceIn = tI.balance;
        decimalsIn = tI.decimals;
        weightIn = bnum(tI.denormWeight).div(bnum(p.totalWeight));
    }
    if (pairType != 'token->BPT') {
        tokenIndexOut = p.tokens.findIndex(
            t => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        tO = p.tokens[tokenIndexOut];
        balanceOut = tO.balance;
        decimalsOut = tO.decimals;
        weightOut = bnum(tO.denormWeight).div(bnum(p.totalWeight));
    }

    // Todo: the pool type should be already on subgraph
    if (typeof p.amp === 'undefined' || p.amp === '0') poolType = 'Weighted';
    else poolType = 'Stable';

    if (poolType == 'Weighted') {
        poolPairData = {
            id: p.id,
            poolType: poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: decimalsIn,
            decimalsOut: decimalsOut,
            balanceIn: bnum(balanceIn),
            balanceOut: bnum(balanceOut),
            weightIn: weightIn,
            weightOut: weightOut,
            swapFee: bnum(p.swapFee),
        };
    } else if (poolType == 'Stable') {
        // Get all token balances
        let allBalances = [];
        for (let i = 0; i < p.tokens.length; i++) {
            allBalances.push(bnum(p.tokens[i].balance));
        }

        let inv = stableMath._invariant(bnum(p.amp), allBalances);
        // Just to debug we confirm that the invariant value function is extremely close to zero as it should:
        // let invVF = stableMath._invariantValueFunction(
        //     bnum(p.amp),
        //     allBalances,
        //     inv
        // );

        poolPairData = {
            id: p.id,
            poolType: poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: decimalsIn,
            decimalsOut: decimalsOut,
            balanceIn: bnum(balanceIn),
            balanceOut: bnum(balanceOut),
            invariant: stableMath._invariant(bnum(p.amp), allBalances),
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
    pools: SubGraphPoolDictionary,
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
    pools: SubGraphPoolDictionary,
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
    pools: SubGraphPoolDictionary,
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let {
        poolType,
        pairType,
        balanceIn,
        balanceOut,
        tokenIn,
        tokenOut,
        decimalsIn,
        decimalsOut,
        swapFee,
    } = poolPairData;
    let returnAmount: BigNumber;

    if (swapType === 'swapExactIn') {
        if (poolPairData.balanceIn.isZero()) {
            return bnum(0);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bnum(0);
        }
        if (amount.gte(poolPairData.balanceOut)) return bnum('Infinity');
    }
    if (swapType === 'swapExactIn') {
        if (poolType == 'Weighted') {
            let { weightIn, weightOut } = poolPairData;
            if (pairType == 'token->token') {
                returnAmount = weightedSolidity._outGivenIn(
                    new FixedPoint(scale(balanceIn, decimalsIn)),
                    new FixedPoint(scale(weightIn, 18)),
                    new FixedPoint(scale(balanceOut, decimalsOut)),
                    new FixedPoint(scale(weightOut, 18)),
                    new FixedPoint(scale(amount, decimalsIn)),
                    new FixedPoint(scale(swapFee, 18))
                );
                // TODO: scaling down may not be necessary since we have to
                // scale it up anyways for the swap info later?
                returnAmount = scale(returnAmount, -decimalsOut);
            } else if (pairType == 'token->BPT') {
                // returnAmount = getOutputAmountSwap(poolPairData,swapType,amount);
                returnAmount = weightedSolidity._exactTokenInForBPTOut(
                    new FixedPoint(scale(balanceIn, decimalsIn)),
                    new FixedPoint(scale(weightIn, 18)),
                    new FixedPoint(scale(amount, decimalsIn)),
                    new FixedPoint(scale(balanceOut, 18)), // BPT is always 18 decimals
                    new FixedPoint(scale(swapFee, 18))
                );
                // TODO: scaling down may not be necessary since we have to
                // scale it up anyways for the swap info later?
                returnAmount = scale(returnAmount, -18); // BPT is always 18 decimals
            } else if (pairType == 'BPT->token') {
                // returnAmount = getOutputAmountSwap(poolPairData,swapType,amount);
                returnAmount = weightedSolidity._exactBPTInForTokenOut(
                    new FixedPoint(scale(balanceOut, decimalsOut)),
                    new FixedPoint(scale(weightOut, 18)),
                    new FixedPoint(scale(amount, 18)), // BPT is always 18 decimals
                    new FixedPoint(scale(balanceIn, 18)), // BPT is always 18 decimals
                    new FixedPoint(scale(swapFee, 18))
                );
                // TODO: scaling down may not be necessary since we have to
                // scale it up anyways for the swap info later?
                returnAmount = scale(returnAmount, -decimalsOut);
            }
        } else if (poolType == 'Stable') {
            // TODO update when sol helpers available for stable pools also
            returnAmount = getOutputAmountSwap(poolPairData, swapType, amount);
            // if (pairType == 'token->token') {
            //     returnAmount = stableMath._exactTokenInForTokenOut(
            //         amount,
            //         poolPairData
            //     );
            // } else if (pairType == 'token->BPT') {
            //     returnAmount = stableMath._exactTokenInForBPTOut(amount, poolPairData);
            // } else if (pairType == 'BPT->token') {
            //     returnAmount = stableMath._exactBPTInForTokenOut(amount, poolPairData);
            // }
        }
    } else {
        if (poolType == 'Weighted') {
            let { weightIn, weightOut } = poolPairData;
            if (pairType == 'token->token') {
                returnAmount = weightedSolidity._inGivenOut(
                    new FixedPoint(scale(balanceIn, decimalsIn)),
                    new FixedPoint(scale(weightIn, 18)),
                    new FixedPoint(scale(balanceOut, decimalsOut)),
                    new FixedPoint(scale(weightOut, 18)),
                    new FixedPoint(scale(amount, decimalsOut)),
                    new FixedPoint(scale(swapFee, 18))
                );
                // TODO: scaling down may not be necessary since we have to
                // scale it up anyways for the swap info later?
                returnAmount = scale(returnAmount, -decimalsIn);
            } else if (pairType == 'token->BPT') {
                // returnAmount = getOutputAmountSwap(poolPairData,swapType,amount);
                returnAmount = weightedSolidity._tokenInForExactBPTOut(
                    new FixedPoint(scale(balanceIn, decimalsIn)),
                    new FixedPoint(scale(weightIn, 18)),
                    new FixedPoint(scale(amount, 18)), // BPT is always 18 decimals
                    new FixedPoint(scale(balanceOut, 18)), // BPT is always 18 decimals
                    new FixedPoint(scale(swapFee, 18))
                );
                // TODO: scaling down may not be necessary since we have to
                // scale it up anyways for the swap info later?
                returnAmount = scale(returnAmount, -decimalsIn);
            } else if (pairType == 'BPT->token') {
                // returnAmount = getOutputAmountSwap(poolPairData,swapType,amount);
                returnAmount = weightedSolidity._bptInForExactTokenOut(
                    new FixedPoint(scale(balanceOut, decimalsOut)),
                    new FixedPoint(scale(weightOut, 18)),
                    new FixedPoint(scale(amount, decimalsOut)),
                    new FixedPoint(scale(balanceIn, 18)), // BPT is always 18 decimals
                    new FixedPoint(scale(swapFee, 18))
                );
                // TODO: scaling down may not be necessary since we have to
                // scale it up anyways for the swap info later?
                returnAmount = scale(returnAmount, -18); // BPT is always 18 decimals
            }
        } else if (poolType == 'Stable') {
            // TODO update when sol helpers available for stable pools also
            returnAmount = getOutputAmountSwap(poolPairData, swapType, amount);
            // if (pairType == 'token->token') {
            //     returnAmount = stableMath._tokenInForExactTokenOut(
            //         amount,
            //         poolPairData
            //     );
            // } else if (pairType == 'token->BPT') {
            //     returnAmount = stableMath._tokenInForExactBPTOut(amount, poolPairData);
            // } else if (pairType == 'BPT->token') {
            //     returnAmount = stableMath._BPTInForExactTokenOut(amount, poolPairData);
            // }
        }
    }
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

// Updates the balance of a given token for a given pool passed as parameter
export function updateTokenBalanceForPool(
    pool: any,
    token: string,
    balance: BigNumber
): any {
    // token is BPT
    if (pool.id == token) {
        pool.balanceBpt = balance;
        return pool;
    } else {
        // token is underlying in the pool
        let T = pool.tokens.find(t => t.address === token);
        T.balance = balance;
        return pool;
    }
}

// This is just used to compare how liquid the different pools are. We are
// using as unit of reference the liquidity in tokenOut. We also account
// for the different poolTypes and poolPairs
export function getNormalizedLiquidity(poolPairData: PoolPairData): BigNumber {
    let {
        poolType,
        pairType,
        weightIn,
        weightOut,
        balanceIn,
        balanceOut,
        amp,
    } = poolPairData;
    if (poolType == 'Weighted') {
        if (pairType == 'token->token') {
            return balanceOut.times(weightIn).div(weightIn.plus(weightOut));
        } else if (pairType == 'token->BPT') {
            return balanceOut; // Liquidity in tokenOut is balanceBpt
        } else if (pairType == 'BPT->token') {
            return balanceOut.div(bnum(1).plus(weightOut)); // Liquidity in tokenOut is Bo/wo
        }
    } else if (poolType == 'Stable') {
        return balanceOut.times(amp); // This is an approximation as the actual
        // normalized liquidity is a lot more complicated to calculate
    } else throw 'Pool type unknown';
}

// LEGACY FUNCTION - Keep Input/Output Format
export const parsePoolData = (
    directPools: SubGraphPoolDictionary,
    tokenIn: string,
    tokenOut: string,
    mostLiquidPoolsFirstHop: SubGraphPool[] = [],
    mostLiquidPoolsSecondHop: SubGraphPool[] = [],
    hopTokens: string[] = []
): [SubGraphPoolDictionary, Path[]] => {
    let pathDataList: Path[] = [];
    let pools: SubGraphPoolDictionary = {};

    // First add direct pair paths
    for (let idKey in directPools) {
        let p: SubGraphPool = directPools[idKey];
        // Add pool to the set with all pools (only adds if it's still not present in dict)
        pools[idKey] = p;

        let swap: Swap = {
            pool: p.id,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            tokenInDecimals: 18, // Placeholder for actual decimals
            tokenOutDecimals: 18,
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
            tokenInDecimals: 18, // Placeholder for actual decimals
            tokenOutDecimals: 18,
        };

        let swap2: Swap = {
            pool: mostLiquidPoolsSecondHop[i].id,
            tokenIn: hopTokens[i],
            tokenOut: tokenOut,
            tokenInDecimals: 18, // Placeholder for actual decimals
            tokenOutDecimals: 18,
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

export function filterPools(
    allPools: SubGraphPool[], // The complete information of the pools
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
): [
    SubGraphPoolDictionary,
    string[],
    SubGraphPoolDictionary,
    SubGraphPoolDictionary
] {
    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let poolsDirect: SubGraphPoolDictionary = {};
    let poolsTokenOne: SubGraphPoolDictionary = {};
    let poolsTokenTwo: SubGraphPoolDictionary = {};
    let tokenInPairedTokens: Set<string> = new Set();
    let tokenOutPairedTokens: Set<string> = new Set();

    let disabledTokens = disabledTokensDefault.tokens;
    if (disabledOptions.isOverRide)
        disabledTokens = disabledOptions.disabledTokens;

    allPools.forEach(pool => {
        let tokenListSet = new Set(pool.tokensList);
        // we add the BPT as well as we can join/exit as part of the multihop
        tokenListSet.add(pool.id);
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
    poolsTokenInNoTokenOut: SubGraphPoolDictionary,
    poolsTokenOutNoTokenIn: SubGraphPoolDictionary
): [SubGraphPool[], SubGraphPool[]] {
    // Find the most liquid pool for each pair (tokenIn -> hopToken). We store an object in the form:
    // mostLiquidPoolsFirstHop = {hopToken1: mostLiquidPool, hopToken2: mostLiquidPool, ... , hopTokenN: mostLiquidPool}
    // Here we could query subgraph for all pools with pair (tokenIn -> hopToken), but to
    // minimize subgraph calls we loop through poolsTokenInNoTokenOut, and check the liquidity
    // only for those that have hopToken
    let mostLiquidPoolsFirstHop: SubGraphPool[] = [];
    let mostLiquidPoolsSecondHop: SubGraphPool[] = [];
    let poolPair = {}; // Store pair liquidity in case it is reused

    for (let i = 0; i < hopTokens.length; i++) {
        let highestNormalizedLiquidityFirst = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityFirstPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)

        for (let k in poolsTokenInNoTokenOut) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenInNoTokenOut[k].tokensList)
                    .add(poolsTokenInNoTokenOut[k].id)
                    .has(hopTokens[i])
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
                new Set(poolsTokenOutNoTokenIn[k].tokensList)
                    .add(poolsTokenOutNoTokenIn[k].id)
                    .has(hopTokens[i])
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

export function normalizePools(pools) {
    let normalizedPools = { pools: [] };
    for (let i = 0; i < pools.pools.length; i++) {
        let normalizedPool = pools.pools[i];
        normalizedPool.tokens.forEach(token => {
            token.balance = scale(token.balance, -token.decimals);
        });

        normalizedPools.pools.push(normalizedPool);
    }

    return normalizedPools;
}

export function formatSwaps(
    swaps: Swap[][],
    swapType: string,
    swapAmount: BigNumber,
    tokenIn: string,
    tokenOut: string,
    returnAmount: BigNumber,
    marketSp: BigNumber
): SwapInfo {
    const tokenAddressesSet: Set<string> = new Set();

    let tokenInDecimals: number;
    let tokenOutDecimals: number;

    let swapInfo: SwapInfo = {
        tokenAddresses: [],
        swaps: [],
        swapAmount: bnum(0),
        returnAmount: bnum(0),
        tokenIn: '',
        tokenOut: '',
        marketSp: marketSp,
    };

    if (swaps.length === 0) {
        return swapInfo;
    }

    swaps.forEach(sequence => {
        sequence.forEach(swap => {
            tokenAddressesSet.add(swap.tokenIn);
            tokenAddressesSet.add(swap.tokenOut);
            if (swap.tokenIn === tokenIn)
                tokenInDecimals = swap.tokenInDecimals;

            if (swap.tokenOut === tokenOut)
                tokenOutDecimals = swap.tokenOutDecimals;
        });
    });

    const tokenArray = [...tokenAddressesSet];

    if (swapType === 'swapExactIn') {
        const swapsV2: SwapV2[] = [];

        /*
         * Multihop swaps can be executed by passing an`amountIn` value of zero for a swap.This will cause the amount out
         * of the previous swap to be used as the amount in of the current one.In such a scenario, `tokenIn` must equal the
         * previous swap's `tokenOut`.
         * */
        swaps.forEach(sequence => {
            sequence.forEach((swap, i) => {
                let amountScaled = '0'; // amount will be 0 for second swap in multihop swap
                if (i == 0) {
                    // First swap so should have a value for both single and multihop
                    //!!!!!!! TO DO - Not sure if this is a correct way to handle?
                    amountScaled = scale(
                        bnum(swap.swapAmount),
                        swap.tokenInDecimals
                    )
                        .toString()
                        .split('.')[0];
                }

                const inIndex = tokenArray.indexOf(swap.tokenIn);
                const outIndex = tokenArray.indexOf(swap.tokenOut);
                const swapV2: SwapV2 = {
                    poolId: swap.pool,
                    tokenInIndex: inIndex,
                    tokenOutIndex: outIndex,
                    amountIn: amountScaled,
                    userData: '0x',
                };

                swapsV2.push(swapV2);
            });
        });

        swapInfo.swapAmount = scale(swapAmount, tokenInDecimals);
        swapInfo.returnAmount = scale(returnAmount, tokenOutDecimals);
        swapInfo.swaps = swapsV2;
    } else {
        let swapsV2: SwapV2[] = [];
        /*
        SwapExactOut will have order reversed in V2.
        v1 = [[x, y]], [[a, b]]
        v2 = [y, x, b, a]
        */
        swaps.forEach((sequence, sequenceNo) => {
            if (sequence.length > 2)
                throw new Error(
                    'Multihop with more than 2 swaps not supported'
                );

            const sequenceSwaps = [];
            sequence.forEach((swap, i) => {
                const inIndex = tokenArray.indexOf(swap.tokenIn);
                const outIndex = tokenArray.indexOf(swap.tokenOut);
                const swapV2: SwapV2 = {
                    poolId: swap.pool,
                    tokenInIndex: inIndex,
                    tokenOutIndex: outIndex,
                    amountOut: '0', // For a multihop the first swap in sequence should be last in order and have amt = 0
                    userData: '0x',
                };

                if (i == 0 && sequence.length > 1) {
                    sequenceSwaps[1] = swapV2; // Make the swap the last in V2 order for the sequence
                } else {
                    let amountScaled = scale(
                        bnum(swap.swapAmount),
                        swap.tokenOutDecimals
                    )
                        .toString()
                        .split('.')[0];

                    swapV2.amountOut = amountScaled; // Make the swap the first in V2 order for the sequence with the value
                    sequenceSwaps[0] = swapV2;
                }
            });

            swapsV2 = swapsV2.concat(sequenceSwaps);
        });

        swapInfo.swapAmount = scale(swapAmount, tokenOutDecimals);
        swapInfo.returnAmount = scale(returnAmount, tokenInDecimals);
        swapInfo.swaps = swapsV2;
    }

    swapInfo.tokenAddresses = tokenArray;
    swapInfo.tokenIn = tokenIn;
    swapInfo.tokenOut = tokenOut;
    return swapInfo;
}
