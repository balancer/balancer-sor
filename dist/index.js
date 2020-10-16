'use strict';
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
// Legacy Calls
var direct_sor_1 = require('./direct/direct-sor');
exports.smartOrderRouter = direct_sor_1.smartOrderRouter;
exports.smartOrderRouterEpsOfInterest =
    direct_sor_1.smartOrderRouterEpsOfInterest;
exports.calcTotalOutput = direct_sor_1.calcTotalOutput;
exports.calcTotalInput = direct_sor_1.calcTotalInput;
exports.formatSwapsExactAmountIn = direct_sor_1.formatSwapsExactAmountIn;
exports.formatSwapsExactAmountOut = direct_sor_1.formatSwapsExactAmountOut;
exports.processBalancers = direct_sor_1.processBalancers;
exports.processEpsOfInterest = direct_sor_1.processEpsOfInterest;
//
var sor_1 = require('./sor');
exports.smartOrderRouterMultiHopEpsOfInterest =
    sor_1.smartOrderRouterMultiHopEpsOfInterest;
exports.calcTotalReturn = sor_1.calcTotalReturn;
exports.processPaths = sor_1.processPaths;
exports.processEpsOfInterestMultiHop = sor_1.processEpsOfInterestMultiHop;
var helpers_1 = require('./helpers');
exports.getTokenPairsMultiHop = helpers_1.getTokenPairsMultiHop;
exports.parsePoolData = helpers_1.parsePoolData;
exports.filterPoolsWithTokensDirect = helpers_1.filterPoolsWithTokensDirect;
exports.filterPoolsWithTokensMultihop = helpers_1.filterPoolsWithTokensMultihop;
exports.formatSubgraphPools = helpers_1.formatSubgraphPools;
exports.filterPools = helpers_1.filterPools;
exports.sortPoolsMostLiquid = helpers_1.sortPoolsMostLiquid;
exports.checkSwapsExactIn = helpers_1.checkSwapsExactIn;
exports.checkSwapsExactOut = helpers_1.checkSwapsExactOut;
exports.getPoolsFromSwaps = helpers_1.getPoolsFromSwaps;
var subgraph_1 = require('./subgraph');
exports.getPoolsWithTokens = subgraph_1.getPoolsWithTokens;
exports.getTokenPairs = subgraph_1.getTokenPairs;
exports.getAllPublicSwapPools = subgraph_1.getAllPublicSwapPools;
var multicall_1 = require('./multicall'); // Legacy Function
exports.parsePoolDataOnChain = multicall_1.parsePoolDataOnChain;
exports.getAllPoolDataOnChain = multicall_1.getAllPoolDataOnChain;
const bmath = __importStar(require('./bmath'));
exports.bmath = bmath;
var costToken_1 = require('./costToken');
exports.getCostOutputToken = costToken_1.getCostOutputToken;
var wrapper_1 = require('./wrapper');
exports.SOR = wrapper_1.SOR;
