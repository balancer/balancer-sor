import { WeightedPool } from './weightedPool/weightedPool';
import { StablePool } from './stablePool/stablePool';
import { ElementPool } from './elementPool/elementPool';
import { MetaStablePool } from './metaStablePool/metaStablePool';
import { BigNumber, INFINITY, ZERO } from '../utils/bignumber';
import {
    SubgraphPoolBase,
    PoolBase,
    SwapTypes,
    PoolPairBase,
    PairTypes,
} from '../types';

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

// TODO: Add cases for pairType = [BTP->token, token->BTP] and poolType = [weighted, stable]
export function getOutputAmountSwap(
    pool: PoolBase,
    poolPairData: PoolPairBase,
    swapType: SwapTypes,
    amount: BigNumber
): BigNumber {
    const pairType = poolPairData.pairType;

    // TODO: check if necessary to check if amount > limitAmount
    if (swapType === SwapTypes.SwapExactIn) {
        if (poolPairData.balanceIn.isZero()) {
            return ZERO;
        } else if (pairType === PairTypes.TokenToToken) {
            return pool._exactTokenInForTokenOut(poolPairData, amount, false);
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._exactTokenInForBPTOut(poolPairData, amount, false);
        } else if (pairType === PairTypes.BptToToken) {
            return pool._exactBPTInForTokenOut(poolPairData, amount, false);
        }
    } else {
        if (poolPairData.balanceOut.isZero()) {
            return ZERO;
        } else if (amount.gte(poolPairData.balanceOut)) {
            return INFINITY;
        } else if (pairType === PairTypes.TokenToToken) {
            return pool._tokenInForExactTokenOut(poolPairData, amount, false);
        } else if (pairType === PairTypes.TokenToBpt) {
            return pool._tokenInForExactBPTOut(poolPairData, amount, false);
        } else if (pairType === PairTypes.BptToToken) {
            return pool._BPTInForExactTokenOut(poolPairData, amount, false);
        }
    }
}
