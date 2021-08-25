import { JsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from 'bignumber.js';
import * as sorv1 from '@balancer-labs/sor';
import { BigNumber as v1BigNumber } from 'v1bignumber.js';
import * as sorv2 from '../../src';
import {
    SubGraphPoolsBase,
    SubgraphPoolBase,
    Swap,
    DisabledToken,
    DisabledOptions,
    PoolDictionary,
    SwapPairType,
    SwapTypes,
    SwapInfo,
    PoolFilter,
    SwapV2,
} from '../../src/types';
import { bnum, scale } from '../../src/utils/bignumber';
import * as fs from 'fs';
import { performance } from 'perf_hooks';
import { assert } from 'chai';
import { getAddress } from '@ethersproject/address';
// Mainnet reference tokens with addresses & decimals
import WeightedTokens from '../testData/eligibleTokens.json';
import StableTokens from '../testData/stableTokens.json';

interface SubgraphPoolsV1 {
    pools: SubGraphPoolV1[];
}

export interface SubGraphPoolV1 {
    id: string;
    swapFee: string;
    totalWeight: string;
    totalShares: string;
    tokens: SubGraphTokenV1[];
    tokensList: string[];
}

export interface SubGraphTokenV1 {
    address: string;
    balance: string;
    decimals: string;
    denormWeight: string;
}

export interface TradeInfo {
    SwapType: string;
    TokenIn: string;
    TokenOut: string;
    NoPools: number;
    SwapAmount: BigNumber;
    GasPrice: BigNumber;
    SwapAmountDecimals: number;
    ReturnAmountDecimals: number;
}

export interface TestData {
    pools: SubgraphPoolBase[];
    tradeInfo: TradeInfo;
}

export interface V1SwapData {
    title: string;
    swaps: Swap[][];
    returnAmount: BigNumber;
    timeData: TimeData;
}

export interface Result {
    title: string;
    timeData: TimeData;
    returnAmount: BigNumber;
    swaps: SwapV2[] | Swap[][];
}

interface TimeData {
    fullSwap: number;
}

/*
Helper to format V2 pools to V1 pool format.
Only weighted pools with balance.
Scales from normalised field values.
Changes weight field to denormWeight.
*/
function formatToV1schema(poolsV2: SubGraphPoolsBase): SubgraphPoolsV1 {
    const weightedPools: SubGraphPoolsBase = { pools: [] };

    for (const pool of poolsV2.pools) {
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0)
            if (pool.tokens[0].balance != '0')
                if (pool.poolType !== 'Stable' && pool.poolType !== 'Element')
                    weightedPools.pools.push(pool); // Do not include element pools
    }
    const poolsv1: SubGraphPoolV1[] = [];

    for (let i = 0; i < weightedPools.pools.length; i++) {
        const v1Pool: SubGraphPoolV1 = formatToV1Pool(weightedPools.pools[i]);
        poolsv1.push(v1Pool);
    }

    return { pools: poolsv1 };
}

function formatToV1Pool(pool: SubgraphPoolBase): SubGraphPoolV1 {
    const v1tokens: SubGraphTokenV1[] = [];
    pool.tokens.forEach(token => {
        v1tokens.push({
            address: token.address,
            balance: scale(
                bnum(token.balance),
                Number(token.decimals)
            ).toString(),
            decimals: token.decimals.toString(),
            denormWeight: scale(bnum(token.weight), 18).toString(),
        });
    });

    const v1Pool: SubGraphPoolV1 = {
        id: pool.id,
        swapFee: scale(bnum(pool.swapFee), 18).toString(),
        totalWeight: scale(bnum(pool.totalWeight), 18).toString(),
        totalShares: pool.totalShares,
        tokensList: pool.tokensList,
        tokens: v1tokens,
    };

    return v1Pool;
}

// Filters for only pools with balance and returns token list too.
export function filterPoolsAndTokens(
    allPools: SubGraphPoolsBase,
    disabledTokens: DisabledToken[] = []
): [Set<unknown>, SubGraphPoolsBase] {
    const allTokens = [];
    let allTokensSet = new Set();
    const allPoolsNonZeroBalances: SubGraphPoolsBase = { pools: [] };

    for (const pool of allPools.pools) {
        // Build list of non-zero balance pools
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0) {
            if (pool.tokens[0].balance != '0') {
                const tokens = [];
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
    costOutputToken: BigNumber,
    MaxNoPools: number,
    AllSubgraphPools: SubGraphPoolsBase,
    SwapType: string,
    TokenIn: string,
    TokenOut: string,
    returnAmountDecimals: number,
    SwapAmount: BigNumber,
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
): Promise<V1SwapData> {
    TokenIn = TokenIn.toLowerCase();
    TokenOut = TokenOut.toLowerCase();

    // V1 will always ONLY use Weighted Pools
    const weightedPools = filterToWeightedPoolsOnly(AllSubgraphPools);
    if (weightedPools.pools.length === 0)
        return {
            title: 'v1',
            swaps: [],
            returnAmount: bnum(0),
            timeData: { fullSwap: 0 },
        };

    const fullSwapStart = performance.now();
    // costOutputToken should be the same as V2 as that's what we compare to.
    const getCostOutputTokenStart = performance.now();
    // // This calculates the cost in output token (output token is TokenOut for swapExactIn and
    // // TokenIn for a swapExactOut) for each additional pool added to the final SOR swap result.
    // // This is used as an input to SOR to allow it to make gas efficient recommendations, i.e.
    // // if it costs 5 DAI to add another pool to the SOR solution and that only generates 1 more DAI,
    // // then SOR should not add that pool (if gas costs were zero that pool would be added)
    // // Notice that outputToken is TokenOut if SwapType == 'swapExactIn' and TokenIn if SwapType == 'swapExactOut'
    // let costOutputToken: BigNumber;
    // if (SwapType === 'swapExactIn')
    //     costOutputToken = await sorv1.getCostOutputToken(
    //         TokenOut,
    //         GasPrice,
    //         swapCost,
    //         Provider
    //     );
    // else
    //     costOutputToken = await sorv1.getCostOutputToken(
    //         TokenIn,
    //         GasPrice,
    //         swapCost,
    //         Provider
    //     );

    const getCostOutputTokenEnd = performance.now();

    // Helper - Filters for only pools with balance and converts to wei/bnum format.
    const poolsWithOnChainBalances: any = formatToV1schema(
        JSON.parse(JSON.stringify(weightedPools))
    );

    const filterPoolsStart = performance.now();

    const [
        directPools,
        hopTokens,
        poolsTokenIn,
        poolsTokenOut,
    ] = sorv1.filterPools(
        poolsWithOnChainBalances.pools, // AllSubgraphPoolsCorrect.pools,
        TokenIn,
        TokenOut,
        MaxNoPools,
        disabledOptions
    );
    const filterPoolsEnd = performance.now();
    const sortPoolsMostLiquidStart = performance.now();

    // For each hopToken, find the most liquid pool for the first and the second hops
    const [
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
    const [pools, pathData] = sorv1.parsePoolData(
        directPools,
        TokenIn,
        TokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    console.log(`****** V1 Paths: ${pathData.length}`);
    const parsePoolDataEnd = performance.now();
    const processPathsStart = performance.now();

    // For each path, find its spot price, slippage and limit amount
    // The spot price of a multihop is simply the multiplication of the spot prices of each
    // of the swaps. The slippage of a multihop is a bit more complicated (out of scope for here)
    // The limit amount is due to the fact that Balancer protocol limits a trade to 50% of the pool
    // balance of TokenIn (for swapExactIn) and 33.33% of the pool balance of TokenOut (for
    // swapExactOut)
    // 'paths' are ordered by ascending spot price
    const paths = sorv1.processPaths(pathData, pools, SwapType);

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
    const epsOfInterest = sorv1.processEpsOfInterestMultiHop(
        paths,
        SwapType,
        MaxNoPools
    );

    const processEpsOfInterestMultiHopEnd = performance.now();
    const smartOrderRouterMultiHopEpsOfInterestStart = performance.now();

    // Returns 'swaps' which is the optimal list of swaps to make and
    // 'swapAmount' which is the total amount of TokenOut (eg. DAI) will be returned
    const [swaps, returnAmount] = sorv1.smartOrderRouterMultiHopEpsOfInterest(
        pools,
        paths,
        SwapType,
        new v1BigNumber(SwapAmount),
        MaxNoPools,
        new v1BigNumber(costOutputToken),
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

    const swapsV2 = swaps as Swap[][];

    return {
        title: 'v1',
        swaps: swapsV2,
        returnAmount: bnum(returnAmount.toString()),
        timeData,
    };
}

export function loadTestFile(File: string): TestData {
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
    TradeInfo: TradeInfo,
    Results: Result[],
    Verbose: boolean,
    MaxPools: number
): void {
    let symbolIn, symbolOut;
    const allTokens = WeightedTokens;
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
    console.log(`Pools From File: ${TestTitle}`);
    console.log(`In: ${symbolIn} ${TradeInfo.TokenIn.toLowerCase()}`);
    console.log(`Out: ${symbolOut} ${TradeInfo.TokenOut.toLowerCase()}`);
    console.log(`Swap Amt: ${TradeInfo.SwapAmount.toString()}`);
    console.log(`Max Pools: ${MaxPools}`);
    console.log(TradeInfo.SwapType);

    const tableData = [];
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
    testName: string,
    testData: TestData,
    v1SwapData: V1SwapData,
    swapInfo: SwapInfo
): void {
    let swapTypeCorrect = SwapTypes.SwapExactIn;
    if (testData.tradeInfo.SwapType !== 'swapExactIn') {
        swapTypeCorrect = SwapTypes.SwapExactOut;
    }

    testReturnAmountAgainstV1(testName, swapTypeCorrect, v1SwapData, swapInfo);

    testSwapAmounts(swapTypeCorrect, testData, swapInfo);

    testSwapAmountsForDecimals(swapTypeCorrect, swapInfo);
}

/*
Test that current result is within V1 result.
*/
function testReturnAmountAgainstV1(
    testName: string,
    swapType: SwapTypes,
    v1SwapData: V1SwapData,
    swapInfo: SwapInfo
): void {
    const relDiffBn = calcRelativeDiffBn(
        swapInfo.returnAmount,
        v1SwapData.returnAmount
    );
    const errorDelta = 10 ** -6;

    if (swapType === SwapTypes.SwapExactIn) {
        // Current result should be better or equal to V1 result or within errorDelta
        if (!swapInfo.returnAmount.gte(v1SwapData.returnAmount)) {
            assert.isAtMost(relDiffBn.toNumber(), errorDelta);
            console.log(
                `!!!!!! V2 < V1 but error delta ok. (${relDiffBn.toString()})`
            );
        }
    } else {
        if (swapInfo.returnAmount.eq(0))
            assert(
                v1SwapData.returnAmount.eq(0),
                `File: ${testName}, V2 Should Not Have 0 Swap If V1 > 0.`
            );

        if (v1SwapData.returnAmount.eq(0) && swapInfo.returnAmount.gt(0)) {
            console.log(`!!!!!! V1 has no swap but V2 has.`);
            return;
        }

        // Current result should be less than or equal to V1 result or within errorDelta
        if (!swapInfo.returnAmount.lte(v1SwapData.returnAmount)) {
            assert.isAtMost(relDiffBn.toNumber(), errorDelta);
            console.log(
                `!!!!!! V2 > V1 but error delta ok. (${relDiffBn.toString()})`
            );
        }
    }
}

/*
Make sure swapInfo swap amount is correct.
Should be 0 when return amount is 0.
Should equal test data amount when return amount > 0.
All swap amounts for swap type should equal test data amount.
*/
function testSwapAmounts(
    swapType: SwapTypes,
    testData: TestData,
    swapInfo: SwapInfo
): void {
    if (swapInfo.returnAmount.gt(0)) {
        // This should be to Scaled format
        assert.equal(
            testData.tradeInfo.SwapAmount.toString(),
            swapInfo.swapAmount.toString(),
            'Swap Amounts Should Be Equal.'
        );

        const totalSwapAmount = getTotalSwapAmount(swapType, swapInfo);
        assert.equal(
            testData.tradeInfo.SwapAmount.toString(),
            totalSwapAmount.toString(),
            'Total From SwapInfo Should Equal Swap Amount.'
        );
    } else
        assert.equal(
            '0',
            swapInfo.swapAmount.toString(),
            'Swap Amount Should Be 0 For No Swaps'
        );
}

/*
Tests to make sure swap amounts are whole numbers.
*/
function testSwapAmountsForDecimals(
    swapType: SwapTypes,
    swapInfo: SwapInfo
): void {
    swapInfo.swaps.forEach(swap => {
        if (swapType === SwapTypes.SwapExactIn) {
            const check = swap.amount.split('.');
            assert.isTrue(
                check.length === 1,
                `Swap Amounts Should Not Have Decimal: ${swap.amount.toString()}`
            );
        } else {
            const check = swap.amount.split('.');
            assert.isTrue(
                check.length === 1,
                `Swap Amounts Should Not Have Decimal: ${swap.amount.toString()}`
            );
        }
    });
}

// Helper to sum all amounts traded by swaps
function getTotalSwapAmount(
    swapType: SwapTypes,
    swapInfo: SwapInfo
): BigNumber {
    let total = bnum(0);
    const inIndex = swapInfo.tokenAddresses.indexOf(swapInfo.tokenIn);
    const outIndex = swapInfo.tokenAddresses.indexOf(swapInfo.tokenOut);

    swapInfo.swaps.forEach(swap => {
        if (swapType === SwapTypes.SwapExactIn) {
            if (swap.assetInIndex === inIndex) total = total.plus(swap.amount);
        } else {
            if (swap.assetOutIndex === outIndex)
                total = total.plus(swap.amount);
        }
    });
    return total;
}

// Helper to filter pools to contain only Weighted pools
export function filterToWeightedPoolsOnly(
    pools: SubGraphPoolsBase
): SubGraphPoolsBase {
    const weightedPools = { pools: [] };

    for (const pool of pools.pools) {
        if (pool.poolType === 'Weighted') weightedPools.pools.push(pool);
    }
    return weightedPools;
}

export function calcRelativeDiffBn(
    expected: BigNumber,
    actual: BigNumber
): BigNumber {
    return expected
        .minus(actual)
        .div(expected)
        .abs();
}

export function countPoolSwapPairTypes(
    poolsOfInterestDictionary: PoolDictionary
): [number, number, number] {
    let noDirect = 0,
        noHopIn = 0,
        noHopOut = 0;
    for (const k in poolsOfInterestDictionary) {
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

export async function getFullSwap(
    pools: SubGraphPoolsBase,
    tokenIn: string,
    tokenOut: string,
    returnAmountDecimals: number,
    maxPools: number,
    swapType: string | SwapTypes,
    swapAmountNormalised: BigNumber,
    costOutputToken: BigNumber,
    gasPrice: BigNumber,
    provider: JsonRpcProvider,
    swapCost: BigNumber = new BigNumber('100000'),
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
): Promise<SwapInfo> {
    const sor = new sorv2.SOR(
        provider,
        gasPrice,
        maxPools,
        1,
        JSON.parse(JSON.stringify(pools)),
        swapCost,
        disabledOptions
    );

    let swapTypeCorrect = SwapTypes.SwapExactIn;

    if (swapType === 'swapExactIn')
        await sor.setCostOutputToken(
            tokenOut,
            returnAmountDecimals,
            costOutputToken
        );
    else {
        swapTypeCorrect = SwapTypes.SwapExactOut;
        await sor.setCostOutputToken(
            tokenIn,
            returnAmountDecimals,
            costOutputToken
        );
    }

    const isFetched = await sor.fetchPools(false);
    assert(isFetched, 'Pools should be fetched in wrapper');

    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn,
        tokenOut,
        swapTypeCorrect,
        swapAmountNormalised,
        { timestamp: 0, poolTypeFilter: PoolFilter.All }
    );

    return swapInfo;
}
