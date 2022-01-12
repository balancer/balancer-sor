import cloneDeep from 'lodash.clonedeep';
import {
    SubgraphPoolBase,
    PoolDictionary,
    SwapPairType,
    NewPath,
    Swap,
    PoolBase,
    PoolFilter,
    PoolTypes,
    PoolPairBase,
    SorConfig,
} from '../types';
import { MetaStablePool } from '../pools/metaStablePool/metaStablePool';
import { ZERO } from '../utils/bignumber';
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

            const path = createPath([tokenIn, tokenOut], [poolsOfInterest[id]]);
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
                    const path = createPath([tokenIn, tokenOut], [pool]);
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

            const path = createPath(
                [tokenIn, hopTokens[i], tokenOut],
                [
                    poolsOfInterest[highestNormalizedLiquidityFirstPoolId],
                    poolsOfInterest[highestNormalizedLiquiditySecondPoolId],
                ]
            );
            paths.push(path);
        }
    }

    return [filteredPoolsOfInterest, paths];
}

/*
Return paths through StaBal3 Linear pools.
Paths can be created for any token that is paired to staBAL3 
or WETH via a WETH/staBAL3 connecting pool
LinearStable <> LinearStable: LinearStableIn>[LINEARPOOL_IN]>bStable_IN>[staBAL3]>bStable_OUT>[LINEARPOOL_OUT]>LinearStableOut
LinearStable <> token paired to staBAL3: LinearStableIn>[LINEARPOOL]>bStable>[staBAL3]>staBal3>[staBal3-TokenOut]>TokenOut
LinearStable <> token paired to WETH: LinearStableIn>[LINEARPOOL]>bStable>[staBAL3]>staBal3>[staBal3-WETH]>WETH>[WETH-TokenOut]>TokenOut
*/
export function getLinearStaBal3Paths(
    tokenIn: string,
    tokenOut: string,
    poolsAllDict: PoolDictionary,
    poolsFilteredDict: PoolDictionary,
    config: SorConfig
): NewPath[] {
    // This is the top level Metastable pool containing bUSDC/bDAI/bUSDT
    const staBal3PoolInfo = config.staBal3Pool;
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

    // Find Linear Pools that are connected to staBal3
    const linearStaBal3Pools = getLinearStaBal3Pools(poolsAllDict, staBal3Pool);
    // Find Linear Pools that have tokenIn/Out as main token
    const linearPoolIn = getPoolWithMainToken(linearStaBal3Pools, tokenIn);
    const linearPoolOut = getPoolWithMainToken(linearStaBal3Pools, tokenOut);

    const pathsUsingLinear: NewPath[] = [];

    // If neither of tokenIn and tokenOut have linear pools, return an empty array.
    if (!linearPoolIn && !linearPoolOut) return [];
    // If both tokenIn and tokenOut belong to linear pools
    else if (linearPoolIn && linearPoolOut) {
        // tokenIn/tokenOut belong to same Linear Pool and don't need routed via staBAL3
        if (linearPoolIn.id === linearPoolOut.id) return [];

        // TokenIn>[LINEARPOOL_IN]>BPT_IN>[staBAL3]>BPT_OUT>[LINEARPOOL_OUT]>TokenOut
        const linearPathway = createPath(
            [tokenIn, linearPoolIn.address, linearPoolOut.address, tokenOut],
            [linearPoolIn, staBal3Pool, linearPoolOut]
        );
        pathsUsingLinear.push(linearPathway);
        return pathsUsingLinear;
    } else if (linearPoolIn && !linearPoolOut) {
        // Creates first part of path: TokenIn>[LINEARPOOL]>bStable>[staBAL3]>staBal3Bpt
        const linearPathway = createPath(
            [tokenIn, linearPoolIn.address, staBal3Pool.address],
            [linearPoolIn, staBal3Pool]
        );

        // Creates a path through most liquid staBal3/Token pool
        // staBal3Bpt>[staBal3Bpt-TokenOut]>TokenOut
        const staBal3TokenOutPath = getMostLiquidPath(
            [staBal3Pool.address, tokenOut],
            0,
            [],
            poolsFilteredDict,
            SwapPairType.HopOut
        );

        if (staBal3TokenOutPath.swaps) {
            const shortPath = composePaths([
                linearPathway,
                staBal3TokenOutPath,
            ]);
            pathsUsingLinear.push(shortPath);
        }

        // Creates a path through most liquid WETH/TokenOut pool via WETH/staBal3 connecting pool
        // staBal3Bpt>[staBal3Bpt-WETH]>WETH>[WETH-TokenOut]>TokenOut
        const wethStaBal3Info = config.wethStaBal3;
        if (!wethStaBal3Info) return pathsUsingLinear;
        const wethStaBal3Pool = poolsAllDict[wethStaBal3Info.id];
        if (!wethStaBal3Pool) return pathsUsingLinear;

        const wethTokenOutPath = getMostLiquidPath(
            [staBal3Pool.address, config.weth, tokenOut],
            1,
            [wethStaBal3Pool],
            poolsFilteredDict,
            SwapPairType.HopOut
        );

        if (wethTokenOutPath.swaps) {
            const longPath = composePaths([linearPathway, wethTokenOutPath]);
            pathsUsingLinear.push(longPath);
        }

        return pathsUsingLinear;
    } else {
        // here we have the condition (!linearPoolIn && linearPoolOut)
        // Creates second part of path: staBal3Bpt>[staBAL3]>bStable>[LINEARPOOL]>TokenOut
        const linearPathway = createPath(
            [staBal3Pool.address, linearPoolOut.address, tokenOut],
            [staBal3Pool, linearPoolOut]
        );

        // Creates a path through most liquid staBal3/Token pool
        // TokenIn>[TokenIn-staBal3Bpt]>staBal3Bpt
        const tokenInStaBal3Path = getMostLiquidPath(
            [tokenIn, staBal3Pool.address],
            0,
            [],
            poolsFilteredDict,
            SwapPairType.HopIn
        );
        if (tokenInStaBal3Path.swaps) {
            const shortPath = composePaths([tokenInStaBal3Path, linearPathway]);
            pathsUsingLinear.push(shortPath);
        }

        // Creates a path through most liquid WETH paired pool and staBal3/WETH pool
        // TokenIn>[WETH-TokenIn]>WETH>[staBal3Bpt-WETH]>staBal3Bpt>
        const wethStaBal3Info = config.wethStaBal3;
        if (!wethStaBal3Info) return pathsUsingLinear;
        const wethStaBal3Pool = poolsAllDict[wethStaBal3Info.id];
        if (!wethStaBal3Pool) return pathsUsingLinear;

        const tokenInWethPath = getMostLiquidPath(
            [tokenIn, config.weth, staBal3Pool.address],
            0,
            [wethStaBal3Pool],
            poolsFilteredDict,
            SwapPairType.HopIn
        );

        if (tokenInWethPath.swaps) {
            const longPath = composePaths([tokenInWethPath, linearPathway]);
            pathsUsingLinear.push(longPath);
        }

        return pathsUsingLinear;
    }
}

/*
Returns Linear pools that are part of staBal3
*/
function getLinearStaBal3Pools(
    pools: PoolDictionary,
    staBal3Pool: PoolBase
): PoolDictionary {
    const linearStaBal3Pools = {};
    for (const id in pools) {
        if (pools[id].poolType === PoolTypes.Linear) {
            // Check if pool is part of staBal3
            if (staBal3Pool.tokensList.includes(pools[id].address))
                linearStaBal3Pools[id] = pools[id];
        }
    }

    return linearStaBal3Pools;
}

function getPoolWithMainToken(pools: PoolDictionary, token: string): PoolBase {
    let pool;
    for (const id in pools) {
        const mainIndex = pools[id].mainIndex;
        if (mainIndex !== undefined) {
            // TO DO
            // Currently maths doesn't support wrapped tokens (TBC if there is a workaround)
            // This means we can only support main token
            // See Linear https://linear.app/balancer/issue/SOR-26/finalise-wrappedtoken-support
            // If can workaround then replace below with: if (pools[id].tokensList.includes(token.toLowerCase()))
            if (pools[id].tokensList[mainIndex] === token.toLowerCase())
                return pools[id];
        }
    }
    return pool;
}

/*
Creates a path for a set of token hops with one unknown pool.
Finds most liquid pool for tokenIn/tokenOut where tokenInIndex is position of tokenIn in tokens array.
*/
function getMostLiquidPath(
    tokens: string[],
    tokenInIndex: number,
    pathPools: PoolBase[],
    pools: PoolDictionary,
    swapPairType: SwapPairType
): NewPath {
    const tokenIn = tokens[tokenInIndex];
    const tokenOut = tokens[tokenInIndex + 1];

    // Finds pool with highest liquidity for tokenIn/Out
    const mostLiquidPool = getHighestLiquidityPool(
        tokenIn.toLowerCase(),
        tokenOut.toLowerCase(),
        swapPairType,
        pools
    );
    // If there is a paired pool create a path
    if (mostLiquidPool === null) return {} as NewPath;

    // Add most liquid pool to array in correct hop position
    pathPools.splice(tokenInIndex, 0, pools[mostLiquidPool]);

    const path = createPath(tokens, pathPools);
    return path;
}

// Creates a path with pools.length hops
// i.e. tokens[0]>[Pool0]>tokens[1]>[Pool1]>tokens[2]>[Pool2]>tokens[3]
export function createPath(tokens: string[], pools: PoolBase[]): NewPath {
    let tI: string, tO: string;
    const swaps: Swap[] = [];
    const poolPairData: PoolPairBase[] = [];
    let id = '';

    for (let i = 0; i < pools.length; i++) {
        tI = tokens[i];
        tO = tokens[i + 1];
        const poolPair = pools[i].parsePoolPairData(tI, tO);
        poolPairData.push(poolPair);
        id = id + poolPair.id;

        const swap: Swap = {
            pool: pools[i].id,
            tokenIn: tI,
            tokenOut: tO,
            tokenInDecimals: poolPair.decimalsIn,
            tokenOutDecimals: poolPair.decimalsOut,
        };

        swaps.push(swap);
    }

    const path: NewPath = {
        id,
        swaps,
        limitAmount: Zero,
        poolPairData,
        pools,
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
    config: SorConfig
): NewPath[] {
    // This will be the USDC/staBAL Connecting pool used in Polygon
    const usdcConnectingPoolInfo = config.usdcConnectingPool;
    if (!usdcConnectingPoolInfo) return [];

    const usdcConnectingPool = poolsAll[usdcConnectingPoolInfo.id];
    // staBal BPT token is the hop token between token and USDC connecting pool
    const hopTokenStaBal = config.staBal3Pool?.address;

    if (!usdcConnectingPool || !hopTokenStaBal) return [];

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
        const staBalPath = createPath(
            [tokenIn, hopTokenStaBal, usdcConnectingPoolInfo.usdc],
            [metaStablePoolIn, usdcConnectingPool]
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
        const pathEnd = createPath(
            [usdcConnectingPoolInfo.usdc, tokenOut],
            [lastPool]
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
        const staBalPath = createPath(
            [usdcConnectingPoolInfo.usdc, hopTokenStaBal, tokenOut],
            [usdcConnectingPool, metaStablePoolIn]
        );
        const pathStart = createPath(
            [tokenIn, usdcConnectingPoolInfo.usdc],
            [firstPool]
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
