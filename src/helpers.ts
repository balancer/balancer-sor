import { BigNumber } from './utils/bignumber';
import { ethers } from 'ethers';
import { PoolPairData, Path } from './types';
import { getPoolsWithSingleToken, getPoolsWithToken } from './subgraph';
import {
    BONE,
    TWOBONE,
    MAX_IN_RATIO,
    MAX_OUT_RATIO,
    bmul,
    bdiv,
    bnum,
    calcOutGivenIn,
    calcInGivenOut,
    scale,
} from './bmath';

export function getLimitAmountSwap(
    poolPairData: PoolPairData,
    swapType: string
): BigNumber {
    if (swapType === 'swapExactIn') {
        return bmul(poolPairData.balanceIn, MAX_IN_RATIO);
    } else {
        return bmul(poolPairData.balanceOut, MAX_OUT_RATIO);
    }
}

export function getLimitAmountSwapPath(
    path: Path,
    swapType: string
): BigNumber {
    let poolPairDataList = path.poolPairDataList;
    if (poolPairDataList.length == 1)
        return getLimitAmountSwap(poolPairDataList[0], swapType);
    else if (poolPairDataList.length == 2) {
        if (swapType === 'swapExactIn') {
            return BigNumber.min(
                // The limit is either set by limit_IN of poolPairData 1 or indirectly by limit_IN of poolPairData 2
                getLimitAmountSwap(poolPairDataList[0], swapType),
                bmul(
                    getLimitAmountSwap(poolPairDataList[1], swapType),
                    getSpotPrice(poolPairDataList[0])
                ) // we need to multiply the limit_IN of
                // poolPairData 2 by the spotPrice of poolPairData 1 to get the equivalent in token IN
            );
        } else {
            return BigNumber.min(
                // The limit is either set by limit_OUT of poolPairData 2 or indirectly by limit_OUT of poolPairData 1
                getLimitAmountSwap(poolPairDataList[1], swapType),
                bdiv(
                    getLimitAmountSwap(poolPairDataList[0], swapType),
                    getSpotPrice(poolPairDataList[1])
                ) // we need to divide the limit_OUT of
                // poolPairData 1 by the spotPrice of poolPairData 2 to get the equivalent in token OUT
            );
        }
    } else {
        throw new Error('Path with more than 2 poolPairDataList not supported');
    }
}

export function getSpotPricePath(path: Path): BigNumber {
    let poolPairDataList = path.poolPairDataList;
    if (poolPairDataList.length == 1) return getSpotPrice(poolPairDataList[0]);
    else if (poolPairDataList.length == 2) {
        return bmul(
            getSpotPrice(poolPairDataList[0]),
            getSpotPrice(poolPairDataList[1])
        );
    } else {
        throw new Error('Path with more than 2 poolPairDataList not supported');
    }
}

export function getSpotPrice(poolPairData: PoolPairData): BigNumber {
    let inRatio = bdiv(poolPairData.balanceIn, poolPairData.weightIn);
    let outRatio = bdiv(poolPairData.balanceOut, poolPairData.weightOut);
    if (outRatio.isEqualTo(bnum(0))) {
        return bnum(0);
    } else {
        return bdiv(bdiv(inRatio, outRatio), BONE.minus(poolPairData.swapFee));
    }
}

export function getSlippageLinearizedSpotPriceAfterSwapPath(
    path: Path,
    swapType: string
): BigNumber {
    let poolPairDataList = path.poolPairDataList;
    if (poolPairDataList.length == 1)
        return getSlippageLinearizedSpotPriceAfterSwap(
            poolPairDataList[0],
            swapType
        );
    else if (poolPairDataList.length == 2) {
        let p1 = poolPairDataList[0];
        let p2 = poolPairDataList[1];
        if (
            p1.balanceIn.isEqualTo(bnum(0)) ||
            p2.balanceIn.isEqualTo(bnum(0))
        ) {
            return bnum(0);
        } else {
            // Since the numerator is the same for both 'swapExactIn' and 'swapExactOut' we do this first
            // See formulas on https://one.wolframcloud.com/env/fernando.martinel/SOR_multihop_analysis.nb
            let numerator1 = bmul(
                bmul(
                    bmul(BONE.minus(p1.swapFee), BONE.minus(p2.swapFee)), // In mathematica both terms are the negative (which compensates)
                    p1.balanceOut
                ),
                bmul(p1.weightIn, p2.weightIn)
            );

            let numerator2 = bmul(
                bmul(
                    p1.balanceOut.plus(p2.balanceIn),
                    BONE.minus(p1.swapFee) // In mathematica this is the negative but we add (instead of subtracting) numerator2 to compensate
                ),
                bmul(p1.weightIn, p2.weightOut)
            );

            let numerator3 = bmul(
                p2.balanceIn,
                bmul(p1.weightOut, p2.weightOut)
            );

            let numerator = numerator1.plus(numerator2).plus(numerator3);

            // The denominator is different for 'swapExactIn' and 'swapExactOut'
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
        }
    } else {
        throw new Error('Path with more than 2 poolPairDataList not supported');
    }
}

export function getSlippageLinearizedSpotPriceAfterSwap(
    poolPairData: PoolPairData,
    swapType: string
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return bdiv(
                bmul(BONE.minus(swapFee), bdiv(weightIn, weightOut)).plus(BONE),
                balanceIn
            );
        }
    } else {
        if (balanceOut.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return bdiv(
                bdiv(weightOut, bmul(BONE.minus(swapFee), weightIn)).plus(BONE),
                balanceOut
            );
        }
    }
}

export function getReturnAmountSwapPath(
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let poolPairDataList = path.poolPairDataList;
    if (poolPairDataList.length == 1)
        return getReturnAmountSwap(poolPairDataList[0], swapType, amount);
    else if (poolPairDataList.length == 2) {
        if (swapType === 'swapExactIn') {
            // The outputAmount is number of tokenOut we receive from the second poolPairData
            return getReturnAmountSwap(
                poolPairDataList[1],
                swapType,
                getReturnAmountSwap(poolPairDataList[0], swapType, amount)
            );
        } else {
            // The outputAmount is number of tokenIn we send to the first poolPairData
            return getReturnAmountSwap(
                poolPairDataList[0],
                swapType,
                getReturnAmountSwap(poolPairDataList[1], swapType, amount)
            );
        }
    } else {
        throw new Error('Path with more than 2 poolPairDataList not supported');
    }
}

export function getReturnAmountSwap(
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    if (swapType === 'swapExactIn') {
        if (balanceIn.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return calcOutGivenIn(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                amount,
                swapFee
            );
        }
    } else {
        if (balanceOut.isEqualTo(bnum(0))) {
            return bnum(0);
        } else {
            return calcInGivenOut(
                balanceIn,
                weightIn,
                balanceOut,
                weightOut,
                amount,
                swapFee
            );
        }
    }
}
// Based on the function of same name of file onchain-sor in file: BRegistry.sol
// Normalized liquidity is not used in any calculationf, but instead for comparison between poolPairDataList only
// so we can find the most liquid poolPairData considering the effect of uneven weigths
export function getNormalizedLiquidity(poolPairData: PoolPairData): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    return bdiv(bmul(balanceOut, weightIn), weightIn.plus(weightOut));
}

export async function getMultihopPoolsWithTokens(tokenIn, tokenOut) {
    //// Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    const dataTokenIn = await getPoolsWithSingleToken(tokenIn);
    const poolsTokenInNoTokenOut = filterPoolsWithoutToken(
        dataTokenIn.pools,
        tokenOut
    );
    // console.log(poolsTokenInNoTokenOut);

    const tokenInHopTokens = getTokensPairedToTokenInPool(
        poolsTokenInNoTokenOut,
        tokenIn
    );

    // Second: we get all tokens that can be used to be traded with tokenOut excluding
    // tokens that are in pools that already contain tokenIn (in which case multi-hop is not necessary)
    const dataTokenOut = await getPoolsWithSingleToken(tokenOut);
    const poolsTokenOutNoTokenIn = filterPoolsWithoutToken(
        dataTokenOut.pools,
        tokenIn
    );
    // console.log(poolsTokenOutNoTokenIn);

    const tokenOutHopTokens = getTokensPairedToTokenInPool(
        poolsTokenOutNoTokenIn,
        tokenOut
    );

    // Third: we find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    // code from https://stackoverflow.com/a/31931146
    var hopTokensSet = new Set(
        [...Array.from(tokenInHopTokens)].filter(i => tokenOutHopTokens.has(i))
    );
    // Transform set into Array
    var hopTokens = Array.from(hopTokensSet);
    // console.log(hopTokens);

    // Find the most liquid pool for each pair (tokenIn -> hopToken). We store an object in the form:
    // mostLiquidPoolsFirstHop = {hopToken1: mostLiquidPool, hopToken2: mostLiquidPool, ... , hopTokenN: mostLiquidPool}
    // Here we could query subgraph for all pools with pair (tokenIn -> hopToken), but to
    // minimize subgraph calls we loop through poolsTokenInNoTokenOut, and check the liquidity
    // only for those that have hopToken
    var mostLiquidPoolsFirstHop = [];
    for (var i = 0; i < hopTokens.length; i++) {
        var highestNormalizedLiquidity = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        var highestNormalizedLiquidityIndex = 0; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (var k = 0; k < poolsTokenInNoTokenOut.length; k++) {
            // We now loop to check if this pool has hopToken
            var found = false;
            for (
                var j = 0;
                j < poolsTokenInNoTokenOut[k].tokensList.length;
                j++
            ) {
                if (
                    poolsTokenInNoTokenOut[k].tokensList[j].toLowerCase() ==
                    hopTokens[i]
                ) {
                    found = true;
                    break;
                }
            }
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (found) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    parsePoolPairData(
                        poolsTokenInNoTokenOut[k],
                        tokenIn,
                        hopTokens[i].toString()
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThan(
                        highestNormalizedLiquidity
                    )
                ) {
                    highestNormalizedLiquidity = normalizedLiquidity;
                    highestNormalizedLiquidityIndex = k;
                }
            }
        }
        mostLiquidPoolsFirstHop[i] =
            poolsTokenInNoTokenOut[highestNormalizedLiquidityIndex];
        // console.log(highestNormalizedLiquidity)
        // console.log(mostLiquidPoolsFirstHop)
    }

    // console.log('mostLiquidPoolsFirstHop');
    // console.log(mostLiquidPoolsFirstHop);

    // Now similarly find the most liquid pool for each pair (hopToken -> tokenOut)
    var mostLiquidPoolsSecondHop = [];
    for (var i = 0; i < hopTokens.length; i++) {
        var highestNormalizedLiquidity = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        var highestNormalizedLiquidityIndex = 0; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (var k = 0; k < poolsTokenOutNoTokenIn.length; k++) {
            // We now loop to check if this pool has hopToken
            var found = false;
            for (
                var j = 0;
                j < poolsTokenOutNoTokenIn[k].tokensList.length;
                j++
            ) {
                if (
                    poolsTokenOutNoTokenIn[k].tokensList[j].toLowerCase() ==
                    hopTokens[i]
                ) {
                    found = true;
                    break;
                }
            }
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (found) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    parsePoolPairData(
                        poolsTokenOutNoTokenIn[k],
                        hopTokens[i].toString(),
                        tokenOut
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThan(
                        highestNormalizedLiquidity
                    )
                ) {
                    highestNormalizedLiquidity = normalizedLiquidity;
                    highestNormalizedLiquidityIndex = k;
                }
            }
        }
        mostLiquidPoolsSecondHop[i] =
            poolsTokenOutNoTokenIn[highestNormalizedLiquidityIndex];
        // console.log(highestNormalizedLiquidity)
        // console.log(mostLiquidPoolsSecondHop)
    }
    return [mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens];
}

export const parsePoolData = (
    directPools,
    tokenIn: string,
    tokenOut: string,
    mostLiquidPoolsFirstHop = [],
    mostLiquidPoolsSecondHop = [],
    hopTokens = []
): Path[] => {
    let pathDataList: Path[] = [];

    // First add direct pair paths
    directPools.forEach(p => {
        let poolPairData = parsePoolPairData(p, tokenIn, tokenOut);

        let path = {
            id: poolPairData.id,
            poolPairDataList: [poolPairData],
        };
        pathDataList.push(path);
    });

    // Now add multi-hop paths.
    // mostLiquidPoolsFirstHop always has the same lengh of mostLiquidPoolsSecondHop
    for (let i = 0; i < mostLiquidPoolsFirstHop.length; i++) {
        let poolFirstHop = parsePoolPairData(
            mostLiquidPoolsFirstHop[i],
            tokenIn,
            hopTokens[i]
        );
        let poolSecondHop = parsePoolPairData(
            mostLiquidPoolsSecondHop[i],
            hopTokens[i],
            tokenOut
        );

        let path = {
            id: poolFirstHop.id + poolSecondHop.id, // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
            poolPairDataList: [poolFirstHop, poolSecondHop],
        };

        pathDataList.push(path);
    }
    return pathDataList;
};

export const parsePoolPairData = (
    p,
    tokenIn: string,
    tokenOut: string
): PoolPairData => {
    let tI = p.tokens.find(
        t =>
            ethers.utils.getAddress(t.address) ===
            ethers.utils.getAddress(tokenIn)
    );
    let tO = p.tokens.find(
        t =>
            ethers.utils.getAddress(t.address) ===
            ethers.utils.getAddress(tokenOut)
    );
    let poolPairData = {
        id: p.id,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        decimalsIn: tI.decimals,
        decimalsOut: tO.decimals,
        balanceIn: scale(bnum(tI.balance), tI.decimals),
        balanceOut: scale(bnum(tO.balance), tO.decimals),
        weightIn: scale(bnum(tI.denormWeight).div(bnum(p.totalWeight)), 18),
        weightOut: scale(bnum(tO.denormWeight).div(bnum(p.totalWeight)), 18),
        swapFee: scale(bnum(p.swapFee), 18),
    };

    return poolPairData;
};

function filterPoolsWithoutToken(pools, token) {
    var found;
    var OutputPools = [];
    for (var i = 0; i < pools.length; i++) {
        found = false;
        for (var k = 0; k < pools[i].tokensList.length; k++) {
            if (pools[i].tokensList[k].toLowerCase() == token.toLowerCase()) {
                found = true;
                break;
            }
        }
        //Append pool if token not found
        if (!found) OutputPools.push(pools[i]);
    }
    return OutputPools;
}

// Inputs:
// - pools: All pools that contain a token
// - token: Token for which we are looking for pairs
// Outputs:
// - tokens: Set (without duplicate elements) of all tokens that pair with token
function getTokensPairedToTokenInPool(pools, token) {
    var found;
    var tokens = new Set();
    for (var i = 0; i < pools.length; i++) {
        found = false;
        for (var k = 0; k < pools[i].tokensList.length; k++) {
            if (pools[i].tokensList[k].toLowerCase() != token.toLowerCase()) {
                tokens.add(pools[i].tokensList[k]);
            }
        }
    }
    return tokens;
}

export async function getTokenPairsMultiHop(token) {
    // Get all tokens that can be accessed through multi-hop (only 2 hops possible for now)
    let directTokenPairsSet = new Set();
    let multihopTokenPairsSet = new Set();
    let allTokenPairsSet = new Set();
    let poolsWithTokenData = await getPoolsWithToken(token);
    let poolsWithToken = poolsWithTokenData.pools;
    // console.log(poolsWithToken)
    for (var i = 0; i < poolsWithToken.length; i++) {
        for (var k = 0; k < poolsWithToken[i].tokensList.length; k++) {
            directTokenPairsSet.add(poolsWithToken[i].tokensList[k]);
            allTokenPairsSet.add(poolsWithToken[i].tokensList[k]);
        }
    }
    // Get all pools that each directTokenPair has and add tokens that are present in them, these are the multihop tokens of token
    let directTokenPairs = Array.from(directTokenPairsSet);
    // console.log(directTokenPairs)

    for (var j = 0; j < directTokenPairs.length; j++) {
        let poolsWithDirectTokenPairData = await getPoolsWithToken(
            directTokenPairs[j]
        );
        let poolsWithDirectTokenPair = poolsWithDirectTokenPairData.pools;
        for (var i = 0; i < poolsWithDirectTokenPair.length; i++) {
            for (
                var k = 0;
                k < poolsWithDirectTokenPair[i].tokensList.length;
                k++
            ) {
                allTokenPairsSet.add(poolsWithDirectTokenPair[i].tokensList[k]);
            }
        }
    }
    let allTokenPairs = Array.from(allTokenPairsSet);
    return [directTokenPairs, allTokenPairs];
}
