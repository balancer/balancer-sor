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

    let amounts = getAmounts(path, swapType, amount);
    if (swapType === SwapTypes.SwapExactIn) {
        return amounts[amounts.length - 1];
    } else {
        return amounts[0];
    }
}

function getAmounts(
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber[] {
    let pools = path.pools;
    let poolPairData = path.poolPairData;
    let ans = [amount];

    if (swapType === SwapTypes.SwapExactIn) {
        for (let i = 0; i < pools.length; i++){
            ans.push( getOutputAmountSwap(
                pools[i],
                poolPairData[i],
                swapType,
                ans[ans.length - 1]
            ) );
        }
    } else {
        let n = pools.length;
        for (let i = 0; i < pools.length; i++){
            ans.unshift( getOutputAmountSwap(
                pools[n - 1 - i],
                poolPairData[n - 1 - i],
                swapType,
                ans[0]
            ) );
        }
    }
    return ans;
}

function getProdsSpotPrices(
    path: NewPath,
    swapType: SwapTypes,
    amounts: BigNumber[]
): BigNumber[] {
    let pools = path.pools;
    let poolPairData = path.poolPairData;
    let ans = [bnum(1)];
    let n = pools.length;
    let oneIfExactOut = 0;
    if (swapType === SwapTypes.SwapExactOut) oneIfExactOut = 1;
    for (let i = 0; i < pools.length; i++){
        ans.unshift( getSpotPriceAfterSwap(
            pools[n - 1 - i],
            poolPairData[n - 1 - i],
            swapType,
            amounts[n - 1 - i + oneIfExactOut]
        ).times( ans[0] ) );
    }
    return ans;
}

export function getSpotPriceAfterSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    let amounts = getAmounts(path, swapType, amount);
    let prodsSpotPrices = getProdsSpotPrices(path, swapType, amounts);
    return prodsSpotPrices[0];
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
    let pools = path.pools;
    let n = pools.length;

    let amounts = getAmounts(path, swapType, amount);
    let prodsSpotPrices = getProdsSpotPrices(path, swapType, amounts);
    let ans = bnum(0);
    if (swapType === SwapTypes.SwapExactIn) {
        for (let i = 0; i < n; i++) {
            let newTerm = getDerivativeSpotPriceAfterSwap(
                pools[i],
                poolPairData[i],
                swapType,
                amounts[i]
            ).times(prodsSpotPrices[i + 1]);
            ans = ans.plus(newTerm);
        }
    } else {
        for (let i = 0; i < n; i++) {
            let newTerm = getDerivativeSpotPriceAfterSwap(
                pools[i],
                poolPairData[i],
                swapType,
                amounts[i + 1]
            ).times(prodsSpotPrices[i + 1]);
            let thisSpotPrice = getSpotPriceAfterSwap(
                pools[i], 
                poolPairData[i],
                swapType, 
                amounts[i + 1]);
            newTerm = newTerm.div(thisSpotPrice).times(prodsSpotPrices[0]);
// This gives a slightly different result than previous code, because of precision
// in the last division. The exact previous result can be obtained but it would be less efficient
            ans = ans.plus(newTerm);
        }
    }
    return ans;
}

// TODO: Add cases for pairType = [BPT->token, token->BPT] and poolType = [weighted, stable]
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
        let dust = swapAmountScaled.minus(totalSwapAmount);
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
        let dust = swapAmountScaled.minus(totalSwapAmount);
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
