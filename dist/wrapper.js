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
const costToken_1 = require('./costToken');
const multicall_1 = require('./multicall');
const pools_1 = require('./pools');
const subgraph_1 = require('./subgraph');
const sorClass_1 = require('./sorClass');
const helpersClass_1 = require('./helpersClass');
const types_1 = require('./types');
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
        this.MULTIADDR = {
            1: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
            5: '0x3b2A02F22fCbc872AF77674ceD303eb269a46ce3',
            42: '0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A',
        };
        this.VAULTADDR = {
            1: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
            5: '0x65748E8287Ce4B9E6D83EE853431958851550311',
            42: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        };
        this.WETHADDR = {
            1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            5: '0x9A1000D492d40bfccbc03f413A48F5B6516Ec0Fd',
            42: '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
        };
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
                        this.WETHADDR[this.chainId].toLowerCase()
                ) {
                    this.tokenCost[
                        tokenOut.toLowerCase()
                    ] = this.gasPrice
                        .times(this.swapCost)
                        .div(bmath_1.bnum(Math.pow(10, 18)));
                    return this.tokenCost[tokenOut.toLowerCase()];
                }
                // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations
                const costOutputToken = yield costToken_1.getCostOutputToken(
                    tokenOut,
                    this.gasPrice,
                    this.swapCost,
                    this.provider,
                    this.chainId
                );
                this.tokenCost[tokenOut] = costOutputToken.div(
                    bmath_1.bnum(Math.pow(10, tokenDecimals))
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
                        subgraphPools = yield subgraph_1.fetchSubgraphPools(
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
            const onChainPools = yield multicall_1.getOnChainBalances(
                subgraphPools,
                this.MULTIADDR[this.chainId],
                this.VAULTADDR[this.chainId],
                this.provider
            );
            // Error with multicall
            if (!onChainPools) return { pools: [] };
            return onChainPools;
        });
    }
    getSwaps(tokenIn, tokenOut, swapType, swapAmt, timestamp = 0) {
        return __awaiter(this, void 0, void 0, function*() {
            let swapInfo = {
                tokenAddresses: [],
                swaps: [],
                swapAmount: bmath_1.bnum(0),
                tokenIn: '',
                tokenOut: '',
                returnAmount: bmath_1.bnum(0),
                returnAmountConsideringFees: bmath_1.bnum(0),
                marketSp: bmath_1.bnum(0),
            };
            // The Subgraph returns tokens in lower case format so we must match this
            tokenIn = tokenIn.toLowerCase();
            tokenOut = tokenOut.toLowerCase();
            const WETH = this.WETHADDR[this.chainId].toLowerCase();
            const wrapOptions = { isEthSwap: false, wethAddress: WETH };
            if (tokenIn === index_1.ZERO_ADDRESS) {
                tokenIn = WETH;
                wrapOptions.isEthSwap = true;
            }
            if (tokenOut === index_1.ZERO_ADDRESS) {
                tokenOut = WETH;
                wrapOptions.isEthSwap = true;
            }
            if (this.finishedFetchingOnChain) {
                // All Pools with OnChain Balances is already fetched so use that
                swapInfo = yield this.processSwaps(
                    tokenIn,
                    tokenOut,
                    swapType,
                    swapAmt,
                    this.onChainBalanceCache,
                    wrapOptions,
                    true,
                    timestamp
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
        wrapOptions,
        useProcessCache = true,
        currentBlockTimestamp = 0
    ) {
        return __awaiter(this, void 0, void 0, function*() {
            let swapInfo = {
                tokenAddresses: [],
                swaps: [],
                swapAmount: bmath_1.bnum(0),
                tokenIn: '',
                tokenOut: '',
                returnAmount: bmath_1.bnum(0),
                returnAmountConsideringFees: bmath_1.bnum(0),
                marketSp: bmath_1.bnum(0),
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
                [pools, hopTokens] = pools_1.filterPoolsOfInterest(
                    poolsList.pools,
                    tokenIn,
                    tokenOut,
                    this.maxPools,
                    this.disabledOptions,
                    currentBlockTimestamp
                );
                [pools, pathData] = pools_1.filterHopPools(
                    tokenIn,
                    tokenOut,
                    hopTokens,
                    pools
                );
                [paths] = sorClass_1.calculatePathLimits(pathData, swapType);
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
            if (swapType === types_1.SwapTypes.SwapExactOut)
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
            ] = sorClass_1.smartOrderRouter(
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
            swapInfo = helpersClass_1.formatSwaps(
                swaps,
                swapType,
                swapAmt,
                tokenIn,
                tokenOut,
                total,
                totalConsideringFees,
                marketSp,
                wrapOptions
            );
            if (wrapOptions.isEthSwap) {
                if (swapInfo.tokenIn === wrapOptions.wethAddress)
                    swapInfo.tokenIn = index_1.ZERO_ADDRESS;
                if (swapInfo.tokenOut === wrapOptions.wethAddress)
                    swapInfo.tokenOut = index_1.ZERO_ADDRESS;
            }
            return swapInfo;
        });
    }
}
exports.SOR = SOR;
