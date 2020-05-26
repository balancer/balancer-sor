// Legacy Calls
export {
    smartOrderRouter,
    calcTotalOutput,
    calcTotalInput,
    formatSwapsExactAmountIn,
    formatSwapsExactAmountOut,
} from './direct/direct-sor';
//

export { smartOrderRouterMultiHop, calcTotalReturn } from './sor';
export {
    getMultihopPoolsWithTokens,
    getTokenPairsMultiHop,
    parsePoolData, // Legacy Function
    filterPoolsWithTokensDirect,
} from './helpers';
export {
    getPoolsWithTokens, // Legacy Function
    getTokenPairs, // Legacy Function
    getPoolsWithToken,
    getPoolsWithSingleToken,
    getPools,
    getPoolsWithTokensMultiHop,
} from './subgraph';
export { parsePoolDataOnChain } from './multicall'; // Legacy Function
import * as bmath from './bmath';
export { bmath };
