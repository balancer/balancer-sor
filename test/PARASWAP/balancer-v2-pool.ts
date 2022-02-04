// import { MathSol, BZERO, BONE } from './balancer-v2-math';
import { MathSol } from '../../src/utils/basicOperations';

export class BasePool {
    _subtractSwapFeeAmount(amount: bigint, _swapFeePercentage: bigint): bigint {
        // This returns amount - fee amount, so we round up (favoring a higher fee amount).
        const feeAmount = MathSol.mulUpFixed(amount, _swapFeePercentage);
        return amount - feeAmount;
    }

    _upscaleArray(amounts: bigint[], scalingFactors: bigint[]): bigint[] {
        return amounts.map((a, i) => MathSol.mul(a, scalingFactors[i]));
    }

    _upscale(amount: bigint, scalingFactor: bigint): bigint {
        return MathSol.mul(amount, scalingFactor);
    }

    _downscaleDown(amount: bigint, scalingFactor: bigint): bigint {
        return MathSol.divDown(amount, scalingFactor);
    }
}
