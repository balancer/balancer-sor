import {
    SubgraphPoolBase,
    PoolDictionary,
    SwapPairType,
    NewPath,
    Swap,
    PoolBase,
    PoolFilter,
    PoolPairBase,
} from '../types';
import { WeightedPool } from '../pools/weightedPool/weightedPool';
import { StablePool } from '../pools/stablePool/stablePool';
import { ElementPool } from '../pools/elementPool/elementPool';
import { MetaStablePool } from '../pools/metaStablePool/metaStablePool';
import { ZERO } from '../utils/bignumber';
import { USDCCONNECTINGPOOL, STABALADDR } from '../constants';

import { parseNewPool } from '../pools';

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
    chainId: number,
    currentBlockTimestamp = 0
): [PoolDictionary, string[], StablePool] {
    const poolsDictionary: PoolDictionary = {};

    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let tokenInPairedTokens: Set<string> = new Set();
    let tokenOutPairedTokens: Set<string> = new Set();

    // This will be the USDC/staBAL Connecting pool used in Polygon
    let usdcConnectingPool: StablePool = {} as StablePool;

    allPools.forEach((pool) => {
        if (pool.tokensList.length === 0 || pool.tokens[0].balance === '0') {
            return;
        }

        const newPool:
            | WeightedPool
            | StablePool
            | MetaStablePool
            | ElementPool
            | undefined = parseNewPool(pool, currentBlockTimestamp);
        if (!newPool) return;

        if (newPool.id === USDCCONNECTINGPOOL[chainId].id) {
            usdcConnectingPool = newPool as StablePool;
        }

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
    return [poolsDictionary, hopTokens, usdcConnectingPool];
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

export function createMultihopPath(
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

export function getHighestLiquidityPool(
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

/*
The staBAL3 pool (STABALADDR) is the main stable pool that holds DAI/USDC/USDT and has the staBAL3 BPT.
staBAL Pools are metastable pools that contain a project token, i.e. TUSD, paired with staBAL3 BPT.
USDC connecting pool (USDCCONNECTINGPOOL) is a metastable pool containing USDC and staBAL3 BPT.
This setup should enable paths between the new project metastable pools and other liquidity. I.e. TUSD > BAL, which would look like:
TUSD>[TUSDstaBALPool]>staBAL3>[ConnectingPool]>USDC>[BalWeightedPool]>BAL
*/
export function getPathUsingStaBalPools(
    tokenIn: string,
    tokenOut: string,
    pools: PoolDictionary,
    usdcConnectingPool: StablePool,
    chainId: number
): NewPath {
    // staBal BPT token is the hop token between token and USDC connecting pool
    const hopTokenStaBal = STABALADDR[chainId];

    // Finds the best staBAL Pool with tokenIn/staBal3Bpt or returns '' if doesn't exist
    const staBalPoolIdIn = getHighestLiquidityPool(
        tokenIn,
        hopTokenStaBal,
        SwapPairType.HopIn,
        pools
    );
    // Finds the best staBAL Pool with tokenOut/staBal3Bpt or returns '' if doesn't exist
    const staBalPoolIdOut = getHighestLiquidityPool(
        hopTokenStaBal,
        tokenOut,
        SwapPairType.HopOut,
        pools
    );

    // Path must start or finish with a staBAL Pool
    if (!staBalPoolIdIn && !staBalPoolIdOut) return {} as NewPath;
    else if (staBalPoolIdIn && staBalPoolIdOut) {
        // This case should be handled by existing multihop algorithm because it is tokenIn>[staBalPoolIn]>staBal>[staBalPoolOut]>tokenOut
        return {} as NewPath;
    } else if (staBalPoolIdIn && !staBalPoolIdOut) {
        // First part of path is multihop through staBalPool and USDC Connecting Pools
        // Last part of path is single hop through USDC/tokenOut highest liquidity pool
        // i.e. tokenIn>[staBalPair1]>staBAL>[usdcConnecting]>USDC>[HighLiqPool]>tokenOut

        const staBalPoolIn = pools[staBalPoolIdIn];

        // tokenIn > [staBalPool] > staBal > [UsdcConnectingPool] > USDC
        const staBalPath = createMultihopPath(
            staBalPoolIn,
            usdcConnectingPool,
            tokenIn,
            hopTokenStaBal,
            USDCCONNECTINGPOOL[chainId].usdc
        );

        // Hop out as it is USDC > tokenOut
        const mostLiquidLastPool = getHighestLiquidityPool(
            USDCCONNECTINGPOOL[chainId].usdc,
            tokenOut,
            SwapPairType.HopOut,
            pools
        );
        // No USDC>tokenOut pool so return empty path
        if (mostLiquidLastPool === '') return {} as NewPath;
        else {
            const lastPool = pools[mostLiquidLastPool];
            const pathEnd = createDirectPath(
                lastPool,
                USDCCONNECTINGPOOL[chainId].usdc,
                tokenOut
            );

            return composePaths([staBalPath, pathEnd]);
        }
    } else {
        // First part of path is single hop through tokenIn/USDC highest liquidity pool
        // Last part of path is multihop through USDC Connecting Pools and staBalPool
        // i.e. i.e. tokenIn>[HighLiqPool]>USDC>[usdcConnecting]>staBAL>[staBalPair1]>tokenOut
        const staBalPoolIn = pools[staBalPoolIdOut];

        // Hop in as it is tokenIn > USDC
        const mostLiquidFirstPool = getHighestLiquidityPool(
            tokenIn,
            USDCCONNECTINGPOOL[chainId].usdc,
            SwapPairType.HopIn,
            pools
        );
        // No tokenIn>USDC pool so return empty path
        if (mostLiquidFirstPool === '') return {} as NewPath;

        const firstPool = pools[mostLiquidFirstPool];

        // USDC > [UsdcConnectingPool] > staBal > [staBalPool] > tokenOut
        const staBalPath = createMultihopPath(
            usdcConnectingPool,
            staBalPoolIn,
            USDCCONNECTINGPOOL[chainId].usdc,
            hopTokenStaBal,
            tokenOut
        );

        const pathStart = createDirectPath(
            firstPool,
            tokenIn,
            USDCCONNECTINGPOOL[chainId].usdc
        );

        return composePaths([pathStart, staBalPath]);
    }
}
