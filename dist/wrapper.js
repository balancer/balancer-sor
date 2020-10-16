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
var __importDefault =
    (this && this.__importDefault) ||
    function(mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
const bignumber_1 = require('./utils/bignumber');
const lodash_1 = __importDefault(require('lodash'));
const sor = require('./index');
class SOR {
    constructor(Provider, GasPrice) {
        this.multicallAddress = '0xeefba1e63905ef1d7acba5a8513c70307c1ce441';
        // avg Balancer swap cost. Can be updated manually if required.
        this.swapCost = new bignumber_1.BigNumber('100000');
        this.isSubgraphFetched = false;
        this.isOnChainFetched = false;
        this.provider = Provider;
        this.gasPrice = GasPrice;
        this.tokenCost = {};
    }
    fetchSubgraphPools() {
        return __awaiter(this, void 0, void 0, function*() {
            this.isSubgraphFetched = false;
            let previous = lodash_1.default.cloneDeep(this.subgraphPools);
            this.subgraphPools = yield sor.getAllPublicSwapPools();
            if (!lodash_1.default.isEqual(this.subgraphPools, previous)) {
                this.isOnChainFetched = false; // New pools so any previous onchain info is out of date.
                this.subgraphPoolsFormatted = lodash_1.default.cloneDeep(
                    this.subgraphPools
                ); // format alters pools so make copy first
                sor.formatSubgraphPools(this.subgraphPoolsFormatted);
            }
            this.isSubgraphFetched = true;
        });
    }
    fetchOnChainPools() {
        return __awaiter(this, void 0, void 0, function*() {
            this.isOnChainFetched = false;
            if (!this.isSubgraphFetched) {
                console.error(
                    'ERROR: Must fetch Subgraph pools before getting On-Chain.'
                );
                return;
            }
            this.onChainPools = yield sor.getAllPoolDataOnChain(
                this.subgraphPools,
                this.multicallAddress,
                this.provider
            );
            this.isOnChainFetched = true;
        });
    }
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
    getSwaps(
        TokenIn,
        TokenOut,
        SwapType,
        SwapAmt,
        NoPools,
        CheckOnChain = true
    ) {
        return __awaiter(this, void 0, void 0, function*() {
            if (!this.isSubgraphFetched) {
                console.error('ERROR: Must fetch pools before getting a swap.');
                return;
            }
            // Some function alter pools list directly but we want to keep original so make a copy to work from
            let poolsList;
            if (this.isOnChainFetched)
                poolsList = lodash_1.default.cloneDeep(this.onChainPools);
            else
                poolsList = lodash_1.default.cloneDeep(
                    this.subgraphPoolsFormatted
                );
            // The Subgraph returns tokens in lower case format so we must match this
            TokenIn = TokenIn.toLowerCase();
            TokenOut = TokenOut.toLowerCase();
            let costOutputToken = this.tokenCost[TokenOut];
            if (costOutputToken === undefined) {
                costOutputToken = new bignumber_1.BigNumber(0);
            }
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
            let pools, pathData;
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
                NoPools
            );
            // Returns list of swaps
            // swapExactIn - total = total amount swap will return of TokenOut
            // swapExactOut - total = total amount of TokenIn required for swap
            let swaps, total;
            [swaps, total] = sor.smartOrderRouterMultiHopEpsOfInterest(
                pools,
                paths,
                SwapType,
                SwapAmt,
                NoPools,
                costOutputToken,
                epsOfInterest
            );
            // Perform onChain check of swaps if using Subgraph balances
            if (!this.isOnChainFetched && CheckOnChain && swaps.length > 0) {
                // Gets pools used in swaps
                let poolsToCheck = sor.getPoolsFromSwaps(
                    swaps,
                    this.subgraphPools
                );
                // Get onchain info for swap pools
                let onChainPools = yield sor.getAllPoolDataOnChain(
                    poolsToCheck,
                    this.multicallAddress,
                    this.provider
                );
                // Checks Subgraph swaps against Onchain pools info.
                // Will update any invalid swaps for valid.
                if (SwapType === 'swapExactIn')
                    [swaps, total] = sor.checkSwapsExactIn(
                        swaps,
                        TokenIn,
                        TokenOut,
                        SwapAmt,
                        total,
                        onChainPools
                    );
                else
                    [swaps, total] = sor.checkSwapsExactOut(
                        swaps,
                        TokenIn,
                        TokenOut,
                        SwapAmt,
                        total,
                        onChainPools
                    );
            }
            return [swaps, total];
        });
    }
}
exports.SOR = SOR;
