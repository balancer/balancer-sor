import cloneDeep from 'lodash.clonedeep';
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
import { MetaStablePool } from '../pools/metaStablePool/metaStablePool';
import { ZERO } from '../utils/bignumber';
import { USDCCONNECTINGPOOL, STABAL3POOL } from '../constants';
import { parseNewPool } from '../pools';
import { Zero } from '@ethersproject/constants';

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
*/
export function filterPoolsOfInterest(
    allPools: PoolDictionary,
    tokenIn: string,
    tokenOut: string,
    maxPools: number
): [PoolDictionary, string[]] {
    // This will include pools with tokenIn and/or tokenOut only
    const poolsFilteredDictionary: PoolDictionary = {};

    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let tokenInPairedTokens: Set<string> = new Set();
    let tokenOutPairedTokens: Set<string> = new Set();

    Object.keys(allPools).forEach((id) => {
        const pool = allPools[id];
        const tokenListSet = new Set(pool.tokensList);
        const containsTokenIn = tokenListSet.has(tokenIn.toLowerCase());
        const containsTokenOut = tokenListSet.has(tokenOut.toLowerCase());

        // This is a direct pool as has both tokenIn and tokenOut
        if (containsTokenIn && containsTokenOut) {
            pool.setTypeForSwap(SwapPairType.Direct);
            poolsFilteredDictionary[pool.id] = pool;
            return;
        }

        if (maxPools > 1) {
            if (containsTokenIn && !containsTokenOut) {
                tokenInPairedTokens = new Set([
                    ...tokenInPairedTokens,
                    ...tokenListSet,
                ]);
                pool.setTypeForSwap(SwapPairType.HopIn);
                poolsFilteredDictionary[pool.id] = pool;
            } else if (!containsTokenIn && containsTokenOut) {
                tokenOutPairedTokens = new Set([
                    ...tokenOutPairedTokens,
                    ...tokenListSet,
                ]);
                pool.setTypeForSwap(SwapPairType.HopOut);
                poolsFilteredDictionary[pool.id] = pool;
            }
        }
    });

    // We find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    const hopTokensSet = [...tokenInPairedTokens].filter((x) =>
        tokenOutPairedTokens.has(x)
    );

    // Transform set into Array
    const hopTokens = [...hopTokensSet];
    return [poolsFilteredDictionary, hopTokens];
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
    poolsAllDict: PoolDictionary,
    poolsFilteredDict: PoolDictionary,
    chainId: number
): NewPath[] {
    // This is the top level Metastable pool containing bUSDC/bDAI/bUSDT
    const staBal3PoolInfo = STABAL3POOL[chainId];
    if (!staBal3PoolInfo) return [];
    const staBal3Pool: MetaStablePool = poolsAllDict[
        staBal3PoolInfo.id
    ] as MetaStablePool;

    if (!staBal3Pool) return [];

    if (
        tokenIn === staBal3PoolInfo.address ||
        tokenOut === staBal3PoolInfo.address
    )
        return [];

    // Create a new dictionary containing all Linear pools
    const linearPoolsDictByMain: PoolDictionaryByMain = {};
    for (const id in poolsAllDict) {
        if (poolsAllDict[id].poolType === PoolTypes.Linear) {
            linearPoolsDictByMain[poolsAllDict[id].tokensList[0]] =
                poolsAllDict[id]; // TO DO - Check if we can rely on the token address
        }
    }

    const pathsUsingLinear: NewPath[] = [];
    const linearPoolIn = linearPoolsDictByMain[tokenIn];
    const linearPoolOut = linearPoolsDictByMain[tokenOut];

    // If neither of tokenIn and tokenOut have linear pools, return an empty array.
    if (!linearPoolIn && !linearPoolOut) return [];
    else if (linearPoolIn && linearPoolOut) {
        // If both tokenIn and tokenOut are stable coins, return linear-multistable-linear path
        const linearPathway = makeLinearPathway(
            tokenIn,
            tokenOut,
            linearPoolIn,
            linearPoolOut,
            staBal3Pool
        );
        pathsUsingLinear.push(linearPathway);
        return pathsUsingLinear;
    } else if (linearPoolIn && !linearPoolOut) {
        // TokenIn is stable. TokenOut should be paired in a pool with staBal3 BPT.
        // TokenIn>[LINEARPOOL]>bStable>[staBAL3]>staBal3Bpt>[WeightedPool]>TokenOut

        // Find best paired pool, i.e. with staBal3 BP and tokenOut
        const pairedPoolId = getHighestLiquidityPool(
            staBal3Pool.address,
            tokenOut,
            SwapPairType.HopOut,
            poolsFilteredDict
        );
        // No pool for TokenOut/staBal3
        if (pairedPoolId === '' || pairedPoolId === null) return [];

        // Creates first part of path: TokenIn>[LINEARPOOL]>bStable>[staBAL3]>staBal3Bpt
        const linearPathway = createMultihopPath(
            linearPoolIn,
            staBal3Pool,
            tokenIn,
            linearPoolIn.address,
            staBal3Pool.address
        );

        // Creates last part of path: staBal3Bpt>[PairedPool]>TokenOut
        const pairedPool = poolsFilteredDict[pairedPoolId];
        const pathEnd = createDirectPath(
            pairedPool,
            staBal3Pool.address,
            tokenOut
        );
        pathsUsingLinear.push(composePaths([linearPathway, pathEnd]));

        return pathsUsingLinear;
    } else {
        // TokenOut is stable. TokenIn should be paired in a pool with staBal3 BPT.
        // TokenIn>[PairedPool]>staBal3Bpt>[staBAL3]>bStable>[LINEARPOOL]>TokenOut

        // Find best paired pool, i.e. with tokenIn and staBal3 BP
        const pairedPoolId = getHighestLiquidityPool(
            tokenIn,
            staBal3Pool.address,
            SwapPairType.HopIn,
            poolsFilteredDict
        );

        // No pool for TokenIn/staBal3
        if (pairedPoolId === '' || pairedPoolId === null) return [];

        // Creates first part of path: TokenIn>[PairedPool]>staBal3Bpt
        const pairedPool = poolsFilteredDict[pairedPoolId];
        const pathStart = createDirectPath(
            pairedPool,
            tokenIn,
            staBal3Pool.address
        );

        // Creates second part of path: staBal3Bpt>[staBAL3]>bStable>[LINEARPOOL]>TokenOut
        const linearPathway = createMultihopPath(
            staBal3Pool,
            linearPoolOut,
            staBal3Pool.address,
            linearPoolOut.address,
            tokenOut
        );

        pathsUsingLinear.push(composePaths([pathStart, linearPathway]));
        return pathsUsingLinear;
    }
}

function createDirectPath(
    pool: PoolBase,
    tokenIn: string,
    tokenOut: string
): NewPath {
    const poolPairData = pool.parsePoolPairData(tokenIn, tokenOut);

    const swap: Swap = {
        pool: pool.id,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        tokenInDecimals: poolPairData.decimalsIn,
        tokenOutDecimals: poolPairData.decimalsOut,
    };

    const path: NewPath = {
        id: pool.id,
        swaps: [swap],
        limitAmount: Zero,
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

export function createMultihopPath(
    firstPool: PoolBase,
    secondPool: PoolBase,
    tokenIn: string,
    hopToken: string,
    tokenOut: string
): NewPath {
    const poolPairDataFirst = firstPool.parsePoolPairData(tokenIn, hopToken);
    const poolPairDataSecond = secondPool.parsePoolPairData(hopToken, tokenOut);

    const swap1: Swap = {
        pool: firstPool.id,
        tokenIn: tokenIn,
        tokenOut: hopToken,
        tokenInDecimals: poolPairDataFirst.decimalsIn,
        tokenOutDecimals: poolPairDataFirst.decimalsOut,
    };

    const swap2: Swap = {
        pool: secondPool.id,
        tokenIn: hopToken,
        tokenOut: tokenOut,
        tokenInDecimals: poolPairDataSecond.decimalsIn,
        tokenOutDecimals: poolPairDataSecond.decimalsOut,
    };

    // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
    const path: NewPath = {
        id: firstPool.id + secondPool.id,
        swaps: [swap1, swap2],
        limitAmount: Zero,
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
): string | null {
    let highestNormalizedLiquidity = ZERO;
    let highestNormalizedLiquidityPoolId: string | null = null;
    for (const id in poolsOfInterest) {
        const pool = poolsOfInterest[id];
        if (swapPairType != pool.swapPairType) continue;
        const tokenListSet = new Set(pool.tokensList);

        // If pool doesn't have tokenIn or tokenOut then ignore

        if (
            !tokenListSet.has(tokenIn.toLowerCase()) ||
            !tokenListSet.has(tokenOut.toLowerCase())
        )
            continue;
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
        limitAmount: Zero,
        pools: pools,
    };
    return path;
}

/*
The staBAL3 pool (STABALADDR) is the main stable pool that holds DAI/USDC/USDT and has the staBAL3 BPT.
Metastable pools that contain a project token, i.e. TUSD, paired with staBAL3 BPT.
USDC connecting pool (USDCCONNECTINGPOOL) is a metastable pool containing USDC and staBAL3 BPT.
This setup should enable paths between the new project metastable pools and other liquidity. I.e. TUSD > BAL, which would look like:
TUSD>[TUSDstaBALPool]>staBAL3>[ConnectingPool]>USDC>[BalWeightedPool]>BAL
*/
export function getPathsUsingStaBalPool(
    tokenIn: string,
    tokenOut: string,
    poolsAll: PoolDictionary,
    poolsFiltered: PoolDictionary,
    chainId: number
): NewPath[] {
    // This will be the USDC/staBAL Connecting pool used in Polygon
    const usdcConnectingPoolInfo = USDCCONNECTINGPOOL[chainId];
    if (!usdcConnectingPoolInfo) return [];

    const usdcConnectingPool = poolsAll[usdcConnectingPoolInfo.id];
    if (!usdcConnectingPool) return [];

    // staBal BPT token is the hop token between token and USDC connecting pool
    const hopTokenStaBal = STABAL3POOL[chainId].address;

    // Finds the best metastable Pool with tokenIn/staBal3Bpt or returns null if doesn't exist
    const metastablePoolIdIn = getHighestLiquidityPool(
        tokenIn,
        hopTokenStaBal,
        SwapPairType.HopIn,
        poolsFiltered
    );
    // Finds the best metastable Pool with tokenOut/staBal3Bpt or returns null if doesn't exist
    const metastablePoolIdOut = getHighestLiquidityPool(
        hopTokenStaBal,
        tokenOut,
        SwapPairType.HopOut,
        poolsFiltered
    );

    if (metastablePoolIdIn && !metastablePoolIdOut) {
        // First part of path is multihop through metaStablePool and USDC Connecting Pools
        // Last part of path is single hop through USDC/tokenOut highest liquidity pool
        // i.e. tokenIn>[metaStablePool]>staBAL>[usdcConnecting]>USDC>[HighLiqPool]>tokenOut

        const metaStablePoolIn = poolsFiltered[metastablePoolIdIn];

        // tokenIn > [metaStablePool] > staBal > [UsdcConnectingPool] > USDC
        const staBalPath = createMultihopPath(
            metaStablePoolIn,
            usdcConnectingPool,
            tokenIn,
            hopTokenStaBal,
            usdcConnectingPoolInfo.usdc
        );

        // Hop out as it is USDC > tokenOut
        const mostLiquidLastPool = getHighestLiquidityPool(
            usdcConnectingPoolInfo.usdc,
            tokenOut,
            SwapPairType.HopOut,
            poolsFiltered
        );
        // No USDC>tokenOut pool so return empty path
        if (mostLiquidLastPool === null) return [];

        const lastPool = poolsFiltered[mostLiquidLastPool];
        const pathEnd = createDirectPath(
            lastPool,
            usdcConnectingPoolInfo.usdc,
            tokenOut
        );

        return [composePaths([staBalPath, pathEnd])];
    }

    if (!metastablePoolIdIn && metastablePoolIdOut) {
        // First part of path is single hop through tokenIn/USDC highest liquidity pool
        // Last part of path is multihop through USDC Connecting Pools and metaStablePool
        // i.e. i.e. tokenIn>[HighLiqPool]>USDC>[usdcConnecting]>staBAL>[metaStablePool]>tokenOut

        // Hop in as it is tokenIn > USDC
        const mostLiquidFirstPool = getHighestLiquidityPool(
            tokenIn,
            usdcConnectingPoolInfo.usdc,
            SwapPairType.HopIn,
            poolsFiltered
        );
        // No tokenIn>USDC pool so return empty path
        if (mostLiquidFirstPool === null) return [];

        const metaStablePoolIn = poolsFiltered[metastablePoolIdOut];
        const firstPool = poolsFiltered[mostLiquidFirstPool];

        // USDC > [UsdcConnectingPool] > staBal > [metaStablePool] > tokenOut
        const staBalPath = createMultihopPath(
            usdcConnectingPool,
            metaStablePoolIn,
            usdcConnectingPoolInfo.usdc,
            hopTokenStaBal,
            tokenOut
        );

        const pathStart = createDirectPath(
            firstPool,
            tokenIn,
            usdcConnectingPoolInfo.usdc
        );

        return [composePaths([pathStart, staBalPath])];
    }

    // If we're here either the path doesn't use metastable pools (and so will not be routed through StaBAL)
    // or both input and output tokens are in metastable pools and so should be handled by existing multihop algorithm
    // (because it is tokenIn>[metaStablePoolIn]>staBal>[metaStablePoolOut]>tokenOut)
    //
    // We then return an empty set of paths
    return [];
}

export function parseToPoolsDict(
    pools: SubgraphPoolBase[],
    timestamp: number
): PoolDictionary {
    return Object.fromEntries(
        cloneDeep(pools)
            .filter(
                (pool) =>
                    pool.tokensList.length > 0 && pool.tokens[0].balance !== '0'
            )
            .map((pool) => [pool.id, parseNewPool(pool, timestamp)])
            .filter(([, pool]) => pool !== undefined)
    );
}
