import { SubgraphPoolBase, PoolFilter } from './types';
import { WeightedPool } from './pools/weightedPool/weightedPool';
import { StablePool } from './pools/stablePool/stablePool';
import { ElementPool } from './pools/elementPool/elementPool';
import { MetaStablePool } from './pools/metaStablePool/metaStablePool';

export const filterPoolsByType = (
    pools: SubgraphPoolBase[],
    poolTypeFilter: PoolFilter
): SubgraphPoolBase[] => {
    if (poolTypeFilter === PoolFilter.All) return pools;
    return pools.filter(p => p.poolType === poolTypeFilter);
};

export function parseNewPool(
    pool: SubgraphPoolBase,
    currentBlockTimestamp = 0
): WeightedPool | StablePool | ElementPool | undefined {
    let newPool: WeightedPool | StablePool | ElementPool;
    if (pool.poolType === 'Weighted') newPool = WeightedPool.fromPool(pool);
    else if (pool.poolType === 'Stable') newPool = StablePool.fromPool(pool);
    else if (pool.poolType === 'Element') {
        newPool = ElementPool.fromPool(pool);
        newPool.setCurrentBlockTimestamp(currentBlockTimestamp);
    } else if (pool.poolType === 'MetaStable') {
        newPool = MetaStablePool.fromPool(pool);
    } else if (pool.poolType === 'LiquidityBootstrapping') {
        // If an LBP doesn't have its swaps paused we treat it like a regular Weighted pool.
        // If it does we just ignore it.
        if (pool.swapEnabled === true) newPool = WeightedPool.fromPool(pool);
        else return undefined;
    } else {
        console.error(
            `Unknown pool type or type field missing: ${pool.poolType} ${pool.id}`
        );
        return undefined;
    }
    return newPool;
}
