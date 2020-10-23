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
        this.MULTIADDR = {
            1: '0xF700478148B84E572A447d63b29fD937Fd511147',
            42: '0x9907109e5Ca97aE76f684407318D1B8ea119c83B',
        };
        // 0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210 - Balances only
        this.SUBGRAPH_URL = {
            1: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer',
            42: 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan',
        };
        this.chainId = ChainId;
        this.isSubgraphFetched = false;
        this.isOnChainFetched = false;
        this.provider = Provider;
        this.gasPrice = GasPrice;
        this.maxPools = MaxPools;
        this.tokenCost = {};
        this.processedCache = {};
    }
    /*
    Fetch all public & active pools from Subgraph.
    Will clear cached onChain pools and processed paths if new pools are different from cached.
    */
    fetchSubgraphPools() {
        return __awaiter(this, void 0, void 0, function*() {
            this.isSubgraphFetched = false;
            let previousStringify = JSON.stringify(this.subgraphPools); // Used for compare
            this.subgraphPools = yield sor.getAllPublicSwapPools(
                this.SUBGRAPH_URL[this.chainId]
            );
            let newStringify = JSON.stringify(this.subgraphPools);
            if (newStringify !== previousStringify) {
                this.isOnChainFetched = false; // New pools so any previous onchain info is out of date.
                this.subgraphPoolsFormatted = JSON.parse(newStringify); // format alters pools so make copy first
                sor.formatSubgraphPools(this.subgraphPoolsFormatted);
                this.processedCache = {}; // Clear processed cache as data changed
            }
            this.isSubgraphFetched = true;
        });
    }
    /*
    Uses multicall contact to fetch all onchain balances, weights and fees for cached Subgraph pools.
    Will clear cached processed paths if new pools are different from cached.
    MulticallAddr can be passed to override default mainnet multicall address.
    */
    fetchOnChainPools() {
        return __awaiter(this, void 0, void 0, function*() {
            this.isOnChainFetched = false;
            if (!this.isSubgraphFetched) {
                console.error(
                    'ERROR: Must fetch Subgraph pools before getting On-Chain.'
                );
                return;
            }
            let previousStringify = JSON.stringify(this.onChainPools); // Used for compare
            this.onChainPools = yield sor.getAllPoolDataOnChain(
                this.subgraphPools,
                this.MULTIADDR[this.chainId],
                this.provider
            );
            // Error with multicall
            if (!this.onChainPools) return;
            // If new pools are different from previous then any previous processed data is out of date so clear
            if (previousStringify !== JSON.stringify(this.onChainPools)) {
                this.processedCache = {};
            }
            this.isOnChainFetched = true;
        });
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
    Main function to retrieve swap information.
    Will always use onChain pools if available over Subgraph pools.
    If using Subgraph pools by default swaps are checked using data retrieved from onChain.
    Can be overridden with CheckOnChain.
    */
    getSwaps(TokenIn, TokenOut, SwapType, SwapAmt) {
        return __awaiter(this, void 0, void 0, function*() {
            // The Subgraph returns tokens in lower case format so we must match this
            TokenIn = TokenIn.toLowerCase();
            TokenOut = TokenOut.toLowerCase();
            if (!this.isSubgraphFetched || !this.isOnChainFetched) {
                let [swaps, total] = yield this.getSwapsWithoutCache(
                    TokenIn,
                    TokenOut,
                    SwapType,
                    SwapAmt,
                    this.SUBGRAPH_URL[this.chainId],
                    this.MULTIADDR[this.chainId]
                );
                return [swaps, total];
            } else {
                let [swaps, total] = yield this.getSwapsWithCache(
                    TokenIn,
                    TokenOut,
                    SwapType,
                    SwapAmt,
                    this.SUBGRAPH_URL[this.chainId],
                    this.MULTIADDR[this.chainId]
                );
                return [swaps, total];
            }
        });
    }
    getSwapsWithoutCache(
        TokenIn,
        TokenOut,
        SwapType,
        SwapAmt,
        SubgraphUrl,
        MulticallAddr
    ) {
        return __awaiter(this, void 0, void 0, function*() {
            // Fetch pools that have either tokenIn or tokenOut or both
            let subGraphPools = yield sor.getFilteredPools(
                TokenIn,
                TokenOut,
                SubgraphUrl
            );
            // Fetch on-chain balances
            let poolsList = yield sor.getAllPoolDataOnChain(
                subGraphPools,
                this.MULTIADDR[this.chainId],
                this.provider
            );
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
            let pathData, pools;
            [pools, pathData] = sor.parsePoolData(
                directPools,
                TokenIn,
                TokenOut,
                mostLiquidPoolsFirstHop,
                mostLiquidPoolsSecondHop,
                hopTokens
            );
            // Finds sorted price & slippage information for paths
            let paths = sor.processPaths(pathData, pools, SwapType);
            let epsOfInterest = sor.processEpsOfInterestMultiHop(
                paths,
                SwapType,
                this.maxPools
            );
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
                pools, // Need to keep original pools for cache
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
            let cache = this.processedCache[`${TokenIn}${TokenOut}${SwapType}`];
            if (!cache) {
                // If not previously cached we must process all paths/prices.
                // Always use onChain info if available
                // Some functions alter pools list directly but we want to keep original so make a copy to work from
                let poolsList;
                if (this.isOnChainFetched)
                    poolsList = JSON.parse(JSON.stringify(this.onChainPools));
                else
                    poolsList = JSON.parse(
                        JSON.stringify(this.subgraphPoolsFormatted)
                    );
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
                this.processedCache[`${TokenIn}${TokenOut}${SwapType}`] = {
                    pools: pools,
                    paths: paths,
                    epsOfInterest: epsOfInterest,
                };
            } else {
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
