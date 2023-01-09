import {
    filterPoolsOfInterest,
    getBoostedPaths,
    getPathsUsingStaBalPool,
    parseToPoolsDict,
    producePaths,
} from './filtering';
import { calculatePathLimits } from './pathLimits';
import {
    NewPath,
    PoolDictionary,
    SorConfig,
    SubgraphPoolBase,
    SwapOptions,
    SwapTypes,
} from '../types';
import { PathGraph } from '../pathGraph/pathGraph';

export class RouteProposer {
    cache: Record<string, { paths: NewPath[] }> = {};
    private readonly pathGraph: PathGraph;

    constructor(private readonly config: SorConfig) {
        this.pathGraph = new PathGraph();
    }

    public initPathGraphWithPools(pools: SubgraphPoolBase[]): void {
        //TODO: setting the timestamp here is no longer ideal
        const poolsAllDict = parseToPoolsDict(pools, 0);

        this.pathGraph.buildGraph({
            pools: Object.values(poolsAllDict),
        });
    }

    /**
     * Given a list of pools and a desired input/output, returns a set of possible paths to route through
     */
    getCandidatePaths(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        pools: SubgraphPoolBase[],
        swapOptions: SwapOptions
    ): NewPath[] {
        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();
        if (pools.length === 0) return [];

        // If token pair has been processed before that info can be reused to speed up execution
        const cache =
            this.cache[
                `${tokenIn}${tokenOut}${swapType}${swapOptions.timestamp}`
            ];

        // forceRefresh can be set to force fresh processing of paths/prices
        if (!swapOptions.forceRefresh && !!cache) {
            // Using pre-processed data from cache
            return cache.paths;
        }

        const poolsAllDict = parseToPoolsDict(pools, swapOptions.timestamp);

        //TODO: this flow is no longer ideal
        if (!this.pathGraph.isGraphInitialized) {
            this.pathGraph.buildGraph({
                pools: Object.values(poolsAllDict),
            });
        }

        const [directPools, hopsIn, hopsOut] = filterPoolsOfInterest(
            poolsAllDict,
            tokenIn,
            tokenOut,
            swapOptions.maxPools
        );

        const pathData = producePaths(
            tokenIn,
            tokenOut,
            directPools,
            hopsIn,
            hopsOut,
            poolsAllDict
        );

        const boostedPaths = getBoostedPaths(
            tokenIn,
            tokenOut,
            poolsAllDict,
            this.config
        );

        const pathsUsingStaBal = getPathsUsingStaBalPool(
            tokenIn,
            tokenOut,
            poolsAllDict,
            poolsAllDict,
            this.config
        );

        this.pathGraph.traverseGraphAndFindBestPaths({
            tokenIn,
            tokenOut,
        });

        /*console.log(
            'uniquePaths',
            JSON.stringify(
                uniquePaths.map((item) => ({
                    id: item.id,
                    swaps: item.swaps,
                    pools: item.pools.map((pool) => pool.id),
                })),
                null,
                4
            )
        );*/
        //console.log('boosted paths', JSON.stringify(boostedPaths, null, 4));

        const combinedPathData = pathData
            .concat(...boostedPaths)
            .concat(...pathsUsingStaBal);
        const [paths] = calculatePathLimits(combinedPathData, swapType);

        this.cache[`${tokenIn}${tokenOut}${swapType}${swapOptions.timestamp}`] =
            {
                paths: paths,
            };
        return paths;
    }

    /**
     * Given a pool dictionary and a desired input/output, returns a set of possible paths to route through.
     * @param {string} tokenIn - Address of tokenIn
     * @param {string} tokenOut - Address of tokenOut
     * @param {SwapTypes} swapType - SwapExactIn where the amount of tokens in (sent to the Pool) is known or SwapExactOut where the amount of tokens out (received from the Pool) is known.
     * @param {PoolDictionary} poolsAllDict - Dictionary of pools.
     * @param {number }maxPools - Maximum number of pools to hop through.
     * @returns {NewPath[]} Array of possible paths sorted by liquidity.
     */
    getCandidatePathsFromDict(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        poolsAllDict: PoolDictionary,
        maxPools: number
    ): NewPath[] {
        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();
        if (Object.keys(poolsAllDict).length === 0) return [];

        const [directPools, hopsIn, hopsOut] = filterPoolsOfInterest(
            poolsAllDict,
            tokenIn,
            tokenOut,
            maxPools
        );

        const pathData = producePaths(
            tokenIn,
            tokenOut,
            directPools,
            hopsIn,
            hopsOut,
            poolsAllDict
        );

        const boostedPaths = getBoostedPaths(
            tokenIn,
            tokenOut,
            poolsAllDict,
            this.config
        );

        const combinedPathData = pathData.concat(...boostedPaths);
        const [paths] = calculatePathLimits(combinedPathData, swapType);
        return paths;
    }
}
