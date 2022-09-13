import { Zero } from '@ethersproject/constants';
import { SwapInfo } from './types';

export const EMPTY_SWAPINFO: SwapInfo = {
    tokenAddresses: [],
    swaps: [],
    swapAmount: Zero,
    swapAmountForSwaps: Zero,
    tokenIn: '',
    tokenInForSwaps: '',
    tokenOut: '',
    tokenOutFromSwaps: '',
    returnAmount: Zero,
    returnAmountConsideringFees: Zero,
    returnAmountFromSwaps: Zero,
    marketSp: Zero.toString(),
    routes: [],
};
