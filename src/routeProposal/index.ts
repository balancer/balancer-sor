import {
    filterPoolsOfInterest,
    filterHopPools,
    getPathsUsingLinearPools,
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

        const [poolsDict, hopTokens] = filterPoolsOfInterest(
            poolsAllDict,
            tokenIn,
            tokenOut,
            swapOptions.maxPools
        );

        let pathData: NewPath[];
        [, pathData] = filterHopPools(tokenIn, tokenOut, hopTokens, poolsDict);

        const pathsUsingLinear: NewPath[] = getPathsUsingLinearPools(
            tokenIn,
            tokenOut,
            poolsAllDict,
            poolsDict,
            chainId
        );
        pathData = pathData.concat(pathsUsingLinear);

        const [paths] = calculatePathLimits(pathData, swapType);

        this.cache[`${tokenIn}${tokenOut}${swapType}${swapOptions.timestamp}`] =
            {
                paths: paths,
            };

        return paths;
    }
}
