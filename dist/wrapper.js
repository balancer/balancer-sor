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
const index_1 = require('./index');
class SOR {
    constructor(
        provider,
        gasPrice,
        maxPools,
        chainId,
        poolsSource,
        swapCost = new bignumber_1.BigNumber('100000'),
        disabledOptions = {
            isOverRide: false,
            disabledTokens: [],
        }
    ) {
        this.tokenCost = {};
        this.onChainBalanceCache = { pools: [] };
        this.processedDataCache = {};
        this.finishedFetchingOnChain = false;
        this.provider = provider;
        this.gasPrice = gasPrice;
        this.maxPools = maxPools;
        this.chainId = chainId;
        this.swapCost = swapCost;
        // The pools source can be a URL (e.g. pools from Subgraph) or a data set of pools
        if (typeof poolsSource === 'string') {
            this.isUsingPoolsUrl = true;
            this.poolsUrl = poolsSource;
        } else {
            this.isUsingPoolsUrl = false;
            this.subgraphPools = poolsSource;
        }
        this.disabledOptions = disabledOptions;
    }
    /*
    Find and cache cost of token.
    If cost is passed then it manually sets the value.
    */
    setCostOutputToken(tokenOut, tokenDecimals, cost = null) {
        return __awaiter(this, void 0, void 0, function*() {
            tokenOut = tokenOut.toLowerCase();
            if (cost === null) {
                // Handle ETH/WETH cost
                if (
                    tokenOut === index_1.ZERO_ADDRESS ||
                    tokenOut.toLowerCase() ===
                        index_1.WETHADDR[this.chainId].toLowerCase()
                ) {
                    this.tokenCost[
                        tokenOut.toLowerCase()
                    ] = this.gasPrice
                        .times(this.swapCost)
                        .div(index_1.bnum(Math.pow(10, 18)));
                    return this.tokenCost[tokenOut.toLowerCase()];
                }
                // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations
                const costOutputToken = yield index_1.getCostOutputToken(
                    tokenOut,
                    this.gasPrice,
                    this.swapCost,
                    this.provider,
                    this.chainId
                );
                this.tokenCost[tokenOut] = costOutputToken.div(
                    index_1.bnum(Math.pow(10, tokenDecimals))
                );
                return this.tokenCost[tokenOut];
            } else {
                this.tokenCost[tokenOut] = cost;
                return cost;
            }
        });
    }
    /*
    Saves updated pools data to internal onChainBalanceCache.
    If isOnChain is true will retrieve all required onChain data. (false is advised to only be used for testing)
    If poolsData is passed as parameter - uses this as pools source.
    If poolsData was passed in to constructor - uses this as pools source.
    If pools url was passed in to constructor - uses this to fetch pools source.
    */
    fetchPools(isOnChain = true, poolsData = { pools: [] }) {
        return __awaiter(this, void 0, void 0, function*() {
            try {
                // If poolsData has been passed to function these pools should be used
                const isExternalPoolData =
                    poolsData.pools.length > 0 ? true : false;
                let subgraphPools;
                if (isExternalPoolData) {
                    subgraphPools = JSON.parse(JSON.stringify(poolsData));
                    // Store as latest pools data
                    if (!this.isUsingPoolsUrl)
                        this.subgraphPools = subgraphPools;
                } else {
                    // Retrieve from URL if set otherwise use data passed in constructor
                    if (this.isUsingPoolsUrl)
                        subgraphPools = yield index_1.fetchSubgraphPools(
                            this.poolsUrl
                        );
                    else subgraphPools = this.subgraphPools;
                }
                let previousStringify = JSON.stringify(
                    this.onChainBalanceCache
                ); // Used for compare
                // Get latest on-chain balances (returns data in string/normalized format)
                this.onChainBalanceCache = yield this.fetchOnChainBalances(
                    subgraphPools,
                    isOnChain
                );
                // If new pools are different from previous then any previous processed data is out of date so clear
                if (
                    previousStringify !==
                    JSON.stringify(this.onChainBalanceCache)
                ) {
                    this.processedDataCache = {};
                }
                this.finishedFetchingOnChain = true;
                return true;
            } catch (err) {
                // On error clear all caches and return false so user knows to try again.
                this.finishedFetchingOnChain = false;
                this.onChainBalanceCache = { pools: [] };
                this.processedDataCache = {};
                console.error(`Error: fetchPools(): ${err.message}`);
                return false;
            }
        });
    }
    /*
    Uses multicall contract to fetch all onchain balances for pools.
    */
    fetchOnChainBalances(subgraphPools, isOnChain = true) {
        return __awaiter(this, void 0, void 0, function*() {
            if (subgraphPools.pools.length === 0) {
                console.error('ERROR: No Pools To Fetch.');
                return { pools: [] };
            }
            // Allows for testing
            if (!isOnChain) {
                console.log(
                    `!!!!!!! WARNING - Not Using Real OnChain Balances !!!!!!`
                );
                return subgraphPools;
            }
            // This will return in normalized/string format
            const onChainPools = yield index_1.getOnChainBalances(
                subgraphPools,
                index_1.MULTIADDR[this.chainId],
                index_1.VAULTADDR[this.chainId],
                this.provider
            );
            // Error with multicall
            if (!onChainPools) return { pools: [] };
            return onChainPools;
        });
    }
    getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        swapAmt,
        swapOptions = {
            poolTypeFilter: index_1.PoolFilter.All,
            timestamp: 0,
        }
    ) {
        return __awaiter(this, void 0, void 0, function*() {
            let swapInfo = {
                tokenAddresses: [],
                swaps: [],
                swapAmount: bmath_1.ZERO,
                swapAmountForSwaps: bmath_1.ZERO,
                tokenIn: '',
                tokenOut: '',
                returnAmount: bmath_1.ZERO,
                returnAmountConsideringFees: bmath_1.ZERO,
                returnAmountFromSwaps: bmath_1.ZERO,
                marketSp: bmath_1.ZERO,
            };
            const wrappedInfo = yield index_1.getWrappedInfo(
                this.provider,
                swapType,
                tokenIn,
                tokenOut,
                this.chainId,
                swapAmt
            );
            if (this.finishedFetchingOnChain) {
                let pools = JSON.parse(
                    JSON.stringify(this.onChainBalanceCache)
                );
                if (!(swapOptions.poolTypeFilter === index_1.PoolFilter.All))
                    pools.pools = pools.pools.filter(
                        p => p.poolType === swapOptions.poolTypeFilter
                    );
                if (index_1.isLidoStableSwap(this.chainId, tokenIn, tokenOut)) {
                    swapInfo = yield index_1.getLidoStaticSwaps(
                        pools,
                        this.chainId,
                        wrappedInfo.tokenIn.addressForSwaps,
                        wrappedInfo.tokenOut.addressForSwaps,
                        swapType,
                        wrappedInfo.swapAmountForSwaps,
                        this.provider
                    );
                } else {
                    swapInfo = yield this.processSwaps(
                        wrappedInfo.tokenIn.addressForSwaps,
                        wrappedInfo.tokenOut.addressForSwaps,
                        swapType,
                        wrappedInfo.swapAmountForSwaps,
                        pools,
                        true,
                        swapOptions.timestamp
                    );
                }
                swapInfo = index_1.setWrappedInfo(
                    swapInfo,
                    swapType,
                    wrappedInfo,
                    this.chainId
                );
            }
            return swapInfo;
        });
    }
    // Will process swap/pools data and return best swaps
    // useProcessCache can be false to force fresh processing of paths/prices
    processSwaps(
        tokenIn,
        tokenOut,
        swapType,
        swapAmt,
        onChainPools,
        useProcessCache = true,
        currentBlockTimestamp = 0
    ) {
        return __awaiter(this, void 0, void 0, function*() {
            let swapInfo = {
                tokenAddresses: [],
                swaps: [],
                swapAmount: bmath_1.ZERO,
                swapAmountForSwaps: bmath_1.ZERO,
                tokenIn: '',
                tokenOut: '',
                returnAmount: bmath_1.ZERO,
                returnAmountConsideringFees: bmath_1.ZERO,
                returnAmountFromSwaps: bmath_1.ZERO,
                marketSp: bmath_1.ZERO,
            };
            if (onChainPools.pools.length === 0) return swapInfo;
            let pools, paths, marketSp;
            // If token pair has been processed before that info can be reused to speed up execution
            let cache = this.processedDataCache[
                `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
            ];
            // useProcessCache can be false to force fresh processing of paths/prices
            if (!useProcessCache || !cache) {
                // If not previously cached we must process all paths/prices.
                // Always use onChain info
                // Some functions alter pools list directly but we want to keep original so make a copy to work from
                let poolsList = JSON.parse(JSON.stringify(onChainPools));
                let pathData;
                let hopTokens;
                [pools, hopTokens] = index_1.filterPoolsOfInterest(
                    poolsList.pools,
                    tokenIn,
                    tokenOut,
                    this.maxPools,
                    this.disabledOptions,
                    currentBlockTimestamp
                );
                [pools, pathData] = index_1.filterHopPools(
                    tokenIn,
                    tokenOut,
                    hopTokens,
                    pools
                );
                [paths] = index_1.calculatePathLimits(pathData, swapType);
                // Update cache if used
                if (useProcessCache)
                    this.processedDataCache[
                        `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
                    ] = {
                        pools: pools,
                        paths: paths,
                        marketSp: marketSp,
                    };
            } else {
                // Using pre-processed data from cache
                pools = cache.pools;
                paths = cache.paths;
                marketSp = cache.marketSp;
            }
            let costOutputToken = this.tokenCost[tokenOut];
            if (swapType === index_1.SwapTypes.SwapExactOut)
                costOutputToken = this.tokenCost[tokenIn];
            // Use previously stored value if exists else default to 0
            if (costOutputToken === undefined) {
                costOutputToken = new bignumber_1.BigNumber(0);
            }
            // Returns list of swaps
            // swapExactIn - total = total amount swap will return of tokenOut
            // swapExactOut - total = total amount of tokenIn required for swap
            let swaps, total, totalConsideringFees;
            [
                swaps,
                total,
                marketSp,
                totalConsideringFees,
            ] = index_1.smartOrderRouter(
                JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
                paths,
                swapType,
                swapAmt,
                this.maxPools,
                costOutputToken
            );
            if (useProcessCache)
                this.processedDataCache[
                    `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
                ].marketSp = marketSp;
            swapInfo = index_1.formatSwaps(
                swaps,
                swapType,
                swapAmt,
                tokenIn,
                tokenOut,
                total,
                totalConsideringFees,
                marketSp
            );
            return swapInfo;
        });
    }
}
exports.SOR = SOR;
