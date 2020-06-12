// Legacy Calls
export {
    smartOrderRouter,
    smartOrderRouterEpsOfInterest,
    calcTotalOutput,
    calcTotalInput,
    formatSwapsExactAmountIn,
    formatSwapsExactAmountOut,
    processBalancers,
    processEpsOfInterest,
} from './direct/direct-sor';
//

export { smartOrderRouterMultiHop, calcTotalReturn } from './sor';
export {
    getTokenPairsMultiHop,
    parsePoolData, // Legacy Function
    filterPoolsWithTokensDirect,
    filterPoolsWithTokensMultihop,
} from './helpers';
export {
    getPoolsWithTokens, // Legacy Function
    getTokenPairs, // Legacy Function
    getAllPublicSwapPools,
} from './subgraph';
export { parsePoolDataOnChain, getAllPoolDataOnChain } from './multicall'; // Legacy Function
import * as bmath from './bmath';
export { bmath };
