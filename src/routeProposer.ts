import { filterPoolsOfInterest, filterHopPools } from './pools';
import { calculatePathLimits } from './router';
import {
    DisabledOptions,
    SwapTypes,
    NewPath,
    PoolDictionary,
    SubgraphPoolBase,
} from './types';

export class RouteProposer {
    maxPools: number;
    processedDataCache: Record<
        string,
        { pools: PoolDictionary; paths: NewPath[] }
    > = {};
    disabledOptions: DisabledOptions;

    constructor(
        maxPools: number,
        disabledOptions: DisabledOptions = {
            isOverRide: false,
            disabledTokens: [],
        }
    ) {
        this.maxPools = maxPools;
        this.disabledOptions = disabledOptions;
    }

    /**
     * Given a list of pools and a desired input/output, returns a set of possible paths to route through
     */
    getCandidatePaths(
        tokenIn: string,
        tokenOut: string,
        swapType: SwapTypes,
        pools: SubgraphPoolBase[],
        useProcessCache = true,
        currentBlockTimestamp = 0
    ): { pools: PoolDictionary; paths: NewPath[] } {
        if (pools.length === 0) return { pools: {}, paths: [] };

        // If token pair has been processed before that info can be reused to speed up execution
        const cache = this.processedDataCache[
            `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
        ];

        // useProcessCache can be false to force fresh processing of paths/prices
        if (useProcessCache && !!cache) {
            // Using pre-processed data from cache
            return {
                pools: cache.pools,
                paths: cache.paths,
            };
        }

        // Some functions alter pools list directly but we want to keep original so make a copy to work from
        const poolsList = JSON.parse(JSON.stringify(pools));

        const [pools2, hopTokens] = filterPoolsOfInterest(
            poolsList,
            tokenIn,
            tokenOut,
            this.maxPools,
            this.disabledOptions,
            currentBlockTimestamp
        );
        const [filteredPools, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            pools2
        );
        const [paths] = calculatePathLimits(pathData, swapType);

        // Update cache if used
        if (useProcessCache) {
            this.processedDataCache[
                `${tokenIn}${tokenOut}${swapType}${currentBlockTimestamp}`
            ] = {
                pools: filteredPools,
                paths: paths,
            };
        }

        return { pools: filteredPools, paths };
    }
}
