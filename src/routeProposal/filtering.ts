import {
    SubgraphPoolBase,
    PoolDictionary,
    PoolDictionaryByMain,
    SwapPairType,
    NewPath,
    Swap,
    PoolBase,
    PoolFilter,
    PoolTypes,
    PoolPairBase,
} from '../types';
import { WeightedPool } from '../pools/weightedPool/weightedPool';
import { StablePool } from '../pools/stablePool/stablePool';
import { ElementPool } from '../pools/elementPool/elementPool';
import { MetaStablePool } from '../pools/metaStablePool/metaStablePool';
import { LinearPool } from '../pools/linearPool/linearPool';
import { ZERO } from '../utils/bignumber';
import { MULTIMETASTABLEPOOL } from '../addresses';

import { parseNewPool } from '../pools';
import { privateEncrypt } from 'crypto';

export const filterPoolsByType = (
    pools: SubgraphPoolBase[],
    poolTypeFilter: PoolFilter
): SubgraphPoolBase[] => {
    if (poolTypeFilter === PoolFilter.All) return pools;
    return pools.filter((p) => p.poolType === poolTypeFilter);
};

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
export function filterPoolsOfInterest(
    allPools: SubgraphPoolBase[],
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    chainId: number = 1,
    currentBlockTimestamp = 0
): [PoolDictionary, string[], [PoolDictionaryByMain, MetaStablePool]] {
    const poolsDictionary: PoolDictionary = {};

    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let tokenInPairedTokens: Set<string> = new Set();
    let tokenOutPairedTokens: Set<string> = new Set();

    const linearPoolsDictByMain: PoolDictionaryByMain = {};
    let multiMetaStablePool: MetaStablePool = {} as MetaStablePool;

    allPools.forEach((pool) => {
        if (pool.tokensList.length === 0 || pool.tokens[0].balance === '0') {
            return;
        }

        const newPool:
            | WeightedPool
            | StablePool
            | MetaStablePool
            | ElementPool
            | LinearPool
            | undefined = parseNewPool(pool, currentBlockTimestamp);
        if (!newPool) return;

        if (newPool.address === MULTIMETASTABLEPOOL[chainId].address) {
            multiMetaStablePool = newPool as MetaStablePool;
        }

        if (newPool.poolType === PoolTypes.Linear)
            linearPoolsDictByMain[pool.tokens[0].address] = newPool;

        const tokenListSet = new Set(pool.tokensList);

        // This is a direct pool as has both tokenIn and tokenOut
        if (
            (tokenListSet.has(tokenIn) && tokenListSet.has(tokenOut)) ||
            (tokenListSet.has(tokenIn.toLowerCase()) &&
                tokenListSet.has(tokenOut.toLowerCase()))
        ) {
            newPool.setTypeForSwap(SwapPairType.Direct);

            // parsePoolPairData for Direct pools as it avoids having to loop later
            newPool.parsePoolPairData(tokenIn, tokenOut);
            poolsDictionary[pool.id] = newPool;
            return;
        }

        if (maxPools > 1) {
            const containsTokenIn = tokenListSet.has(tokenIn);
            const containsTokenOut = tokenListSet.has(tokenOut);

            if (containsTokenIn && !containsTokenOut) {
                tokenInPairedTokens = new Set([
                    ...tokenInPairedTokens,
                    ...tokenListSet,
                ]);
                newPool.setTypeForSwap(SwapPairType.HopIn);
                poolsDictionary[pool.id] = newPool;
            } else if (!containsTokenIn && containsTokenOut) {
                tokenOutPairedTokens = new Set([
                    ...tokenOutPairedTokens,
                    ...tokenListSet,
                ]);
                newPool.setTypeForSwap(SwapPairType.HopOut);
                poolsDictionary[pool.id] = newPool;
            }
        }
    });

    // We find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    const hopTokensSet = [...tokenInPairedTokens].filter((x) =>
        tokenOutPairedTokens.has(x)
    );

    // Transform set into Array
    const hopTokens = [...hopTokensSet];
    const linearPoolsInfo: [PoolDictionaryByMain, MetaStablePool] = [
        linearPoolsDictByMain,
        multiMetaStablePool,
    ];
    return [poolsDictionary, hopTokens, linearPoolsInfo];
}

/*
Find the most liquid pool for each hop (i.e. tokenIn->hopToken & hopToken->tokenOut).
Creates paths for each pool of interest (multi & direct pools).
*/
export function filterHopPools(
    tokenIn: string,
    tokenOut: string,
    hopTokens: string[],
    poolsOfInterest: PoolDictionary
): [PoolDictionary, NewPath[]] {
    const filteredPoolsOfInterest: PoolDictionary = {};
    const paths: NewPath[] = [];
    let firstPoolLoop = true;

    // No multihop pool but still need to create paths for direct pools
    if (hopTokens.length === 0) {
        for (const id in poolsOfInterest) {
            if (poolsOfInterest[id].swapPairType !== SwapPairType.Direct) {
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
        let highestNormalizedLiquidityFirst = ZERO; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityFirstPoolId: string | undefined; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquiditySecond = ZERO; // Aux variable to find pool with most liquidity for pair (hopToken -> tokenOut)
        let highestNormalizedLiquiditySecondPoolId: string | undefined; // Aux variable to find pool with most liquidity for pair (hopToken -> tokenOut)

        for (const id in poolsOfInterest) {
            const pool = poolsOfInterest[id];

            // We don't consider direct pools for the multihop but we do add it's path
            if (pool.swapPairType === SwapPairType.Direct) {
                // First loop of all pools we add paths to list
                if (firstPoolLoop) {
                    const path = createDirectPath(pool, tokenIn, tokenOut);
                    paths.push(path);
                    filteredPoolsOfInterest[id] = pool;
                }
                continue;
            }

            const tokenListSet = new Set(pool.tokensList);

            // If pool doesn't have hopTokens[i] then ignore
            if (!tokenListSet.has(hopTokens[i])) continue;

            if (pool.swapPairType === SwapPairType.HopIn) {
                const poolPairData = pool.parsePoolPairData(
                    tokenIn,
                    hopTokens[i]
                );
                // const normalizedLiquidity = pool.getNormalizedLiquidity(tokenIn, hopTokens[i]);
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
            } else if (pool.swapPairType === SwapPairType.HopOut) {
                const poolPairData = pool.parsePoolPairData(
                    hopTokens[i],
                    tokenOut
                );
                // const normalizedLiquidity = pool.getNormalizedLiquidity(hopTokens[i], tokenOut);
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

        firstPoolLoop = false;

        if (
            highestNormalizedLiquidityFirstPoolId &&
            highestNormalizedLiquiditySecondPoolId
        ) {
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
    }

    return [filteredPoolsOfInterest, paths];
}

export function getPathsUsingLinearPools(
    tokenIn: string,
    tokenOut: string,
    linearPoolsInfo: [PoolDictionaryByMain, MetaStablePool],
    poolsDict: PoolDictionary,
    filteredPoolsDict: PoolDictionary
): [PoolDictionary, NewPath[]] {
    const pathsUsingLinear: NewPath[] = [];
    const linearPoolsDictByMain = linearPoolsInfo[0];
    const multiMetaStablePool = linearPoolsInfo[1];
    if (!multiMetaStablePool) return [filteredPoolsDict, pathsUsingLinear];
    filteredPoolsDict[multiMetaStablePool.id] = multiMetaStablePool;
    const linearPoolIn = linearPoolsDictByMain[tokenIn];
    const linearPoolOut = linearPoolsDictByMain[tokenOut];

    // If neither of tokenIn and tokenOut have linear pools, return an empty array.
    if (!linearPoolIn && !linearPoolOut) {
        return [filteredPoolsDict, pathsUsingLinear];
    }

    // If both tokenIn and tokenOut are stable coins, return linear-multistable-linear path
    if (linearPoolIn && linearPoolOut) {
        filteredPoolsDict[linearPoolIn.id] = linearPoolIn;
        filteredPoolsDict[linearPoolOut.id] = linearPoolOut;
        const linearPathway = makeLinearPathway(
            tokenIn,
            tokenOut,
            linearPoolIn,
            linearPoolOut,
            multiMetaStablePool
        );
        pathsUsingLinear.push(linearPathway);
    }
    // If just one of tokenIn and tokenOut is stable, return linear-multistable-linear
    // composed with highest liquidity pool at the other end.
    if (linearPoolIn && !linearPoolOut) {
        for (const stableHopToken in linearPoolsDictByMain) {
            if (stableHopToken == tokenIn) continue;
            let hopLinearPool = linearPoolsDictByMain[stableHopToken];
            filteredPoolsDict[hopLinearPool.id] = hopLinearPool;
            const linearPathway = makeLinearPathway(
                tokenIn,
                stableHopToken,
                linearPoolIn,
                linearPoolsDictByMain[stableHopToken],
                multiMetaStablePool
            );
            const lastPoolId = getHighestLiquidityPool(
                stableHopToken,
                tokenOut,
                SwapPairType.HopOut,
                poolsDict
            );
            if (lastPoolId) {
                const lastPool = poolsDict[lastPoolId];
                filteredPoolsDict[lastPoolId] = lastPool;
                const pathEnd = createDirectPath(
                    lastPool,
                    stableHopToken,
                    tokenOut
                );
                pathsUsingLinear.push(composePaths([linearPathway, pathEnd]));
            }
        }
    }
    if (!linearPoolIn && linearPoolOut) {
        filteredPoolsDict[linearPoolOut.id] = linearPoolOut;
        for (const stableHopToken in linearPoolsDictByMain) {
            if (stableHopToken == tokenOut) continue;
            let hopLinearPool = linearPoolsDictByMain[stableHopToken];
            filteredPoolsDict[hopLinearPool.id] = hopLinearPool;
            const linearPathway = makeLinearPathway(
                stableHopToken,
                tokenOut,
                linearPoolsDictByMain[stableHopToken],
                linearPoolOut,
                multiMetaStablePool
            );
            const firstPoolId = getHighestLiquidityPool(
                tokenIn,
                stableHopToken,
                SwapPairType.HopIn,
                poolsDict
            );
            if (firstPoolId) {
                const firstPool = poolsDict[firstPoolId];
                filteredPoolsDict[firstPoolId] = firstPool;
                const pathStart = createDirectPath(
                    firstPool,
                    tokenIn,
                    stableHopToken
                );
                pathsUsingLinear.push(composePaths([pathStart, linearPathway]));
            }
        }
    }
    return [filteredPoolsDict, pathsUsingLinear];
}

function getHighestLiquidityPool(
    tokenIn: string,
    tokenOut: string,
    swapPairType: SwapPairType,
    poolsOfInterest: PoolDictionary
): string {
    let highestNormalizedLiquidity = ZERO;
    let highestNormalizedLiquidityPoolId = '';
    for (const id in poolsOfInterest) {
        const pool = poolsOfInterest[id];
        if (swapPairType != pool.swapPairType) continue;
        const tokenListSet = new Set(pool.tokensList);

        // If pool doesn't have tokenIn or tokenOut then ignore

        if (!tokenListSet.has(tokenIn) || !tokenListSet.has(tokenOut)) continue;
        const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);
        const normalizedLiquidity = pool.getNormalizedLiquidity(poolPairData);
        // Cannot be strictly greater otherwise highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
        if (
            normalizedLiquidity.isGreaterThanOrEqualTo(
                highestNormalizedLiquidity
            )
        ) {
            highestNormalizedLiquidity = normalizedLiquidity;
            highestNormalizedLiquidityPoolId = id;
        }
    }
    return highestNormalizedLiquidityPoolId;
}

// This function will only work correctly if the input is composable
// i.e. each path's token out = next path's token in
function composePaths(paths: NewPath[]): NewPath {
    let id = '';
    let swaps: Swap[] = [];
    let poolPairData: PoolPairBase[] = [];
    let pools: PoolBase[] = [];
    for (const path of paths) {
        id += path.id;
        swaps = swaps.concat(path.swaps);
        poolPairData = poolPairData.concat(path.poolPairData);
        pools = pools.concat(path.pools);
    }
    const path: NewPath = {
        id: id,
        swaps: swaps,
        poolPairData: poolPairData,
        limitAmount: ZERO,
        pools: pools,
    };
    return path;
}

function createDirectPath(
    pool: PoolBase,
    tokenIn: string,
    tokenOut: string
): NewPath {
    const swap: Swap = {
        pool: pool.id,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        tokenInDecimals: 18, // TO DO - Add decimals here
        tokenOutDecimals: 18,
    };

    const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

    const path: NewPath = {
        id: pool.id,
        swaps: [swap],
        limitAmount: ZERO,
        poolPairData: [poolPairData],
        pools: [pool],
    };

    return path;
}

function makeLinearPathway(
    tokenIn: string,
    tokenOut: string,
    linearPoolIn: PoolBase,
    linearPoolOut: PoolBase,
    multiMetaStablePool: MetaStablePool
): NewPath {
    const linearPoolInBPT = linearPoolIn.address;
    const linearPoolInPath = createDirectPath(
        linearPoolIn,
        tokenIn,
        linearPoolInBPT
    );
    const linearPoolOutBPT = linearPoolOut.address;
    const linearPoolOutPath = createDirectPath(
        linearPoolOut,
        linearPoolOutBPT,
        tokenOut
    );
    const multiStablePoolPath = createDirectPath(
        multiMetaStablePool,
        linearPoolInBPT,
        linearPoolOutBPT
    );
    return composePaths([
        linearPoolInPath,
        multiStablePoolPath,
        linearPoolOutPath,
    ]);
}

function createMultihopPath(
    firstPool: PoolBase,
    secondPool: PoolBase,
    tokenIn: string,
    hopToken: string,
    tokenOut: string
): NewPath {
    const swap1: Swap = {
        pool: firstPool.id,
        tokenIn: tokenIn,
        tokenOut: hopToken,
        tokenInDecimals: 18, // Placeholder for actual decimals TO DO
        tokenOutDecimals: 18,
    };

    const swap2: Swap = {
        pool: secondPool.id,
        tokenIn: hopToken,
        tokenOut: tokenOut,
        tokenInDecimals: 18, // Placeholder for actual decimals TO DO
        tokenOutDecimals: 18,
    };

    const poolPairDataFirst = firstPool.parsePoolPairData(tokenIn, hopToken);
    const poolPairDataSecond = secondPool.parsePoolPairData(hopToken, tokenOut);

    // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
    const path: NewPath = {
        id: firstPool.id + secondPool.id,
        swaps: [swap1, swap2],
        limitAmount: ZERO,
        poolPairData: [poolPairDataFirst, poolPairDataSecond],
        pools: [firstPool, secondPool],
    };

    return path;
}
