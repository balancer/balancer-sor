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
const bmath_1 = require('./bmath');
const sor = require('./index');
class SOR {
    constructor(Provider, GasPrice, MaxPools, ChainId) {
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
                    this.provider,
                    this.chainId
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
                this.isAllFetched = true;
                return true;
            } catch (err) {
                this.isAllFetched = false;
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
            let swaps, total;
            if (this.isAllFetched) {
                [swaps, total] = yield this.getSwapsWithCache(
                    TokenIn,
                    TokenOut,
                    SwapType,
                    SwapAmt,
                    this.onChainCache
                );
            } else {
                if (!this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)])
                    return [[], bmath_1.bnum(0)];
                [swaps, total] = yield this.getSwapsWithCache(
                    TokenIn,
                    TokenOut,
                    SwapType,
                    SwapAmt,
                    this.poolsForPairsCache[this.createKey(TokenIn, TokenOut)],
                    false
                );
            }
            return [swaps, total];
        });
    }
    getSwapsWithCache(
        TokenIn,
        TokenOut,
        SwapType,
        SwapAmt,
        OnChainPools,
        UserProcessCache = true
    ) {
        return __awaiter(this, void 0, void 0, function*() {
            if (OnChainPools.pools.length === 0) return [[], bmath_1.bnum(0)];
            let pools, paths, epsOfInterest;
            // If token pair has been processed before use that info to speed up execution
            let cache = this.processedDataCache[
                `${TokenIn}${TokenOut}${SwapType}`
            ];
            if (!UserProcessCache || !cache) {
                // If not previously cached we must process all paths/prices.
                // Always use onChain info
                // Some functions alter pools list directly but we want to keep original so make a copy to work from
                let poolsList = JSON.parse(JSON.stringify(OnChainPools));
                // Retrieves all pools that contain both tokenIn & tokenOut, i.e. pools that can be used for direct swaps
                // Retrieves intermediate pools along with tokens that are contained in these.
                // let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
                let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
                [
                    directPools,
                    hopTokens,
                    poolsTokenIn,
                    poolsTokenOut,
                ] = sor.filterPools(poolsList.pools, TokenIn, TokenOut);
                [pools, paths, epsOfInterest] = this.processPairPools(
                    TokenIn,
                    TokenOut,
                    poolsTokenIn,
                    poolsTokenOut,
                    directPools,
                    hopTokens,
                    SwapType
                );
                if (UserProcessCache)
                    this.processedDataCache[
                        `${TokenIn}${TokenOut}${SwapType}`
                    ] = {
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
    fetchFilteredPairPools(TokenIn, TokenOut) {
        return __awaiter(this, void 0, void 0, function*() {
            TokenIn = TokenIn.toLowerCase();
            TokenOut = TokenOut.toLowerCase();
            // Get all IPFS pools (with balance)
            let allPoolsNonBig = yield this.ipfs.getAllPublicSwapPools(
                `${this.IPNS[this.chainId]}?cb=${Math.random() *
                    10000000000000000}`,
                'ipns'
            );
            // Convert to BigNumber format
            let allPools = yield this.ipfs.getAllPublicSwapPoolsBigNumber(
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
            // Retrieves all pools that contain both tokenIn & tokenOut, i.e. pools that can be used for direct swaps
            // Retrieves intermediate pools along with tokens that are contained in these.
            // These are common for both swap types
            let directPools, hopTokens, poolsTokenIn, poolsTokenOut;
            [
                directPools,
                hopTokens,
                poolsTokenIn,
                poolsTokenOut,
            ] = sor.filterPools(allPools.pools, TokenIn, TokenOut);
            let poolsInOut, pathsExactIn, epsExactIn;
            [poolsInOut, pathsExactIn, epsExactIn] = this.processPairPools(
                TokenIn,
                TokenOut,
                poolsTokenIn,
                poolsTokenOut,
                directPools,
                hopTokens,
                'swapExactIn'
            );
            let poolsOutIn, pathsExactOut, epsExactOut;
            [poolsOutIn, pathsExactOut, epsExactOut] = this.processPairPools(
                TokenOut,
                TokenIn,
                poolsTokenOut,
                poolsTokenIn,
                directPools,
                hopTokens,
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
            range.forEach(amt => {
                let amtIn = bmath_1.scale(amt, decimalsIn);
                let amtOut = amtIn;
                if (decimalsIn !== decimalsOut)
                    amtOut = bmath_1.scale(amt, decimalsOut);
                let swaps, total;
                [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
                    JSON.parse(JSON.stringify(poolsInOut)), // Need to keep original pools
                    pathsExactIn,
                    'swapExactIn',
                    amtIn,
                    this.maxPools,
                    costOutputToken,
                    epsExactIn
                );
                allSwaps.push(swaps);
                [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
                    JSON.parse(JSON.stringify(poolsOutIn)), // Need to keep original pools
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
            // get swap pools
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
                let index = filteredPools.indexOf(allPoolsNonBig.pools[i].id);
                if (index > -1) {
                    filteredPools.splice(index, 1);
                    poolsOfInterest.push(allPoolsNonBig.pools[i]);
                    if (filteredPools.length === 0) break;
                }
            }
            let onChainPools = yield sor.getAllPoolDataOnChain(
                { pools: poolsOfInterest },
                this.MULTIADDR[this.chainId],
                this.provider
            );
            this.poolsForPairsCache[
                this.createKey(TokenIn, TokenOut)
            ] = onChainPools;
        });
    }
    processPairPools(
        TokenIn,
        TokenOut,
        PoolsTokenIn,
        PoolsTokenOut,
        DirectPools,
        HopTokens,
        SwapType
    ) {
        // Sort intermediate pools by order of liquidity
        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
        ] = sor.sortPoolsMostLiquid(
            TokenIn,
            TokenOut,
            HopTokens,
            PoolsTokenIn,
            PoolsTokenOut
        );
        // Finds the possible paths to make the swap
        let pathData;
        let pools;
        [pools, pathData] = sor.parsePoolData(
            DirectPools,
            TokenIn,
            TokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            HopTokens
        );
        // Finds sorted price & slippage information for paths for SwapType
        let paths = sor.processPaths(pathData, pools, SwapType);
        let eps = sor.processEpsOfInterestMultiHop(
            paths,
            SwapType,
            this.maxPools
        );
        return [pools, paths, eps];
    }
    createKey(Token1, Token2) {
        return Token1 < Token2 ? `${Token1}${Token2}` : `${Token2}${Token1}`;
    }
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
