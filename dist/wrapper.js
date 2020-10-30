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
        this.onChainCache = { pools: [] };
        this.processedDataCache = {};
        this.MULTIADDR = {
            1: '0x514053acec7177e277b947b1ebb5c08ab4c4580e',
            42: '0x71c7f1086aFca7Aa1B0D4d73cfa77979d10D3210',
        };
        this.IPNS = {
            1: 'balancer-team-bucket.storage.fleek.co/balancer-exchange/pools',
            42: 'balancer-team-bucket.storage.fleek.co/balancer-exchange-kovan/pools',
        };
        this.provider = Provider;
        this.gasPrice = GasPrice;
        this.maxPools = MaxPools;
        this.chainId = ChainId;
        this.ipfs = new sor.IPFS();
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
    // Fetch allPools from IPFS then OnChain balances
    fetchPools() {
        return __awaiter(this, void 0, void 0, function*() {
            try {
                let allPools = yield this.ipfs.getAllPublicSwapPools(
                    `${this.IPNS[this.chainId]}?cb=${Math.random() *
                        10000000000000000}`,
                    'ipns'
                );
                let previousStringify = JSON.stringify(this.onChainCache); // Used for compare
                this.onChainCache = yield this.fetchOnChainPools(allPools);
                // If new pools are different from previous then any previous processed data is out of date so clear
                if (previousStringify !== JSON.stringify(this.onChainCache)) {
                    this.processedDataCache = {};
                }
                return true;
            } catch (err) {
                console.error(`fetchPools(): ${err.message}`);
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
            let [swaps, total] = yield this.getSwapsWithCache(
                TokenIn,
                TokenOut,
                SwapType,
                SwapAmt
            );
            return [swaps, total];
        });
    }
    getSwapsWithCache(TokenIn, TokenOut, SwapType, SwapAmt) {
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
