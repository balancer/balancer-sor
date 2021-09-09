'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
const config_1 = require('./config');
const types_1 = require('./types');
const weightedPool_1 = require('./pools/weightedPool/weightedPool');
const stablePool_1 = require('./pools/stablePool/stablePool');
const elementPool_1 = require('./pools/elementPool/elementPool');
const metaStablePool_1 = require('./pools/metaStablePool/metaStablePool');
const linearPool_1 = require('./pools/linearPool/linearPool');
const bmath_1 = require('./bmath');
const addresses_1 = require('./addresses');
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
    currentBlockTimestamp = 0,
    chainId
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
    allPools.forEach((pool) => {
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
        } else if (pool.poolType === 'Linear') {
            newPool = new linearPool_1.LinearPool(
                pool.id,
                pool.address,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList,
                pool.rate,
                pool.target1,
                pool.target2
            );
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
        disabledTokens.forEach((token) => tokenListSet.delete(token.address));
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
        // Always add the "MULTISTABLEPOOL" and linear pools.
        // Alternatively we might check whether tokenIn or tokenOut belong to
        // the list of stable coins.
        if (
            pool.address === addresses_1.STABLEINFO[chainId].MULTISTABLEPOOL ||
            pool.poolType === 'Linear'
        ) {
            poolsDictionary[pool.id] = newPool;
        }
    });
    // We find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    const hopTokensSet = [...tokenInPairedTokens].filter((x) =>
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
    for (let id in poolsOfInterest) {
        if (poolsOfInterest[id].swapPairType === types_1.SwapPairType.Direct) {
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
            let tokenListSet = new Set(pool.tokensList);
            // Depending on env file, we add the BPT as well as
            // we can join/exit as part of the multihop
            if (config_1.ALLOW_ADD_REMOVE) tokenListSet.add(pool.address);
            // MAKE THIS A FLAG IN FILTER?
            // If pool doesn't have hopTokens[i] then ignore
            if (!tokenListSet.has(hopTokens[i])) continue;
            if (pool.swapPairType === types_1.SwapPairType.HopIn) {
                const poolPairData = pool.parsePoolPairData(
                    tokenIn,
                    hopTokens[i]
                );
                const normalizedLiquidity =
                    pool.getNormalizedLiquidity(poolPairData);
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
                const normalizedLiquidity =
                    pool.getNormalizedLiquidity(poolPairData);
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
        filteredPoolsOfInterest[highestNormalizedLiquidityFirstPoolId] =
            poolsOfInterest[highestNormalizedLiquidityFirstPoolId];
        filteredPoolsOfInterest[highestNormalizedLiquiditySecondPoolId] =
            poolsOfInterest[highestNormalizedLiquiditySecondPoolId];
        const path1 = createDirectPath(
            poolsOfInterest[highestNormalizedLiquidityFirstPoolId],
            tokenIn,
            hopTokens[i]
        );
        const path2 = createDirectPath(
            poolsOfInterest[highestNormalizedLiquiditySecondPoolId],
            hopTokens[i],
            tokenOut
        );
        const path = composePaths([path1, path2]);
        paths.push(path);
    }
    return [filteredPoolsOfInterest, paths];
}
exports.filterHopPools = filterHopPools;
// This function will only work correctly if the input is composable
// i.e. each path's token out = next path's token in
function composePaths(paths) {
    let id = '';
    let swaps = [];
    let poolPairData = [];
    let pools = [];
    for (let path of paths) {
        id += path.id;
        swaps = swaps.concat(path.swaps);
        poolPairData = poolPairData.concat(path.poolPairData);
        pools = pools.concat(path.pools);
    }
    const path = {
        id: id,
        swaps: swaps,
        poolPairData: poolPairData,
        limitAmount: bmath_1.ZERO,
        pools: pools,
    };
    return path;
}
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
function addPathsUsingLinearPools(tokenIn, tokenOut, chainId, poolsOfInterest) {
    /*
        const USDC = STABLEINFO[chainId].USDC.address;
        console.log("USDC address: ", USDC);
        console.log( stableMap['0xc2569dd7d0fd715B054fBf16E75B001E5c0C1115'] );*/
    let stableMap = {};
    for (let symbol in addresses_1.STABLEINFO[chainId].STABLECOINS) {
        stableMap[addresses_1.STABLEINFO[chainId].STABLECOINS[symbol].address] =
            symbol;
    }
    let pathsUsingLinear = [];
    let symbolIn = stableMap[tokenIn];
    let symbolOut = stableMap[tokenOut];
    // If neither of tokenIn and tokenOut are stable coins, return an empty array.
    if (!symbolIn && !symbolOut) {
        // maybe also delete linear and multistable pools from poolsOfInterest
        return [poolsOfInterest, pathsUsingLinear];
    }
    // If both tokenIn and tokenOut are stable coins, return linear-multistable-linear path
    if (symbolIn && symbolOut) {
        let linearPathway = makeLinearPathway(
            tokenIn,
            tokenOut,
            symbolIn,
            symbolOut,
            poolsOfInterest,
            chainId
        );
        pathsUsingLinear.push(linearPathway);
    }
    if (symbolIn && !symbolOut) {
    }
    // Si son una y una, devolver linear-stable-linear compuesto con el
    // que tenga highest normalized liquidity, serán tres paths.
    return [poolsOfInterest, pathsUsingLinear];
}
exports.addPathsUsingLinearPools = addPathsUsingLinearPools;
function makeLinearPathway(
    tokenIn,
    tokenOut,
    symbolIn,
    symbolOut,
    poolsOfInterest,
    chainId
) {
    let linearPoolInId =
        addresses_1.STABLEINFO[chainId].STABLECOINS[symbolIn].linearPoolId;
    let linearPoolOutId =
        addresses_1.STABLEINFO[chainId].STABLECOINS[symbolOut].linearPoolId;
    let linearPoolInBPT =
        addresses_1.STABLEINFO[chainId].STABLECOINS[symbolIn].linearPoolAddress;
    let linearPoolOutBPT =
        addresses_1.STABLEINFO[chainId].STABLECOINS[symbolOut]
            .linearPoolAddress;
    let linearPoolIn = poolsOfInterest[linearPoolInId];
    let linearPoolInPath = createDirectPath(
        linearPoolIn,
        tokenIn,
        linearPoolInBPT
    );
    let multiStablePool =
        poolsOfInterest[addresses_1.STABLEINFO[chainId].MULTISTABLEPOOL.id];
    let multiStablePoolPath = createDirectPath(
        multiStablePool,
        linearPoolInBPT,
        linearPoolOutBPT
    );
    let linearPoolOut = poolsOfInterest[linearPoolOutId];
    let linearPoolOutPath = createDirectPath(
        linearPoolOut,
        linearPoolOutBPT,
        tokenOut
    );
    return composePaths([
        linearPoolInPath,
        multiStablePoolPath,
        linearPoolOutPath,
    ]);
}
