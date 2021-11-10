import {
    filterPoolsOfInterest,
    filterHopPools,
    getLinearStaBal3Paths,
    getPathsUsingStaBalPool,
    parseToPoolsDict,
} from './filtering';
import { calculatePathLimits } from './pathLimits';
import { SwapOptions, SwapTypes, NewPath, SubgraphPoolBase } from '../types';

export class RouteProposer {
    cache: Record<string, { paths: NewPath[] }> = {};

    /**
     * Given a list of pools and a desired input/output, returns a set of possible paths to route through
     */
    getCandidatePaths(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        pools: SubgraphPoolBase[],
        swapOptions: SwapOptions,
        chainId: number
    ): NewPath[] {
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

        const [poolsFilteredDict, hopTokens] = filterPoolsOfInterest(
            poolsAllDict,
            tokenIn,
            tokenOut,
            swapOptions.maxPools
        );

        const [, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            poolsFilteredDict
        );

        const pathsUsingLinear: NewPath[] = getLinearStaBal3Paths(
            tokenIn,
            tokenOut,
            poolsAllDict,
            poolsFilteredDict,
            chainId
        );

        const pathsUsingStaBal = getPathsUsingStaBalPool(
            tokenIn,
            tokenOut,
            poolsAllDict,
            poolsFilteredDict,
            chainId
        );

        const combinedPathData = pathData
            .concat(...pathsUsingLinear)
            .concat(...pathsUsingStaBal);
        const [paths] = calculatePathLimits(combinedPathData, swapType);

        this.cache[`${tokenIn}${tokenOut}${swapType}${swapOptions.timestamp}`] =
            {
                paths: paths,
            };

        return paths;
    }
}
