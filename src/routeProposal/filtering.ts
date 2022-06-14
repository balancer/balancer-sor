import cloneDeep from 'lodash.clonedeep';
import {
    SubgraphPoolBase,
    PoolDictionary,
    NewPath,
    Swap,
    PoolBase,
    PoolFilter,
    PoolTypes,
    PoolPairBase,
    SorConfig,
    hopDictionary,
} from '../types';
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
The purpose of this function is to build dictionaries of direct pools 
and plausible hop pools.
*/
export function filterPoolsOfInterest(
    allPools: PoolDictionary,
    tokenIn: string,
    tokenOut: string,
    maxPools: number
): [PoolDictionary, hopDictionary, hopDictionary] {
    const directPools: PoolDictionary = {};
    const hopsIn: hopDictionary = {};
    const hopsOut: hopDictionary = {};

    Object.keys(allPools).forEach((id) => {
        const pool = allPools[id];
        const tokenListSet = new Set(pool.tokensList);
        const containsTokenIn = tokenListSet.has(tokenIn.toLowerCase());
        const containsTokenOut = tokenListSet.has(tokenOut.toLowerCase());

        // This is a direct pool as has both tokenIn and tokenOut
        if (containsTokenIn && containsTokenOut) {
            directPools[pool.id] = pool;
            return;
        }

        if (maxPools > 1) {
            if (containsTokenIn && !containsTokenOut) {
                for (const hopToken of tokenListSet) {
                    if (!hopsIn[hopToken]) hopsIn[hopToken] = new Set([]);
                    hopsIn[hopToken].add(pool.id);
                }
            } else if (!containsTokenIn && containsTokenOut) {
                for (const hopToken of [...tokenListSet]) {
                    if (!hopsOut[hopToken]) hopsOut[hopToken] = new Set([]);
                    hopsOut[hopToken].add(pool.id);
                }
            }
        }
    });
    return [directPools, hopsIn, hopsOut];
}

export function producePaths(
    tokenIn: string,
    tokenOut: string,
    directPools: PoolDictionary,
    hopsIn: hopDictionary,
    hopsOut: hopDictionary,
    pools: PoolDictionary
): NewPath[] {
    const paths: NewPath[] = [];

    // Create direct paths
    for (const id in directPools) {
        const path = createPath([tokenIn, tokenOut], [pools[id]]);
        paths.push(path);
    }

    for (const hopToken in hopsIn) {
        if (hopsOut[hopToken]) {
            let highestNormalizedLiquidityFirst = ZERO; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
            let highestNormalizedLiquidityFirstPoolId: string | undefined; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
            let highestNormalizedLiquiditySecond = ZERO; // Aux variable to find pool with most liquidity for pair (hopToken -> tokenOut)
            let highestNormalizedLiquiditySecondPoolId: string | undefined; // Aux variable to find pool with most liquidity for pair (hopToken -> tokenOut)
            for (const poolInId of [...hopsIn[hopToken]]) {
                const poolIn = pools[poolInId];
                const poolPairData = poolIn.parsePoolPairData(
                    tokenIn,
                    hopToken
                );
                const normalizedLiquidity =
                    poolIn.getNormalizedLiquidity(poolPairData);
                // Cannot be strictly greater otherwise highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        highestNormalizedLiquidityFirst
                    )
                ) {
                    highestNormalizedLiquidityFirst = normalizedLiquidity;
                    highestNormalizedLiquidityFirstPoolId = poolIn.id;
                }
            }
            for (const poolOutId of [...hopsOut[hopToken]]) {
                const poolOut = pools[poolOutId];
                const poolPairData = poolOut.parsePoolPairData(
                    hopToken,
                    tokenOut
                );
                const normalizedLiquidity =
                    poolOut.getNormalizedLiquidity(poolPairData);
                // Cannot be strictly greater otherwise highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        highestNormalizedLiquiditySecond
                    )
                ) {
                    highestNormalizedLiquiditySecond = normalizedLiquidity;
                    highestNormalizedLiquiditySecondPoolId = poolOut.id;
                }
            }
            if (
                highestNormalizedLiquidityFirstPoolId &&
                highestNormalizedLiquiditySecondPoolId
            ) {
                const path = createPath(
                    [tokenIn, hopToken, tokenOut],
                    [
                        pools[highestNormalizedLiquidityFirstPoolId],
                        pools[highestNormalizedLiquiditySecondPoolId],
                    ]
                );
                paths.push(path);
            }
        }
    }
    return paths;
}

/*
Returns relevant paths using boosted pools, called "boosted paths".
Boosted paths typically have length greater than 2, so we need
a separate algorithm to create them.
We consider two central tokens: WETH and any phantomStable BPT. 
We want to consider paths in which token_in and token_out are connected
(each of them) to either of the central tokens. 
Here for a token A to be "connected" to a token B means that it satisfies one of the following:
(a) A is B.
(b) A and B belong to the same pool.
(c) A has a linear pool whose BPT belongs to a pool jointly with B.

A semipath is a path from token > central token.
Thus for token_in and token_out we generate every semipath. 
After that we combine semipaths to form paths from token_in to token_out. 

For the special case where phantomStable BPT === bbaUSD. We expect to have a 
central pool WETH/bbaUSD. We use this pool to combine a semipath connecting 
to WETH with a semipath connecting to bbaUSD.

If either of token_in our token_out is a token being offered at an LBP, 
we consider the boosted paths from the corresponding "raising token"
composed with the LBP.

Two issues that had to be addressed:
  
  a) when trading for instance DAI/USDC, the algorithm described above finds 
  the path whose tokens chain is
  DAI-bbaDAI-bbaUSD-bbaUSDC-USDC instead of directly
  DAI-bbaDAI-bbaUSDC-USDC

  b) For DAI/aDAI it finds a path through bbaUSD pool using twice Aave-DAI linear pool.

  To deal with both of these we call the function composeSimplifyPath when
  combining semipaths at combineSemiPaths function.
*/
export function getBoostedPaths(
    tokenIn: string,
    tokenOut: string,
    poolsAllDict: PoolDictionary,
    config: SorConfig
): NewPath[] {
    // Get phantom stable pools from all pool
    // These pools are the `connectors` for Linear Pools
    const phantomStablePools = getPhantomStablePools(poolsAllDict);

    if (Object.keys(phantomStablePools).length === 0) return [];

    /*
    If either of token_in or token_out is a token being offered at an LBP, 
    we consider the boosted paths (according to the above explanation) from 
    the corresponding "raising token", and compose those with the LBP to obtain 
    the paths for this case.
    */
    const [lbpPathIn, iTokenIn] = getLBP(
        tokenIn.toLowerCase(),
        poolsAllDict,
        true,
        config
    );
    // eslint-disable-next-line prettier/prettier
    const [lbpPathOut, iTokenOut] = getLBP(
        tokenOut.toLowerCase(),
        poolsAllDict,
        false,
        config
    );

    // getLinearPools might instead receive an array of tokens so that we search
    // over poolsAllDict once instead of twice. Similarly for getPoolsWith
    // and getLBP. This is a matter of code simplicity vs. efficiency.
    // Find Linear pools with tokenIn/Out
    const linearPoolsIn = getLinearPools(iTokenIn, poolsAllDict);
    const linearPoolsOut = getLinearPools(iTokenOut, poolsAllDict);

    // Constructs paths via weth
    const pathsThroughWeth = constructPathsThroughConnecting(
        iTokenIn,
        iTokenOut,
        linearPoolsIn,
        linearPoolsOut,
        config.weth.toLowerCase(),
        poolsAllDict,
        config
    );
    // tokenIn > wethPool > tokenOut
    let allPaths = pathsThroughWeth.fullPaths;

    // Construct paths for each PhantomStable pool
    for (const id in phantomStablePools) {
        const phantomAddr = poolsAllDict[id].address.toLowerCase();

        // Constructs paths via phantomStable
        const pathsInfoThroughPhantom = constructPathsThroughConnecting(
            iTokenIn,
            iTokenOut,
            linearPoolsIn,
            linearPoolsOut,
            phantomAddr,
            poolsAllDict,
            config
        );

        // Creates paths through bbausd/weth pool
        // Only valid when phantom pool === bbausd
        const pathsThroughBbausdWeth: NewPath[] = [];
        if (
            config.wethBBausd &&
            config.bbausd &&
            phantomAddr === config.bbausd.address.toLowerCase()
        ) {
            const WethBBausdPool = poolsAllDict[config.wethBBausd.id];
            // weth[bbausd/weth]bbausd
            const WethBBausdPath = createPath(
                [config.weth, phantomAddr],
                [WethBBausdPool]
            );
            // bbausd[bbausd/weth]weth
            const BBausdWethPath = createPath(
                [phantomAddr, config.weth],
                [WethBBausdPool]
            );
            // tokenIn > WETH > weth[bbausd/weth]bbausd >  phantomStable(bbausd) > tokenOut
            const paths3 = combineSemiPaths(
                pathsThroughWeth.semiPathsIn,
                pathsInfoThroughPhantom.semiPathsOut,
                WethBBausdPath
            );
            // tokenIn > phantomStable > bbausd[bbausd/weth]weth >  weth > tokenOut
            const paths4 = combineSemiPaths(
                pathsInfoThroughPhantom.semiPathsIn,
                pathsThroughWeth.semiPathsOut,
                BBausdWethPath
            );
            pathsThroughBbausdWeth.push(...paths3, ...paths4);
        }
        allPaths.push(
            ...pathsInfoThroughPhantom.fullPaths,
            ...pathsThroughBbausdWeth
        );
    }
    // If there is a nontrivial LBP path, compose every path with the lbp paths
    // in and out. One of them might be the empty path.
    if (lbpPathIn.pools.length > 0 || lbpPathOut.pools.length > 0) {
        allPaths = allPaths.map((path) =>
            composePaths([lbpPathIn, path, lbpPathOut])
        );
    }
    // Every short path (short means length 1 and 2) is included in producePaths.
    return removeShortPaths(allPaths);
}

/**
 * Creates paths (length>2) from tokenIn to tokenOut via a connecting token.
 * Here for a token to be "connected" to the connecting tokens it satisfies one of the following:
 * (a) token is connectingToken.
 * (b) token and connectingToken belong to the same pool. i.e. BAL, WETH - both belong to WETH/BAL weighted pool.
 * (c) token has a pool whose BPT belongs to a pool jointly with connectingToken. i.e. DAI, bbaUSD - bDAI is in phantomStable with bbaUSD.
 * A semipath is a path from token > connecting token.
 * Thus for tokenIn and tokenOut we generate every semipath.
 * After that we combine semipaths to form paths from token_in to token_out.
 * @param tokenIn Token in address.
 * @param tokenOut Token out address.
 * @param poolsWithTokenIn Pools that contain tokenIn.
 * @param poolsWithTokenOut Pools that contain tokenOut.
 * @param connectingTokenAddr Address of connecting token.
 * @param pools Dictionary of pools to consider.
 * @param config Sor config.
 * @returns Paths from tokenIn to tokenOut via pools with connecting token.
 */
function constructPathsThroughConnecting(
    tokenIn: string,
    tokenOut: string,
    poolsWithTokenIn: PoolDictionary,
    poolsWithTokenOut: PoolDictionary,
    connectingTokenAddr: string, // connecting
    pools: PoolDictionary,
    config: SorConfig
): { fullPaths: NewPath[]; semiPathsIn: NewPath[]; semiPathsOut: NewPath[] } {
    // Find all pools with connecting token
    const connectingTokenPoolsDict = getPoolsWith(connectingTokenAddr, pools);

    if (config.wethBBausd) {
        // This avoids duplicate paths when weth is a token to trade
        delete connectingTokenPoolsDict[config.wethBBausd.id];
    }
    // Paths for tokenIn > connecting
    const semiPathsInToConnectingToken: NewPath[] = getSemiPaths(
        tokenIn,
        poolsWithTokenIn,
        connectingTokenPoolsDict,
        connectingTokenAddr
    );
    // Paths for tokenOut > connecting
    const semiPathsOutToConnectingToken: NewPath[] = getSemiPaths(
        tokenOut,
        poolsWithTokenOut,
        connectingTokenPoolsDict,
        connectingTokenAddr
    );
    // connecting > tokenOut
    const semiPathsConnectingTokenToOut = semiPathsOutToConnectingToken.map(
        (path) => reversePath(path)
    );
    // tokenIn > connecting > tokenOut
    return {
        fullPaths: combineSemiPaths(
            semiPathsInToConnectingToken,
            semiPathsConnectingTokenToOut
        ),
        semiPathsIn: semiPathsInToConnectingToken,
        semiPathsOut: semiPathsConnectingTokenToOut,
    };
}

function getPhantomStablePools(poolsAllDict: PoolDictionary): PoolDictionary {
    const phantomStablePools: PoolDictionary = {};
    for (const id in poolsAllDict) {
        const pool = poolsAllDict[id];
        const tokensList = pool.tokensList.map((address) =>
            address.toLowerCase()
        );
        if (
            pool.poolType === PoolTypes.MetaStable &&
            tokensList.includes(pool.address.toLowerCase())
        )
            phantomStablePools[id] = pool;
    }
    return phantomStablePools;
}

function getLinearPools(
    token: string,
    poolsAllDict: PoolDictionary
): PoolDictionary {
    const linearPools: PoolDictionary = {};
    for (const id in poolsAllDict) {
        const pool = poolsAllDict[id];
        const tokensList = pool.tokensList.map((address) =>
            address.toLowerCase()
        );
        if (tokensList.includes(token) && pool.poolType == PoolTypes.Linear) {
            linearPools[id] = pool;
        }
    }
    return linearPools;
}

function getPoolsWith(token: string, poolsDict: PoolDictionary) {
    const poolsWithToken: PoolDictionary = {};
    for (const id in poolsDict) {
        const pool = poolsDict[id];
        const tokensList = pool.tokensList.map((address) =>
            address.toLowerCase()
        );
        if (tokensList.includes(token)) {
            poolsWithToken[id] = pool;
        }
    }
    return poolsWithToken;
}

function getSemiPaths(
    token: string,
    linearPoolsDict: PoolDictionary,
    poolsDict: PoolDictionary,
    toToken: string
): NewPath[] {
    if (token == toToken) return [getEmptyPath()];
    let semiPaths = searchConnectionsTo(token, poolsDict, toToken);
    for (const id in linearPoolsDict) {
        const linearPool = linearPoolsDict[id];
        const simpleLinearPath = createPath(
            [token, linearPool.address],
            [linearPool]
        );
        const connections = searchConnectionsTo(
            linearPool.address,
            poolsDict,
            toToken
        );
        const newSemiPaths = connections.map((connection) =>
            composePaths([simpleLinearPath, connection])
        );
        semiPaths = semiPaths.concat(newSemiPaths);
    }
    return semiPaths;
}

function combineSemiPaths(
    semiPathsIn: NewPath[],
    semiPathsOut: NewPath[],
    intermediatePath?: NewPath
): NewPath[] {
    const paths: NewPath[] = [];
    if (intermediatePath) {
        semiPathsIn = semiPathsIn.map((semiPathIn) =>
            composePaths([semiPathIn, intermediatePath])
        );
    }
    for (const semiPathIn of semiPathsIn) {
        for (const semiPathOut of semiPathsOut) {
            const path = composeSimplifyPath(semiPathIn, semiPathOut);
            if (path) paths.push(path);
        }
    }
    return paths;
}

function searchConnectionsTo(
    token: string,
    poolsDict: PoolDictionary,
    toToken: string
): NewPath[] {
    // this assumes that every pool in poolsDict contains toToken
    const connections: NewPath[] = [];
    for (const id in poolsDict) {
        const pool = poolsDict[id];
        const tokensList = pool.tokensList.map((address) =>
            address.toLowerCase()
        );
        if (tokensList.includes(token)) {
            const connection = createPath([token, toToken], [pool]);
            connections.push(connection);
        }
    }
    return connections;
}

function removeShortPaths(paths: NewPath[]): NewPath[] {
    // return paths;
    const answer = paths.filter((path) => path.swaps.length > 2);
    return answer;
}

function reversePath(path: NewPath): NewPath {
    if (path.pools.length == 0) return getEmptyPath();
    const pools = path.pools.reverse();
    const tokens = path.swaps.map((swap) => swap.tokenOut).reverse();
    tokens.push(path.swaps[0].tokenIn);
    return createPath(tokens, pools);
}

function getEmptyPath(): NewPath {
    const emptyPath: NewPath = {
        id: '',
        swaps: [],
        poolPairData: [],
        limitAmount: Zero, // logically this should be infinity, but no practical difference expected
        pools: [],
    };
    return emptyPath;
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
    poolsOfInterest: PoolDictionary
): string | null {
    let highestNormalizedLiquidity = ZERO;
    let highestNormalizedLiquidityPoolId: string | null = null;
    for (const id in poolsOfInterest) {
        const pool = poolsOfInterest[id];
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
        poolsFiltered
    );
    // Finds the best metastable Pool with tokenOut/staBal3Bpt or returns null if doesn't exist
    const metastablePoolIdOut = getHighestLiquidityPool(
        hopTokenStaBal,
        tokenOut,
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

function composeSimplifyPath(semiPathIn: NewPath, semiPathOut: NewPath) {
    let path: NewPath;
    if (semiPathIn.pools[semiPathIn.pools.length - 1] == semiPathOut.pools[0]) {
        const newPoolsIn = semiPathIn.pools.slice(0, -1);
        const newTokensIn = semiPathIn.swaps.map((swap) => swap.tokenIn);
        const tokensOut = semiPathOut.swaps.map((swap) => swap.tokenOut);
        path = createPath(
            newTokensIn.concat(tokensOut),
            newPoolsIn.concat(semiPathOut.pools)
        );
        for (const leftPool of newPoolsIn) {
            for (const rightPool of semiPathOut.pools) {
                if (leftPool == rightPool) {
                    return null;
                }
            }
        }
    } else {
        path = composePaths([semiPathIn, semiPathOut]);
    }
    return path;
}

function getLBP(
    token: string,
    poolsAllDict: PoolDictionary,
    isInitial: boolean,
    config: SorConfig
): [NewPath, string] {
    if (config.lbpRaisingTokens) {
        if (config.lbpRaisingTokens.includes(token)) {
            return [getEmptyPath(), token];
        } else {
            for (const id in poolsAllDict) {
                const pool = poolsAllDict[id];
                if (!pool.isLBP) continue;
                const tokensList = pool.tokensList;
                // We assume that the LBP has two tokens.
                for (let i = 0; i < 2; i++) {
                    if (tokensList[i] == token) {
                        const theOtherToken = tokensList[1 - i];
                        let path = createPath(
                            [tokensList[i], theOtherToken],
                            [pool]
                        );
                        if (!isInitial) path = reversePath(path);
                        if (config.lbpRaisingTokens.includes(theOtherToken))
                            return [path, theOtherToken];
                    }
                }
            }
            return [getEmptyPath(), token];
        }
    } else return [getEmptyPath(), token];
}
