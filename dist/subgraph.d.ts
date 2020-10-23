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
