import {
    BigNumber as OldBigNumber,
    ZERO,
    INFINITY,
    scale,
    bnum,
} from '../utils/bignumber';
import { getOutputAmountSwap } from '../pools';
import { INFINITESIMAL } from '../config';
import {
    NewPath,
    SwapTypes,
    PoolBase,
    PoolPairBase,
    PoolTypes,
} from '../types';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';

export function getHighestLimitAmountsForPaths(
    paths: NewPath[],
    maxPools: number
): BigNumber[] {
    if (paths.length === 0) return [];
    const limitAmounts: BigNumber[] = [];
    for (let i = 0; i < maxPools; i++) {
        if (i < paths.length) {
            const limitAmount = paths[i].limitAmount;
            limitAmounts.push(limitAmount);
        }
    }
    return limitAmounts;
}

export function getEffectivePriceSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: OldBigNumber,
    inputDecimals: number
): OldBigNumber {
    if (amount.lt(INFINITESIMAL)) {
        // Return spot price as code below would be 0/0 = undefined
        // or small_amount/0 or 0/small_amount which would cause bugs
        return getSpotPriceAfterSwapForPath(path, swapType, amount);
    }
    const outputAmountSwap = getOutputAmountSwapForPath(
        path,
        swapType,
        amount,
        inputDecimals
    );
    if (swapType === SwapTypes.SwapExactIn) {
        return amount.div(outputAmountSwap); // amountIn/AmountOut
    } else {
        return outputAmountSwap.div(amount); // amountIn/AmountOut
    }
}

export function getOutputAmountSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: OldBigNumber,
    inputDecimals: number
): OldBigNumber {
    // First of all check if the amount is above limit, if so, return 0 for
    // 'swapExactIn' or Inf for swapExactOut
    if (amount.gt(bnum(formatFixed(path.limitAmount, inputDecimals)))) {
        if (swapType === SwapTypes.SwapExactIn) {
            return ZERO;
        } else {
            return INFINITY;
        }
    }

    const amounts = getAmounts(path, swapType, amount);
    if (swapType === SwapTypes.SwapExactIn) {
        return amounts[amounts.length - 1];
    } else {
        return amounts[0];
    }
}

function getAmounts(
    path: NewPath,
    swapType: SwapTypes,
    amount: OldBigNumber
): OldBigNumber[] {
    const pools = path.pools;
    const poolPairData = path.poolPairData;
    const ans = [amount];

    if (swapType === SwapTypes.SwapExactIn) {
        for (let i = 0; i < pools.length; i++) {
            ans.push(
                getOutputAmountSwap(
                    pools[i],
                    poolPairData[i],
                    swapType,
                    ans[ans.length - 1]
                )
            );
        }
    } else {
        const n = pools.length;
        for (let i = 0; i < pools.length; i++) {
            ans.unshift(
                getOutputAmountSwap(
                    pools[n - 1 - i],
                    poolPairData[n - 1 - i],
                    swapType,
                    ans[0]
                )
            );
        }
    }
    return ans;
}

function getProdsSpotPrices(
    path: NewPath,
    swapType: SwapTypes,
    amounts: OldBigNumber[]
): OldBigNumber[] {
    const pools = path.pools;
    const poolPairData = path.poolPairData;
    const ans = [bnum(1)];
    const n = pools.length;
    let oneIfExactOut = 0;
    if (swapType === SwapTypes.SwapExactOut) oneIfExactOut = 1;
    for (let i = 0; i < pools.length; i++) {
        ans.unshift(
            getSpotPriceAfterSwap(
                pools[n - 1 - i],
                poolPairData[n - 1 - i],
                swapType,
                amounts[n - 1 - i + oneIfExactOut]
            ).times(ans[0])
        );
    }
    return ans;
}

function getProdsFirstSpotPrices(
    path: NewPath,
    swapType: SwapTypes,
    amounts: OldBigNumber[]
): OldBigNumber[] {
    if (swapType !== SwapTypes.SwapExactOut)
        // Throw error?
        return [bnum(0)];

    const pools = path.pools;
    const poolPairData = path.poolPairData;
    const ans = [bnum(1)];
    for (let i = 0; i < pools.length; i++) {
        ans.push(
            getSpotPriceAfterSwap(
                pools[i],
                poolPairData[i],
                swapType,
                amounts[i + 1]
            ).times(ans[ans.length - 1])
        );
    }
    return ans;
}

export function getSpotPriceAfterSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: OldBigNumber
): OldBigNumber {
    const amounts = getAmounts(path, swapType, amount);
    const prodsSpotPrices = getProdsSpotPrices(path, swapType, amounts);
    return prodsSpotPrices[0];
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getSpotPriceAfterSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: OldBigNumber
): OldBigNumber {
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        }
        if (
            scale(amount, poolPairData.decimalsOut).gte(
                poolPairData.balanceOut.toString()
            )
        )
            return INFINITY;
    }
    if (swapType === SwapTypes.SwapExactIn) {
        return pool._spotPriceAfterSwapExactTokenInForTokenOut(
            poolPairData,
            amount
        );
    } else {
        return pool._spotPriceAfterSwapTokenInForExactTokenOut(
            poolPairData,
            amount
        );
    }
    throw Error('Unsupported swap');
}

export function getDerivativeSpotPriceAfterSwapForPath(
    path: NewPath,
    swapType: SwapTypes,
    amount: OldBigNumber
): OldBigNumber {
    const poolPairData = path.poolPairData;
    const pools = path.pools;
    const n = pools.length;

    const amounts = getAmounts(path, swapType, amount);
    const prodsSpotPrices = getProdsSpotPrices(path, swapType, amounts);
    let ans = bnum(0);
    if (swapType === SwapTypes.SwapExactIn) {
        for (let i = 0; i < n; i++) {
            const newTerm = getDerivativeSpotPriceAfterSwap(
                pools[i],
                poolPairData[i],
                swapType,
                amounts[i]
            ).times(prodsSpotPrices[i + 1]);
            ans = ans.plus(newTerm);
        }
    } else {
        const prodsFirstSpotPrices = getProdsFirstSpotPrices(
            path,
            swapType,
            amounts
        );
        for (let i = 0; i < n; i++) {
            let newTerm = getDerivativeSpotPriceAfterSwap(
                pools[i],
                poolPairData[i],
                swapType,
                amounts[i + 1]
            ).times(prodsSpotPrices[i + 1]);
            newTerm = newTerm
                .times(prodsSpotPrices[i + 1])
                .times(prodsFirstSpotPrices[i]);
            // The following option is more efficient but returns less precision due to the division
            /*          let thisSpotPrice = getSpotPriceAfterSwap(pools[i], poolPairData[i], swapType, amounts[i + 1]);
            newTerm = newTerm.div(thisSpotPrice).times(prodsSpotPrices[0]);*/
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
    amount: OldBigNumber
): OldBigNumber {
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        }
        if (
            scale(amount, poolPairData.decimalsOut).gte(
                poolPairData.balanceOut.toString()
            )
        )
            return INFINITY;
    }
    if (swapType === SwapTypes.SwapExactIn) {
        return pool._derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
            poolPairData,
            amount
        );
    } else {
        return pool._derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
            poolPairData,
            amount
        );
    }
    throw Error('Unsupported swap');
}

// We need do pass 'pools' here because this function has to update the pools state
// in case a pool is used twice in two different paths
export function EVMgetOutputAmountSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: OldBigNumber
): OldBigNumber {
    const { balanceIn, balanceOut, tokenIn, tokenOut } = poolPairData;

    let returnAmount: OldBigNumber;

    if (swapType === SwapTypes.SwapExactIn) {
        if (
            poolPairData.poolType !== PoolTypes.Linear &&
            poolPairData.balanceIn.isZero()
        ) {
            return ZERO;
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        }
        if (
            scale(amount, poolPairData.decimalsOut).gte(
                poolPairData.balanceOut.toString()
            )
        )
            return INFINITY;
    }
    if (swapType === SwapTypes.SwapExactIn) {
        // TODO we will be able to remove pooltype check once Element EVM maths is available
        if (
            pool.poolType === PoolTypes.Weighted ||
            pool.poolType === PoolTypes.Stable ||
            pool.poolType === PoolTypes.MetaStable ||
            pool.poolType === PoolTypes.Linear
        ) {
            // Will accept/return normalised values
            returnAmount = pool._exactTokenInForTokenOut(
                poolPairData,
                amount,
                true
            );
        } else if (pool.poolType === PoolTypes.Element) {
            // TODO this will just be part of above once maths available
            returnAmount = getOutputAmountSwap(
                pool,
                poolPairData,
                swapType,
                amount
            );
        } else {
            throw Error('Unsupported swap');
        }
    } else {
        // TODO we will be able to remove pooltype check once Element EVM maths is available
        if (
            pool.poolType === PoolTypes.Weighted ||
            pool.poolType === PoolTypes.Stable ||
            pool.poolType === PoolTypes.MetaStable ||
            pool.poolType === PoolTypes.Linear
        ) {
            returnAmount = pool._tokenInForExactTokenOut(
                poolPairData,
                amount,
                true
            );
        } else if (pool.poolType === PoolTypes.Element) {
            // TODO this will just be part of above once maths available
            returnAmount = getOutputAmountSwap(
                pool,
                poolPairData,
                swapType,
                amount
            );
        } else {
            throw Error('Unsupported swap');
        }
    }
    // Update balances of tokenIn and tokenOut
    pool.updateTokenBalanceForPool(
        tokenIn,
        balanceIn.add(
            parseFixed(
                returnAmount.dp(poolPairData.decimalsIn).toString(),
                poolPairData.decimalsIn
            )
        )
    );
    pool.updateTokenBalanceForPool(
        tokenOut,
        balanceOut.sub(
            parseFixed(
                amount.dp(poolPairData.decimalsOut).toString(),
                poolPairData.decimalsOut
            )
        )
    );

    return returnAmount;
}
