import { WeightedPool } from './weightedPool/weightedPool';
import { StablePool } from './stablePool/stablePool';
import { MetaStablePool } from './metaStablePool/metaStablePool';
import { LinearPool } from './linearPool/linearPool';
import { ElementPool } from './elementPool/elementPool';
import { PhantomStablePool } from './phantomStablePool/phantomStablePool';
import { ComposableStablePool } from './composableStable/composableStablePool';
import { Gyro2Pool } from './gyro2Pool/gyro2Pool';
import { Gyro3Pool } from './gyro3Pool/gyro3Pool';
import { GyroEPool } from './gyroEPool/gyroEPool';
import { GyroEV2Pool } from './gyroEV2Pool/gyroEV2Pool';
import { FxPool } from './xaveFxPool/fxPool';
import { KassandraManagedPool } from './managedPools/kassandraManagedPool';
import {
    BigNumber as OldBigNumber,
    INFINITY,
    scale,
    ZERO,
} from '../utils/bignumber';
import {
    SubgraphPoolBase,
    PoolBase,
    SwapTypes,
    PoolPairBase,
    PoolTypes,
    PoolFilter,
} from '../types';

export function parseNewPool(
    pool: SubgraphPoolBase,
    currentBlockTimestamp = 0
):
    | WeightedPool
    | StablePool
    | ElementPool
    | LinearPool
    | MetaStablePool
    | PhantomStablePool
    | ComposableStablePool
    | Gyro2Pool
    | Gyro3Pool
    | GyroEPool
    | GyroEV2Pool
    | FxPool
    | KassandraManagedPool
    | undefined {
    // We're not interested in any pools which don't allow swapping
    if (!pool.swapEnabled) return undefined;

    let newPool:
        | WeightedPool
        | StablePool
        | ElementPool
        | LinearPool
        | MetaStablePool
        | PhantomStablePool
        | ComposableStablePool
        | Gyro2Pool
        | Gyro3Pool
        | GyroEPool
        | GyroEV2Pool
        | FxPool
        | KassandraManagedPool;

    try {
        const isLinear = pool.poolType.toString().includes('Linear');
        if (!isLinear && !(pool.poolType in PoolFilter)) {
            console.error(`Unsupported pool type: ${pool.poolType} ${pool.id}`);
            return undefined;
        }
        if (pool.poolType === 'Weighted' || pool.poolType === 'Investment') {
            newPool = WeightedPool.fromPool(pool, false);
        } else if (pool.poolType === 'LiquidityBootstrapping') {
            newPool = WeightedPool.fromPool(pool, true);
        } else if (pool.poolType === 'Stable') {
            newPool = StablePool.fromPool(pool);
        } else if (pool.poolType === 'MetaStable') {
            newPool = MetaStablePool.fromPool(pool);
        } else if (pool.poolType === 'Element') {
            newPool = ElementPool.fromPool(pool);
            newPool.setCurrentBlockTimestamp(currentBlockTimestamp);
        } else if (isLinear) newPool = LinearPool.fromPool(pool);
        else if (pool.poolType === 'StablePhantom')
            newPool = PhantomStablePool.fromPool(pool);
        else if (pool.poolType === 'ComposableStable')
            newPool = ComposableStablePool.fromPool(pool);
        else if (pool.poolType === 'Gyro2') newPool = Gyro2Pool.fromPool(pool);
        else if (pool.poolType === 'Gyro3') newPool = Gyro3Pool.fromPool(pool);
        else if (pool.poolType === 'GyroE') {
            if (pool.poolTypeVersion === 2) {
                newPool = GyroEV2Pool.fromPool(pool);
            } else {
                newPool = GyroEPool.fromPool(pool);
            }
        } else if (pool.poolType === 'FX') newPool = FxPool.fromPool(pool);
        else if (pool.poolType === 'Managed')
            newPool = KassandraManagedPool.fromPool(pool);
        else {
            console.error(
                `Unknown pool type or type field missing: ${pool.poolType} ${pool.id}`
            );
            return undefined;
        }
    } catch (err) {
        console.error(`parseNewPool: ${err.message}`);
        return undefined;
    }
    return newPool;
}

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getOutputAmountSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: OldBigNumber
): OldBigNumber {
    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (
            poolPairData.poolType !== PoolTypes.Linear &&
            poolPairData.balanceIn.isZero()
        ) {
            return ZERO;
        } else {
            return pool._exactTokenInForTokenOut(poolPairData, amount);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        } else if (
            scale(amount, poolPairData.decimalsOut).gte(
                poolPairData.balanceOut.toString()
            )
        ) {
            return INFINITY;
        } else {
            return pool._tokenInForExactTokenOut(poolPairData, amount);
        }
    }
    throw Error('Unsupported swap');
}
