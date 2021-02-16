import { BigNumber } from './utils/bignumber';
import { getAddress } from '@ethersproject/address';
import {
    PoolPairData,
    Path,
    Pool,
    PoolDictionary,
    Swap,
    DisabledOptions,
} from './types';
import {
    BONE,
    MAX_IN_RATIO,
    MAX_OUT_RATIO,
    bmul,
    bdiv,
    bnum,
    calcOutGivenIn,
    calcInGivenOut,
    scale,
} from './bmath';
import disabledTokensDefault from './disabled-tokens.json';

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

export function getLimitAmountSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getLimitAmountSwap(poolPairData[0], swapType);
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            let limitAmountSwap1 = getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            let limitAmountSwap2 = getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            let limitOutputAmountSwap1 = getOutputAmountSwap(
                poolPairData[0],
                swapType,
                limitAmountSwap1
            );
            if (limitOutputAmountSwap1.gt(limitAmountSwap2))
                // This means second hop is limiting the path
                return getOutputAmountSwap(
                    poolPairData[0],
                    'swapExactOut',
                    limitAmountSwap2
                );
            // This means first hop is limiting the path
            else return limitAmountSwap1;
        } else {
            let limitAmountSwap1 = getLimitAmountSwap(
                poolPairData[0],
                swapType
            );
            let limitAmountSwap2 = getLimitAmountSwap(
                poolPairData[1],
                swapType
            );
            let limitOutputAmountSwap2 = getOutputAmountSwap(
                poolPairData[1],
                swapType,
                limitAmountSwap2
            );
            if (limitOutputAmountSwap2.gt(limitAmountSwap1))
                // This means first hop is limiting the path
                return getOutputAmountSwap(
                    poolPairData[1],
                    'swapExactIn',
                    limitAmountSwap1
                );
            // This means second hop is limiting the path
            else return limitAmountSwap2;
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getOutputAmountSwap(
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let {
        weightIn,
        weightOut,
        balanceIn,
        balanceOut,
        swapFee,
        tokenIn,
        tokenOut,
    } = poolPairData;
    let returnAmount: BigNumber;

    // TODO: won't be necessary once we change the type of PoolPairData
    let wi, wo, Bi, Bo, f;

    // TODO solve problem with deep copy turning Bignumber into Number
    // This if is a temporary solution
    if (typeof weightIn == 'string') {
        wi = Number(weightIn);
        wo = Number(weightOut);
        Bi = Number(balanceIn);
        Bo = Number(balanceOut);
        f = Number(swapFee) / 1000000000000000000;
    } else {
        wi = weightIn.toNumber();
        wo = weightOut.toNumber();
        Bi = balanceIn.toNumber();
        Bo = balanceOut.toNumber();
        f = swapFee.div(bnum(1000000000000000000)).toNumber();
    }

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (Bi == 0) {
            return bnum(0);
        } else {
            let Ai = amount.toNumber();
            // return Bo-Bo*(Bi/(Ai+Bi-Ai*f))**(wi/wo)
            return bnum(Bo - Bo * Math.pow(Bi / (Ai + Bi - Ai * f), wi / wo));
        }
    } else {
        if (Bo == 0) {
            return bnum(0);
        } else {
            let Ao = amount.toNumber();
            if (Ao >= Bo) return bnum('Infinity');
            // return -((Bi*(-1+(Bo/(-Ao+Bo))**(wo/wi)))/(-1+f))
            else
                return bnum(
                    -(
                        (Bi * (-1 + Math.pow(Bo / (-Ao + Bo), wo / wi))) /
                        (-1 + f)
                    )
                );
        }
    }
}

export function getOutputAmountSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    // First of all check if the amount is above limit, if so, return 0 for
    // 'swapExactIn' or Inf for swapExactOut
    if (amount.gt(path.limitAmount)) {
        if (swapType === 'swapExactIn') {
            return bnum(0);
        } else {
            return bnum(Infinity);
        }
    }

    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getOutputAmountSwap(poolPairData[0], swapType, amount);
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            // The outputAmount is number of tokenOut we receive from the second poolPairData
            let outputAmountSwap1 = getOutputAmountSwap(
                poolPairData[0],
                swapType,
                amount
            );
            return getOutputAmountSwap(
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
        } else {
            // The outputAmount is number of tokenIn we send to the first poolPairData
            let outputAmountSwap2 = getOutputAmountSwap(
                poolPairData[1],
                swapType,
                amount
            );
            return getOutputAmountSwap(
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

export function getEffectivePriceSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    if (amount.isZero()) {
        // Return spot price as code below would be 0/0 = undefined
        return getSpotPriceAfterSwapForPath(pools, path, swapType, amount);
    }
    let outputAmountSwap = getOutputAmountSwapForPath(
        pools,
        path,
        swapType,
        amount
    );
    if (swapType === 'swapExactIn') {
        return amount.div(outputAmountSwap); // amountIn/AmountOut
    } else {
        return outputAmountSwap.div(amount); // amountIn/AmountOut
    }
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getSpotPriceAfterSwap(
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let {
        weightIn,
        weightOut,
        balanceIn,
        balanceOut,
        swapFee,
        tokenIn,
        tokenOut,
    } = poolPairData;
    let returnAmount: BigNumber;

    // TODO: won't be necessary once we change the type of PoolPairData
    let wi, wo, Bi, Bo, f;

    // TODO solve problem with deep copy turning Bignumber into Number
    // This if is a temporary solution
    // if (typeof weightIn == 'string') {
    //     wi = Number(weightIn);
    //     wo = Number(weightOut);
    //     Bi = Number(balanceIn);
    //     Bo = Number(balanceOut);
    //     f = Number(swapFee) / 1000000000000000000;
    // } else {
    wi = weightIn.toNumber();
    wo = weightOut.toNumber();
    Bi = balanceIn.toNumber();
    Bo = balanceOut.toNumber();
    f = swapFee.div(bnum(1000000000000000000)).toNumber();
    // }

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (Bi == 0) {
            return bnum(0);
        } else {
            let Ai = amount.toNumber();
            // return -((Bi*wo)/(Bo*(-1+f)*(Bi/(Ai+Bi-Ai*f))**((wi+wo)/wo)*wi))
            return bnum(
                -(
                    (Bi * wo) /
                    (Bo *
                        (-1 + f) *
                        Math.pow(Bi / (Ai + Bi - Ai * f), (wi + wo) / wo) *
                        wi)
                )
            );
        }
    } else {
        if (Bo == 0) {
            return bnum(0);
        } else {
            let Ao = amount.toNumber();
            // return return -((Bi*(Bo/(-Ao+Bo))**((wi+wo)/wi)*wo)/(Bo*(-1+f)*wi))
            return bnum(
                -(
                    (Bi * Math.pow(Bo / (-Ao + Bo), (wi + wo) / wi) * wo) /
                    (Bo * (-1 + f) * wi)
                )
            );
        }
    }
}

export function getSpotPriceAfterSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getSpotPriceAfterSwap(poolPairData[0], swapType, amount);
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            let outputAmountSwap1 = getOutputAmountSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let spotPriceAfterSwap1 = getSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let spotPriceAfterSwap2 = getSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
            return spotPriceAfterSwap1.times(spotPriceAfterSwap2);
        } else {
            let outputAmountSwap2 = getOutputAmountSwap(
                poolPairData[1],
                swapType,
                amount
            );
            let spotPriceAfterSwap1 = getSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let spotPriceAfterSwap2 = getSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                amount
            );
            return spotPriceAfterSwap1.times(spotPriceAfterSwap2);
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getDerivativeSpotPriceAfterSwap(
    poolPairData: PoolPairData,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let {
        weightIn,
        weightOut,
        balanceIn,
        balanceOut,
        swapFee,
        tokenIn,
        tokenOut,
    } = poolPairData;
    let returnAmount: BigNumber;

    // TODO: won't be necessary once we change the type of PoolPairData
    let wi, wo, Bi, Bo, f;

    // TODO solve problem with deep copy turning Bignumber into Number
    // This if is a temporary solution
    if (typeof weightIn == 'string') {
        wi = Number(weightIn);
        wo = Number(weightOut);
        Bi = Number(balanceIn);
        Bo = Number(balanceOut);
        f = Number(swapFee) / 1000000000000000000;
    } else {
        wi = weightIn.toNumber();
        wo = weightOut.toNumber();
        Bi = balanceIn.toNumber();
        Bo = balanceOut.toNumber();
        f = swapFee.div(bnum(1000000000000000000)).toNumber();
    }

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === 'swapExactIn') {
        if (Bi == 0) {
            return bnum(0);
        } else {
            let Ai = amount.toNumber();
            // return (wi+wo)/(Bo*(Bi/(Ai+Bi-Ai*f))**(wi/wo)*wi)
            return bnum(
                (wi + wo) /
                    (Bo * Math.pow(Bi / (Ai + Bi - Ai * f), wi / wo) * wi)
            );
        }
    } else {
        if (Bo == 0) {
            return bnum(0);
        } else {
            let Ao = amount.toNumber();
            if (Ao >= Bo) return bnum('Infinity');
            // return -((Bi*(Bo/(-Ao + Bo))**(wo/wi)*wo*(wi + wo))/((Ao - Bo)**2*(-1 + f)*wi**2))
            else
                return bnum(
                    -(
                        (Bi *
                            Math.pow(Bo / (-Ao + Bo), wo / wi) *
                            wo *
                            (wi + wo)) /
                        (Math.pow(Ao - Bo, 2) * (-1 + f) * wi * wi)
                    )
                );
        }
    }
}

export function getDerivativeSpotPriceAfterSwapForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string,
    amount: BigNumber
): BigNumber {
    let poolPairData = path.poolPairData;
    if (poolPairData.length == 1) {
        return getDerivativeSpotPriceAfterSwap(
            poolPairData[0],
            swapType,
            amount
        );
    } else if (poolPairData.length == 2) {
        if (swapType === 'swapExactIn') {
            let outputAmountSwap1 = getOutputAmountSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let SPaS1 = getSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let SPaS2 = getSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
            let dSPaS1 = getDerivativeSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                amount
            );
            let dSPaS2 = getDerivativeSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                outputAmountSwap1
            );
            // Using the rule of the derivative of the multiplication: d[f(x)*g(x)] = d[f(x)]*g(x) + f(x)*d[g(x)]
            // where SPaS1 is SpotPriceAfterSwap of pool 1 and OA1 is OutputAmount of pool 1. We then have:
            // d[SPaS1(x) * SPaS2(OA1(x))] = d[SPaS1(x)] * SPaS2(OA1(x)) + SPaS1(x) * d[SPaS2(OA1(x))]
            // Let's expand the term d[SPaS2(OA1(x))] which is trickier:
            // d[SPaS2(OA1(x))] at x0 = d[SPaS2(x)] at OA1(x0) * d[OA1(x)] at x0,
            // Since d[OA1(x)] = SPaS1(x) we then have:
            // d[SPaS2(OA1(x))] = d[SPaS2(x)] * SPaS1(x). Which leads us to:
            // d[SPaS1(x) * SPaS2(OA1(x))] = d[SPaS1(x)] * SPaS2(OA1(x)) + SPaS1(x)**2 * d[SPaS2(OA1(x))]
            // return dSPaS1 * SPaS2 + SPaS1*SPaS1 * dSPaS2
            return dSPaS1.times(SPaS2).plus(SPaS1.times(SPaS1).times(dSPaS2));
        } else {
            let outputAmountSwap2 = getOutputAmountSwap(
                poolPairData[1],
                swapType,
                amount
            );
            let SPaS1 = getSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let SPaS2 = getSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                amount
            );
            let dSPaS1 = getDerivativeSpotPriceAfterSwap(
                poolPairData[0],
                swapType,
                outputAmountSwap2
            );
            let dSPaS2 = getDerivativeSpotPriceAfterSwap(
                poolPairData[1],
                swapType,
                amount
            );
            // Using an analogy to swapExactIn described above (just swap 1 for 2) we have
            // return dSPaS2 * SPaS1 + SPaS2*SPaS2 * dSPaS1
            return dSPaS2.times(SPaS1).plus(SPaS2.times(SPaS2).times(dSPaS1));
        }
    } else {
        throw new Error('Path with more than 2 swaps not supported');
    }
}

export function getHighestLimitAmountsForPaths(
    paths: Path[],
    maxPools: number
): BigNumber[] {
    if (paths.length === 0) return [];
    let limitAmounts = [];
    for (let i = 1; i < maxPools + 1; i++) {
        let limitAmount = paths[i].limitAmount;
        limitAmounts.push(limitAmount);
    }
    return limitAmounts;
}

export const parsePoolPairData = (
    p: Pool,
    tokenIn: string,
    tokenOut: string
): PoolPairData => {
    let tI = p.tokens.find(t => getAddress(t.address) === getAddress(tokenIn));
    // console.log("tI")
    // console.log(tI.balance.toString());
    // console.log(tI)
    let tO = p.tokens.find(t => getAddress(t.address) === getAddress(tokenOut));

    // console.log("tO")
    // console.log(tO.balance.toString());
    // console.log(tO)

    let poolPairData = {
        id: p.id,
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        decimalsIn: tI.decimals,
        decimalsOut: tO.decimals,
        balanceIn: bnum(tI.balance),
        balanceOut: bnum(tO.balance),
        weightIn: scale(bnum(tI.denormWeight).div(bnum(p.totalWeight)), 18),
        weightOut: scale(bnum(tO.denormWeight).div(bnum(p.totalWeight)), 18),
        swapFee: bnum(p.swapFee),
    };

    return poolPairData;
};

// Transfors path information into poolPairData list
export function parsePoolPairDataForPath(
    pools: PoolDictionary,
    path: Path,
    swapType: string
): PoolPairData[] {
    let swaps = path.swaps;
    if (swaps.length == 1) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        return [poolPairDataSwap1];
    } else if (swaps.length == 2) {
        let swap1 = swaps[0];
        let poolSwap1 = pools[swap1.pool];
        let poolPairDataSwap1 = parsePoolPairData(
            poolSwap1,
            swap1.tokenIn,
            swap1.tokenOut
        );
        let swap2 = swaps[1];
        let poolSwap2 = pools[swap2.pool];
        let poolPairDataSwap2 = parsePoolPairData(
            poolSwap2,
            swap2.tokenIn,
            swap2.tokenOut
        );
        return [poolPairDataSwap1, poolPairDataSwap2];
    }
}

// TODO calculate exact EVM result using bmath

// export function EVMgetOutputAmountSwap(
//     pools: PoolDictionary,
//     poolPairData: PoolPairData,
//     swapType: string,
//     amount: BigNumber
// ): BigNumber {
//     let {
//         weightIn,
//         weightOut,
//         balanceIn,
//         balanceOut,
//         swapFee,
//         tokenIn,
//         tokenOut,
//     } = poolPairData;
//     let returnAmount: BigNumber;

//     if (swapType === 'swapExactIn') {
//         if (balanceIn.isEqualTo(bnum(0))) {
//             return bnum(0);
//         } else {
//             returnAmount = calcOutGivenIn(
//                 balanceIn,
//                 weightIn,
//                 balanceOut,
//                 weightOut,
//                 amount,
//                 swapFee
//             );
//             // Update balances of tokenIn and tokenOut
//             pools[poolPairData.id] = updateTokenBalanceForPool(
//                 pools[poolPairData.id],
//                 tokenIn,
//                 balanceIn.plus(amount)
//             );
//             pools[poolPairData.id] = updateTokenBalanceForPool(
//                 pools[poolPairData.id],
//                 tokenOut,
//                 balanceOut.minus(returnAmount)
//             );
//             return returnAmount;
//         }
//     } else {
//         if (balanceOut.isEqualTo(bnum(0))) {
//             return bnum(0);
//         } else if (amount.times(3).gte(balanceOut)) {
//             // The maximum amoutOut you can have is 1/3 of the balanceOut to ensure binomial approximation diverges
//             return bnum(0);
//         } else {
//             returnAmount = calcInGivenOut(
//                 balanceIn,
//                 weightIn,
//                 balanceOut,
//                 weightOut,
//                 amount,
//                 swapFee
//             );
//             // Update balances of tokenIn and tokenOut
//             pools[poolPairData.id] = updateTokenBalanceForPool(
//                 pools[poolPairData.id],
//                 tokenIn,
//                 balanceIn.plus(returnAmount)
//             );
//             pools[poolPairData.id] = updateTokenBalanceForPool(
//                 pools[poolPairData.id],
//                 tokenOut,
//                 balanceOut.minus(amount)
//             );
//             return returnAmount;
//         }
//     }
// }

// Updates the balance of a given token for a given pool passed as parameter
export function updateTokenBalanceForPool(
    pool: any,
    token: string,
    balance: BigNumber
): any {
    // console.log("pool")
    // console.log(pool)
    // console.log("token")
    // console.log(token)
    // console.log("balance")
    // console.log(balance)

    // Scale down back as balances are stored scaled down by the decimals
    let T = pool.tokens.find(t => t.address === token);
    T.balance = balance;
    return pool;
}

// Based on the function of same name of file onchain-sor in file: BRegistry.sol
// Normalized liquidity is not used in any calculationf, but instead for comparison between poolPairDataList only
// so we can find the most liquid poolPairData considering the effect of uneven weigths
export function getNormalizedLiquidity(poolPairData: PoolPairData): BigNumber {
    let { weightIn, weightOut, balanceIn, balanceOut, swapFee } = poolPairData;
    return bdiv(bmul(balanceOut, weightIn), weightIn.plus(weightOut));
}

// LEGACY FUNCTION - Keep Input/Output Format
export const parsePoolData = (
    directPools: PoolDictionary,
    tokenIn: string,
    tokenOut: string,
    mostLiquidPoolsFirstHop: Pool[] = [],
    mostLiquidPoolsSecondHop: Pool[] = [],
    hopTokens: string[] = []
): [PoolDictionary, Path[]] => {
    let pathDataList: Path[] = [];
    let pools: PoolDictionary = {};

    // First add direct pair paths
    for (let idKey in directPools) {
        let p: Pool = directPools[idKey];
        // Add pool to the set with all pools (only adds if it's still not present in dict)
        pools[idKey] = p;

        let swap: Swap = {
            pool: p.id,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
        };

        let path: Path = {
            id: p.id,
            swaps: [swap],
        };
        pathDataList.push(path);
    }

    // Now add multi-hop paths.
    // mostLiquidPoolsFirstHop and mostLiquidPoolsSecondHop always has the same
    // lengh of hopTokens
    for (let i = 0; i < hopTokens.length; i++) {
        // Add pools to the set with all pools (only adds if it's still not present in dict)
        pools[mostLiquidPoolsFirstHop[i].id] = mostLiquidPoolsFirstHop[i];
        pools[mostLiquidPoolsSecondHop[i].id] = mostLiquidPoolsSecondHop[i];

        let swap1: Swap = {
            pool: mostLiquidPoolsFirstHop[i].id,
            tokenIn: tokenIn,
            tokenOut: hopTokens[i],
        };

        let swap2: Swap = {
            pool: mostLiquidPoolsSecondHop[i].id,
            tokenIn: hopTokens[i],
            tokenOut: tokenOut,
        };

        let path: Path = {
            id: mostLiquidPoolsFirstHop[i].id + mostLiquidPoolsSecondHop[i].id, // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
            swaps: [swap1, swap2],
        };
        pathDataList.push(path);
    }
    return [pools, pathDataList];
};

function filterPoolsWithoutToken(pools, token) {
    let found;
    let OutputPools = {};
    for (let i in pools) {
        found = false;
        for (let k = 0; k < pools[i].tokensList.length; k++) {
            if (pools[i].tokensList[k].toLowerCase() == token.toLowerCase()) {
                found = true;
                break;
            }
        }
        //Add pool if token not found
        if (!found) OutputPools[i] = pools[i];
    }
    return OutputPools;
}

export const formatSubgraphPools = pools => {
    for (let pool of pools.pools) {
        pool.swapFee = scale(bnum(pool.swapFee), 18);
        pool.totalWeight = scale(bnum(pool.totalWeight), 18);
        pool.tokens.forEach(token => {
            token.balance = scale(bnum(token.balance), token.decimals);
            token.denormWeight = scale(bnum(token.denormWeight), 18);
        });
    }
};

export function filterPools(
    allPools: Pool[], // The complete information of the pools
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
): [PoolDictionary, string[], PoolDictionary, PoolDictionary] {
    // If pool contains token add all its tokens to direct list
    // Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    let poolsDirect: PoolDictionary = {};
    let poolsTokenOne: PoolDictionary = {};
    let poolsTokenTwo: PoolDictionary = {};
    let tokenInPairedTokens: Set<string> = new Set();
    let tokenOutPairedTokens: Set<string> = new Set();

    let disabledTokens = disabledTokensDefault.tokens;
    if (disabledOptions.isOverRide)
        disabledTokens = disabledOptions.disabledTokens;

    allPools.forEach(pool => {
        let tokenListSet = new Set(pool.tokensList);
        disabledTokens.forEach(token => tokenListSet.delete(token.address));

        if (tokenListSet.has(tokenIn) && tokenListSet.has(tokenOut)) {
            poolsDirect[pool.id] = pool;
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
                poolsTokenOne[pool.id] = pool;
            } else if (!containsTokenIn && containsTokenOut) {
                tokenOutPairedTokens = new Set([
                    ...tokenOutPairedTokens,
                    ...tokenListSet,
                ]);
                poolsTokenTwo[pool.id] = pool;
            }
        }
    });

    // We find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    const hopTokensSet = [...tokenInPairedTokens].filter(x =>
        tokenOutPairedTokens.has(x)
    );

    // Transform set into Array
    const hopTokens: string[] = [...hopTokensSet];

    return [poolsDirect, hopTokens, poolsTokenOne, poolsTokenTwo];
}

export function sortPoolsMostLiquid(
    tokenIn: string,
    tokenOut: string,
    hopTokens: string[],
    poolsTokenInNoTokenOut: PoolDictionary,
    poolsTokenOutNoTokenIn: PoolDictionary
): [Pool[], Pool[]] {
    // Find the most liquid pool for each pair (tokenIn -> hopToken). We store an object in the form:
    // mostLiquidPoolsFirstHop = {hopToken1: mostLiquidPool, hopToken2: mostLiquidPool, ... , hopTokenN: mostLiquidPool}
    // Here we could query subgraph for all pools with pair (tokenIn -> hopToken), but to
    // minimize subgraph calls we loop through poolsTokenInNoTokenOut, and check the liquidity
    // only for those that have hopToken
    let mostLiquidPoolsFirstHop: Pool[] = [];
    let mostLiquidPoolsSecondHop: Pool[] = [];
    let poolPair = {}; // Store pair liquidity incase it is reused

    for (let i = 0; i < hopTokens.length; i++) {
        let highestNormalizedLiquidityFirst = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityFirstPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)

        for (let k in poolsTokenInNoTokenOut) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenInNoTokenOut[k].tokensList).has(hopTokens[i])
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    parsePoolPairData(
                        poolsTokenInNoTokenOut[k],
                        tokenIn,
                        hopTokens[i].toString()
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        // Cannot be strictly greater otherwise
                        // highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                        highestNormalizedLiquidityFirst
                    )
                ) {
                    highestNormalizedLiquidityFirst = normalizedLiquidity;
                    highestNormalizedLiquidityFirstPoolId = k;
                }
            }
        }

        mostLiquidPoolsFirstHop[i] =
            poolsTokenInNoTokenOut[highestNormalizedLiquidityFirstPoolId];

        let highestNormalizedLiquidity = bnum(0); // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        let highestNormalizedLiquidityPoolId; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)

        for (let k in poolsTokenOutNoTokenIn) {
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (
                new Set(poolsTokenOutNoTokenIn[k].tokensList).has(hopTokens[i])
            ) {
                let normalizedLiquidity = getNormalizedLiquidity(
                    parsePoolPairData(
                        poolsTokenOutNoTokenIn[k],
                        hopTokens[i].toString(),
                        tokenOut
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThanOrEqualTo(
                        // Cannot be strictly greater otherwise
                        // highestNormalizedLiquidityPoolId = 0 if hopTokens[i] balance is 0 in this pool.
                        highestNormalizedLiquidity
                    )
                ) {
                    highestNormalizedLiquidity = normalizedLiquidity;
                    highestNormalizedLiquidityPoolId = k;
                }
            }
        }
        mostLiquidPoolsSecondHop[i] =
            poolsTokenOutNoTokenIn[highestNormalizedLiquidityPoolId];
    }

    return [mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop];
}
