import { getAddress } from '@ethersproject/address';

export const isSameAddress = (address1: string, address2: string): boolean =>
    getAddress(address1) === getAddress(address2);
