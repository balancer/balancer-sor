import { ALLOW_ADD_REMOVE } from './config';
import {
    DisabledOptions,
    SubgraphPoolBase,
    PoolDictionary,
    SwapPairType,
    NewPath,
    Swap,
    PoolBase,
    PoolPairBase,
} from './types';
import { WeightedPool } from './pools/weightedPool/weightedPool';
import { StablePool } from './pools/stablePool/stablePool';
import { ElementPool } from './pools/elementPool/elementPool';
import { MetaStablePool } from './pools/metaStablePool/metaStablePool';
import { LinearPool } from './pools/linearPool/linearPool';
import { ZERO } from './bmath';
import { STABLEINFO } from './addresses';

import disabledTokensDefault from './disabled-tokens.json';
import { getHighestLimitAmountsForPaths } from 'index';
import { BigNumber } from 'utils/bignumber';

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
    disabledOptions: DisabledOptions = {
        isOverRide: false,
        disabledTokens: [],
    },
    currentBlockTimestamp: number = 0,
    chainId: number = 42
): [PoolDictionary, string[]] {
    const poolsDictionary: PoolDictionary = {};

    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let tokenInPairedTokens: Set<string> = new Set();
    let tokenOutPairedTokens: Set<string> = new Set();

    let disabledTokens = disabledTokensDefault.tokens;
    if (disabledOptions.isOverRide)
        disabledTokens = disabledOptions.disabledTokens;

    allPools.forEach(pool => {
        if (pool.tokensList.length === 0 || pool.tokens[0].balance === '0') {
            return;
        }
        let newPool: WeightedPool | StablePool | ElementPool | LinearPool;

        if (pool.poolType === 'Weighted')
            newPool = new WeightedPool(
                pool.id,
                pool.address,
                pool.swapFee,
                pool.totalWeight,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );
        else if (pool.poolType === 'Stable')
            newPool = new StablePool(
                pool.id,
                pool.address,
                pool.amp,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList
            );
        else if (pool.poolType === 'Element') {
            newPool = new ElementPool(
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
            newPool = new MetaStablePool(
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
                newPool = new WeightedPool(
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
            newPool = new LinearPool(
                pool.id,
                pool.address,
                pool.swapFee,
                pool.totalShares,
                pool.tokens,
                pool.tokensList,
                pool.wrappedIndex,
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
        if (ALLOW_ADD_REMOVE) tokenListSet.add(pool.address);

        disabledTokens.forEach(token => tokenListSet.delete(token.address));
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
            let containsTokenIn = tokenListSet.has(tokenIn);
            let containsTokenOut = tokenListSet.has(tokenOut);

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
        // Always add the "MULTISTABLEPOOL" and linear pools.
        if (
            pool.address === STABLEINFO[chainId].MULTISTABLEPOOL.address ||
            pool.poolType === 'Linear'
        ) {
            poolsDictionary[pool.id] = newPool;
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

/*
Find the most liquid pool for each hop (i.e. tokenIn->hopToken & hopToken->tokenOut).
Creates paths for each pool of interest (multi & direct pools).
*/
export function filterHopPools(
    tokenIn: string,
    tokenOut: string,
    hopTokens: string[],
    poolsOfInterest: PoolDictionary,
    chainId: number = 42
): [PoolDictionary, NewPath[]] {
    const filteredPoolsOfInterest: PoolDictionary = {};
    const paths: NewPath[] = [];

    for (let id in poolsOfInterest) {
        if (poolsOfInterest[id].swapPairType === SwapPairType.Direct) {
            const path = createDirectPath(
                poolsOfInterest[id],
                tokenIn,
                tokenOut
            );
            paths.push(path);
            filteredPoolsOfInterest[id] = poolsOfInterest[id];
        }
    }

    for (let hopToken of hopTokens) {
        let highestNormalizedLiquidityFirstPoolId = getHighestLiquidityPool(
            tokenIn,
            hopToken,
            SwapPairType.HopIn,
            poolsOfInterest
        );
        let highestNormalizedLiquiditySecondPoolId = getHighestLiquidityPool(
            hopToken,
            tokenOut,
            SwapPairType.HopOut,
            poolsOfInterest
        );

        filteredPoolsOfInterest[highestNormalizedLiquidityFirstPoolId] =
            poolsOfInterest[highestNormalizedLiquidityFirstPoolId];
        filteredPoolsOfInterest[highestNormalizedLiquiditySecondPoolId] =
            poolsOfInterest[highestNormalizedLiquiditySecondPoolId];
        const path1 = createDirectPath(
            poolsOfInterest[highestNormalizedLiquidityFirstPoolId],
            tokenIn,
            hopToken
        );
        const path2 = createDirectPath(
            poolsOfInterest[highestNormalizedLiquiditySecondPoolId],
            hopToken,
            tokenOut
        );
        const path = composePaths([path1, path2]);
        paths.push(path);
    }
    // always add multiStablePool to filteredPoolsOfInterest
    //    let multiStableId = STABLEINFO[chainId].MULTISTABLEPOOL.id;
    //    filteredPoolsOfInterest[multiStableId] = poolsOfInterest[multiStableId];
    return [filteredPoolsOfInterest, paths];
}

export function getPathsUsingLinearPools(
    tokenIn: string,
    tokenOut: string,
    chainId: number,
    pools: PoolDictionary
): NewPath[] {
    // stableMap maps addresses of stable coins to their symbols.
    // If it is not a stable coin, stableMap will return undefined.
    type symbolMap = { [address: string]: string };
    let stableMap: symbolMap = {};
    for (let symbol in STABLEINFO[chainId].STABLECOINS) {
        stableMap[STABLEINFO[chainId].STABLECOINS[symbol].address] = symbol;
    }

    let pathsUsingLinear: NewPath[] = [];
    let symbolIn = stableMap[tokenIn];
    let symbolOut = stableMap[tokenOut];

    // If neither of tokenIn and tokenOut are stable coins, return an empty array.
    if (!symbolIn && !symbolOut) {
        return pathsUsingLinear;
    }

    // Since linear are not activated yet, return
    let linearActivated: boolean = false;
    if (!linearActivated) return pathsUsingLinear;

    // If both tokenIn and tokenOut are stable coins, return linear-multistable-linear path
    if (symbolIn && symbolOut) {
        let linearPathway = makeLinearPathway(
            tokenIn,
            tokenOut,
            symbolIn,
            symbolOut,
            pools,
            chainId
        );
        pathsUsingLinear.push(linearPathway);
    }
    // If just one of tokenIn and tokenOut is stable, return linear-multistable-linear
    // composed with highest liquidity pool at the other end.
    if (symbolIn && !symbolOut) {
        let stablecoins = STABLEINFO[chainId].STABLECOINS;
        for (let symbol in stablecoins) {
            let stableHopToken = stablecoins[symbol].address;
            if (stableHopToken == tokenIn) continue;
            let linearPathway = makeLinearPathway(
                tokenIn,
                stableHopToken,
                symbolIn,
                symbol,
                pools,
                chainId
            );
            let lastPoolId = getHighestLiquidityPool(
                stableHopToken,
                tokenOut,
                SwapPairType.HopOut,
                pools
            );
            let lastPool = pools[lastPoolId];
            let pathEnd = createDirectPath(lastPool, stableHopToken, tokenOut);
            pathsUsingLinear.push(composePaths([linearPathway, pathEnd]));
        }
    }
    if (!symbolIn && symbolOut) {
        let stablecoins = STABLEINFO[chainId].STABLECOINS;
        for (let symbol in stablecoins) {
            let stableHopToken = stablecoins[symbol].address;
            if (stableHopToken == tokenOut) continue;
            let linearPathway = makeLinearPathway(
                stableHopToken,
                tokenOut,
                symbol,
                symbolOut,
                pools,
                chainId
            );
            let firstPoolId = getHighestLiquidityPool(
                tokenIn,
                stableHopToken,
                SwapPairType.HopIn,
                pools
            );
            let firstPool = pools[firstPoolId];
            let pathStart = createDirectPath(
                firstPool,
                stableHopToken,
                tokenOut
            );
            pathsUsingLinear.push(composePaths([pathStart, linearPathway]));
        }
    }
    return pathsUsingLinear;
}

function getHighestLiquidityPool(
    tokenIn: string,
    tokenOut: string,
    swapPairType: SwapPairType,
    poolsOfInterest: PoolDictionary
): string {
    let highestNormalizedLiquidity = ZERO;
    let highestNormalizedLiquidityPoolId: string;
    for (let id in poolsOfInterest) {
        const pool = poolsOfInterest[id];
        if (swapPairType != pool.swapPairType) continue;
        let tokenListSet = new Set(pool.tokensList);
        // Depending on env file, we add the BPT as well as
        // we can join/exit as part of the multihop
        if (ALLOW_ADD_REMOVE) tokenListSet.add(pool.address);
        // MAKE THIS A FLAG IN FILTER?
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
    let id: string = '';
    let swaps: Swap[] = [];
    let poolPairData: PoolPairBase[] = [];
    let pools: PoolBase[] = [];
    for (let path of paths) {
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
    symbolIn: string,
    symbolOut: string,
    poolsOfInterest: PoolDictionary,
    chainId: number
): NewPath {
    let linearPoolInId = STABLEINFO[chainId].STABLECOINS[symbolIn].linearPoolId;
    let linearPoolOutId =
        STABLEINFO[chainId].STABLECOINS[symbolOut].linearPoolId;
    let linearPoolInBPT =
        STABLEINFO[chainId].STABLECOINS[symbolIn].linearPoolAddress;
    let linearPoolOutBPT =
        STABLEINFO[chainId].STABLECOINS[symbolOut].linearPoolAddress;

    let linearPoolIn = poolsOfInterest[linearPoolInId];
    let linearPoolInPath = createDirectPath(
        linearPoolIn,
        tokenIn,
        linearPoolInBPT
    );

    let multiStablePool =
        poolsOfInterest[STABLEINFO[chainId].MULTISTABLEPOOL.id];
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
