import { BigNumber } from './utils/bignumber';
import {
    NewPath,
    PoolDictionary,
    SwapTypes,
    PairTypes,
    PoolBase,
    PoolPairBase,
    PoolTypes,
    SwapV2,
    Swap,
    SwapInfo,
} from './types';
import { bnum, scale, ZERO, INFINITY } from './bmath';
import { INFINITESIMAL } from './config';
import { ZERO_ADDRESS } from './index';

export function getHighestLimitAmountsForPaths(
    paths: NewPath[],
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

export function getEffectivePriceSwapForPath(
    pools: PoolDictionary,
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    if (amount.lt(INFINITESIMAL)) {
        // Return spot price as code below would be 0/0 = undefined
        // or small_amount/0 or 0/small_amount which would cause bugs
        return getSpotPriceAfterSwapForPath(path, swapType, amount);
    }
    let outputAmountSwap = getOutputAmountSwapForPath(path, swapType, amount);
    if (swapType === SwapTypes.SwapExactIn) {
        return amount.div(outputAmountSwap); // amountIn/AmountOut
    } else {
        return outputAmountSwap.div(amount); // amountIn/AmountOut
    }
}

export function getOutputAmountSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    const pools = path.pools;

    // First of all check if the amount is above limit, if so, return 0 for
    // 'swapExactIn' or Inf for swapExactOut
    if (amount.gt(path.limitAmount)) {
        if (swapType === SwapTypes.SwapExactIn) {
            return ZERO;
        } else {
            return INFINITY;
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
        if (swapType === SwapTypes.SwapExactIn) {
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

export function getSpotPriceAfterSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
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
        if (swapType === SwapTypes.SwapExactIn) {
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

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getOutputAmountSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    let pairType = poolPairData.pairType;

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return ZERO;
        } else if (pairType === PairTypes.TokenToToken) {
            return pool._exactTokenInForTokenOut(poolPairData, amount);
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._exactTokenInForBPTOut(poolPairData, amount);
        } else if (pairType === PairTypes.BptToToken) {
            return pool._exactBPTInForTokenOut(poolPairData, amount);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        } else if (amount.gte(poolPairData.balanceOut)) {
            return INFINITY;
        } else if (pairType === PairTypes.TokenToToken) {
            return pool._tokenInForExactTokenOut(poolPairData, amount);
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._tokenInForExactBPTOut(poolPairData, amount);
        } else if (pairType === PairTypes.BptToToken) {
            return pool._BPTInForExactTokenOut(poolPairData, amount);
        }
    }
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getSpotPriceAfterSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    let pairType = poolPairData.pairType;

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        }
        if (amount.gte(poolPairData.balanceOut)) return INFINITY;
    }
    if (swapType === SwapTypes.SwapExactIn) {
        if (pairType === PairTypes.TokenToToken) {
            return pool._spotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                amount
            );
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._spotPriceAfterSwapExactTokenInForBPTOut(
                poolPairData,
                amount
            );
        } else if (pairType === PairTypes.BptToToken) {
            return pool._spotPriceAfterSwapExactBPTInForTokenOut(
                poolPairData,
                amount
            );
        }
    } else {
        if (pairType === PairTypes.TokenToToken) {
            return pool._spotPriceAfterSwapTokenInForExactTokenOut(
                poolPairData,
                amount
            );
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._spotPriceAfterSwapTokenInForExactBPTOut(
                poolPairData,
                amount
            );
        } else if (pairType === PairTypes.BptToToken) {
            return pool._spotPriceAfterSwapBPTInForExactTokenOut(
                poolPairData,
                amount
            );
        }
    }
}

export function getDerivativeSpotPriceAfterSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getDerivativeSpotPriceAfterSwap(
            path.pools[0],
            path.poolPairData[0],
            swapType,
            amount
        );
    } else if (poolPairData.length == 2) {
        if (swapType === SwapTypes.SwapExactIn) {
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

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getDerivativeSpotPriceAfterSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    let pairType = poolPairData.pairType;

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        }
        if (amount.gte(poolPairData.balanceOut)) return INFINITY;
    }
    if (swapType === SwapTypes.SwapExactIn) {
        if (pairType === PairTypes.TokenToToken) {
            return pool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                poolPairData,
                amount
            );
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                poolPairData,
                amount
            );
        } else if (pairType === PairTypes.BptToToken) {
            return pool._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                poolPairData,
                amount
            );
        }
    } else {
        if (pairType === PairTypes.TokenToToken) {
            return pool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                poolPairData,
                amount
            );
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                poolPairData,
                amount
            );
        } else if (pairType === PairTypes.BptToToken) {
            return pool._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                poolPairData,
                amount
            );
        }
    }
}

// We need do pass 'pools' here because this function has to update the pools state
// in case a pool is used twice in two different paths
export function EVMgetOutputAmountSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    let { pairType, balanceIn, balanceOut, tokenIn, tokenOut } = poolPairData;

    let returnAmount: BigNumber;

    if (swapType === SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        }
        if (amount.gte(poolPairData.balanceOut)) return INFINITY;
    }
    if (swapType === SwapTypes.SwapExactIn) {
        // TODO we will be able to remove pooltype check once Element EVM maths is available
        if (
            pool.poolType === PoolTypes.Weighted ||
            pool.poolType === PoolTypes.Stable ||
            pool.poolType === PoolTypes.MetaStable
        ) {
            // Will accept/return normalised values
            if (pairType === PairTypes.TokenToToken) {
                returnAmount = pool._evmoutGivenIn(poolPairData, amount);
            } else if (pairType === PairTypes.TokenToBpt) {
                returnAmount = pool._evmexactTokenInForBPTOut(
                    poolPairData,
                    amount
                );
            } else if (pairType === PairTypes.BptToToken) {
                returnAmount = pool._evmexactBPTInForTokenOut(
                    poolPairData,
                    amount
                );
            }
        } else if (pool.poolType === PoolTypes.Element) {
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
            pool.poolType === PoolTypes.Weighted ||
            pool.poolType === PoolTypes.Stable ||
            pool.poolType === PoolTypes.MetaStable
        ) {
            if (pairType === PairTypes.TokenToToken) {
                returnAmount = pool._evminGivenOut(poolPairData, amount);
            } else if (pairType === PairTypes.TokenToBpt) {
                returnAmount = pool._evmtokenInForExactBPTOut(
                    poolPairData,
                    amount
                );
            } else if (pairType === PairTypes.BptToToken) {
                returnAmount = pool._evmbptInForExactTokenOut(
                    poolPairData,
                    amount
                );
            }
        } else if (pool.poolType === PoolTypes.Element) {
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

export function formatSwaps(
    swapsOriginal: Swap[][],
    swapType: SwapTypes,
    swapAmount: BigNumber,
    tokenIn: string,
    tokenOut: string,
    returnAmount: BigNumber,
    returnAmountConsideringFees: BigNumber,
    marketSp: BigNumber,
    wrapOptions = {
        isEthSwap: false,
        wethAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    }
): SwapInfo {
    const tokenAddressesSet: Set<string> = new Set();

    const swaps: Swap[][] = JSON.parse(JSON.stringify(swapsOriginal));

    let tokenInDecimals: number;
    let tokenOutDecimals: number;

    let swapInfo: SwapInfo = {
        tokenAddresses: [],
        swaps: [],
        swapAmount: ZERO,
        returnAmount: ZERO,
        returnAmountConsideringFees: ZERO,
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
                if (swap.tokenIn === WETH) swap.tokenIn = ZERO_ADDRESS;
                if (swap.tokenOut === WETH) swap.tokenOut = ZERO_ADDRESS;
            }
            tokenAddressesSet.add(swap.tokenIn);
            tokenAddressesSet.add(swap.tokenOut);
        });
    });

    const tokenArray = [...tokenAddressesSet];

    if (swapType === SwapTypes.SwapExactIn) {
        const swapsV2: SwapV2[] = [];

        let totalSwapAmount = ZERO;
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
                    amountScaled = scale(
                        bnum(swap.swapAmount),
                        swap.tokenInDecimals
                    )
                        .decimalPlaces(0, 1)
                        .toString();
                    totalSwapAmount = totalSwapAmount.plus(amountScaled);
                }

                const inIndex = tokenArray.indexOf(swap.tokenIn);
                const outIndex = tokenArray.indexOf(swap.tokenOut);
                const swapV2: SwapV2 = {
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
        let swapAmountScaled = scale(swapAmount, tokenInDecimals);
        let dust = swapAmountScaled.minus(totalSwapAmount).dp(0, 0);
        if (dust.gt(0))
            swapsV2[0].amount = bnum(swapsV2[0].amount)
                .plus(dust)
                .toString();

        swapInfo.swapAmount = swapAmountScaled;
        // Using this split to remove any decimals
        swapInfo.returnAmount = bnum(
            scale(returnAmount, tokenOutDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.returnAmountConsideringFees = bnum(
            scale(returnAmountConsideringFees, tokenOutDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.swaps = swapsV2;
    } else {
        let swapsV2: SwapV2[] = [];
        let totalSwapAmount = ZERO;
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
                    assetInIndex: inIndex,
                    assetOutIndex: outIndex,
                    amount: '0', // For a multihop the first swap in sequence should be last in order and have amt = 0
                    userData: '0x',
                };

                if (i == 0 && sequence.length > 1) {
                    sequenceSwaps[1] = swapV2; // Make the swap the last in V2 order for the sequence
                } else {
                    let amountScaled = scale(
                        bnum(swap.swapAmount),
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
        let swapAmountScaled = scale(swapAmount, tokenOutDecimals);
        let dust = swapAmountScaled.minus(totalSwapAmount).dp(0, 0);
        if (dust.gt(0))
            swapsV2[0].amount = bnum(swapsV2[0].amount)
                .plus(dust)
                .toString();

        swapInfo.swapAmount = swapAmountScaled;
        // Using this split to remove any decimals
        swapInfo.returnAmount = bnum(
            scale(returnAmount, tokenInDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.returnAmountConsideringFees = bnum(
            scale(returnAmountConsideringFees, tokenInDecimals)
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
