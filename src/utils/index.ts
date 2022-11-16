import { getAddress } from '@ethersproject/address';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';

export const isSameAddress = (address1: string, address2: string): boolean =>
    getAddress(address1) === getAddress(address2);

/// Parses a fixed-point decimal string into a BigNumber
/// If we do not have enough decimals to express the number, we truncate it
export function safeParseFixed(value: string, decimals: number = 0): BigNumber {
    const [integer, fraction] = value.split('.');
    if (!fraction) {
        return parseFixed(value, decimals);
    }
    const safeValue = integer + '.' + fraction.slice(0, decimals);
    return parseFixed(safeValue, decimals);
}
