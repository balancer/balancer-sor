export declare function getPoolsWithTokens(
    tokenIn: any,
    tokenOut: any
): Promise<any>;
export declare function getTokenPairs(token: any): Promise<any>;
export declare function getAllPublicSwapPools(
    SubgraphUrl?: string
): Promise<any>;
export declare function getFilteredPools(
    tokenIn: any,
    tokenOut: any,
    SubgraphUrl?: string
): Promise<{
    pools: any;
}>;
