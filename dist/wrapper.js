'use strict';
var __awaiter =
    (this && this.__awaiter) ||
    function(thisArg, _arguments, P, generator) {
        function adopt(value) {
            return value instanceof P
                ? value
                : new P(function(resolve) {
                      resolve(value);
                  });
        }
        return new (P || (P = Promise))(function(resolve, reject) {
            function fulfilled(value) {
                try {
                    step(generator.next(value));
                } catch (e) {
                    reject(e);
                }
            }
            function rejected(value) {
                try {
                    step(generator['throw'](value));
                } catch (e) {
                    reject(e);
                }
            }
            function step(result) {
                result.done
                    ? resolve(result.value)
                    : adopt(result.value).then(fulfilled, rejected);
            }
            step(
                (generator = generator.apply(thisArg, _arguments || [])).next()
            );
        });
    };
var __importStar =
    (this && this.__importStar) ||
    function(mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
        result['default'] = mod;
        return result;
    };
Object.defineProperty(exports, '__esModule', { value: true });
const bignumber_1 = require('./utils/bignumber');
const bmath_1 = require('./bmath');
const sor = __importStar(require('./index'));
class SOR {
    constructor(Provider, GasPrice, MaxPools, ChainId, PoolsUrl) {
        // avg Balancer swap cost. Can be updated manually if required.
        this.swapCost = new bignumber_1.BigNumber('100000');
        this.tokenCost = {};
        this.onChainCache = { pools: [] };
        this.poolsForPairsCache = {};
        this.processedDataCache = {};
        this.isAllFetched = false;
        this.MULTIADDR = {
            1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
            42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
        };
        this.provider = Provider;
        this.gasPrice = GasPrice;
        this.maxPools = MaxPools;
        this.chainId = ChainId;
        this.poolsUrl = PoolsUrl;
        this.pools = new sor.POOLS();
    }
    /*
    Find and cache cost of token.
    */
    setCostOutputToken(TokenOut, Cost = null) {
        return __awaiter(this, void 0, void 0, function*() {
            TokenOut = TokenOut.toLowerCase();
            if (Cost === null) {
                // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations
                const costOutputToken = yield sor.getCostOutputToken(
                    TokenOut,
                    this.gasPrice,
                    this.swapCost,
                    this.provider,
                    this.chainId
                );
                this.tokenCost[TokenOut] = costOutputToken;
            } else {
                this.tokenCost[TokenOut] = Cost;
            }
        });
    }
    // Fetch allPools from URL then retrieve OnChain balances
    fetchPools() {
        return __awaiter(this, void 0, void 0, function*() {
            try {
                let allPools = yield this.pools.getAllPublicSwapPools(
                    this.poolsUrl
                );
                let previousStringify = JSON.stringify(this.onChainCache); // Used for compare
                this.onChainCache = yield this.fetchOnChainPools(allPools);
                // If new pools are different from previous then any previous processed data is out of date so clear
                if (previousStringify !== JSON.stringify(this.onChainCache)) {
                    this.processedDataCache = {};
                }
                this.isAllFetched = true;
                return true;
            } catch (err) {
                // On error clear all caches and return false so user knows to try again.
                this.isAllFetched = false;
                this.onChainCache = { pools: [] };
                this.processedDataCache = {};
                console.error(`Error: fetchPools(): ${err.message}`);
                return false;
            }
        });
    }
    /*
    Uses multicall contact to fetch all onchain balances for pools.
    */
    fetchOnChainPools(SubgraphPools) {
        return __awaiter(this, void 0, void 0, function*() {
            if (SubgraphPools.pools.length === 0) {
                console.error('ERROR: No Pools To Fetch.');
                return { pools: [] };
            }
            let onChainPools = yield sor.getAllPoolDataOnChain(
                SubgraphPools,
                this.MULTIADDR[this.chainId],
                this.provider
            );
            // Error with multicall
            if (!onChainPools) return { pools: [] };
            return onChainPools;
        });
    }
    /*
    Main function to retrieve swap information.
    */
    getSwaps(TokenIn, TokenOut, SwapType, SwapAmt) {
        return __awaiter(this, void 0, void 0, function*() {
            // The Subgraph returns tokens in lower case format so we must match this
            TokenIn = TokenIn.toLowerCase();
            TokenOut = TokenOut.toLowerCase();
            let swaps, total, marketSp;
            if (this.isAllFetched) {
                // All Pools with OnChain Balances is already fetched so use that
                [swaps, total, marketSp] = yield this.processSwaps(
                    TokenIn,
                    TokenOut,
                    SwapType,
                    SwapAmt,
                    this.onChainCache
                );
            } else {
                // Haven't retrieved all pools/balances so we use the pools for pairs if previously fetched
                if (!this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)])
                    return [[[]], bmath_1.bnum(0), bmath_1.bnum(0)];
                [swaps, total, marketSp] = yield this.processSwaps(
                    TokenIn,
                    TokenOut,
                    SwapType,
                    SwapAmt,
                    this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)],
                    false
                );
            }
            return [swaps, total, marketSp];
        });
    }
    // Will process swap/pools data and return best swaps
    // UserProcessCache can be false to force fresh processing of paths/prices
    processSwaps(
        TokenIn,
        TokenOut,
        SwapType,
        SwapAmt,
        OnChainPools,
        UserProcessCache = true
    ) {
        return __awaiter(this, void 0, void 0, function*() {
            if (OnChainPools.pools.length === 0)
                return [[[]], bmath_1.bnum(0), bmath_1.bnum(0)];
            let pools, paths, epsOfInterest, marketSp;
            // If token pair has been processed before that info can be reused to speed up execution
            let cache = this.processedDataCache[
                `${TokenIn}${TokenOut}${SwapType}`
            ];
            // UserProcessCache can be false to force fresh processing of paths/prices
            if (!UserProcessCache || !cache) {
                // If not previously cached we must process all paths/prices.
                // Always use onChain info
                // Some functions alter pools list directly but we want to keep original so make a copy to work from
                let poolsList = JSON.parse(JSON.stringify(OnChainPools));
                let pathData;
                [pools, pathData] = this.processPairPools(
                    TokenIn,
                    TokenOut,
                    poolsList
                );
                [paths, epsOfInterest, marketSp] = this.processPathsAndPrices(
                    pathData,
                    pools,
                    SwapType
                );
                // Update cache if used
                if (UserProcessCache)
                    this.processedDataCache[
                        `${TokenIn}${TokenOut}${SwapType}`
                    ] = {
                        pools: pools,
                        paths: paths,
                        epsOfInterest: epsOfInterest,
                        marketSp: marketSp,
                    };
            } else {
                // Using pre-processed data from cache
                pools = cache.pools;
                paths = cache.paths;
                epsOfInterest = cache.epsOfInterest;
                marketSp = marketSp;
            }
            // Use previously stored value if exists else default to 0
            let costOutputToken = this.tokenCost[TokenOut];
            if (costOutputToken === undefined) {
                costOutputToken = new bignumber_1.BigNumber(0);
            }
            // Returns list of swaps
            // swapExactIn - total = total amount swap will return of TokenOut
            // swapExactOut - total = total amount of TokenIn required for swap
            let swaps, total;
            [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
                JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
                paths,
                SwapType,
                SwapAmt,
                this.maxPools,
                costOutputToken,
                epsOfInterest
            );
            return [swaps, total, marketSp];
        });
    }
    /*
    This is used as a quicker alternative to fetching all pools information.
    A subset of pools for token pair is found by checking swaps for range of input amounts.
    The onchain balances for the subset of pools is retrieved and cached for future swap calculations (i.e. when amts change).
    */
    fetchFilteredPairPools(TokenIn, TokenOut) {
        return __awaiter(this, void 0, void 0, function*() {
            TokenIn = TokenIn.toLowerCase();
            TokenOut = TokenOut.toLowerCase();
            try {
                // Get all IPFS pools (with balance)
                let allPoolsNonBig = yield this.pools.getAllPublicSwapPools(
                    this.poolsUrl
                );
                // Convert to BigNumber format
                let allPools = yield this.pools.formatPoolsBigNumber(
                    allPoolsNonBig
                );
                let decimalsIn = 0;
                let decimalsOut = 0;
                // Find token decimals for scaling
                for (let i = 0; i < allPools.pools.length; i++) {
                    for (let j = 0; j < allPools.pools[i].tokens.length; j++) {
                        if (allPools.pools[i].tokens[j].address === TokenIn) {
                            decimalsIn = Number(
                                allPools.pools[i].tokens[j].decimals
                            );
                            if (decimalsIn > 0 && decimalsOut > 0) break;
                        } else if (
                            allPools.pools[i].tokens[j].address === TokenOut
                        ) {
                            decimalsOut = Number(
                                allPools.pools[i].tokens[j].decimals
                            );
                            if (decimalsIn > 0 && decimalsOut > 0) break;
                        }
                    }
                    if (decimalsIn > 0 && decimalsOut > 0) break;
                }
                // These can be shared for both swap Types
                let pools, pathData;
                [pools, pathData] = this.processPairPools(
                    TokenIn,
                    TokenOut,
                    allPools
                );
                // Find paths and prices for swap types
                let pathsExactIn, epsExactIn;
                [pathsExactIn, epsExactIn] = this.processPathsAndPrices(
                    JSON.parse(JSON.stringify(pathData)),
                    pools,
                    'swapExactIn'
                );
                let pathsExactOut, epsExactOut;
                [pathsExactOut, epsExactOut] = this.processPathsAndPrices(
                    pathData,
                    pools,
                    'swapExactOut'
                );
                // Use previously stored value if exists else default to 0
                let costOutputToken = this.tokenCost[TokenOut];
                if (costOutputToken === undefined) {
                    costOutputToken = new bignumber_1.BigNumber(0);
                }
                let allSwaps = [];
                let range = [
                    bmath_1.bnum('0.01'),
                    bmath_1.bnum('0.1'),
                    bmath_1.bnum('1'),
                    bmath_1.bnum('10'),
                    bmath_1.bnum('100'),
                    bmath_1.bnum('1000'),
                ];
                // Calculate swaps for swapExactIn/Out over range and save swaps (with pools) returned
                range.forEach(amt => {
                    let amtIn = bmath_1.scale(amt, decimalsIn);
                    let amtOut = amtIn;
                    if (decimalsIn !== decimalsOut)
                        amtOut = bmath_1.scale(amt, decimalsOut);
                    let swaps, total;
                    [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
                        JSON.parse(JSON.stringify(pools)), // Need to keep original pools
                        pathsExactIn,
                        'swapExactIn',
                        amtIn,
                        this.maxPools,
                        costOutputToken,
                        epsExactIn
                    );
                    allSwaps.push(swaps);
                    [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
                        JSON.parse(JSON.stringify(pools)), // Need to keep original pools
                        pathsExactOut,
                        'swapExactOut',
                        amtOut,
                        this.maxPools,
                        costOutputToken,
                        epsExactOut
                    );
                    allSwaps.push(swaps);
                });
                // List of unique pool addresses
                let filteredPools = [];
                // get unique swap pools
                allSwaps.forEach(swap => {
                    swap.forEach(seq => {
                        seq.forEach(p => {
                            if (!filteredPools.includes(p.pool))
                                filteredPools.push(p.pool);
                        });
                    });
                });
                // Get list of pool infos for pools of interest
                let poolsOfInterest = [];
                for (let i = 0; i < allPoolsNonBig.pools.length; i++) {
                    let index = filteredPools.indexOf(
                        allPoolsNonBig.pools[i].id
                    );
                    if (index > -1) {
                        filteredPools.splice(index, 1);
                        poolsOfInterest.push(allPoolsNonBig.pools[i]);
                        if (filteredPools.length === 0) break;
                    }
                }
                let onChainPools = { pools: [] };
                if (poolsOfInterest.length !== 0) {
                    // Retrieves onchain balances for pools list
                    onChainPools = yield sor.getAllPoolDataOnChain(
                        { pools: poolsOfInterest },
                        this.MULTIADDR[this.chainId],
                        this.provider
                    );
                }
                // Add to cache for future use
                this.poolsForPairsCache[
                    this.createKey(TokenIn, TokenOut)
                ] = onChainPools;
                return true;
            } catch (err) {
                console.error(
                    `Error: fetchFilteredPairPools(): ${err.message}`
                );
                // Add to cache for future use
                this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)] = {
                    pools: [],
                };
                return false;
            }
        });
    }
    // Finds pools and paths for token pairs. Independent of swap type.
    processPairPools(TokenIn, TokenOut, poolsList) {
        // Retrieves intermediate pools along with tokens that are contained in these.
        let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
        [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
            poolsList.pools,
            TokenIn,
            TokenOut,
            this.maxPools
        );
        // Sort intermediate pools by order of liquidity
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
        // Finds the possible paths to make the swap
        let pathData;
        let pools;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            TokenIn,
            TokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );
        return [pools, pathData];
    }
    // SwapType dependent - calculates paths prices/amounts
    processPathsAndPrices(PathArray, PoolsDict, SwapType) {
        const paths = sor.processPaths(PathArray, PoolsDict, SwapType);
        const bestSpotPrice = sor.getMarketSpotPrice(paths);
        const eps = sor.processEpsOfInterestMultiHop(
            paths,
            SwapType,
            this.maxPools
        );
        return [paths, eps, bestSpotPrice];
    }
    // Used for cache ids
    createKey(Token1, Token2) {
        return Token1 < Token2 ? `${Token1}${Token2}` : `${Token2}${Token1}`;
    }
    // Check if pair data already fetched (using fetchFilteredPairPools)
    hasDataForPair(TokenIn, TokenOut) {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();
        if (
            this.isAllFetched ||
            this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)]
        )
            return true;
        else return false;
    }
}
exports.SOR = SOR;
