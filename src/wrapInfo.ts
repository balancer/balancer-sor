import { BigNumber } from './utils/bignumber';
import { SwapTypes, SwapInfo } from './types';
import { bnum, scale } from './utils/bignumber';
import { ZERO_ADDRESS, Lido, getStEthRate } from './index';
import { WETHADDR } from './constants';
import { BaseProvider } from '@ethersproject/providers';

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
    provider: BaseProvider,
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
    let tokenInRate = bnum(1);
    let tokenOutRate = bnum(1);

    // Handle ETH wrapping
    if (tokenIn === ZERO_ADDRESS) {
        tokenInForSwaps = WETHADDR[chainId].toLowerCase();
        tokenInWrapType = WrapTypes.ETH;
    }
    if (tokenOut === ZERO_ADDRESS) {
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
            swapAmountForSwaps = swapAmount.times(rate).dp(18);
    }
    if (tokenOut === Lido.stETH[chainId]) {
        tokenOutForSwaps = Lido.wstETH[chainId];
        tokenOutWrapType = WrapTypes.stETH;
        const rate = await getStEthRate(provider, chainId);
        tokenOutRate = rate;
        if (swapType === SwapTypes.SwapExactOut)
            swapAmountForSwaps = swapAmount.times(rate).dp(18);
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

    // replace weth with ZERO/ETH in assets for Vault to handle ETH directly
    if (
        wrappedInfo.tokenIn.wrapType === WrapTypes.ETH ||
        wrappedInfo.tokenOut.wrapType === WrapTypes.ETH
    ) {
        let wethIndex = -1;
        swapInfo.tokenAddresses.forEach((addr, i) => {
            if (addr.toLowerCase() === WETHADDR[chainId].toLowerCase())
                wethIndex = i;
        });
        if (wethIndex !== -1) swapInfo.tokenAddresses[wethIndex] = ZERO_ADDRESS;
    }

    // Handle stETH swap amount scaling
    if (
        (wrappedInfo.tokenIn.wrapType === WrapTypes.stETH &&
            swapType === SwapTypes.SwapExactIn) ||
        (wrappedInfo.tokenOut.wrapType === WrapTypes.stETH &&
            swapType === SwapTypes.SwapExactOut)
    ) {
        swapInfo.swapAmountForSwaps = scale(
            wrappedInfo.swapAmountForSwaps,
            18
        ).dp(0); // Always 18 because wstETH
        swapInfo.swapAmount = scale(wrappedInfo.swapAmountOriginal, 18).dp(0);
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
            .div(wrappedInfo.tokenOut.rate)
            .dp(0);
        swapInfo.returnAmountConsideringFees = swapInfo.returnAmountConsideringFees
            .div(wrappedInfo.tokenOut.rate)
            .dp(0);
    }

    // SwapExactOut, stETH in, returnAmount us stETH amount in, returnAmountForSwaps is wstETH amount in
    if (
        swapType === SwapTypes.SwapExactOut &&
        wrappedInfo.tokenIn.wrapType === WrapTypes.stETH
    ) {
        swapInfo.returnAmount = swapInfo.returnAmount
            .div(wrappedInfo.tokenIn.rate)
            .dp(0);
        swapInfo.returnAmountConsideringFees = swapInfo.returnAmountConsideringFees
            .div(wrappedInfo.tokenIn.rate)
            .dp(0);
    }
    return swapInfo;
}
