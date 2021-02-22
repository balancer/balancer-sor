import { BigNumber } from 'bignumber.js';
import * as sor from '@balancer-labs/sor';
import * as sorv2 from '../src';
import { BaseProvider } from '@ethersproject/providers';
import { bnum, scale } from '../src/bmath';
import { keccak256 } from '@ethersproject/keccak256';
import { sha256 } from '@ethersproject/sha2';
import { hashMessage } from '@ethersproject/hash';
import * as fs from 'fs';
import { readdir } from 'fs/promises';

export const Tokens = {
    WETH: {
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        decimals: 18,
    },
    DAI: {
        address: '0x6b175474e89094c44da98b954eedeac495271d0f',
        decimals: 18,
    },
    BAL: {
        address: '0xba100000625a3754423978a60c9317c58a424e3d',
        decimals: 18,
    },
    USDC: {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
    },
    WBTC: {
        address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        decimals: 8,
    },
    MKR: {
        address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
        decimals: 18,
    },
    AAVE: {
        address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
        decimals: 18,
    },
    UNI: {
        address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
        decimals: 18,
    },
    SNX: {
        address: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
        decimals: 18,
    },
    COMP: {
        address: '0xc00e94cb662c3520282e6f5717214004a7f26888',
        decimals: 18,
    },
};

export interface SubGraphPools {
    pools: SubGraphPool[];
}

export interface SubGraphPool {
    id: string;
    swapFee: string;
    totalWeight: string;
    publicSwap: string;
    tokens: SubGraphToken[];
    tokensList: string[];
}

export interface SubGraphToken {
    address: string;
    balance: string;
    decimals: string;
    denormWeight: string;
}

export interface Pools {
    pools: Pool[];
}

export interface Pool {
    id: string;
    swapFee: BigNumber;
    totalWeight: BigNumber;
    tokens: Token[];
    tokensList: string[];
}

export interface Token {
    address: string;
    balance: BigNumber;
    decimals: number;
    denormWeight: BigNumber;
}

interface Profiling {
    display: boolean;
    detailed: boolean;
    onChainBalances: boolean;
}

// Filters for only pools with balance > 0 and converts to wei/bnum format.
export function formatAndFilterPools(AllSubgraphPools: SubGraphPools): Pools {
    let allPoolsNonZeroBalances: any = { pools: [] };

    for (let pool of AllSubgraphPools.pools) {
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0)
            if (pool.tokens[0].balance != '0')
                allPoolsNonZeroBalances.pools.push(pool);
    }

    // Formats Subgraph to wei/bnum format
    sor.formatSubgraphPools(allPoolsNonZeroBalances);

    return allPoolsNonZeroBalances;
}

export async function getV1Swap(
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
        display: false,
        detailed: false,
        onChainBalances: true,
    }
) {
    TokenIn = TokenIn.toLowerCase();
    TokenOut = TokenOut.toLowerCase();

    const MULTIADDR: { [ChainId: number]: string } = {
        1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
        42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
    };

    const swapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas

    if (Profiling.display) console.time('V1FullSwap');

    if (Profiling.display && Profiling.detailed)
        console.time('V1getCostOutputToken');
    // This calculates the cost in output token (output token is TokenOut for swapExactIn and
    // TokenIn for a swapExactOut) for each additional pool added to the final SOR swap result.
    // This is used as an input to SOR to allow it to make gas efficient recommendations, i.e.
    // if it costs 5 DAI to add another pool to the SOR solution and that only generates 1 more DAI,
    // then SOR should not add that pool (if gas costs were zero that pool would be added)
    // Notice that outputToken is TokenOut if SwapType == 'swapExactIn' and TokenIn if SwapType == 'swapExactOut'
    let costOutputToken: BigNumber;
    if (SwapType === 'swapExactIn')
        costOutputToken = await sor.getCostOutputToken(
            TokenOut,
            GasPrice,
            swapCost,
            Provider
        );
    else
        costOutputToken = await sor.getCostOutputToken(
            TokenIn,
            GasPrice,
            swapCost,
            Provider
        );

    if (Profiling.display && Profiling.detailed)
        console.timeEnd('V1getCostOutputToken');

    let onChainPools;

    if (Profiling.onChainBalances) {
        if (Profiling.display && Profiling.detailed)
            console.time('V1getAllPoolDataOnChain');

        onChainPools = await sor.getAllPoolDataOnChain(
            AllSubgraphPools,
            MULTIADDR[ChainId],
            Provider
        );

        if (Profiling.display && Profiling.detailed) {
            console.timeEnd('V1getAllPoolDataOnChain');
        }
    } else {
        // console.log(`Using saved balances`)
        // Helper - Filters for only pools with balance and converts to wei/bnum format.
        onChainPools = formatAndFilterPools(
            JSON.parse(JSON.stringify(AllSubgraphPools))
        );
    }

    if (Profiling.display && Profiling.detailed) {
        console.time('V1filterPools');
    }

    let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
        onChainPools.pools, // AllSubgraphPoolsCorrect.pools,
        TokenIn,
        TokenOut,
        MaxNoPools
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V1filterPools');
        console.time('V1sortPoolsMostLiquid');
    }

    // For each hopToken, find the most liquid pool for the first and the second hops
    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
    ] = sor.sortPoolsMostLiquid(
        TokenIn,
        TokenOut,
        hopTokens,
        poolsTokenIn,
        poolsTokenOut
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V1sortPoolsMostLiquid');
        console.time('V1parsePoolData');
    }
    // Finds the possible paths to make the swap, each path can be a direct swap
    // or a multihop composed of 2 swaps
    let pools, pathData;
    [pools, pathData] = sor.parsePoolData(
        directPools,
        TokenIn,
        TokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );
    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V1parsePoolData');
        console.time('V1processPaths');
    }

    // For each path, find its spot price, slippage and limit amount
    // The spot price of a multihop is simply the multiplication of the spot prices of each
    // of the swaps. The slippage of a multihop is a bit more complicated (out of scope for here)
    // The limit amount is due to the fact that Balancer protocol limits a trade to 50% of the pool
    // balance of TokenIn (for swapExactIn) and 33.33% of the pool balance of TokenOut (for
    // swapExactOut)
    // 'paths' are ordered by ascending spot price
    let paths = sor.processPaths(pathData, pools, SwapType);

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V1processPaths');
        console.time('V1processEpsOfInterestMultiHop');
    }
    // epsOfInterest stores a list of all relevant prices: these are either
    // 1) Spot prices of a path
    // 2) Prices where paths cross, meaning they would move to the same spot price after trade
    //    for the same amount traded.
    // For each price of interest we have:
    //   - 'bestPathsIds' a list of the id of the best paths to get to this price and
    //   - 'amounts' a list of how much each path would need to trade to get to that price of
    //     interest
    let epsOfInterest = sor.processEpsOfInterestMultiHop(
        paths,
        SwapType,
        MaxNoPools
    );
    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V1processEpsOfInterestMultiHop');
        console.time('V1smartOrderRouterMultiHopEpsOfInterest');
    }

    // Returns 'swaps' which is the optimal list of swaps to make and
    // 'totalReturnWei' which is the total amount of TokenOut (eg. DAI) will be returned
    let swaps, totalReturnWei;
    [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
        pools,
        paths,
        SwapType,
        SwapAmount,
        MaxNoPools,
        costOutputToken,
        epsOfInterest
    );
    if (Profiling.display && Profiling.detailed)
        console.timeEnd('V1smartOrderRouterMultiHopEpsOfInterest');

    if (Profiling.display) {
        console.log(
            `-------------------- V1 Result ---------------------------`
        );
        console.timeEnd('V1FullSwap');
        console.log(`Swap Amount: ${totalReturnWei.toString()}`);
        console.log(`Swaps: `);
        console.log(swaps);
        console.log(
            `----------------------------------------------------------`
        );
        console.log();
    }

    return [swaps, totalReturnWei];
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
        display: false,
        detailed: false,
        onChainBalances: true,
    }
) {
    TokenIn = TokenIn.toLowerCase();
    TokenOut = TokenOut.toLowerCase();

    const MULTIADDR: { [ChainId: number]: string } = {
        1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
        42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
    };

    const swapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas

    if (Profiling.display) console.time('V2FullSwap');

    if (Profiling.display && Profiling.detailed)
        console.time('V2getCostOutputToken');
    // This calculates the cost in output token (output token is TokenOut for swapExactIn and
    // TokenIn for a swapExactOut) for each additional pool added to the final SOR swap result.
    // This is used as an input to SOR to allow it to make gas efficient recommendations, i.e.
    // if it costs 5 DAI to add another pool to the SOR solution and that only generates 1 more DAI,
    // then SOR should not add that pool (if gas costs were zero that pool would be added)
    // Notice that outputToken is TokenOut if SwapType == 'swapExactIn' and TokenIn if SwapType == 'swapExactOut'
    let costOutputToken: BigNumber;
    if (SwapType === 'swapExactIn')
        costOutputToken = await sorv2.getCostOutputToken(
            TokenOut,
            GasPrice,
            swapCost,
            Provider
        );
    else
        costOutputToken = await sorv2.getCostOutputToken(
            TokenIn,
            GasPrice,
            swapCost,
            Provider
        );

    if (Profiling.display && Profiling.detailed)
        console.timeEnd('V2getCostOutputToken');

    let onChainPools;

    if (Profiling.onChainBalances) {
        if (Profiling.display && Profiling.detailed)
            console.time('V2getAllPoolDataOnChain');

        onChainPools = await sorv2.getAllPoolDataOnChain(
            AllSubgraphPools,
            MULTIADDR[ChainId],
            Provider
        );

        if (Profiling.display && Profiling.detailed) {
            console.timeEnd('V2getAllPoolDataOnChain');
        }
    } else {
        // console.log(`Using saved balances`)
        // Helper - Filters for only pools with balance and converts to wei/bnum format.
        onChainPools = formatAndFilterPools(
            JSON.parse(JSON.stringify(AllSubgraphPools))
        );
    }

    if (Profiling.display && Profiling.detailed) {
        console.time('V2filterPools');
    }

    let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sorv2.filterPools(
        onChainPools.pools,
        TokenIn,
        TokenOut,
        MaxNoPools
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2filterPools');
        console.time('V2sortPoolsMostLiquid');
    }

    // For each hopToken, find the most liquid pool for the first and the second hops
    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
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

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2sortPoolsMostLiquid');
        console.time('V2parsePoolData');
    }
    // Finds the possible paths to make the swap, each path can be a direct swap
    // or a multihop composed of 2 swaps
    let pools, pathData;
    [pools, pathData] = sorv2.parsePoolData(
        directPools,
        TokenIn,
        TokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2parsePoolData');
        console.time('V2processPaths');
    }

    let [paths, maxLiquidityAvailable] = sorv2.processPaths(
        pathData,
        pools,
        SwapType,
        MaxNoPools
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2processPaths');
        console.time('V2smartOrderRouter');
    }

    let swaps: any, totalReturnWei: BigNumber;
    [swaps, totalReturnWei] = sorv2.smartOrderRouter(
        JSON.parse(JSON.stringify(pools)),
        paths,
        SwapType,
        SwapAmount,
        MaxNoPools,
        costOutputToken
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2smartOrderRouter');
    }

    if (Profiling.display) {
        console.log(
            `-------------------- V2 Result ---------------------------`
        );
        console.timeEnd('V2FullSwap');
        console.log(`Swap Amount: ${totalReturnWei.toString()}`);
        console.log(`Swaps: `);
        console.log(swaps);
        console.log(
            `----------------------------------------------------------`
        );
        console.log();
    }

    return [swaps, totalReturnWei];
}

export async function getV2SwapWithFilter(
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
        display: false,
        detailed: false,
        onChainBalances: true,
    }
) {
    TokenIn = TokenIn.toLowerCase();
    TokenOut = TokenOut.toLowerCase();

    const MULTIADDR: { [ChainId: number]: string } = {
        1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
        42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
    };

    const swapCost = new BigNumber('100000'); // A pool swap costs approx 100000 gas

    if (Profiling.display) console.time('V2FullSwap');

    if (Profiling.display && Profiling.detailed)
        console.time('V2getCostOutputToken');
    // This calculates the cost in output token (output token is TokenOut for swapExactIn and
    // TokenIn for a swapExactOut) for each additional pool added to the final SOR swap result.
    // This is used as an input to SOR to allow it to make gas efficient recommendations, i.e.
    // if it costs 5 DAI to add another pool to the SOR solution and that only generates 1 more DAI,
    // then SOR should not add that pool (if gas costs were zero that pool would be added)
    // Notice that outputToken is TokenOut if SwapType == 'swapExactIn' and TokenIn if SwapType == 'swapExactOut'
    let costOutputToken: BigNumber;
    if (SwapType === 'swapExactIn')
        costOutputToken = await sorv2.getCostOutputToken(
            TokenOut,
            GasPrice,
            swapCost,
            Provider
        );
    else
        costOutputToken = await sorv2.getCostOutputToken(
            TokenIn,
            GasPrice,
            swapCost,
            Provider
        );

    if (Profiling.display && Profiling.detailed)
        console.timeEnd('V2getCostOutputToken');

    let onChainPools;

    if (Profiling.onChainBalances) {
        if (Profiling.display && Profiling.detailed)
            console.time('V2getAllPoolDataOnChain');

        onChainPools = await sorv2.getAllPoolDataOnChain(
            AllSubgraphPools,
            MULTIADDR[ChainId],
            Provider
        );

        if (Profiling.display && Profiling.detailed) {
            console.timeEnd('V2getAllPoolDataOnChain');
        }
    } else {
        // console.log(`Using saved balances`)
        // Helper - Filters for only pools with balance and converts to wei/bnum format.
        onChainPools = formatAndFilterPools(
            JSON.parse(JSON.stringify(AllSubgraphPools))
        );
    }

    if (Profiling.display && Profiling.detailed) {
        console.time('V2filterPools');
    }

    let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sorv2.filterPools(
        onChainPools.pools,
        TokenIn,
        TokenOut,
        MaxNoPools
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2filterPools');
        console.time('V2sortPoolsMostLiquid');
    }

    // For each hopToken, find the most liquid pool for the first and the second hops
    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
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

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2sortPoolsMostLiquid');
        console.time('V2parsePoolData');
    }
    // Finds the possible paths to make the swap, each path can be a direct swap
    // or a multihop composed of 2 swaps
    let pools, pathData;
    [pools, pathData] = sorv2.parsePoolData(
        directPools,
        TokenIn,
        TokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2parsePoolData');
        console.time('V2processPaths');
    }

    let [paths, maxLiquidityAvailable] = sorv2.processPaths(
        pathData,
        pools,
        SwapType,
        MaxNoPools
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2processPaths');
        console.time('filterPaths');
    }

    let filteredPaths = sorv2.filterPaths(
        JSON.parse(JSON.stringify(pools)),
        paths,
        SwapType,
        MaxNoPools,
        maxLiquidityAvailable,
        costOutputToken
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('filterPaths');
        console.time('V2smartOrderRouter');
    }

    let swaps: any, totalReturnWei: BigNumber;
    [swaps, totalReturnWei] = sorv2.smartOrderRouter(
        JSON.parse(JSON.stringify(pools)),
        filteredPaths,
        SwapType,
        SwapAmount,
        MaxNoPools,
        costOutputToken
    );

    if (Profiling.display && Profiling.detailed) {
        console.timeEnd('V2smartOrderRouter');
    }

    if (Profiling.display) {
        console.log(
            `-------------------- V2 With Filter Result ---------------------------`
        );
        console.timeEnd('V2FullSwap');
        console.log(`Swap Amount: ${totalReturnWei.toString()}`);
        console.log(`Swaps: `);
        console.log(swaps);
        console.log(
            `----------------------------------------------------------`
        );
        console.log();
    }

    return [swaps, totalReturnWei];
}

function getAmounts(decimals) {
    const min = 10 ** -decimals;
    const mid = 1;
    const max = 10 ** 6;
    const smallAmt = Math.random() * (mid - min) + min;
    const highAmt = Math.random() * (max - mid) + mid;
    const smallSwapAmt = scale(bnum(smallAmt), decimals);
    const largeSwapAmt = scale(bnum(highAmt), decimals);

    return [smallSwapAmt, largeSwapAmt];
}

export function getRandomTradeData() {
    // Find a random token from list
    const symbols = Object.keys(Tokens);
    const symbolIn = symbols[Math.floor(Math.random() * symbols.length)];
    const tokenIn = Tokens[symbolIn];
    const symbolOut = symbols[Math.floor(Math.random() * symbols.length)];
    const tokenOut = Tokens[symbolOut];

    const decimalsIn = tokenIn.decimals;
    const decimalsOut = tokenOut.decimals;

    const [smallSwapAmtIn, largeSwapAmtIn] = getAmounts(decimalsIn);
    const [smallSwapAmtOut, largeSwapAmtOut] = getAmounts(decimalsOut);
    const maxPools = Math.floor(Math.random() * (7 - 1 + 1) + 1);

    console.log(`In: ${symbolIn}`);
    console.log(`Out: ${symbolOut}`);
    console.log(`Small Swap Amt In: ${smallSwapAmtIn.toString()}`);
    console.log(`Large Swap Amt In: ${largeSwapAmtIn.toString()}`);
    console.log(`Small Swap Amt Out: ${smallSwapAmtOut.toString()}`);
    console.log(`Large Swap Amt Out: ${largeSwapAmtOut.toString()}`);
    console.log(`MaxPools: ${maxPools}`);

    return {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        smallSwapAmtIn,
        largeSwapAmtIn,
        smallSwapAmtOut,
        largeSwapAmtOut,
        maxPools,
    };
}

export function saveTestFile(
    Pools: Pools | SubGraphPools,
    SwapType: string,
    TokenIn: string,
    TokenOut: string,
    NoPools: string,
    SwapAmount: string,
    GasPrice: string,
    FilePath: string
) {
    const tradeInfo = {
        tradeInfo: {
            SwapType,
            TokenIn,
            TokenOut,
            NoPools,
            SwapAmount,
            GasPrice,
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
}

export function deleteTestFile(
    Pools: Pools | SubGraphPools,
    SwapType: string,
    TokenIn: string,
    TokenOut: string,
    NoPools: string,
    SwapAmount: string,
    GasPrice: string,
    FilePath: string
) {
    const tradeInfo = {
        tradeInfo: {
            SwapType,
            TokenIn,
            TokenOut,
            NoPools,
            SwapAmount,
            GasPrice,
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
    console.log(files);
    return files;
}

export function loadTestFile(File: string) {
    const fileString = fs.readFileSync(File, 'utf8');
    const fileJson = JSON.parse(fileString);
    fileJson.tradeInfo.GasPrice = new BigNumber(fileJson.tradeInfo.GasPrice);
    fileJson.tradeInfo.SwapAmount = new BigNumber(
        fileJson.tradeInfo.SwapAmount
    );
    return fileJson;
}

// const files = listTestFiles(`${__dirname}/testPools/`);
