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

const BOOSTED_PATHS_MAX_LENGTH = 7;

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

// We build a directed graph for the boosted pools.
// Nodes are tokens and edges are triads: [pool.id, tokenIn, tokenOut].
// The current criterion for including a pool into this graph is the following:
// (a) We include every linear pool.
// (b) Among phantom pools, we include those that contain the pool token of a linear pool.
// (c) Among every pool, we include those that contain the pool token of
// a pool from the previous step.
// (d) We include connections of tokenIn and tokenOut to WETH.
// (e) When tokenIn or tokenOut are tokens offered at an LBP, we also include
// the LBPs and the connections of the corresponding raising tokens with WETH.
// (f) We include the pool weth/wsteth
//
// To build the paths using boosted pools we use the following algorithm.
// Given a tokenIn and a tokenOut belonging to the graph, we want to find
// all the connecting paths inside the graph, with the properties:
// (a) They do not visit the same token twice
// (b) They do not use the same pool twice in a row (since this
// would never be optimal).
// These paths can be organized as a directed tree having tokenIn as a root.
// We build this tree by adding at each step all the possible continuations for
// each branch. When a branch reaches tokenOut, we write down the corresponding path.
// We only allow paths up to length BOOSTED_PATHS_MAX_LENGTH = 7

export function getBoostedGraph(
    tokenIn: string,
    tokenOut: string,
    poolsAllDict: PoolDictionary,
    config: SorConfig
): edgeDict {
    const wethAddress: string = config.weth.toLowerCase();
    const graphPoolsSet: Set<PoolBase> = new Set();
    const linearPools: PoolBase[] = [];
    const phantomPools: PoolBase[] = [];
    const relevantRaisingTokens: string[] = [];
    // Here we add all linear pools, take note of phantom pools,
    // add pools with tokenIn or tokenOut with weth,
    // add LBP pools with tokenIn or tokenOut and take note of the
    // corresponding raising tokens.
    for (const id in poolsAllDict) {
        const pool = poolsAllDict[id];
        if (pool.poolType == PoolTypes.Linear) {
            linearPools.push(pool);
            graphPoolsSet.add(pool);
        } else {
            // Here we asssume that phantom pools are exactly those that
            // are not linear and have their pool token in their tokensList.
            const tokensList = pool.tokensList.map((address) =>
                address.toLowerCase()
            );
            if (tokensList.includes(pool.address)) {
                phantomPools.push(pool);
            }
            // adds pools having tokenIn or tokenOut with weth
            if (
                tokenIn != wethAddress &&
                tokenOut != wethAddress &&
                tokensList.includes(wethAddress)
            ) {
                if (
                    tokensList.length <= 3 &&
                    (tokensList.includes(tokenIn) ||
                        tokensList.includes(tokenOut))
                ) {
                    graphPoolsSet.add(pool);
                }
            }
            if (config.lbpRaisingTokens) {
                const raisingTokens = config.lbpRaisingTokens.map((address) =>
                    address.toLowerCase()
                );
                if (pool.isLBP) {
                    const raisingTokenIn: string | undefined = getRaisingToken(
                        pool,
                        raisingTokens,
                        tokenIn
                    );
                    if (raisingTokenIn) {
                        graphPoolsSet.add(pool);
                        relevantRaisingTokens.push(raisingTokenIn);
                    }
                    const raisingTokenOut: string | undefined = getRaisingToken(
                        pool,
                        raisingTokens,
                        tokenOut
                    );
                    if (raisingTokenOut) {
                        graphPoolsSet.add(pool);
                        relevantRaisingTokens.push(raisingTokenOut);
                    }
                }
            }
        }
    }
    if (linearPools.length == 0) return {};
    const linearPoolsAddresses = linearPools.map((pool) => pool.address);
    const secondStepPoolsSet: Set<PoolBase> = new Set();
    for (const pool of phantomPools) {
        for (const linearPoolAddress of linearPoolsAddresses) {
            if (pool.tokensList.includes(linearPoolAddress)) {
                graphPoolsSet.add(pool);
                secondStepPoolsSet.add(pool);
            }
        }
    }
    const secondStepPoolsAddresses = [...secondStepPoolsSet].map(
        (pool) => pool.address
    );
    // Here we include every pool that has a pool token from the previous step
    // and pools having relevant raising tokens and WETH.
    for (const id in poolsAllDict) {
        const pool = poolsAllDict[id];
        for (const secondStepPoolAddress of secondStepPoolsAddresses) {
            if (pool.tokensList.includes(secondStepPoolAddress)) {
                graphPoolsSet.add(pool);
            }
        }
        const tokensList = pool.tokensList;
        for (const raisingToken of relevantRaisingTokens) {
            if (
                tokensList.includes(raisingToken) &&
                tokensList.includes(wethAddress) &&
                raisingToken !== wethAddress
            ) {
                graphPoolsSet.add(pool);
            }
        }
    }
    // add pool weth/wsteth when it exists
    if (config.wETHwstETH && poolsAllDict[config.wETHwstETH.id]) {
        graphPoolsSet.add(poolsAllDict[config.wETHwstETH.id]);
    }
    const graphPools: PoolBase[] = [...graphPoolsSet];
    const edgeDict = getNodesAndEdges(graphPools);
    return edgeDict;
}

interface edgeDict {
    [node: string]: [string, string, string][];
}

function getNodesAndEdges(pools: PoolBase[]): edgeDict {
    const edgesFromNode: edgeDict = {};
    for (const pool of pools) {
        const n = pool.tokensList.length;
        for (let i = 0; i < n; i++) {
            if (!edgesFromNode[pool.tokensList[i]])
                edgesFromNode[pool.tokensList[i]] = [];
            for (let j = 0; j < n; j++) {
                if (i == j) continue;
                const edge: [string, string, string] = [
                    pool.id,
                    pool.tokensList[i],
                    pool.tokensList[j],
                ];
                edgesFromNode[pool.tokensList[i]].push(edge);
            }
        }
    }
    return edgesFromNode;
}

interface treeEdge {
    edge: [string, string, string];
    parentIndices: [number, number];
    visitedNodes: string[];
}

export function getBoostedPaths(
    tokenIn: string,
    tokenOut: string,
    poolsAllDict: PoolDictionary,
    config: SorConfig
): NewPath[] {
    const edgesFromNode = getBoostedGraph(
        tokenIn,
        tokenOut,
        poolsAllDict,
        config
    );
    const pathsInfo: [string[], string[]][] = [];
    const rootTreeEdge: treeEdge = {
        edge: ['', '', tokenIn],
        parentIndices: [-1, -1],
        visitedNodes: [],
    };
    const treeEdges: treeEdge[][] = [[rootTreeEdge]];
    let iterate = true;
    while (iterate) {
        const n = treeEdges.length; // number of tree edge layers so far
        const newTreeEdges: treeEdge[] = [];
        // adds every possible treeEdge for each treeEdge of the previous layer
        for (let i = 0; i < treeEdges[n - 1].length; i++) {
            const treeEdge = treeEdges[n - 1][i];
            const token = treeEdge.edge[2];
            const edgesFromToken = edgesFromNode[token];
            if (!edgesFromToken) continue;
            for (const edge of edgesFromToken) {
                // skip if the node was already visited or
                // if the pool is the one from the previous edge
                if (
                    treeEdge.visitedNodes.includes(edge[2]) ||
                    treeEdge.edge[0] == edge[0]
                ) {
                    continue;
                }
                if (edge[2] == tokenOut) {
                    pathsInfo.push(getPathInfo(edge, treeEdge, treeEdges));
                }
                const newTreeEdge: treeEdge = {
                    edge: edge,
                    parentIndices: [n - 1, i],
                    visitedNodes: treeEdge.visitedNodes.concat(edge[1]),
                };
                newTreeEdges.push(newTreeEdge);
            }
        }
        if (newTreeEdges.length == 0) {
            iterate = false;
        } else treeEdges.push(newTreeEdges);
        if (n == BOOSTED_PATHS_MAX_LENGTH) iterate = false;
    }
    return pathsInfoToPaths(pathsInfo, poolsAllDict);
}

function getPathInfo(
    edge: [string, string, string],
    treeEdge: treeEdge,
    treeEdges: treeEdge[][]
): [string[], string[]] {
    const pathEdges: [string, string, string][] = [edge];
    pathEdges.unshift(treeEdge.edge);
    let indices = treeEdge.parentIndices;
    while (indices[0] !== -1) {
        pathEdges.unshift(treeEdges[indices[0]][indices[1]].edge);
        indices = treeEdges[indices[0]][indices[1]].parentIndices;
    }
    const pools = pathEdges.map((pathEdge) => pathEdge[0]);
    pools.splice(0, 1);
    const tokens = pathEdges.map((pathEdge) => pathEdge[2]);
    return [tokens, pools];
}

function pathsInfoToPaths(
    flexBoostedPathsInfo: [string[], string[]][],
    poolsAllDict: PoolDictionary
): NewPath[] {
    const paths: NewPath[] = [];
    for (const boostedPathInfo of flexBoostedPathsInfo) {
        const pools = boostedPathInfo[1].map((id) => poolsAllDict[id]);
        // ignore paths of length 1 and 2
        if (pools.length > 2) {
            paths.push(createPath(boostedPathInfo[0], pools));
        }
    }
    return paths;
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

function getRaisingToken(
    pool: PoolBase,
    lbpRaisingTokens: string[],
    token: string
): string | undefined {
    let theOtherToken: string | undefined;
    const tokensList = pool.tokensList;
    if (tokensList.includes(token) && !lbpRaisingTokens.includes(token)) {
        for (let i = 0; i < 2; i++) {
            if (tokensList[i] == token) {
                theOtherToken = tokensList[1 - i];
            }
        }
    }
    return theOtherToken;
}
