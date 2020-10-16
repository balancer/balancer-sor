'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bignumber_1 = require('./utils/bignumber');
const address_1 = require('@ethersproject/address');
const bmath_1 = require('./bmath');
const disabledTokensDefault = require('./disabled-tokens.json');
function toChecksum(address) {
    return address_1.getAddress(address);
}
exports.toChecksum = toChecksum;
function getLimitAmountSwap(poolPairData, swapType) {
    if (swapType === 'swapExactIn') {
        return bmath_1.bmul(poolPairData.balanceIn, bmath_1.MAX_IN_RATIO);
    } else {
        return bmath_1.bmul(poolPairData.balanceOut, bmath_1.MAX_OUT_RATIO);
    }
}
exports.getLimitAmountSwap = getLimitAmountSwap;
function getLimitAmountSwapPath(pools, path, swapType, poolPairData) {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let id = `${swaps[0].pool}${swaps[0].tokenIn}${swaps[0].tokenOut}`;
        let poolPairDataSwap1 = poolPairData[id];
        return getLimitAmountSwap(poolPairDataSwap1.poolPairData, swapType);
    } else if (swaps.length == 2) {
        let id = `${swaps[0].pool}${swaps[0].tokenIn}${swaps[0].tokenOut}`;
        let poolPairDataSwap1 = poolPairData[id];
        id = `${swaps[1].pool}${swaps[1].tokenIn}${swaps[1].tokenOut}`;
        let poolPairDataSwap2 = poolPairData[id];
        if (swapType === 'swapExactIn') {
            return bignumber_1.BigNumber.min(
                // The limit is either set by limit_IN of poolPairData 1 or indirectly by limit_IN of poolPairData 2
                getLimitAmountSwap(poolPairDataSwap1.poolPairData, swapType),
                bmath_1.bmul(
                    getLimitAmountSwap(
                        poolPairDataSwap2.poolPairData,
                        swapType
                    ),
                    poolPairDataSwap1.sp
                ) // we need to multiply the limit_IN of
                // poolPairData 2 by the spotPrice of poolPairData 1 to get the equivalent in token IN
            );
        } else {
            return bignumber_1.BigNumber.min(
                // The limit is either set by limit_OUT of poolPairData 2 or indirectly by limit_OUT of poolPairData 1
                getLimitAmountSwap(poolPairDataSwap2.poolPairData, swapType),
                bmath_1.bdiv(
                    getLimitAmountSwap(
                        poolPairDataSwap1.poolPairData,
                        swapType
                    ),
                    poolPairDataSwap2.sp
                ) // we need to divide the limit_OUT of
                // poolPairData 1 by the spotPrice of poolPairData 2 to get the equivalent in token OUT
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}
exports.getLimitAmountSwapPath = getLimitAmountSwapPath;
function getSpotPricePath(pools, path, poolPairData) {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let id = `${swaps[0].pool}${swaps[0].tokenIn}${swaps[0].tokenOut}`;
        let poolPairDataSwap1 = poolPairData[id];
        return poolPairDataSwap1.sp;
    } else if (swaps.length == 2) {
        let id = `${swaps[0].pool}${swaps[0].tokenIn}${swaps[0].tokenOut}`;
        let poolPairDataSwap1 = poolPairData[id];
        id = `${swaps[1].pool}${swaps[1].tokenIn}${swaps[1].tokenOut}`;
        let poolPairDataSwap2 = poolPairData[id];
        return bmath_1.bmul(poolPairDataSwap1.sp, poolPairDataSwap2.sp);
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}
exports.getSpotPricePath = getSpotPricePath;
function getSpotPrice(poolPairData) {
    let inRatio = bmath_1.bdiv(poolPairData.balanceIn, poolPairData.weightIn);
    let outRatio = bmath_1.bdiv(
        poolPairData.balanceOut,
        poolPairData.weightOut
    );
    if (outRatio.isEqualTo(bmath_1.bnum(0))) {
        return bmath_1.bnum(0);
    } else {
        return bmath_1.bdiv(
            bmath_1.bdiv(inRatio, outRatio),
            bmath_1.BONE.minus(poolPairData.swapFee)
        );
    }
}
exports.getSpotPrice = getSpotPrice;
function getSlippageLinearizedSpotPriceAfterSwapPath(
    pools,
    path,
    swapType,
    poolPairData
) {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let id = `${swaps[0].pool}${swaps[0].tokenIn}${swaps[0].tokenOut}`;
        let poolPairDataSwap1 = poolPairData[id].poolPairData;
        return getSlippageLinearizedSpotPriceAfterSwap(
            poolPairDataSwap1,
            swapType
        );
    } else if (swaps.length == 2) {
        let id = `${swaps[0].pool}${swaps[0].tokenIn}${swaps[0].tokenOut}`;
        let p1 = poolPairData[id].poolPairData;
        id = `${swaps[1].pool}${swaps[1].tokenIn}${swaps[1].tokenOut}`;
        let p2 = poolPairData[id].poolPairData;
        if (
            p1.balanceIn.isEqualTo(bmath_1.bnum(0)) ||
            p2.balanceIn.isEqualTo(bmath_1.bnum(0))
        ) {
            return bmath_1.bnum(0);
        } else {
            // Since the numerator is the same for both 'swapExactIn' and 'swapExactOut' we do this first
            // See formulas on https://one.wolframcloud.com/env/fernando.martinel/SOR_multihop_analysis.nb
            let numerator1 = bmath_1.bmul(
                bmath_1.bmul(
                    bmath_1.bmul(
                        bmath_1.BONE.minus(p1.swapFee),
                        bmath_1.BONE.minus(p2.swapFee)
                    ), // In mathematica both terms are the negative (which compensates)
                    p1.balanceOut
                ),
                bmath_1.bmul(p1.weightIn, p2.weightIn)
            );
            let numerator2 = bmath_1.bmul(
                bmath_1.bmul(
                    p1.balanceOut.plus(p2.balanceIn),
                    bmath_1.BONE.minus(p1.swapFee) // In mathematica this is the negative but we add (instead of subtracting) numerator2 to compensate
                ),
                bmath_1.bmul(p1.weightIn, p2.weightOut)
            );
            let numerator3 = bmath_1.bmul(
                p2.balanceIn,
                bmath_1.bmul(p1.weightOut, p2.weightOut)
            );
            let numerator = numerator1.plus(numerator2).plus(numerator3);
            // The denominator is different for 'swapExactIn' and 'swapExactOut'
            if (swapType === 'swapExactIn') {
                let denominator1 = bmath_1.bmul(p1.balanceIn, p1.weightOut);
                let denominator2 = bmath_1.bmul(p2.balanceIn, p2.weightOut);
                return bmath_1.bdiv(
                    bmath_1.bdiv(numerator, denominator1),
                    denominator2
                );
            } else {
                let denominator1 = bmath_1.bmul(
                    bmath_1.BONE.minus(p1.swapFee),
                    bmath_1.bmul(p1.balanceOut, p1.weightIn)
                );
                let denominator2 = bmath_1.bmul(
                    bmath_1.BONE.minus(p2.swapFee),
                    bmath_1.bmul(p2.balanceOut, p2.weightIn)
                );
                return bmath_1.bdiv(
                    bmath_1.bdiv(numerator, denominator1),
                    denominator2
                );
            }
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}
exports.getSlippageLinearizedSpotPriceAfterSwapPath = getSlippageLinearizedSpotPriceAfterSwapPath;
function getSlippageLinearizedSpotPriceAfterSwap(poolPairData, swapType) {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bmath_1.bnum(0))) {
            return bmath_1.bnum(0);
        } else {
            return bmath_1.bdiv(
                bmath_1
                    .bmul(
                        bmath_1.BONE.minus(swapFee),
                        bmath_1.bdiv(weightIn, weightOut)
                    )
                    .plus(bmath_1.BONE),
                balanceIn
            );
        }
    } else {
        if (balanceOut.isEqualTo(bmath_1.bnum(0))) {
            return bmath_1.bnum(0);
        } else {
            return bmath_1.bdiv(
                bmath_1
                    .bdiv(
                        weightOut,
                        bmath_1.bmul(bmath_1.BONE.minus(swapFee), weightIn)
                    )
                    .plus(bmath_1.BONE),
                balanceOut
            );
        }
    }
}
exports.getSlippageLinearizedSpotPriceAfterSwap = getSlippageLinearizedSpotPriceAfterSwap;
function getReturnAmountSwapPath(pools, path, swapType, amount) {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = exports.parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return getReturnAmountSwap(pools, poolPairDataSwap1, swapType, amount);
    } else if (swaps.length == 2) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = exports.parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        let swap2 = swaps[1];
        let poolSwap2 = pools[swap2.pool];
        let poolPairDataSwap2 = exports.parsePoolPairData(
            poolSwap2,
            swap2.tokenIn,
            swap2.tokenOut
        );
        if (swapType === 'swapExactIn') {
            // The outputAmount is number of tokenOut we receive from the second poolPairData
            let returnAmountSwap1 = getReturnAmountSwap(
                pools,
                poolPairDataSwap1,
                swapType,
                amount
            );
            return getReturnAmountSwap(
                pools,
                poolPairDataSwap2,
                swapType,
                returnAmountSwap1
            );
        } else {
            // The outputAmount is number of tokenIn we send to the first poolPairData
            let returnAmountSwap2 = getReturnAmountSwap(
                pools,
                poolPairDataSwap2,
                swapType,
                amount
            );
            return getReturnAmountSwap(
                pools,
                poolPairDataSwap1,
                swapType,
                returnAmountSwap2
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}
exports.getReturnAmountSwapPath = getReturnAmountSwapPath;
function getReturnAmountSwap(pools, poolPairData, swapType, amount) {
    let {
        weightIn,
        weightOut,
        balanceIn,
        balanceOut,
        swapFee,
        tokenIn,
        tokenOut,
    } = poolPairData;
    let returnAmount;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bmath_1.bnum(0))) {
            return bmath_1.bnum(0);
        } else {
            returnAmount = bmath_1.calcOutGivenIn(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                amount,
                swapFee
            );
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
        if (balanceOut.isEqualTo(bmath_1.bnum(0))) {
            return bmath_1.bnum(0);
        } else {
            returnAmount = bmath_1.calcInGivenOut(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                amount,
                swapFee
            );
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
exports.getReturnAmountSwap = getReturnAmountSwap;
// Updates the balance of a given token for a given pool passed as parameter
function updateTokenBalanceForPool(pool, token, balance) {
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
exports.updateTokenBalanceForPool = updateTokenBalanceForPool;
// Based on the function of same name of file onchain-sor in file: BRegistry.sol
// Normalized liquidity is not used in any calculationf, but instead for comparison between poolPairDataList only
// so we can find the most liquid poolPairData considering the effect of uneven weigths
function getNormalizedLiquidity(poolPairData) {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    return bmath_1.bdiv(
        bmath_1.bmul(balanceOut, weightIn),
        weightIn.plus(weightOut)
    );
}
exports.getNormalizedLiquidity = getNormalizedLiquidity;
// LEGACY FUNCTION - Keep Input/Output Format
exports.parsePoolData = (
    directPools,
    tokenIn,
    tokenOut,
    mostLiquidPoolsFirstHop = [],
    mostLiquidPoolsSecondHop = [],
    hopTokens = []
) => {
    let pathDataList = [];
    let pools = {};
    // First add direct pair paths
    for (let idKey in directPools) {
        let p = directPools[idKey];
        // Add pool to the set with all pools (only adds if it's still not present in dict)
        pools[idKey] = p;
        let swap = {
            pool: p.id,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
        };
        let path = {
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
        let swap1 = {
            pool: mostLiquidPoolsFirstHop[i].id,
            tokenIn: tokenIn,
            tokenOut: hopTokens[i],
        };
        let swap2 = {
            pool: mostLiquidPoolsSecondHop[i].id,
            tokenIn: hopTokens[i],
            tokenOut: tokenOut,
        };
        let path = {
            id: mostLiquidPoolsFirstHop[i].id + mostLiquidPoolsSecondHop[i].id,
            swaps: [swap1, swap2],
        };
        pathDataList.push(path);
    }
    return [pools, pathDataList];
};
exports.parsePoolPairData = (p, tokenIn, tokenOut) => {
    let tI = p.tokens.find(
        t => address_1.getAddress(t.address) === address_1.getAddress(tokenIn)
    );
    // console.log("tI")
    // console.log(tI.balance.toString());
    // console.log(tI)
    let tO = p.tokens.find(
        t => address_1.getAddress(t.address) === address_1.getAddress(tokenOut)
    );
    // console.log("tO")
    // console.log(tO.balance.toString());
    // console.log(tO)
    let poolPairData = {
        id: p.id,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        decimalsIn: tI.decimals,
        decimalsOut: tO.decimals,
        balanceIn: bmath_1.bnum(tI.balance),
        balanceOut: bmath_1.bnum(tO.balance),
        weightIn: bmath_1.scale(
            bmath_1.bnum(tI.denormWeight).div(bmath_1.bnum(p.totalWeight)),
            18
        ),
        weightOut: bmath_1.scale(
            bmath_1.bnum(tO.denormWeight).div(bmath_1.bnum(p.totalWeight)),
            18
        ),
        swapFee: bmath_1.bnum(p.swapFee),
    };
    return poolPairData;
};
function filterPoolsWithoutToken(pools, token) {
    let found;
    let OutputPools = {};
    for (let i in pools) {
        found = false;
        for (let k = 0; k < pools[i].tokensList.length; k++) {
            if (pools[i].tokensList[k].toLowerCase() == token.toLowerCase()) {
                found = true;
                break;
            }
        }
        //Add pool if token not found
        if (!found) OutputPools[i] = pools[i];
    }
    return OutputPools;
}
// Inputs:
// - pools: All pools that contain a token
// - token: Token for which we are looking for pairs
// Outputs:
// - tokens: Set (without duplicate elements) of all tokens that pair with token
function getTokensPairedToTokenWithinPools(pools, token) {
    let found;
    let tokens = new Set();
    for (let i in pools) {
        found = false;
        for (let k = 0; k < pools[i].tokensList.length; k++) {
            if (
                address_1.getAddress(pools[i].tokensList[k]) !=
                    address_1.getAddress(token) &&
                pools[i].tokens.find(
                    t =>
                        address_1.getAddress(t.address) ===
                        address_1.getAddress(pools[i].tokensList[k])
                ).balance != 0
            ) {
                tokens.add(pools[i].tokensList[k]);
            }
        }
    }
    return tokens;
}
// Returns two arrays
// First array contains all tokens in direct pools containing tokenIn
// Second array contains all tokens in multi-hop pools containing tokenIn
function getTokenPairsMultiHop(token, poolsTokensListSet) {
    let poolsWithToken = [];
    let poolsWithoutToken = [];
    let directTokenPairsSet = new Set();
    // If pool contains token add all its tokens to direct list
    poolsTokensListSet.forEach((poolTokenList, index) => {
        if (poolTokenList.includes(token)) {
            poolsWithToken.push(poolTokenList);
        } else {
            poolsWithoutToken.push(poolTokenList);
        }
    });
    directTokenPairsSet = new Set([].concat(...poolsWithToken));
    let multihopTokenPools = [];
    let multihopTokenPairsSet = new Set();
    poolsWithoutToken.forEach((pool, index) => {
        let intersection = [...pool].filter(x =>
            [...directTokenPairsSet].includes(x)
        );
        if (intersection.length != 0) {
            multihopTokenPools.push(pool);
        }
    });
    multihopTokenPairsSet = new Set([].concat(...multihopTokenPools));
    let allTokenPairsSet = new Set();
    allTokenPairsSet = new Set([
        ...directTokenPairsSet,
        ...multihopTokenPairsSet,
    ]);
    let directTokenPairs = [...directTokenPairsSet];
    let allTokenPairs = [...allTokenPairsSet];
    return [directTokenPairs, allTokenPairs];
}
exports.getTokenPairsMultiHop = getTokenPairsMultiHop;
// Filters all pools data to find pools that have both tokens
// TODO: Check for balance > 0
function filterPoolsWithTokensDirect(
    allPools, // The complete information of the pools
    tokenIn,
    tokenOut,
    disabledOptions = { isOverRide: false, disabledTokens: [] }
) {
    let poolsWithTokens = {};
    // If pool contains token add all its tokens to direct list
    let disabledTokens = disabledTokensDefault.tokens;
    if (disabledOptions.isOverRide)
        disabledTokens = disabledOptions.disabledTokens;
    allPools.forEach(pool => {
        let tokenListSet = new Set(pool.tokensList);
        disabledTokens.forEach(token => tokenListSet.delete(token.address));
        if (tokenListSet.has(tokenIn) && tokenListSet.has(tokenOut)) {
            poolsWithTokens[pool.id] = pool;
        }
    });
    return poolsWithTokens;
}
exports.filterPoolsWithTokensDirect = filterPoolsWithTokensDirect;
// Returns two pool lists. One with all pools containing tokenOne and not tokenTwo and one with tokenTwo not tokenOn.
function filterPoolsWithoutMutualTokens(
    allPools,
    tokenOne,
    tokenTwo,
    disabledTokens = []
) {
    let tokenOnePools = {};
    let tokenTwoPools = {};
    let tokenOnePairedTokens = new Set();
    let tokenTwoPairedTokens = new Set();
    allPools.forEach(pool => {
        let poolTokensSET = new Set(pool.tokensList);
        disabledTokens.forEach(token => poolTokensSET.delete(token.address));
        if (poolTokensSET.size < 2) {
            return;
        }
        let containsTokenOne = poolTokensSET.has(tokenOne);
        let containsTokenTwo = poolTokensSET.has(tokenTwo);
        if (containsTokenOne && !containsTokenTwo) {
            tokenOnePairedTokens = new Set([
                ...tokenOnePairedTokens,
                ...poolTokensSET,
            ]);
            tokenOnePools[pool.id] = pool;
        } else if (!containsTokenOne && containsTokenTwo) {
            tokenTwoPairedTokens = new Set([
                ...tokenTwoPairedTokens,
                ...poolTokensSET,
            ]);
            tokenTwoPools[pool.id] = pool;
        }
    });
    return [
        tokenOnePools,
        tokenOnePairedTokens,
        tokenTwoPools,
        tokenTwoPairedTokens,
    ];
}
exports.filterPoolsWithoutMutualTokens = filterPoolsWithoutMutualTokens;
// Replacing getMultihopPoolsWithTokens
function filterPoolsWithTokensMultihop(
    allPools, // Just the list of pool tokens
    tokenIn,
    tokenOut,
    disabledOptions = { isOverRide: false, disabledTokens: [] }
) {
    //// Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let poolsTokenInNoTokenOut;
    let tokenInHopTokens;
    let poolsTokenOutNoTokenIn;
    let tokenOutHopTokens;
    let disabledTokens = disabledTokensDefault.tokens;
    if (disabledOptions.isOverRide)
        disabledTokens = disabledOptions.disabledTokens;
    // STOPPED HERE: poolsTokenInNoTokenOut NEEDS
    [
        poolsTokenInNoTokenOut,
        tokenInHopTokens,
        poolsTokenOutNoTokenIn,
        tokenOutHopTokens,
    ] = filterPoolsWithoutMutualTokens(
        allPools,
        tokenIn,
        tokenOut,
        disabledTokens
    );
    // Third: we find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    const hopTokensSet = [...tokenInHopTokens].filter(x =>
        tokenOutHopTokens.has(x)
    );
    // Transform set into Array
    const hopTokens = [...hopTokensSet];
    // console.log(hopTokens);
    // Find the most liquid pool for each pair (tokenIn -> hopToken). We store an object in the form:
    // mostLiquidPoolsFirstHop = {hopToken1: mostLiquidPool, hopToken2: mostLiquidPool, ... , hopTokenN: mostLiquidPool}
    // Here we could query subgraph for all pools with pair (tokenIn -> hopToken), but to
    // minimize subgraph calls we loop through poolsTokenInNoTokenOut, and check the liquidity
    // only for those that have hopToken
    let mostLiquidPoolsFirstHop = [];
    for (let i = 0; i < hopTokens.length; i++) {
        let highestNormalizedLiquidity = bmath_1.bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (let k in poolsTokenInNoTokenOut) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenInNoTokenOut[k].tokensList).has(hopTokens[i])
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    exports.parsePoolPairData(
                        poolsTokenInNoTokenOut[k],
                        tokenIn,
                        hopTokens[i].toString()
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
        mostLiquidPoolsFirstHop[i] =
            poolsTokenInNoTokenOut[highestNormalizedLiquidityPoolId];
        // console.log(highestNormalizedLiquidity)
        // console.log(mostLiquidPoolsFirstHop)
    }
    // console.log('mostLiquidPoolsFirstHop');
    // console.log(mostLiquidPoolsFirstHop);
    // Now similarly find the most liquid pool for each pair (hopToken -> tokenOut)
    let mostLiquidPoolsSecondHop = [];
    for (let i = 0; i < hopTokens.length; i++) {
        let highestNormalizedLiquidity = bmath_1.bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (let k in poolsTokenOutNoTokenIn) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenOutNoTokenIn[k].tokensList).has(hopTokens[i])
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    exports.parsePoolPairData(
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
        // console.log(highestNormalizedLiquidity)
        // console.log(mostLiquidPoolsSecondHop)
    }
    return [mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens];
}
exports.filterPoolsWithTokensMultihop = filterPoolsWithTokensMultihop;
exports.formatSubgraphPools = pools => {
    for (let pool of pools.pools) {
        pool.swapFee = bmath_1.scale(bmath_1.bnum(pool.swapFee), 18);
        pool.totalWeight = bmath_1.scale(bmath_1.bnum(pool.totalWeight), 18);
        pool.tokens.forEach(token => {
            token.balance = bmath_1.scale(
                bmath_1.bnum(token.balance),
                token.decimals
            );
            token.denormWeight = bmath_1.scale(
                bmath_1.bnum(token.denormWeight),
                18
            );
        });
    }
};
function filterPools(
    allPools, // The complete information of the pools
    tokenIn,
    tokenOut,
    disabledOptions = { isOverRide: false, disabledTokens: [] }
) {
    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let poolsDirect = {};
    let poolsTokenOne = {};
    let poolsTokenTwo = {};
    let tokenInPairedTokens = new Set();
    let tokenOutPairedTokens = new Set();
    let disabledTokens = disabledTokensDefault.tokens;
    if (disabledOptions.isOverRide)
        disabledTokens = disabledOptions.disabledTokens;
    allPools.forEach(pool => {
        let tokenListSet = new Set(pool.tokensList);
        disabledTokens.forEach(token => tokenListSet.delete(token.address));
        if (tokenListSet.has(tokenIn) && tokenListSet.has(tokenOut)) {
            poolsDirect[pool.id] = pool;
            return;
        }
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
    });
    // We find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    const hopTokensSet = [...tokenInPairedTokens].filter(x =>
        tokenOutPairedTokens.has(x)
    );
    // Transform set into Array
    const hopTokens = [...hopTokensSet];
    return [poolsDirect, hopTokens, poolsTokenOne, poolsTokenTwo];
}
exports.filterPools = filterPools;
function sortPoolsMostLiquid(
    tokenIn,
    tokenOut,
    hopTokens,
    poolsTokenInNoTokenOut,
    poolsTokenOutNoTokenIn
) {
    // Find the most liquid pool for each pair (tokenIn -> hopToken). We store an object in the form:
    // mostLiquidPoolsFirstHop = {hopToken1: mostLiquidPool, hopToken2: mostLiquidPool, ... , hopTokenN: mostLiquidPool}
    // Here we could query subgraph for all pools with pair (tokenIn -> hopToken), but to
    // minimize subgraph calls we loop through poolsTokenInNoTokenOut, and check the liquidity
    // only for those that have hopToken
    let mostLiquidPoolsFirstHop = [];
    let mostLiquidPoolsSecondHop = [];
    let poolPair = {}; // Store pair liquidity incase it is reused
    for (let i = 0; i < hopTokens.length; i++) {
        let highestNormalizedLiquidityFirst = bmath_1.bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityFirstPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (let k in poolsTokenInNoTokenOut) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenInNoTokenOut[k].tokensList).has(hopTokens[i])
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    exports.parsePoolPairData(
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
        let highestNormalizedLiquidity = bmath_1.bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (let k in poolsTokenOutNoTokenIn) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenOutNoTokenIn[k].tokensList).has(hopTokens[i])
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    exports.parsePoolPairData(
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
exports.sortPoolsMostLiquid = sortPoolsMostLiquid;
function checkSwapsExactIn(
    swaps,
    tokenIn,
    tokenOut,
    amountIn,
    totalAmtOut,
    allPoolsNonZeroBalances
) {
    let totalOut = bmath_1.bnum(0);
    for (let i = 0; i < swaps.length; i++) {
        if (swaps[i].length === 1) {
            let amtOutFirstSequence = calcOutGivenInForPool(
                allPoolsNonZeroBalances,
                swaps[i][0].pool,
                swaps[i][0].tokenIn,
                swaps[i][0].tokenOut,
                bmath_1.bnum(swaps[i][0].swapAmount)
            );
            totalOut = totalOut.plus(amtOutFirstSequence);
        } else {
            let amtOutFirstSequence = calcOutGivenInForPool(
                allPoolsNonZeroBalances,
                swaps[i][0].pool,
                swaps[i][0].tokenIn,
                swaps[i][0].tokenOut,
                bmath_1.bnum(swaps[i][0].swapAmount)
            );
            if (!amtOutFirstSequence.eq(bmath_1.bnum(swaps[i][1].swapAmount))) {
                swaps[i][1].swapAmount = amtOutFirstSequence.toString();
            }
            let amtOutSecondSequence = calcOutGivenInForPool(
                allPoolsNonZeroBalances,
                swaps[i][1].pool,
                swaps[i][1].tokenIn,
                swaps[i][1].tokenOut,
                bmath_1.bnum(swaps[i][1].swapAmount)
            );
            totalOut = totalOut.plus(amtOutSecondSequence);
        }
    }
    if (!totalOut.eq(totalAmtOut)) {
        return [swaps, totalOut];
    }
    return [swaps, totalAmtOut];
}
exports.checkSwapsExactIn = checkSwapsExactIn;
function calcOutGivenInForPool(Pools, PoolAddr, TokenIn, TokenOut, AmtIn) {
    const swapPool = Pools.pools.find(p => p.id === PoolAddr);
    let pool = exports.parsePoolPairData(swapPool, TokenIn, TokenOut);
    const amtOut = bmath_1.calcOutGivenIn(
        pool.balanceIn,
        pool.weightIn,
        pool.balanceOut,
        pool.weightOut,
        AmtIn,
        pool.swapFee
    );
    return amtOut;
}
function checkSwapsExactOut(
    swaps,
    tokenIn,
    tokenOut,
    amountOut,
    totalAmtIn,
    allPoolsNonZeroBalances
) {
    let totalOut = bmath_1.bnum(0);
    let totalIn = bmath_1.bnum(0);
    for (let i = 0; i < swaps.length; i++) {
        if (swaps[i].length === 1) {
            totalOut = totalOut.plus(swaps[i][0].swapAmount);
            let amtInFirstSequence = calcInGivenOutForPool(
                allPoolsNonZeroBalances,
                swaps[i][0].pool,
                swaps[i][0].tokenIn,
                swaps[i][0].tokenOut,
                bmath_1.bnum(swaps[i][0].swapAmount)
            );
            totalIn = totalIn.plus(amtInFirstSequence);
        } else {
            let amtInSecondSequence = calcInGivenOutForPool(
                allPoolsNonZeroBalances,
                swaps[i][1].pool,
                swaps[i][1].tokenIn,
                swaps[i][1].tokenOut,
                swaps[i][1].swapAmount
            );
            // Amount out of first swap which is input to second swap
            if (!amtInSecondSequence.eq(bmath_1.bnum(swaps[i][0].swapAmount))) {
                swaps[i][0].swapAmount = amtInSecondSequence.toString();
            }
            totalOut = totalOut.plus(swaps[i][1].swapAmount);
            let amtInFirstSequence = calcInGivenOutForPool(
                allPoolsNonZeroBalances,
                swaps[i][0].pool,
                swaps[i][0].tokenIn,
                swaps[i][0].tokenOut,
                bmath_1.bnum(swaps[i][0].swapAmount)
            ); // Swap amount is amount out
            totalIn = totalIn.plus(amtInFirstSequence);
        }
    }
    if (!totalOut.eq(amountOut)) {
        console.log(
            `Error With Amount Out During Correction - Defaulting To No Swaps`
        );
        swaps = [];
        return [swaps, bmath_1.bnum(0)];
    }
    if (!totalIn.eq(totalAmtIn)) {
        return [swaps, totalIn];
    }
    return [swaps, totalAmtIn];
}
exports.checkSwapsExactOut = checkSwapsExactOut;
function calcInGivenOutForPool(Pools, PoolAddr, TokenIn, TokenOut, AmtIn) {
    const swapPool = Pools.pools.find(p => p.id === PoolAddr);
    let pool = exports.parsePoolPairData(swapPool, TokenIn, TokenOut);
    const amtOut = bmath_1.calcInGivenOut(
        pool.balanceIn,
        pool.weightIn,
        pool.balanceOut,
        pool.weightOut,
        AmtIn,
        pool.swapFee
    );
    return amtOut;
}
exports.calcInGivenOutForPool = calcInGivenOutForPool;
function getPoolsFromSwaps(Swaps, subGraphPools) {
    let pools = { pools: [] };
    Swaps.forEach(swapSeq => {
        if (swapSeq.length === 1) {
            let pool = subGraphPools.pools.find(p => p.id === swapSeq[0].pool);
            pools.pools.push(pool);
        } else {
            let pool = subGraphPools.pools.find(p => p.id === swapSeq[0].pool);
            pools.pools.push(pool);
            pool = subGraphPools.pools.find(p => p.id === swapSeq[1].pool);
            pools.pools.push(pool);
        }
    });
    return pools;
}
exports.getPoolsFromSwaps = getPoolsFromSwaps;
