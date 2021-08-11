'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const types_1 = require('./types');
const bmath_1 = require('./bmath');
const config_1 = require('./config');
const index_1 = require('./index');
function getHighestLimitAmountsForPaths(paths, maxPools) {
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
exports.getHighestLimitAmountsForPaths = getHighestLimitAmountsForPaths;
function getEffectivePriceSwapForPath(pools, path, swapType, amount) {
    if (amount.lt(config_1.INFINITESIMAL)) {
        // Return spot price as code below would be 0/0 = undefined
        // or small_amount/0 or 0/small_amount which would cause bugs
        return getSpotPriceAfterSwapForPath(path, swapType, amount);
    }
    let outputAmountSwap = getOutputAmountSwapForPath(path, swapType, amount);
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        return amount.div(outputAmountSwap); // amountIn/AmountOut
    } else {
        return outputAmountSwap.div(amount); // amountIn/AmountOut
    }
}
exports.getEffectivePriceSwapForPath = getEffectivePriceSwapForPath;
function getOutputAmountSwapForPath(path, swapType, amount) {
    const pools = path.pools;
    // First of all check if the amount is above limit, if so, return 0 for
    // 'swapExactIn' or Inf for swapExactOut
    if (amount.gt(path.limitAmount)) {
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            return bmath_1.ZERO;
        } else {
            return bmath_1.INFINITY;
        }
    }
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getOutputAmountSwap(
            pools[0],
            path.poolPairData[0],
            swapType,
            amount
        );
    } else if (poolPairData.length == 2) {
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            // The outputAmount is number of tokenOut we receive from the second poolPairData
            let outputAmountSwap1 = getOutputAmountSwap(
                pools[0],
                path.poolPairData[0],
                swapType,
                amount
            );
            return getOutputAmountSwap(
                pools[1],
                path.poolPairData[1],
                swapType,
                outputAmountSwap1
            );
        } else {
            // The outputAmount is number of tokenIn we send to the first poolPairData
            let outputAmountSwap2 = getOutputAmountSwap(
                pools[1],
                path.poolPairData[1],
                swapType,
                amount
            );
            return getOutputAmountSwap(
                pools[0],
                path.poolPairData[0],
                swapType,
                outputAmountSwap2
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}
exports.getOutputAmountSwapForPath = getOutputAmountSwapForPath;
function getSpotPriceAfterSwapForPath(path, swapType, amount) {
    const pools = path.pools;
    const poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getSpotPriceAfterSwap(
            pools[0],
            path.poolPairData[0],
            swapType,
            amount
        );
    } else if (poolPairData.length == 2) {
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            let outputAmountSwap1 = getOutputAmountSwap(
                pools[0],
                path.poolPairData[0],
                swapType,
                amount
            );
            let spotPriceAfterSwap1 = getSpotPriceAfterSwap(
                pools[0],
                path.poolPairData[0],
                swapType,
                amount
            );
            let spotPriceAfterSwap2 = getSpotPriceAfterSwap(
                pools[1],
                path.poolPairData[1],
                swapType,
                outputAmountSwap1
            );
            return spotPriceAfterSwap1.times(spotPriceAfterSwap2);
        } else {
            let outputAmountSwap2 = getOutputAmountSwap(
                pools[1],
                path.poolPairData[1],
                swapType,
                amount
            );
            let spotPriceAfterSwap1 = getSpotPriceAfterSwap(
                pools[0],
                path.poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let spotPriceAfterSwap2 = getSpotPriceAfterSwap(
                pools[1],
                path.poolPairData[1],
                swapType,
                amount
            );
            return spotPriceAfterSwap1.times(spotPriceAfterSwap2);
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}
exports.getSpotPriceAfterSwapForPath = getSpotPriceAfterSwapForPath;
// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
function getOutputAmountSwap(pool, poolPairData, swapType, amount) {
    let pairType = poolPairData.pairType;
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return bmath_1.ZERO;
        } else if (pairType === types_1.PairTypes.TokenToToken) {
            return pool._exactTokenInForTokenOut(poolPairData, amount);
        } else if (pairType === types_1.PairTypes.TokenToBpt) {
            return pool._exactTokenInForBPTOut(poolPairData, amount);
        } else if (pairType === types_1.PairTypes.BptToToken) {
            return pool._exactBPTInForTokenOut(poolPairData, amount);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bmath_1.ZERO;
        } else if (amount.gte(poolPairData.balanceOut)) {
            return bmath_1.INFINITY;
        } else if (pairType === types_1.PairTypes.TokenToToken) {
            return pool._tokenInForExactTokenOut(poolPairData, amount);
        } else if (pairType === types_1.PairTypes.TokenToBpt) {
            return pool._tokenInForExactBPTOut(poolPairData, amount);
        } else if (pairType === types_1.PairTypes.BptToToken) {
            return pool._BPTInForExactTokenOut(poolPairData, amount);
        }
    }
}
exports.getOutputAmountSwap = getOutputAmountSwap;
// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
function getSpotPriceAfterSwap(pool, poolPairData, swapType, amount) {
    let pairType = poolPairData.pairType;
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return bmath_1.ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bmath_1.ZERO;
        }
        if (amount.gte(poolPairData.balanceOut)) return bmath_1.INFINITY;
    }
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        if (pairType === types_1.PairTypes.TokenToToken) {
            return pool._spotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                amount
            );
        } else if (pairType === types_1.PairTypes.TokenToBpt) {
            return pool._spotPriceAfterSwapExactTokenInForBPTOut(
                poolPairData,
                amount
            );
        } else if (pairType === types_1.PairTypes.BptToToken) {
            return pool._spotPriceAfterSwapExactBPTInForTokenOut(
                poolPairData,
                amount
            );
        }
    } else {
        if (pairType === types_1.PairTypes.TokenToToken) {
            return pool._spotPriceAfterSwapTokenInForExactTokenOut(
                poolPairData,
                amount
            );
        } else if (pairType === types_1.PairTypes.TokenToBpt) {
            return pool._spotPriceAfterSwapTokenInForExactBPTOut(
                poolPairData,
                amount
            );
        } else if (pairType === types_1.PairTypes.BptToToken) {
            return pool._spotPriceAfterSwapBPTInForExactTokenOut(
                poolPairData,
                amount
            );
        }
    }
}
exports.getSpotPriceAfterSwap = getSpotPriceAfterSwap;
function getDerivativeSpotPriceAfterSwapForPath(path, swapType, amount) {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getDerivativeSpotPriceAfterSwap(
            path.pools[0],
            path.poolPairData[0],
            swapType,
            amount
        );
    } else if (poolPairData.length == 2) {
        if (swapType === types_1.SwapTypes.SwapExactIn) {
            let outputAmountSwap1 = getOutputAmountSwap(
                path.pools[0],
                path.poolPairData[0],
                swapType,
                amount
            );
            let SPaS1 = getSpotPriceAfterSwap(
                path.pools[0],
                path.poolPairData[0],
                swapType,
                amount
            );
            let SPaS2 = getSpotPriceAfterSwap(
                path.pools[1],
                path.poolPairData[1],
                swapType,
                outputAmountSwap1
            );
            let dSPaS1 = getDerivativeSpotPriceAfterSwap(
                path.pools[0],
                path.poolPairData[0],
                swapType,
                amount
            );
            let dSPaS2 = getDerivativeSpotPriceAfterSwap(
                path.pools[1],
                path.poolPairData[1],
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
                path.pools[1],
                path.poolPairData[1],
                swapType,
                amount
            );
            let SPaS1 = getSpotPriceAfterSwap(
                path.pools[0],
                path.poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let SPaS2 = getSpotPriceAfterSwap(
                path.pools[1],
                path.poolPairData[1],
                swapType,
                amount
            );
            let dSPaS1 = getDerivativeSpotPriceAfterSwap(
                path.pools[0],
                path.poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let dSPaS2 = getDerivativeSpotPriceAfterSwap(
                path.pools[1],
                path.poolPairData[1],
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
exports.getDerivativeSpotPriceAfterSwapForPath = getDerivativeSpotPriceAfterSwapForPath;
// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
function getDerivativeSpotPriceAfterSwap(pool, poolPairData, swapType, amount) {
    let pairType = poolPairData.pairType;
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return bmath_1.ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bmath_1.ZERO;
        }
        if (amount.gte(poolPairData.balanceOut)) return bmath_1.INFINITY;
    }
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        if (pairType === types_1.PairTypes.TokenToToken) {
            return pool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                amount
            );
        } else if (pairType === types_1.PairTypes.TokenToBpt) {
            return pool._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                poolPairData,
                amount
            );
        } else if (pairType === types_1.PairTypes.BptToToken) {
            return pool._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                poolPairData,
                amount
            );
        }
    } else {
        if (pairType === types_1.PairTypes.TokenToToken) {
            return pool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                poolPairData,
                amount
            );
        } else if (pairType === types_1.PairTypes.TokenToBpt) {
            return pool._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                poolPairData,
                amount
            );
        } else if (pairType === types_1.PairTypes.BptToToken) {
            return pool._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                poolPairData,
                amount
            );
        }
    }
}
exports.getDerivativeSpotPriceAfterSwap = getDerivativeSpotPriceAfterSwap;
// We need do pass 'pools' here because this function has to update the pools state
// in case a pool is used twice in two different paths
function EVMgetOutputAmountSwap(pool, poolPairData, swapType, amount) {
    let { pairType, balanceIn, balanceOut, tokenIn, tokenOut } = poolPairData;
    let returnAmount;
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return bmath_1.ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return bmath_1.ZERO;
        }
        if (amount.gte(poolPairData.balanceOut)) return bmath_1.INFINITY;
    }
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        // TODO we will be able to remove pooltype check once Element EVM maths is available
        if (
            pool.poolType === types_1.PoolTypes.Weighted ||
            pool.poolType === types_1.PoolTypes.Stable ||
            pool.poolType === types_1.PoolTypes.MetaStable
        ) {
            // Will accept/return normalised values
            if (pairType === types_1.PairTypes.TokenToToken) {
                returnAmount = pool._evmoutGivenIn(poolPairData, amount);
            } else if (pairType === types_1.PairTypes.TokenToBpt) {
                returnAmount = pool._evmexactTokenInForBPTOut(
                    poolPairData,
                    amount
                );
            } else if (pairType === types_1.PairTypes.BptToToken) {
                returnAmount = pool._evmexactBPTInForTokenOut(
                    poolPairData,
                    amount
                );
            }
        } else if (pool.poolType === types_1.PoolTypes.Element) {
            // TODO this will just be part of above once maths available
            returnAmount = getOutputAmountSwap(
                pool,
                poolPairData,
                swapType,
                amount
            );
        }
    } else {
        // TODO we will be able to remove pooltype check once Element EVM maths is available
        if (
            pool.poolType === types_1.PoolTypes.Weighted ||
            pool.poolType === types_1.PoolTypes.Stable ||
            pool.poolType === types_1.PoolTypes.MetaStable
        ) {
            if (pairType === types_1.PairTypes.TokenToToken) {
                returnAmount = pool._evminGivenOut(poolPairData, amount);
            } else if (pairType === types_1.PairTypes.TokenToBpt) {
                returnAmount = pool._evmtokenInForExactBPTOut(
                    poolPairData,
                    amount
                );
            } else if (pairType === types_1.PairTypes.BptToToken) {
                returnAmount = pool._evmbptInForExactTokenOut(
                    poolPairData,
                    amount
                );
            }
        } else if (pool.poolType === types_1.PoolTypes.Element) {
            // TODO this will just be part of above once maths available
            returnAmount = getOutputAmountSwap(
                pool,
                poolPairData,
                swapType,
                amount
            );
        }
    }
    // Update balances of tokenIn and tokenOut
    pool.updateTokenBalanceForPool(tokenIn, balanceIn.plus(returnAmount));
    pool.updateTokenBalanceForPool(tokenOut, balanceOut.minus(amount));
    return returnAmount;
}
exports.EVMgetOutputAmountSwap = EVMgetOutputAmountSwap;
function formatSwaps(
    swapsOriginal,
    swapType,
    swapAmount,
    tokenIn,
    tokenOut,
    returnAmount,
    returnAmountConsideringFees,
    marketSp,
    wrapOptions = {
        isEthSwap: false,
        wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    }
) {
    const tokenAddressesSet = new Set();
    const swaps = JSON.parse(JSON.stringify(swapsOriginal));
    let tokenInDecimals;
    let tokenOutDecimals;
    let swapInfo = {
        tokenAddresses: [],
        swaps: [],
        swapAmount: bmath_1.ZERO,
        returnAmount: bmath_1.ZERO,
        returnAmountConsideringFees: bmath_1.ZERO,
        tokenIn: '',
        tokenOut: '',
        marketSp: marketSp,
    };
    if (swaps.length === 0) {
        return swapInfo;
    }
    const WETH = wrapOptions.wethAddress.toLowerCase();
    swaps.forEach(sequence => {
        sequence.forEach(swap => {
            if (swap.tokenIn === tokenIn)
                tokenInDecimals = swap.tokenInDecimals;
            if (swap.tokenOut === tokenOut)
                tokenOutDecimals = swap.tokenOutDecimals;
            if (wrapOptions.isEthSwap) {
                if (swap.tokenIn === WETH) swap.tokenIn = index_1.ZERO_ADDRESS;
                if (swap.tokenOut === WETH)
                    swap.tokenOut = index_1.ZERO_ADDRESS;
            }
            tokenAddressesSet.add(swap.tokenIn);
            tokenAddressesSet.add(swap.tokenOut);
        });
    });
    const tokenArray = [...tokenAddressesSet];
    if (swapType === types_1.SwapTypes.SwapExactIn) {
        const swapsV2 = [];
        let totalSwapAmount = bmath_1.ZERO;
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
                    amountScaled = bmath_1
                        .scale(
                            bmath_1.bnum(swap.swapAmount),
                            swap.tokenInDecimals
                        )
                        .decimalPlaces(0, 1)
                        .toString();
                    totalSwapAmount = totalSwapAmount.plus(amountScaled);
                }
                const inIndex = tokenArray.indexOf(swap.tokenIn);
                const outIndex = tokenArray.indexOf(swap.tokenOut);
                const swapV2 = {
                    poolId: swap.pool,
                    assetInIndex: inIndex,
                    assetOutIndex: outIndex,
                    amount: amountScaled,
                    userData: '0x',
                };
                swapsV2.push(swapV2);
            });
        });
        // We need to account for any rounding losses by adding dust to first path
        let swapAmountScaled = bmath_1.scale(swapAmount, tokenInDecimals);
        let dust = swapAmountScaled.minus(totalSwapAmount).dp(0, 0);
        if (dust.gt(0))
            swapsV2[0].amount = bmath_1
                .bnum(swapsV2[0].amount)
                .plus(dust)
                .toString();
        swapInfo.swapAmount = swapAmountScaled;
        // Using this split to remove any decimals
        swapInfo.returnAmount = bmath_1.bnum(
            bmath_1
                .scale(returnAmount, tokenOutDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.returnAmountConsideringFees = bmath_1.bnum(
            bmath_1
                .scale(returnAmountConsideringFees, tokenOutDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.swaps = swapsV2;
    } else {
        let swapsV2 = [];
        let totalSwapAmount = bmath_1.ZERO;
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
                const swapV2 = {
                    poolId: swap.pool,
                    assetInIndex: inIndex,
                    assetOutIndex: outIndex,
                    amount: '0',
                    userData: '0x',
                };
                if (i == 0 && sequence.length > 1) {
                    sequenceSwaps[1] = swapV2; // Make the swap the last in V2 order for the sequence
                } else {
                    let amountScaled = bmath_1
                        .scale(
                            bmath_1.bnum(swap.swapAmount),
                            swap.tokenOutDecimals
                        )
                        .decimalPlaces(0, 1)
                        .toString();
                    totalSwapAmount = totalSwapAmount.plus(amountScaled);
                    swapV2.amount = amountScaled; // Make the swap the first in V2 order for the sequence with the value
                    sequenceSwaps[0] = swapV2;
                }
            });
            swapsV2 = swapsV2.concat(sequenceSwaps);
        });
        // We need to account for any rounding losses by adding dust to first path
        let swapAmountScaled = bmath_1.scale(swapAmount, tokenOutDecimals);
        let dust = swapAmountScaled.minus(totalSwapAmount).dp(0, 0);
        if (dust.gt(0))
            swapsV2[0].amount = bmath_1
                .bnum(swapsV2[0].amount)
                .plus(dust)
                .toString();
        swapInfo.swapAmount = swapAmountScaled;
        // Using this split to remove any decimals
        swapInfo.returnAmount = bmath_1.bnum(
            bmath_1
                .scale(returnAmount, tokenInDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.returnAmountConsideringFees = bmath_1.bnum(
            bmath_1
                .scale(returnAmountConsideringFees, tokenInDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.swaps = swapsV2;
    }
    swapInfo.tokenAddresses = tokenArray;
    swapInfo.tokenIn = tokenIn;
    swapInfo.tokenOut = tokenOut;
    return swapInfo;
}
exports.formatSwaps = formatSwaps;
