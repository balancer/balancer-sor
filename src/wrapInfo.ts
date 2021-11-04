import { BigNumber } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import { AddressZero, WeiPerEther as ONE } from '@ethersproject/constants';

import { Lido, getStEthRate } from './pools/lido';
import { WETHADDR } from './constants';
import { SwapTypes, SwapInfo } from './types';
import { isSameAddress } from './utils';

export interface WrappedInfo {
    swapAmountOriginal: BigNumber;
    swapAmountForSwaps: BigNumber;
    tokenIn: TokenInfo;
    tokenOut: TokenInfo;
}

export interface TokenInfo {
    addressOriginal: string;
    addressForSwaps: string;
    wrapType: WrapTypes;
    rate: BigNumber;
}

export enum WrapTypes {
    None,
    ETH,
    stETH,
}

export async function getWrappedInfo(
    provider: Provider,
    swapType: SwapTypes,
    tokenIn: string,
    tokenOut: string,
    chainId: number,
    swapAmount: BigNumber
): Promise<WrappedInfo> {
    // The Subgraph returns tokens in lower case format so we must match this
    tokenIn = tokenIn.toLowerCase();
    tokenOut = tokenOut.toLowerCase();

    let swapAmountForSwaps = swapAmount;

    let tokenInForSwaps = tokenIn;
    let tokenInWrapType = WrapTypes.None;
    let tokenOutForSwaps = tokenOut;
    let tokenOutWrapType = WrapTypes.None;
    let tokenInRate = ONE;
    let tokenOutRate = ONE;

    // Handle ETH wrapping
    if (tokenIn === AddressZero) {
        tokenInForSwaps = WETHADDR[chainId].toLowerCase();
        tokenInWrapType = WrapTypes.ETH;
    }
    if (tokenOut === AddressZero) {
        tokenOutForSwaps = WETHADDR[chainId].toLowerCase();
        tokenOutWrapType = WrapTypes.ETH;
    }

    // Handle stETH wrapping
    if (tokenIn === Lido.stETH[chainId]) {
        tokenInForSwaps = Lido.wstETH[chainId];
        tokenInWrapType = WrapTypes.stETH;
        const rate = await getStEthRate(provider, chainId);
        tokenInRate = rate;
        if (swapType === SwapTypes.SwapExactIn)
            swapAmountForSwaps = swapAmount.mul(rate).div(ONE);
    }
    if (tokenOut === Lido.stETH[chainId]) {
        tokenOutForSwaps = Lido.wstETH[chainId];
        tokenOutWrapType = WrapTypes.stETH;
        const rate = await getStEthRate(provider, chainId);
        tokenOutRate = rate;
        if (swapType === SwapTypes.SwapExactOut)
            swapAmountForSwaps = swapAmount.mul(rate).div(ONE);
    }

    return {
        swapAmountOriginal: swapAmount,
        swapAmountForSwaps: swapAmountForSwaps,
        tokenIn: {
            addressOriginal: tokenIn,
            addressForSwaps: tokenInForSwaps,
            wrapType: tokenInWrapType,
            rate: tokenInRate,
        },
        tokenOut: {
            addressOriginal: tokenOut,
            addressForSwaps: tokenOutForSwaps,
            wrapType: tokenOutWrapType,
            rate: tokenOutRate,
        },
    };
}

export function setWrappedInfo(
    swapInfo: SwapInfo,
    swapType: SwapTypes,
    wrappedInfo: WrappedInfo,
    chainId: number
): SwapInfo {
    if (swapInfo.swaps.length === 0) return swapInfo;

    swapInfo.tokenIn = wrappedInfo.tokenIn.addressOriginal;
    swapInfo.tokenOut = wrappedInfo.tokenOut.addressOriginal;

    if (
        wrappedInfo.tokenIn.wrapType === WrapTypes.ETH ||
        wrappedInfo.tokenOut.wrapType === WrapTypes.ETH
    ) {
        // replace weth with ZERO/ETH in assets for Vault to handle ETH directly
        swapInfo.tokenAddresses = swapInfo.tokenAddresses.map((addr) =>
            isSameAddress(addr, WETHADDR[chainId]) ? AddressZero : addr
        );
    }

    // Handle stETH swap amount scaling
    if (
        (wrappedInfo.tokenIn.wrapType === WrapTypes.stETH &&
            swapType === SwapTypes.SwapExactIn) ||
        (wrappedInfo.tokenOut.wrapType === WrapTypes.stETH &&
            swapType === SwapTypes.SwapExactOut)
    ) {
        swapInfo.swapAmountForSwaps = wrappedInfo.swapAmountForSwaps;
        swapInfo.swapAmount = wrappedInfo.swapAmountOriginal;
    } else {
        // Should be same when standard tokens and swapAmount should already be scaled
        swapInfo.swapAmountForSwaps = swapInfo.swapAmount;
    }

    // Return amount from swaps will only be different if token has an exchangeRate
    swapInfo.returnAmountFromSwaps = swapInfo.returnAmount;

    // SwapExactIn, stETH out, returnAmount is stETH amount out, returnAmountForSwaps is wstETH amount out
    if (
        swapType === SwapTypes.SwapExactIn &&
        wrappedInfo.tokenOut.wrapType === WrapTypes.stETH
    ) {
        swapInfo.returnAmount = swapInfo.returnAmount
            .mul(ONE)
            .div(wrappedInfo.tokenOut.rate);

        swapInfo.returnAmountConsideringFees =
            swapInfo.returnAmountConsideringFees
                .mul(ONE)
                .div(wrappedInfo.tokenOut.rate);
    }

    // SwapExactOut, stETH in, returnAmount us stETH amount in, returnAmountForSwaps is wstETH amount in
    if (
        swapType === SwapTypes.SwapExactOut &&
        wrappedInfo.tokenIn.wrapType === WrapTypes.stETH
    ) {
        swapInfo.returnAmount = swapInfo.returnAmount
            .mul(ONE)
            .div(wrappedInfo.tokenIn.rate);

        swapInfo.returnAmountConsideringFees =
            swapInfo.returnAmountConsideringFees
                .mul(ONE)
                .div(wrappedInfo.tokenIn.rate);
    }
    return swapInfo;
}
