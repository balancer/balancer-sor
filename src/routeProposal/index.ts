import cloneDeep from 'lodash.clonedeep';
import {
    filterPoolsOfInterest,
    filterHopPools,
    getPathsUsingStaBalPool,
} from './filtering';
import { calculatePathLimits } from './pathLimits';
import {
    SwapOptions,
    SwapTypes,
    NewPath,
    PoolDictionary,
    SubgraphPoolBase,
} from '../types';

export class RouteProposer {
    cache: Record<string, { pools: PoolDictionary; paths: NewPath[] }> = {};

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
    ): { pools: PoolDictionary; paths: NewPath[] } {
        if (pools.length === 0) return { pools: {}, paths: [] };

        // If token pair has been processed before that info can be reused to speed up execution
        const cache =
            this.cache[
                `${tokenIn}${tokenOut}${swapType}${swapOptions.timestamp}`
            ];

        // forceRefresh can be set to force fresh processing of paths/prices
        if (!swapOptions.forceRefresh && !!cache) {
            // Using pre-processed data from cache
            return {
                pools: cache.pools,
                paths: cache.paths,
            };
        }

        // Some functions alter pools list directly but we want to keep original so make a copy to work from
        const poolsList = cloneDeep(pools);

        const [poolsFilteredDict, hopTokens, poolsAllDict] =
            filterPoolsOfInterest(
                poolsList,
                tokenIn,
                tokenOut,
                swapOptions.maxPools,
                chainId,
                swapOptions.timestamp
            );

        const [poolsMostLiquidDict, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            poolsFilteredDict
        );

        const pathsUsingStaBal = getPathsUsingStaBalPool(
            tokenIn,
            tokenOut,
            poolsAllDict,
            poolsFilteredDict,
            chainId
        );

        const combinedPathData = pathData.concat(...pathsUsingStaBal);
        const [paths] = calculatePathLimits(combinedPathData, swapType);

        this.cache[`${tokenIn}${tokenOut}${swapType}${swapOptions.timestamp}`] =
            {
                pools: poolsMostLiquidDict,
                paths: paths,
            };

        return { pools: poolsMostLiquidDict, paths };
    }
}
