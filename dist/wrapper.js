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
Object.defineProperty(exports, '__esModule', { value: true });
const bignumber_1 = require('./utils/bignumber');
const sor = require('./index');
class SOR {
    constructor(Provider, GasPrice, MaxPools, ChainId) {
        // avg Balancer swap cost. Can be updated manually if required.
        this.swapCost = new bignumber_1.BigNumber('100000');
        this.tokenCost = {};
        this.fetchedTokens = {};
        this.subgraphCache = { pools: [] };
        this.onChainCache = { pools: [] };
        this.processedDataCache = {};
        this.MULTIADDR = {
            1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
            42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
        };
        this.SUBGRAPH_URL = {
            1: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer',
            42: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan',
        };
        this.provider = Provider;
        this.gasPrice = GasPrice;
        this.maxPools = MaxPools;
        this.chainId = ChainId;
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
                    this.provider
                );
                this.tokenCost[TokenOut] = costOutputToken;
            } else {
                this.tokenCost[TokenOut] = Cost;
            }
        });
    }
    /*
    Uses multicall contact to fetch all onchain balances for cached Subgraph pools.
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
    fetchPairPools(TokenIn, TokenOut, PurgeCache = true) {
        return __awaiter(this, void 0, void 0, function*() {
            TokenIn = TokenIn.toLowerCase();
            TokenOut = TokenOut.toLowerCase();
            if (PurgeCache) {
                this.purgeCaches();
                return yield this.fetchNewPools(TokenIn, TokenOut);
            } else if (
                this.fetchedTokens[TokenIn] &&
                this.fetchedTokens[TokenOut]
            ) {
                return true;
            } else if (
                !this.fetchedTokens[TokenIn] &&
                !this.fetchedTokens[TokenOut]
            ) {
                return yield this.fetchNewPools(TokenIn, TokenOut);
            } else if (!this.fetchedTokens[TokenIn]) {
                return yield this.updatePools(TokenIn);
            } else if (!this.fetchedTokens[TokenOut]) {
                return yield this.updatePools(TokenOut);
            }
            return false;
        });
    }
    hasPairPools(TokenIn, TokenOut) {
        TokenIn = TokenIn.toLowerCase();
        TokenOut = TokenOut.toLowerCase();
        if (this.fetchedTokens[TokenIn] && this.fetchedTokens[TokenOut])
            return true;
        else return false;
    }
    // Updates onChain balances for all pools in existing cache
    updateOnChainBalances() {
        return __awaiter(this, void 0, void 0, function*() {
            try {
                let previousStringify = JSON.stringify(this.onChainCache); // Used for compare
                this.onChainCache = yield this.fetchOnChainPools(
                    this.subgraphCache
                );
                // If new pools are different from previous then any previous processed data is out of date so clear
                if (previousStringify !== JSON.stringify(this.onChainCache)) {
                    this.processedDataCache = {};
                }
                return true;
            } catch (err) {
                console.error(`updateOnChainBalances(): ${err.message}`);
                return false;
            }
        });
    }
    // Fetches pools that contain TokenIn, TokenOut or both (Subgraph & Onchain)
    fetchNewPools(TokenIn, TokenOut) {
        return __awaiter(this, void 0, void 0, function*() {
            try {
                this.subgraphCache = yield sor.getFilteredPools(
                    TokenIn,
                    TokenOut,
                    this.SUBGRAPH_URL[this.chainId]
                );
                this.onChainCache = yield this.fetchOnChainPools(
                    this.subgraphCache
                );
                this.fetchedTokens[TokenIn] = true;
                this.fetchedTokens[TokenOut] = true;
                return true;
            } catch (err) {
                this.fetchedTokens[TokenIn] = false;
                this.fetchedTokens[TokenOut] = false;
                console.error(
                    `Issue Fetching New Pools: ${TokenIn} ${TokenOut}`
                );
                console.error(err.message);
                return false;
            }
        });
    }
    // Adds any pools that contain token and don't already exist to cache (Subgraph & Onchain)
    updatePools(Token) {
        return __awaiter(this, void 0, void 0, function*() {
            try {
                let poolsWithToken = yield sor.getPoolsWithToken(Token);
                let newPools = poolsWithToken.pools.filter(pool => {
                    return !this.subgraphCache.pools.some(
                        existingPool => existingPool.id === pool.id
                    );
                });
                if (newPools.length > 0) {
                    let newOnChain = yield this.fetchOnChainPools({
                        pools: newPools,
                    });
                    this.subgraphCache.pools = this.subgraphCache.pools.concat(
                        newPools
                    );
                    this.onChainCache.pools = this.onChainCache.pools.concat(
                        newOnChain.pools
                    );
                }
                this.fetchedTokens[Token] = true;
                return true;
            } catch (err) {
                this.fetchedTokens[Token] = false;
                console.error(`Issue Updating Pools: ${Token}`);
                console.error(err.message);
                return false;
            }
        });
    }
    purgeCaches() {
        this.fetchedTokens = {};
        this.subgraphCache = { pools: [] };
        this.onChainCache = { pools: [] };
        this.processedDataCache = {};
    }
    /*
    Main function to retrieve swap information.
    Will fetch & use onChain balances.
    Can use cached pool info by setting PurgeCache=false but be aware balances may be out of date.
    */
    getSwaps(TokenIn, TokenOut, SwapType, SwapAmt, PurgeCache = true) {
        return __awaiter(this, void 0, void 0, function*() {
            // The Subgraph returns tokens in lower case format so we must match this
            TokenIn = TokenIn.toLowerCase();
            TokenOut = TokenOut.toLowerCase();
            // Retrieves pool information
            let isFetched = yield this.fetchPairPools(
                TokenIn,
                TokenOut,
                PurgeCache
            );
            let [swaps, total] = yield this.getSwapsWithCache(
                TokenIn,
                TokenOut,
                SwapType,
                SwapAmt,
                this.SUBGRAPH_URL[this.chainId],
                this.MULTIADDR[this.chainId]
            );
            return [swaps, total];
        });
    }
    getSwapsWithCache(
        TokenIn,
        TokenOut,
        SwapType,
        SwapAmt,
        SubgraphUrl,
        MulticallAddr
    ) {
        return __awaiter(this, void 0, void 0, function*() {
            let pools, paths, epsOfInterest;
            // If token pair has been processed before use that info to speed up execution
            let cache = this.processedDataCache[
                `${TokenIn}${TokenOut}${SwapType}`
            ];
            if (!cache) {
                // If not previously cached we must process all paths/prices.
                // Always use onChain info
                // Some functions alter pools list directly but we want to keep original so make a copy to work from
                let poolsList = JSON.parse(JSON.stringify(this.onChainCache));
                // Retrieves all pools that contain both tokenIn & tokenOut, i.e. pools that can be used for direct swaps
                // Retrieves intermediate pools along with tokens that are contained in these.
                let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
                [
                    directPools,
                    hopTokens,
                    poolsTokenIn,
                    poolsTokenOut,
                ] = sor.filterPools(poolsList.pools, TokenIn, TokenOut);
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
                [pools, pathData] = sor.parsePoolData(
                    directPools,
                    TokenIn,
                    TokenOut,
                    mostLiquidPoolsFirstHop,
                    mostLiquidPoolsSecondHop,
                    hopTokens
                );
                // Finds sorted price & slippage information for paths
                paths = sor.processPaths(pathData, pools, SwapType);
                epsOfInterest = sor.processEpsOfInterestMultiHop(
                    paths,
                    SwapType,
                    this.maxPools
                );
                this.processedDataCache[`${TokenIn}${TokenOut}${SwapType}`] = {
                    pools: pools,
                    paths: paths,
                    epsOfInterest: epsOfInterest,
                };
            } else {
                // Using pre-processed data
                pools = cache.pools;
                paths = cache.paths;
                epsOfInterest = cache.epsOfInterest;
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
            return [swaps, total];
        });
    }
}
exports.SOR = SOR;
