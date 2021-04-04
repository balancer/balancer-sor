import { BigNumber } from 'bignumber.js';
import * as sorv1 from '@balancer-labs/sor';
import * as sorv2 from '../../src';
import {
    SubGraphPools,
    Swap,
    DisabledToken,
    DisabledOptions,
    SubGraphPoolDictionary,
    SubGraphPool,
    Path,
    SubGraphToken,
    PoolDictionary,
    SwapPairType,
    NewPath,
    SwapTypes,
    SubgraphPoolBase,
} from '../../src/types';
import customMultiAbi from '../abi/customMulticall.json';
import { SubGraphPools as SubGraphPoolsV1 } from '@balancer-labs/sor/dist/types';
import { BaseProvider } from '@ethersproject/providers';
import { bnum, scale } from '../../src/bmath';
import { hashMessage } from '@ethersproject/hash';
import * as fs from 'fs';
import { readdir } from 'fs/promises';
import { performance } from 'perf_hooks';
import { assert } from 'chai';
import { getAddress } from '@ethersproject/address';
import { Contract } from '@ethersproject/contracts';
// Mainnet reference tokens with addresses & decimals
import WeightedTokens from '../testData/eligibleTokens.json';
import StableTokens from '../testData/stableTokens.json';
import { filterPoolsOfInterest, filterHopPools } from '../../src/pools';
import { calculatePathLimits, smartOrderRouter } from '../../src/sorClass';

// Just for testing weighted helpers:
import { BPTForTokensZeroPriceImpact } from '../../src/frontendHelpers/weightedHelpers';
import {
    _bptInForExactTokensOut,
    _exactTokensInForBPTOut,
} from '../../src/pools/weightedPool/weightedMathEvm';
import { FixedPointNumber } from '../../src/math/FixedPointNumber';

// These types are used for V1 compare
interface Pools {
    pools: Pool[];
}

interface Pool {
    id: string;
    swapFee: BigNumber;
    amp?: BigNumber;
    totalWeight?: BigNumber;
    balanceBpt?: BigNumber;
    tokens: Token[];
    tokensList: string[];
}

interface Token {
    address: string;
    balance: BigNumber;
    decimals: number;
    denormWeight: BigNumber;
}

interface Profiling {
    onChainBalances: boolean;
}

// Filters for only pools with balance > 0 and converts to SCALED wei/bnum format (used for V1).
export function filterAndScalePools(AllSubgraphPools: SubGraphPools): Pools {
    let allPoolsNonZeroBalances: any = { pools: [] };

    for (let pool of AllSubgraphPools.pools) {
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0)
            if (pool.tokens[0].balance != '0')
                if (typeof pool.poolType == 'undefined')
                    // Do not include element pools
                    allPoolsNonZeroBalances.pools.push(pool);
    }

    // Formats Subgraph to wei/bnum format
    formatSubgraphPools(allPoolsNonZeroBalances);

    return allPoolsNonZeroBalances;
}

const formatSubgraphPools = pools => {
    for (let pool of pools.pools) {
        pool.swapFee = scale(bnum(pool.swapFee), 18);
        pool.totalWeight = scale(bnum(pool.totalWeight), 18);
        pool.tokens.forEach(token => {
            token.balance = scale(bnum(token.balance), token.decimals);
            token.denormWeight = scale(bnum(token.denormWeight), 18);
        });
    }
};

// Filters for only pools with balance > 0.
export function filterPoolsWithBalance(
    AllSubgraphPools: SubGraphPools
): SubGraphPools {
    let allPoolsNonZeroBalances: SubGraphPools = { pools: [] };

    for (let pool of AllSubgraphPools.pools) {
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0)
            if (pool.tokens[0].balance != '0')
                allPoolsNonZeroBalances.pools.push(pool);
    }

    return allPoolsNonZeroBalances;
}

// Filters for only pools with balance and returns token list too.
export function filterPoolsAndTokens(
    allPools: SubGraphPools,
    disabledTokens: DisabledToken[] = []
): [any, SubGraphPools] {
    let allTokens = [];
    let allTokensSet = new Set();
    let allPoolsNonZeroBalances: SubGraphPools = { pools: [] };

    for (let pool of allPools.pools) {
        // Build list of non-zero balance pools
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0) {
            if (pool.tokens[0].balance != '0') {
                let tokens = [];
                pool.tokensList.forEach(token => {
                    if (
                        !disabledTokens.find(
                            t => getAddress(t.address) === getAddress(token)
                        )
                    ) {
                        tokens.push(token);
                    }
                });

                if (tokens.length > 1) {
                    allTokens.push(tokens.sort()); // Will add without duplicate
                }

                allPoolsNonZeroBalances.pools.push(pool);
            }
        }
    }

    allTokensSet = new Set(
        Array.from(new Set(allTokens.map(a => JSON.stringify(a))), json =>
            JSON.parse(json)
        )
    );

    return [allTokensSet, allPoolsNonZeroBalances];
}

export async function getV1Swap(
    Provider: BaseProvider,
    GasPrice: BigNumber,
    MaxNoPools: number,
    ChainId: number,
    AllSubgraphPools: SubGraphPoolsV1,
    SwapType: string,
    TokenIn: string,
    TokenOut: string,
    SwapAmount: BigNumber,
    Profiling: Profiling = {
        onChainBalances: true,
    },
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
) {
    TokenIn = TokenIn.toLowerCase();
    TokenOut = TokenOut.toLowerCase();

    // V1 will always ONLY use Weighted Pools
    const weightedPools = filterToWeightedPoolsOnly(AllSubgraphPools);
    if (weightedPools.pools.length === 0)
        return { title: 'v1', swaps: [], returnAmount: bnum(0), timeData: {} };

    const MULTIADDR: { [ChainId: number]: string } = {
        1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
        42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
    };

    const swapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas

    const fullSwapStart = performance.now();
    const getCostOutputTokenStart = performance.now();
    // This calculates the cost in output token (output token is TokenOut for swapExactIn and
    // TokenIn for a swapExactOut) for each additional pool added to the final SOR swap result.
    // This is used as an input to SOR to allow it to make gas efficient recommendations, i.e.
    // if it costs 5 DAI to add another pool to the SOR solution and that only generates 1 more DAI,
    // then SOR should not add that pool (if gas costs were zero that pool would be added)
    // Notice that outputToken is TokenOut if SwapType == 'swapExactIn' and TokenIn if SwapType == 'swapExactOut'
    let costOutputToken: BigNumber;
    if (SwapType === 'swapExactIn')
        costOutputToken = await sorv1.getCostOutputToken(
            TokenOut,
            GasPrice,
            swapCost,
            Provider
        );
    else
        costOutputToken = await sorv1.getCostOutputToken(
            TokenIn,
            GasPrice,
            swapCost,
            Provider
        );

    const getCostOutputTokenEnd = performance.now();
    let poolsWithOnChainBalances;

    if (Profiling.onChainBalances) {
        const getAllPoolDataOnChainStart = performance.now();

        poolsWithOnChainBalances = await sorv1.getAllPoolDataOnChain(
            weightedPools,
            MULTIADDR[ChainId],
            Provider
        );

        const getAllPoolDataOnChainEnd = performance.now();
    } else {
        const getAllPoolDataOnChainStart = performance.now();
        // console.log(`Using saved balances`)
        // Helper - Filters for only pools with balance and converts to wei/bnum format.
        poolsWithOnChainBalances = filterAndScalePools(
            JSON.parse(JSON.stringify(weightedPools))
        );
        const getAllPoolDataOnChainEnd = performance.now();
    }

    const filterPoolsStart = performance.now();

    let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sorv1.filterPools(
        poolsWithOnChainBalances.pools, // AllSubgraphPoolsCorrect.pools,
        TokenIn,
        TokenOut,
        MaxNoPools,
        disabledOptions
    );
    const filterPoolsEnd = performance.now();
    const sortPoolsMostLiquidStart = performance.now();

    // For each hopToken, find the most liquid pool for the first and the second hops
    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
    ] = sorv1.sortPoolsMostLiquid(
        TokenIn,
        TokenOut,
        hopTokens,
        poolsTokenIn,
        poolsTokenOut
    );

    const sortPoolsMostLiquidEnd = performance.now();
    const parsePoolDataStart = performance.now();

    // Finds the possible paths to make the swap, each path can be a direct swap
    // or a multihop composed of 2 swaps
    let pools, pathData;
    [pools, pathData] = sorv1.parsePoolData(
        directPools,
        TokenIn,
        TokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    ///////////// Start - Just for testing BPTForTokensZeroPriceImpact /////
    /*
    let pool = pools[Object.keys(pools)[0]]; // Get first pool
    let balances = [];
    let decimals = [];
    let normalizedWeights = [];
    let amounts = [];

    // bptTotalSupply is not scaled above (as it's not used in SOR V1)
    let bptTotalSupply = new FixedPointNumber(pool.balanceBpt);
    bptTotalSupply = new FixedPointNumber(
        bptTotalSupply.times(new FixedPointNumber(10 ** 18))
    );
    let swapFee = new FixedPointNumber(pool.swapFee);
    for (let i = 0; i < pool.tokens.length; i++) {
        let decimal = pool.tokens[i].decimals;
        decimals.push(decimal);
        let balance = new FixedPointNumber(pool.tokens[i].balance);
        balances.push(balance);
        let amount = new FixedPointNumber(
            balance.div(new FixedPointNumber(100))
        ); // We are considering a proportional add/remove of 1% of the balances
        amounts.push(amount);
        normalizedWeights.push(
            new FixedPointNumber(
                pool.tokens[i].denormWeight
                    .div(pool.totalWeight)
                    .times(new FixedPointNumber(10 ** 18))
            )
        );
    }

    let BPTForTokensZPI = BPTForTokensZeroPriceImpact(
        balances,
        decimals,
        normalizedWeights,
        [...amounts], // passing copy as somehow BPTForTokensZeroPriceImpact is changing amounts type from FixedPoint to BigNumber
        bptTotalSupply
    );

    let BPTForTokensJoin = _exactTokensInForBPTOut(
        balances,
        normalizedWeights,
        amounts,
        bptTotalSupply,
        swapFee
    );

    let BPTForTokensExit = _bptInForExactTokensOut(
        balances,
        normalizedWeights,
        amounts,
        bptTotalSupply,
        swapFee
    );

    // This has to be true for a proportional join/exit, except
    // for rounding errors (which should always be in favor of the pool)
    // BPTForTokensExit = BPTForTokensZPI = BPTForTokensJoin
    console.log(
        'All three numbers below should be the same (except for rounding errors): '
    );
    console.log(BPTForTokensJoin.toNumber());
    console.log(BPTForTokensZPI.toNumber());
    console.log(BPTForTokensExit.toNumber());

    // To simulate a non-proportional join/exit we just zero one of the amounts:
    amounts[0] = new FixedPointNumber(0);
    let BPTForTokensZPI_NP = BPTForTokensZeroPriceImpact(
        balances,
        decimals,
        normalizedWeights,
        [...amounts], // passing copy as somehow BPTForTokensZeroPriceImpact is changing amounts type from FixedPoint to BigNumber
        bptTotalSupply
    );

    let BPTForTokensJoin_NP = _exactTokensInForBPTOut(
        balances,
        normalizedWeights,
        amounts,
        bptTotalSupply,
        swapFee
    );

    let BPTForTokensExit_NP = _bptInForExactTokensOut(
        balances,
        normalizedWeights,
        amounts,
        bptTotalSupply,
        swapFee
    );
    // This has to be true for a non-proportional join/exit:
    // BPTForTokensExit_NP > BPTForTokensZPI_NP > BPTForTokensJoin_NP

    console.log('Three numbers below should be in ascending order: ');
    console.log(BPTForTokensJoin_NP.toNumber());
    console.log(BPTForTokensZPI_NP.toNumber());
    console.log(BPTForTokensExit_NP.toNumber());
    */
    ///////////// End - Just for testing BPTForTokensZeroPriceImpact /////

    const parsePoolDataEnd = performance.now();
    const processPathsStart = performance.now();

    // For each path, find its spot price, slippage and limit amount
    // The spot price of a multihop is simply the multiplication of the spot prices of each
    // of the swaps. The slippage of a multihop is a bit more complicated (out of scope for here)
    // The limit amount is due to the fact that Balancer protocol limits a trade to 50% of the pool
    // balance of TokenIn (for swapExactIn) and 33.33% of the pool balance of TokenOut (for
    // swapExactOut)
    // 'paths' are ordered by ascending spot price
    let paths = sorv1.processPaths(pathData, pools, SwapType);

    const processPathsEnd = performance.now();
    const processEpsOfInterestMultiHopStart = performance.now();

    // epsOfInterest stores a list of all relevant prices: these are either
    // 1) Spot prices of a path
    // 2) Prices where paths cross, meaning they would move to the same spot price after trade
    //    for the same amount traded.
    // For each price of interest we have:
    //   - 'bestPathsIds' a list of the id of the best paths to get to this price and
    //   - 'amounts' a list of how much each path would need to trade to get to that price of
    //     interest
    let epsOfInterest = sorv1.processEpsOfInterestMultiHop(
        paths,
        SwapType,
        MaxNoPools
    );

    const processEpsOfInterestMultiHopEnd = performance.now();
    const smartOrderRouterMultiHopEpsOfInterestStart = performance.now();

    // Returns 'swaps' which is the optimal list of swaps to make and
    // 'swapAmount' which is the total amount of TokenOut (eg. DAI) will be returned
    let swaps, returnAmount;
    [swaps, returnAmount] = sorv1.smartOrderRouterMultiHopEpsOfInterest(
        pools,
        paths,
        SwapType,
        SwapAmount,
        MaxNoPools,
        costOutputToken,
        epsOfInterest
    );

    const smartOrderRouterMultiHopEpsOfInterestEnd = performance.now();
    const fullSwapEnd = performance.now();

    const timeData = {
        fullSwap: fullSwapEnd - fullSwapStart,
        costOutputToken: getCostOutputTokenEnd - getCostOutputTokenStart,
        // 'getAllPoolDataOnChain': getAllPoolDataOnChainEnd - getAllPoolDataOnChainStart,
        filterPools: filterPoolsEnd - filterPoolsStart,
        sortPools: sortPoolsMostLiquidEnd - sortPoolsMostLiquidStart,
        parsePool: parsePoolDataEnd - parsePoolDataStart,
        processPaths: processPathsEnd - processPathsStart,
        processEps:
            processEpsOfInterestMultiHopEnd - processEpsOfInterestMultiHopStart,
        filter: 'N/A',
        sor:
            smartOrderRouterMultiHopEpsOfInterestEnd -
            smartOrderRouterMultiHopEpsOfInterestStart,
    };

    return { title: 'v1', swaps, returnAmount, timeData };
}

export async function getV2Swap(
    Provider: BaseProvider,
    GasPrice: BigNumber,
    MaxNoPools: number,
    ChainId: number,
    AllSubgraphPools: SubGraphPools,
    SwapType: string,
    TokenIn: string,
    TokenOut: string,
    SwapAmount: BigNumber,
    Profiling: Profiling = {
        onChainBalances: true,
    },
    ReturnAmountDecimals: number,
    disabledOptions: DisabledOptions = {
        isOverRide: false,
        disabledTokens: [],
    },
    costOutputTokenOveride = {
        isOverRide: false,
        overRideCost: new BigNumber(0),
    }
) {
    TokenIn = TokenIn.toLowerCase();
    TokenOut = TokenOut.toLowerCase();

    const MULTIADDR: { [ChainId: number]: string } = {
        1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
        42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
    };

    const swapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas

    const fullSwapStart = performance.now();
    const getCostOutputTokenStart = performance.now();
    let costOutputToken: BigNumber = costOutputTokenOveride.overRideCost;

    if (!costOutputTokenOveride.isOverRide) {
        // This calculates the cost in output token (output token is TokenOut for swapExactIn and
        // TokenIn for a swapExactOut) for each additional pool added to the final SOR swap result.
        // This is used as an input to SOR to allow it to make gas efficient recommendations, i.e.
        // if it costs 5 DAI to add another pool to the SOR solution and that only generates 1 more DAI,
        // then SOR should not add that pool (if gas costs were zero that pool would be added)
        // Notice that outputToken is TokenOut if SwapType == 'swapExactIn' and TokenIn if SwapType == 'swapExactOut'
        if (SwapType === 'swapExactIn') {
            costOutputToken = await sorv2.getCostOutputToken(
                TokenOut,
                GasPrice,
                swapCost,
                Provider
            );
        } else {
            costOutputToken = await sorv2.getCostOutputToken(
                TokenIn,
                GasPrice,
                swapCost,
                Provider
            );
        }
    }
    // Normalize to ReturnAmountDecimals
    costOutputToken = costOutputToken.div(bnum(10 ** ReturnAmountDecimals));

    const getCostOutputTokenEnd = performance.now();
    let poolsWithOnChainBalances: SubGraphPools;

    if (Profiling.onChainBalances) {
        const getAllPoolDataOnChainStart = performance.now();

        // This is only suitable for V1 pools as it uses old contract ABI. Shouldn't be an issue as using as compare vs V1 SOR.
        poolsWithOnChainBalances = await getAllPoolDataOnChain(
            AllSubgraphPools,
            MULTIADDR[ChainId],
            Provider
        );

        const getAllPoolDataOnChainEnd = performance.now();
    } else {
        const getAllPoolDataOnChainStart = performance.now();
        // V2 uses Subgraph normalized balances so no need to format
        poolsWithOnChainBalances = JSON.parse(JSON.stringify(AllSubgraphPools));

        const getAllPoolDataOnChainEnd = performance.now();
    }

    const filterPoolsStart = performance.now();

    let directPools: SubGraphPoolDictionary;
    let hopTokens: string[];
    let poolsTokenIn: SubGraphPoolDictionary;
    let poolsTokenOut: SubGraphPoolDictionary;

    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sorv2.filterPools(
        poolsWithOnChainBalances.pools,
        TokenIn,
        TokenOut,
        MaxNoPools,
        disabledOptions
    );
    const filterPoolsEnd = performance.now();
    const sortPoolsMostLiquidStart = performance.now();

    // For each hopToken, find the most liquid pool for the first and the second hops
    let mostLiquidPoolsFirstHop: SubGraphPool[],
        mostLiquidPoolsSecondHop: SubGraphPool[];
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
    ] = sorv2.sortPoolsMostLiquid(
        TokenIn,
        TokenOut,
        hopTokens,
        poolsTokenIn,
        poolsTokenOut
    );

    const sortPoolsMostLiquidEnd = performance.now();
    const parsePoolDataStart = performance.now();

    // Finds the possible paths to make the swap, each path can be a direct swap
    // or a multihop composed of 2 swaps
    let pools: SubGraphPoolDictionary;
    let pathData: Path[];

    [pools, pathData] = sorv2.parsePoolData(
        directPools,
        TokenIn,
        TokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    const parsePoolDataEnd = performance.now();
    const processPathsStart = performance.now();

    let paths: Path[];
    let maxLiquidityAvailable: BigNumber;

    [paths, maxLiquidityAvailable] = sorv2.processPaths(
        pathData,
        pools,
        SwapType
    );

    const processPathsEnd = performance.now();
    const sorStart = performance.now();

    let swaps: Swap[][], returnAmount: BigNumber;
    [swaps, returnAmount] = sorv2.smartOrderRouter(
        JSON.parse(JSON.stringify(pools)),
        paths,
        SwapType,
        SwapAmount,
        MaxNoPools,
        costOutputToken
    );

    const sorEnd = performance.now();
    const fullSwapEnd = sorEnd;

    const timeData = {
        fullSwap: fullSwapEnd - fullSwapStart,
        costOutputToken: getCostOutputTokenEnd - getCostOutputTokenStart,
        // 'getAllPoolDataOnChain': getAllPoolDataOnChainEnd - getAllPoolDataOnChainStart,
        filterPools: filterPoolsEnd - filterPoolsStart,
        sortPools: sortPoolsMostLiquidEnd - sortPoolsMostLiquidStart,
        parsePool: parsePoolDataEnd - parsePoolDataStart,
        processPaths: processPathsEnd - processPathsStart,
        processEps: 'N/A',
        filter: 'N/A',
        sor: sorEnd - sorStart,
    };

    return { title: 'v2', swaps, returnAmount, timeData, costOutputToken };
}

function getAmountsScaled(decimals) {
    const min = 10 ** -decimals;
    const mid = 1;
    const max = 10 ** 6;
    const smallAmt = Math.random() * (mid - min) + min;
    const highAmt = Math.random() * (max - mid) + mid;
    const interAmt1 = Math.random() * (highAmt - smallAmt) + smallAmt;
    const interAmt2 = Math.random() * (highAmt - smallAmt) + smallAmt;
    let smallSwapAmt = scale(bnum(smallAmt), decimals);
    let largeSwapAmt = scale(bnum(highAmt), decimals);
    let inter1SwapAmt = scale(bnum(interAmt1), decimals);
    let inter2SwapAmt = scale(bnum(interAmt2), decimals);

    // Gets rid of decimal places that causes issue between V1/V2 compare
    smallSwapAmt = new BigNumber(smallSwapAmt.toString().split('.')[0]);
    largeSwapAmt = new BigNumber(largeSwapAmt.toString().split('.')[0]);
    inter1SwapAmt = new BigNumber(inter1SwapAmt.toString().split('.')[0]);
    inter2SwapAmt = new BigNumber(inter2SwapAmt.toString().split('.')[0]);

    return [smallSwapAmt, largeSwapAmt, inter1SwapAmt, inter2SwapAmt];
}

export function getRandomTradeData(isStableOnly: boolean) {
    let tokens: any = WeightedTokens;
    if (isStableOnly) tokens = StableTokens;

    // Find a random token from list
    const symbols = Object.keys(tokens);
    const randomIn = Math.floor(Math.random() * symbols.length);
    let randomOut = Math.floor(Math.random() * symbols.length);
    while (randomOut === randomIn)
        randomOut = Math.floor(Math.random() * symbols.length);

    const symbolIn = symbols[randomIn];
    const tokenIn = tokens[symbolIn];
    const symbolOut = symbols[randomOut];
    const tokenOut = tokens[symbolOut];

    const decimalsIn = tokenIn.decimals;
    const decimalsOut = tokenOut.decimals;

    // These are in scaled BigNumber format.
    const [
        smallSwapAmtIn,
        largeSwapAmtIn,
        inter1SwapAmtIn,
        inter2SwapAmtIn,
    ] = getAmountsScaled(decimalsIn);
    const [
        smallSwapAmtOut,
        largeSwapAmtOut,
        inter1SwapAmtOut,
        inter2SwapAmtOut,
    ] = getAmountsScaled(decimalsOut);
    const maxPools = Math.floor(Math.random() * (7 - 1 + 1) + 1);
    /*
    console.log(`In: ${symbolIn} ${tokenIn.address.toLowerCase()}`);
    console.log(`Out: ${symbolOut} ${tokenOut.address.toLowerCase()}`);
    console.log(`Small Swap Amt In: ${smallSwapAmtIn.toString()}`);
    console.log(`Large Swap Amt In: ${largeSwapAmtIn.toString()}`);
    console.log(`Inter1 Swap Amt In: ${inter1SwapAmtIn.toString()}`);
    console.log(`Inter2 Swap Amt In: ${inter2SwapAmtIn.toString()}`);
    console.log(`Small Swap Amt Out: ${smallSwapAmtOut.toString()}`);
    console.log(`Large Swap Amt Out: ${largeSwapAmtOut.toString()}`);
    console.log(`Inter1 Swap Amt Out: ${inter1SwapAmtOut.toString()}`);
    console.log(`Inter2 Swap Amt Out: ${inter2SwapAmtOut.toString()}`);
    console.log(`MaxPools: ${maxPools}`);
    */

    return {
        tokenIn: tokenIn.address.toLowerCase(),
        tokenOut: tokenOut.address.toLowerCase(),
        tokenInDecimals: decimalsIn,
        tokenOutDecimals: decimalsOut,
        smallSwapAmtIn,
        largeSwapAmtIn,
        inter1SwapAmtIn,
        inter2SwapAmtIn,
        smallSwapAmtOut,
        largeSwapAmtOut,
        inter1SwapAmtOut,
        inter2SwapAmtOut,
        maxPools,
    };
}

export function saveTestFile(
    Pools: SubGraphPools,
    SwapType: string,
    TokenIn: string,
    TokenOut: string,
    TokenInDecimals: string,
    TokenOutDecimals: string,
    NoPools: string,
    SwapAmount: string,
    GasPrice: string,
    FilePath: string
) {
    let SwapAmountDecimals = TokenInDecimals.toString();
    let ReturnAmountDecimals = TokenOutDecimals.toString();

    if (SwapType === 'swapExactOut') {
        SwapAmountDecimals = TokenOutDecimals.toString();
        ReturnAmountDecimals = TokenInDecimals.toString();
    }

    const tradeInfo = {
        tradeInfo: {
            SwapType,
            TokenIn,
            TokenOut,
            NoPools,
            SwapAmount,
            GasPrice,
            SwapAmountDecimals,
            ReturnAmountDecimals,
        },
        pools: Pools.pools,
    };

    const id = hashMessage(JSON.stringify(tradeInfo));

    fs.writeFile(`${FilePath}/${id}.json`, JSON.stringify(tradeInfo), function(
        err
    ) {
        if (err) {
            console.log(err);
        }
    });

    console.log(`Test saved at: ${FilePath}/${id}.json`);
    return id;
}

export function deleteTestFile(
    Pools: SubGraphPools,
    SwapType: string,
    TokenIn: string,
    TokenOut: string,
    TokenInDecimals: string,
    TokenOutDecimals: string,
    NoPools: string,
    SwapAmount: string,
    GasPrice: string,
    FilePath: string
) {
    let SwapAmountDecimals = TokenInDecimals.toString();
    let ReturnAmountDecimals = TokenOutDecimals.toString();

    if (SwapType === 'swapExactOut') {
        SwapAmountDecimals = TokenOutDecimals.toString();
        ReturnAmountDecimals = TokenInDecimals.toString();
    }

    const tradeInfo = {
        tradeInfo: {
            SwapType,
            TokenIn,
            TokenOut,
            NoPools,
            SwapAmount,
            GasPrice,
            SwapAmountDecimals,
            ReturnAmountDecimals,
        },
        pools: Pools.pools,
    };

    const id = hashMessage(JSON.stringify(tradeInfo));

    fs.unlink(`${FilePath}/${id}.json`, function(err) {
        if (err) {
            console.log(err);
        }
    });
}

export async function listTestFiles(TestFilesPath: string) {
    const files = await readdir(TestFilesPath);
    // This is useful output to update test list
    files.forEach(file => {
        console.log(`'${file.split('.json')[0]}',`);
    });

    return files;
}

export function loadTestFile(File: string) {
    const fileString = fs.readFileSync(File, 'utf8');
    const fileJson = JSON.parse(fileString);
    if (!fileJson.tradeInfo) return fileJson;

    fileJson.tradeInfo.GasPrice = new BigNumber(fileJson.tradeInfo.GasPrice);
    fileJson.tradeInfo.SwapAmount = new BigNumber(
        fileJson.tradeInfo.SwapAmount.split('.')[0] // This is getting rid of decimals that shouldn't be there.
    );
    return fileJson;
}

export function displayResults(
    TestTitle: string,
    TradeInfo: any,
    Results: any[],
    Verbose: boolean,
    MaxPools: number
) {
    let symbolIn, symbolOut;
    let allTokens = WeightedTokens;
    Object.assign(allTokens, StableTokens);
    const symbols = Object.keys(allTokens);
    symbols.forEach(symbol => {
        if (
            allTokens[symbol].address.toLowerCase() ===
            TradeInfo.TokenIn.toLowerCase()
        )
            symbolIn = symbol;

        if (
            allTokens[symbol].address.toLowerCase() ===
            TradeInfo.TokenOut.toLowerCase()
        )
            symbolOut = symbol;
    });
    const tokenIn = allTokens[symbolIn];

    console.log(`Pools From File: ${TestTitle}`);
    console.log(`In: ${symbolIn} ${TradeInfo.TokenIn.toLowerCase()}`);
    console.log(`Out: ${symbolOut} ${TradeInfo.TokenOut.toLowerCase()}`);
    console.log(`Swap Amt: ${TradeInfo.SwapAmount.toString()}`);
    console.log(`Max Pools: ${MaxPools}`);
    console.log(TradeInfo.SwapType);

    let tableData = [];
    Results.forEach(result => {
        tableData.push({
            SOR: result.title,
            'Full SOR Time': result.timeData.fullSwap,
            'Return Amt': result.returnAmount.toString(),
        });
    });

    console.table(tableData);

    if (Verbose) {
        Results.forEach(result => {
            console.log(`${result.title} Swaps: `);
            console.log(result.swaps);
        });
    }
}

export function assertResults(
    file,
    testData,
    v1SwapData,
    v2SwapData,
    v2WithFilterSwapData = undefined
) {
    const relDiffBn = calcRelativeDiffBn(
        v2SwapData.returnAmount,
        v1SwapData.returnAmount
    );
    const errorDelta = 10 ** -6;

    if (testData.tradeInfo.SwapType === `swapExactIn`) {
        if (v2SwapData.returnAmount.gte(v1SwapData.returnAmount)) {
            assert(
                v2SwapData.returnAmount.gte(v1SwapData.returnAmount),
                `File: ${file}\nV2<V1\nIn: ${
                    testData.tradeInfo.TokenIn
                } \nOut: ${
                    testData.tradeInfo.TokenOut
                } \nSwap Amt: ${testData.tradeInfo.SwapAmount.toString()} \n${v1SwapData.returnAmount.toString()} \n${v2SwapData.returnAmount.toString()}`
            );
        } else {
            assert.isAtMost(relDiffBn.toNumber(), errorDelta);
            console.log(
                `!!!!!! V2 < V1 but error delta ok. (${relDiffBn.toString()})`
            );
        }
    } else {
        if (v2SwapData.returnAmount.eq(0))
            assert(
                v1SwapData.returnAmount.eq(0),
                `File: ${file}, V2 Should Not Have 0 Swap If V1 > 0.`
            );

        if (v1SwapData.returnAmount.eq(0) && v2SwapData.returnAmount.gt(0)) {
            console.log(`!!!!!! V1 has no swap but V2 has.`);
            return;
        }

        if (v2SwapData.returnAmount.lte(v1SwapData.returnAmount)) {
            assert(
                v2SwapData.returnAmount.lte(v1SwapData.returnAmount),
                `File: ${file}\nV2<V1\nIn: ${
                    testData.tradeInfo.TokenIn
                } \nOut: ${
                    testData.tradeInfo.TokenOut
                } \nSwap Amt: ${testData.tradeInfo.SwapAmount.toString()} \n${v1SwapData.returnAmount.toString()} \n${v2SwapData.returnAmount.toString()}`
            );
        } else {
            assert.isAtMost(relDiffBn.toNumber(), errorDelta);
            console.log(
                `!!!!!! V2 > V1 but error delta ok. (${relDiffBn.toString()})`
            );
        }
    }

    if (v2WithFilterSwapData !== undefined) {
        assert(
            v2SwapData.returnAmount.eq(v2WithFilterSwapData.returnAmount),
            `File: ${file}\nV2 !== V2 Filter\nIn: ${
                testData.tradeInfo.TokenIn
            } \nOut: ${
                testData.tradeInfo.TokenOut
            } \nSwap Amt: ${testData.tradeInfo.SwapAmount.toString()} \n${v2SwapData.returnAmount.toString()} \n${v2WithFilterSwapData.returnAmount.toString()}`
        );
    }
}

// Helper to filter pools to contain only Weighted pools
export function filterToWeightedPoolsOnly(pools: any) {
    let weightedPools = { pools: [] };

    for (let pool of pools.pools) {
        if (pool.amp === undefined) weightedPools.pools.push(pool);
    }
    return weightedPools;
}

export function calcRelativeDiffBn(expected: BigNumber, actual: BigNumber) {
    return expected
        .minus(actual)
        .div(expected)
        .abs();
}

async function getAllPoolDataOnChain(
    pools: SubGraphPools,
    multiAddress: string,
    provider: BaseProvider
): Promise<SubGraphPools> {
    if (pools.pools.length === 0) throw Error('There are no pools.');

    const contract = new Contract(multiAddress, customMultiAbi, provider);

    let addresses = [];
    let total = 0;

    for (let i = 0; i < pools.pools.length; i++) {
        let pool = pools.pools[i];

        addresses.push([pool.id]);
        total++;
        pool.tokens.forEach(token => {
            addresses[i].push(token.address);
            total++;
        });
    }

    let results = await contract.getPoolInfo(addresses, total);

    let j = 0;
    let onChainPools: SubGraphPools = { pools: [] };

    for (let i = 0; i < pools.pools.length; i++) {
        let tokens: SubGraphToken[] = [];

        let p: SubGraphPool = {
            id: pools.pools[i].id,
            swapFee: pools.pools[i].swapFee,
            totalWeight: pools.pools[i].totalWeight,
            tokens: tokens,
            tokensList: pools.pools[i].tokensList,
            amp: '0',
            balanceBpt: pools.pools[i].balanceBpt,
        };

        pools.pools[i].tokens.forEach(token => {
            // let bal = bnum(results[j]);
            let bal = scale(
                bnum(results[j]),
                -Number(token.decimals)
            ).toString();
            j++;
            p.tokens.push({
                address: token.address,
                balance: bal,
                decimals: token.decimals,
                denormWeight: token.denormWeight,
            });
        });
        onChainPools.pools.push(p);
    }
    return onChainPools;
}

export function countPoolSwapPairTypes(
    poolsOfInterestDictionary: PoolDictionary
) {
    let noDirect = 0,
        noHopIn = 0,
        noHopOut = 0;
    for (let k in poolsOfInterestDictionary) {
        if (poolsOfInterestDictionary[k].swapPairType === SwapPairType.Direct)
            noDirect++;
        else if (
            poolsOfInterestDictionary[k].swapPairType === SwapPairType.HopIn
        )
            noHopIn++;
        else if (
            poolsOfInterestDictionary[k].swapPairType === SwapPairType.HopOut
        )
            noHopOut++;
    }

    return [noDirect, noHopIn, noHopOut];
}

export function v2classSwap(
    pools: any,
    tokenIn: string,
    tokenOut: string,
    maxPools: number,
    swapType: string | SwapTypes,
    swapAmount: BigNumber,
    costOutputToken: BigNumber,
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
) {
    let swapTypeCorrect = SwapTypes.SwapExactIn;

    if (swapType === 'swapExactOut' || swapType === SwapTypes.SwapExactOut)
        swapTypeCorrect = SwapTypes.SwapExactOut;

    let hopTokens: string[];
    let poolsOfInterestDictionary: PoolDictionary;
    let pathData: NewPath[];

    [poolsOfInterestDictionary, hopTokens] = filterPoolsOfInterest(
        JSON.parse(JSON.stringify(pools.pools)),
        tokenIn,
        tokenOut,
        maxPools,
        disabledOptions
    );

    [poolsOfInterestDictionary, pathData] = filterHopPools(
        tokenIn,
        tokenOut,
        hopTokens,
        poolsOfInterestDictionary
    );

    let paths: NewPath[];
    let maxAmt: BigNumber;

    [paths, maxAmt] = calculatePathLimits(pathData, swapTypeCorrect);

    let swaps: any, total: BigNumber, marketSp: BigNumber;
    [swaps, total, marketSp] = smartOrderRouter(
        JSON.parse(JSON.stringify(poolsOfInterestDictionary)), // Need to keep original pools for cache
        paths,
        swapTypeCorrect,
        swapAmount,
        maxPools,
        costOutputToken
    );

    return [swaps, total, marketSp];
}

// Generates file output for v1-v2-compare-testPools.spec.ts
// ts-node ./test/lib/testHelpers.ts
// const files = listTestFiles(`/Users/jg/Documents/balancer-sor-v2/test/testData/testPools/`);
