import { BigNumber as OldBigNumber, bnum } from '../../utils/bignumber';
import { parseFixed } from '@ethersproject/bignumber';

/**
 * Replicates the conversion operation to 64.64 fixed point numbers (ABDK library)
 * that occurs in the smart contract. This is done to replicate the loss of precision
 * from the smart contract.
 *
 * For example: in 1e18 decimals, when converting _epsilon_ `0.0015` from `uint256`
 * to a 64.64 fixed point number (`(_epsilon + 1).divu(1e18)`) there is a loss
 * of precision. In 64.64 fixed point, epsilon is stored as 0.001500000000000000953.
 * This is the value that is used in calculations in the smart contract.
 *
 * When converted from 64.64 fixed point back to `uint256` the value is
 * 0.001500000000000000 which is the same as the original value of 0.0015.
 * This is what the graph is showing.
 *
 * This function is used to replicate the same loss of precision that occurs
 * in the smart contract so that we work with an epsilon value of
 * 0.001500000000000000953 instead of 0.0015.
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
