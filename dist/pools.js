'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
const config_1 = require('./config');
const types_1 = require('./types');
const weightedPool_1 = require('./pools/weightedPool/weightedPool');
const stablePool_1 = require('./pools/stablePool/stablePool');
const elementPool_1 = require('./pools/elementPool/elementPool');
const metaStablePool_1 = require('./pools/metaStablePool/metaStablePool');
const bmath_1 = require('./bmath');
const disabled_tokens_json_1 = __importDefault(
    require('./disabled-tokens.json')
);
/*
The main purpose of this function is to:
- filter to  allPools to pools that have:
    - TokenIn & TokenOut, i.e. a direct swap pool
    - TokenIn & !TokenOut, i.e. a hop pool with only TokenIn
    - !TokenIn & TokenOut, i.e. a hop pool with only TokenOut
- find list of hop tokens, i.e. tokens that join hop pools
As we're looping all here, it also does a number of other things to avoid unnecessary loops later:
- parsePoolPairData for Direct pools
- store token decimals for future use
*/
function filterPoolsOfInterest(
    allPools,
    tokenIn,
    tokenOut,
    maxPools,
    disabledOptions = {
        isOverRide: false,
        disabledTokens: [],
    },
    currentBlockTimestamp = 0
) {
    const poolsDictionary = {};
    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let tokenInPairedTokens = new Set();
    let tokenOutPairedTokens = new Set();
    let disabledTokens = disabled_tokens_json_1.default.tokens;
    if (disabledOptions.isOverRide)
        disabledTokens = disabledOptions.disabledTokens;
    allPools.forEach(pool => {
        if (pool.tokensList.length === 0 || pool.tokens[0].balance === '0') {
            return;
        }
        let newPool;
        if (pool.poolType === 'Weighted')
            newPool = new weightedPool_1.WeightedPool(
                pool.id,
                pool.address,
                pool.swapFee,
                pool.totalWeight,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );
        else if (pool.poolType === 'Stable')
            newPool = new stablePool_1.StablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );
        else if (pool.poolType === 'Element') {
            newPool = new elementPool_1.ElementPool(
                pool.id,
                pool.address,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList,
                pool.expiryTime,
                pool.unitSeconds,
                pool.principalToken,
                pool.baseToken
            );
            newPool.setCurrentBlockTimestamp(currentBlockTimestamp);
        } else if (pool.poolType === 'MetaStable') {
            newPool = new metaStablePool_1.MetaStablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );
        } else if (pool.poolType === 'LiquidityBootstrapping') {
            // If an LBP doesn't have its swaps paused we treat it like a regular Weighted pool.
            // If it does we just ignore it.
            if (pool.swapEnabled === true)
                newPool = new weightedPool_1.WeightedPool(
                    pool.id,
                    pool.address,
                    pool.swapFee,
                    pool.totalWeight,
                    pool.totalShares,
                    pool.tokens,
                    pool.tokensList
                );
            else return;
        } else {
            console.error(
                `Unknown pool type or type field missing: ${pool.poolType} ${pool.id}`
            );
            return;
        }
        let tokenListSet = new Set(pool.tokensList);
        // Depending on env file, we add the BPT as well as
        // we can join/exit as part of the multihop
        if (config_1.ALLOW_ADD_REMOVE) tokenListSet.add(pool.address);
        disabledTokens.forEach(token => tokenListSet.delete(token.address));
        // This is a direct pool as has both tokenIn and tokenOut
        if (
            (tokenListSet.has(tokenIn) && tokenListSet.has(tokenOut)) ||
            (tokenListSet.has(tokenIn.toLowerCase()) &&
                tokenListSet.has(tokenOut.toLowerCase()))
        ) {
            newPool.setTypeForSwap(types_1.SwapPairType.Direct);
            // parsePoolPairData for Direct pools as it avoids having to loop later
            newPool.parsePoolPairData(tokenIn, tokenOut);
            poolsDictionary[pool.id] = newPool;
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
                newPool.setTypeForSwap(types_1.SwapPairType.HopIn);
                poolsDictionary[pool.id] = newPool;
            } else if (!containsTokenIn && containsTokenOut) {
                tokenOutPairedTokens = new Set([
                    ...tokenOutPairedTokens,
                    ...tokenListSet,
                ]);
                newPool.setTypeForSwap(types_1.SwapPairType.HopOut);
                poolsDictionary[pool.id] = newPool;
            }
        }
    });
    // We find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    const hopTokensSet = [...tokenInPairedTokens].filter(x =>
        tokenOutPairedTokens.has(x)
    );
    // Transform set into Array
    const hopTokens = [...hopTokensSet];
    return [poolsDictionary, hopTokens];
}
exports.filterPoolsOfInterest = filterPoolsOfInterest;
/*
Find the most liquid pool for each hop (i.e. tokenIn->hopToken & hopToken->tokenOut).
Creates paths for each pool of interest (multi & direct pools).
*/
function filterHopPools(tokenIn, tokenOut, hopTokens, poolsOfInterest) {
    const filteredPoolsOfInterest = {};
    const paths = [];
    let firstPoolLoop = true;
    // No multihop pool but still need to create paths for direct pools
    if (hopTokens.length === 0) {
        for (let id in poolsOfInterest) {
            if (
                poolsOfInterest[id].swapPairType !== types_1.SwapPairType.Direct
            ) {
                delete poolsOfInterest[id];
                continue;
            }
            const path = createDirectPath(
                poolsOfInterest[id],
                tokenIn,
                tokenOut
            );
            paths.push(path);
            filteredPoolsOfInterest[id] = poolsOfInterest[id];
        }
    }
    for (let i = 0; i < hopTokens.length; i++) {
        let highestNormalizedLiquidityFirst = bmath_1.ZERO; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityFirstPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquiditySecond = bmath_1.ZERO; // Aux variable to find pool with most liquidity for pair (hopToken -> tokenOut)
        let highestNormalizedLiquiditySecondPoolId; // Aux variable to find pool with most liquidity for pair (hopToken -> tokenOut)
        for (let id in poolsOfInterest) {
            const pool = poolsOfInterest[id];
            // We don't consider direct pools for the multihop but we do add it's path
            if (pool.swapPairType === types_1.SwapPairType.Direct) {
                // First loop of all pools we add paths to list
                if (firstPoolLoop) {
                    const path = createDirectPath(pool, tokenIn, tokenOut);
                    paths.push(path);
                    filteredPoolsOfInterest[id] = pool;
                }
                continue;
            }
            let tokenListSet = new Set(pool.tokensList);
            // Depending on env file, we add the BPT as well as
            // we can join/exit as part of the multihop
            if (config_1.ALLOW_ADD_REMOVE) tokenListSet.add(pool.address);
            // MAKE THIS A FLAG IN FILTER?
            // If pool doesn't have  hopTokens[i] then ignore
            if (!tokenListSet.has(hopTokens[i])) continue;
            if (pool.swapPairType === types_1.SwapPairType.HopIn) {
                const poolPairData = pool.parsePoolPairData(
                    tokenIn,
                    hopTokens[i]
                );
                // const normalizedLiquidity = pool.getNormalizedLiquidity(tokenIn, hopTokens[i]);
                const normalizedLiquidity = pool.getNormalizedLiquidity(
                    poolPairData
                );
                // Cannot be strictly greater otherwise highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        highestNormalizedLiquidityFirst
                    )
                ) {
                    highestNormalizedLiquidityFirst = normalizedLiquidity;
                    highestNormalizedLiquidityFirstPoolId = id;
                }
            } else if (pool.swapPairType === types_1.SwapPairType.HopOut) {
                const poolPairData = pool.parsePoolPairData(
                    hopTokens[i],
                    tokenOut
                );
                // const normalizedLiquidity = pool.getNormalizedLiquidity(hopTokens[i], tokenOut);
                const normalizedLiquidity = pool.getNormalizedLiquidity(
                    poolPairData
                );
                // Cannot be strictly greater otherwise highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        highestNormalizedLiquiditySecond
                    )
                ) {
                    highestNormalizedLiquiditySecond = normalizedLiquidity;
                    highestNormalizedLiquiditySecondPoolId = id;
                }
            } else {
                // Unknown type
                continue;
            }
        }
        firstPoolLoop = false;
        filteredPoolsOfInterest[highestNormalizedLiquidityFirstPoolId] =
            poolsOfInterest[highestNormalizedLiquidityFirstPoolId];
        filteredPoolsOfInterest[highestNormalizedLiquiditySecondPoolId] =
            poolsOfInterest[highestNormalizedLiquiditySecondPoolId];
        const path = createMultihopPath(
            poolsOfInterest[highestNormalizedLiquidityFirstPoolId],
            poolsOfInterest[highestNormalizedLiquiditySecondPoolId],
            tokenIn,
            hopTokens[i],
            tokenOut
        );
        paths.push(path);
    }
    return [filteredPoolsOfInterest, paths];
}
exports.filterHopPools = filterHopPools;
function createDirectPath(pool, tokenIn, tokenOut) {
    const swap = {
        pool: pool.id,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
    };
    const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);
    const path = {
        id: pool.id,
        swaps: [swap],
        limitAmount: bmath_1.ZERO,
        poolPairData: [poolPairData],
        pools: [pool],
    };
    return path;
}
function createMultihopPath(
    firstPool,
    secondPool,
    tokenIn,
    hopToken,
    tokenOut
) {
    const swap1 = {
        pool: firstPool.id,
        tokenIn: tokenIn,
        tokenOut: hopToken,
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
    };
    const swap2 = {
        pool: secondPool.id,
        tokenIn: hopToken,
        tokenOut: tokenOut,
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
    };
    const poolPairDataFirst = firstPool.parsePoolPairData(tokenIn, hopToken);
    const poolPairDataSecond = secondPool.parsePoolPairData(hopToken, tokenOut);
    // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
    const path = {
        id: firstPool.id + secondPool.id,
        swaps: [swap1, swap2],
        limitAmount: bmath_1.ZERO,
        poolPairData: [poolPairDataFirst, poolPairDataSecond],
        pools: [firstPool, secondPool],
    };
    return path;
}
