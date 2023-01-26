import { getAddress } from '@ethersproject/address';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import {
    _computeScalingFactor,
    _downscaleDown,
    ONE as ONE_BigInt,
    _upscale,
} from './basicOperations';
import { SubgraphToken } from '../types';

export const isSameAddress = (address1: string, address2: string): boolean =>
    getAddress(address1) === getAddress(address2);

/// Parses a fixed-point decimal string into a BigNumber
/// If we do not have enough decimals to express the number, we truncate it
export function safeParseFixed(value: string, decimals = 0): BigNumber {
    const [integer, fraction] = value.split('.');
    if (!fraction) {
        return parseFixed(value, decimals);
    }
    const safeValue = integer + '.' + fraction.slice(0, decimals);
    return parseFixed(safeValue, decimals);
}

// normalizes its balance as if it had 18 decimals taking price rate into consideration.
export const normaliseBalance = (
    token: Pick<SubgraphToken, 'balance' | 'priceRate'>
): bigint => {
    return parseFixed(token.balance, 18)
        .mul(parseFixed(token.priceRate, 18))
        .div(ONE)
        .toBigInt();
};

// normalizes amount as if it had 18 decimals taking price rate into consideration.
export const normaliseAmount = (
    amount: bigint,
    token: Pick<SubgraphToken, 'priceRate' | 'decimals'>
): bigint => {
    const scalingFactor = _computeScalingFactor(BigInt(token.decimals));
    return BigNumber.from(_upscale(amount, scalingFactor).toString())
        .mul(parseFixed(token.priceRate, 18))
        .div(ONE)
        .toBigInt();
};

// denormalises amount from 18 decimals to token decimals taking price rate into consideration.
export const denormaliseAmount = (
    amount: bigint,
    token: Pick<SubgraphToken, 'priceRate' | 'decimals'>
): bigint => {
    const amountAfterRate =
        (amount * ONE_BigInt) /
        BigInt(parseFixed(token.priceRate, 18).toString());
    const scalingFactor = _computeScalingFactor(BigInt(token.decimals));
    return _downscaleDown(amountAfterRate, scalingFactor);
};
