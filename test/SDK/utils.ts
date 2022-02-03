import { MathSol } from '../../src/utils/basicOperations';

export function upscaleAmounts(
    amounts: bigint[],
    scalingFactor: bigint
): bigint[] {
    return amounts.map((amt) => MathSol.mulDownFixed(amt, scalingFactor));
}

export function downscaleDownAmounts(
    amounts: bigint[],
    scalingFactor: bigint
): bigint[] {
    return amounts.map((amt) => MathSol.divDownFixed(amt, scalingFactor));
}

export function downscaleUpAmounts(
    amounts: bigint[],
    scalingFactor: bigint
): bigint[] {
    return amounts.map((amt) => MathSol.divUpFixed(amt, scalingFactor));
}

export function getTokenScalingFactor(tokenDecimals: number): bigint {
    return BigInt(1e18) * BigInt(10) ** BigInt(18 - tokenDecimals);
}
