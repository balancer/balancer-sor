'use strict';
var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function(resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator['throw'](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : adopt(result.value).then(fulfilled, rejected);
            }
            step(
                (generator = generator.apply(thisArg, _arguments || [])).next()
            );
        });
    };
Object.defineProperty(exports, '__esModule', { value: true });
const bignumber_1 = require('./utils/bignumber');
const ethers_1 = require('ethers');
const bmath_1 = require('./bmath');
const disabledTokensDefault = require('./disabled-tokens.json');
function toChecksum(address) {
    return ethers_1.ethers.utils.getAddress(address);
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
function getLimitAmountSwapPath(pools, path, swapType) {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = exports.parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return getLimitAmountSwap(poolPairDataSwap1, swapType);
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
            return bignumber_1.BigNumber.min(
                // The limit is either set by limit_IN of poolPairData 1 or indirectly by limit_IN of poolPairData 2
                getLimitAmountSwap(poolPairDataSwap1, swapType),
                bmath_1.bmul(
                    getLimitAmountSwap(poolPairDataSwap2, swapType),
                    getSpotPrice(poolPairDataSwap1)
                ) // we need to multiply the limit_IN of
                // poolPairData 2 by the spotPrice of poolPairData 1 to get the equivalent in token IN
            );
        } else {
            return bignumber_1.BigNumber.min(
                // The limit is either set by limit_OUT of poolPairData 2 or indirectly by limit_OUT of poolPairData 1
                getLimitAmountSwap(poolPairDataSwap2, swapType),
                bmath_1.bdiv(
                    getLimitAmountSwap(poolPairDataSwap1, swapType),
                    getSpotPrice(poolPairDataSwap2)
                ) // we need to divide the limit_OUT of
                // poolPairData 1 by the spotPrice of poolPairData 2 to get the equivalent in token OUT
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}
exports.getLimitAmountSwapPath = getLimitAmountSwapPath;
function getSpotPricePath(pools, path) {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = exports.parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return getSpotPrice(poolPairDataSwap1);
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
        return bmath_1.bmul(
            getSpotPrice(poolPairDataSwap1),
            getSpotPrice(poolPairDataSwap2)
        );
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
function getSlippageLinearizedSpotPriceAfterSwapPath(pools, path, swapType) {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = exports.parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return getSlippageLinearizedSpotPriceAfterSwap(
            poolPairDataSwap1,
            swapType
        );
    } else if (swaps.length == 2) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let p1 = exports.parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        let swap2 = swaps[1];
        let poolSwap2 = pools[swap2.pool];
        let p2 = exports.parsePoolPairData(
            poolSwap2,
            swap2.tokenIn,
            swap2.tokenOut
        );
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
            /*
            // !!!!!! ORIGINAL CODE
            if (swapType === 'swapExactIn') {
                let denominator = bmul(
                    bmul(p1.balanceIn, p2.balanceIn),
                    bmul(p1.weightOut, p2.weightOut)
                );

                return bdiv(numerator, denominator);
            } else {
                let denominator = bmul(
                    bmul(BONE.minus(p1.swapFee), BONE.minus(p2.swapFee)),
                    bmul(
                        bmul(p1.balanceOut, p2.balanceOut),
                        bmul(p1.weightIn, p2.weightIn)
                    )
                );

                return bdiv(numerator, denominator);
            }
            // !!!!!! ORIGINAL CODE
            */
            if (swapType === 'swapExactIn') {
                let p1scaled = bmath_1.scale(p1.balanceIn, -p1.decimalsIn);
                p1scaled = bmath_1.scale(p1scaled, 18);
                console.log(
                    `p1 scaled: ${p1scaled.toString()} ${p1.balanceIn.toString()}`
                );
                let p2scaled = bmath_1.scale(p2.balanceIn, -p2.decimalsIn);
                p2scaled = bmath_1.scale(p2scaled, 18);
                console.log(
                    `p2 scaled: ${p2scaled.toString()} ${p2.balanceIn.toString()}`
                );
                let product = bmath_1.bmul(p1scaled, p2scaled);
                console.log(`product: ${product.toString()}`);
                product = bmath_1.scale(product, -18);
                console.log(`product -18: ${product.toString()}`);
                product = bmath_1.scale(product, p1.decimalsIn);
                console.log(`product: ${product.toString()}`);
                console.log(
                    `product old: ${bmath_1
                        .bmul(p1.balanceIn, p2.balanceIn)
                        .toString()}`
                );
                let denominator = bmath_1.bmul(
                    product, // bmul(p1.balanceIn, p2.balanceIn),
                    bmath_1.bmul(p1.weightOut, p2.weightOut)
                );
                console.log(`!!!!!!! denominator in ${denominator.toString()}`);
                console.log(
                    `!!!!!!! weights ${p1.weightOut.toString()} ${p2.weightOut.toString()}`
                );
                console.log(
                    `!!!!!!! weights ${bmath_1
                        .bmul(p1.weightOut, p2.weightOut)
                        .toString()}`
                );
                // !!!!!!! balances 816367 51702390  (WBTC, 8decimals x USDC, 6decimals)
                // Equivalent of 0.0081... x 51.702... => 0.42208125
                // !!!!!!! balances 0 so returns infinite slippage
                return bmath_1.bdiv(numerator, denominator);
            } else {
                let denominator = bmath_1.bmul(
                    bmath_1.bmul(
                        bmath_1.BONE.minus(p1.swapFee),
                        bmath_1.BONE.minus(p2.swapFee)
                    ),
                    bmath_1.bmul(
                        bmath_1.bmul(p1.balanceOut, p2.balanceOut),
                        bmath_1.bmul(p1.weightIn, p2.weightIn)
                    )
                );
                console.log(
                    `!!!!!!! denominator out ${denominator.toString()}`
                );
                console.log(
                    `!!!!!!! balances ${p1.balanceOut.toString()} ${p2.balanceOut.toString()}`
                );
                console.log(
                    `!!!!!!! balances ${bmath_1
                        .bmul(p1.balanceOut, p2.balanceOut)
                        .toString()}`
                );
                return bmath_1.bdiv(numerator, denominator);
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
        // // Only add path if the balances are both not zero for first and second hops
        // console.log("poolFirstHop")
        // console.log(poolFirstHop)
        // console.log("poolSecondHop")
        // console.log(poolSecondHop)
        // console.log("tokenIn")
        // console.log(tokenIn)
        // console.log("hopTokens[i]")
        // console.log(hopTokens[i])
        // console.log("tokenOut")
        // console.log(tokenOut)
        // TODO remove since this is already being checked in the previous filters
        let poolFirstHopBalanceIn = mostLiquidPoolsFirstHop[i].tokens.find(
            t =>
                ethers_1.ethers.utils.getAddress(t.address) ===
                ethers_1.ethers.utils.getAddress(tokenIn)
        ).balance;
        let poolFirstHopBalanceOut = mostLiquidPoolsFirstHop[i].tokens.find(
            t =>
                ethers_1.ethers.utils.getAddress(t.address) ===
                ethers_1.ethers.utils.getAddress(hopTokens[i])
        ).balance;
        let poolSecondHopBalanceIn = mostLiquidPoolsSecondHop[i].tokens.find(
            t =>
                ethers_1.ethers.utils.getAddress(t.address) ===
                ethers_1.ethers.utils.getAddress(hopTokens[i])
        ).balance;
        let poolSecondHopBalanceOut = mostLiquidPoolsSecondHop[i].tokens.find(
            t =>
                ethers_1.ethers.utils.getAddress(t.address) ===
                ethers_1.ethers.utils.getAddress(tokenOut)
        ).balance;
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
        t =>
            ethers_1.ethers.utils.getAddress(t.address) ===
            ethers_1.ethers.utils.getAddress(tokenIn)
    );
    // console.log("tI")
    // console.log(tI.balance.toString());
    // console.log(tI)
    let tO = p.tokens.find(
        t =>
            ethers_1.ethers.utils.getAddress(t.address) ===
            ethers_1.ethers.utils.getAddress(tokenOut)
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
                ethers_1.ethers.utils.getAddress(pools[i].tokensList[k]) !=
                    ethers_1.ethers.utils.getAddress(token) &&
                pools[i].tokens.find(
                    t =>
                        ethers_1.ethers.utils.getAddress(t.address) ===
                        ethers_1.ethers.utils.getAddress(pools[i].tokensList[k])
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
    return __awaiter(this, void 0, void 0, function*() {
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
                    new Set(poolsTokenInNoTokenOut[k].tokensList).has(
                        hopTokens[i]
                    )
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
                    new Set(poolsTokenOutNoTokenIn[k].tokensList).has(
                        hopTokens[i]
                    )
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
    });
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
