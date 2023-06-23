import { BigNumber as OldBigNumber, bnum } from '../../utils/bignumber';
import { parseFixed } from '@ethersproject/bignumber';

/**
 * Replicates the conversion operation to 64.64 fixed point numbers (ABDK library)
 * that occurs in the smart contract. This is done to replicate the loss of precision
 * that the fixed point number conversion exhibits.
 *
 * For example:
 *   - `uint256(0.0005 * 1e18).divu(1e18)` is 9223372036854775 which is 0.000499999999999999956
 *   - `uint256(0.0005 * 1e18 + 1).divu(1e18)` is 9223372036854794 which is 0.00050000000000000099
 *
 * Most but one of the parameters (`delta`) use the formula `uint256(PARAM * 1e18 + 1).divu(1e18)`
 * when converting to fixed point precision. This is the value that is used in calculations
 * in the smart contract.
 *
 * @param param any of the pool's curve parameters like alpha, beta, lambda, delta, epsilon
 * @returns OldBigNumber with the same loss of precision as the smart contract
 */
export const parseFixedCurveParam = (param: string): OldBigNumber => {
    const param64 =
        ((((BigInt(parseFixed(param, 18).toString()) + 1n) << 64n) /
            10n ** 18n) *
            10n ** 36n) >>
        64n;

    const val = bnum(param64.toString())
        .div(bnum(10).pow(18))
        .decimalPlaces(3, OldBigNumber.ROUND_UP);

    return val;
};
