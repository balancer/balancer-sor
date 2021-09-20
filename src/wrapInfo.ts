import { BigNumber as EBigNumber } from '@ethersproject/bignumber';

import { BaseProvider } from '@ethersproject/providers';
import { AddressZero, WeiPerEther as ONE } from '@ethersproject/constants';

import { Lido, getStEthRate } from './pools/lido';
import { BigNumber, bnum, scale } from './utils/bignumber';
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
    rate: EBigNumber;
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
            swapAmountForSwaps = scale(
                bnum(
                    EBigNumber.from(swapAmount.toString()).mul(rate).toString()
                ),
                -18
            );
    }
    if (tokenOut === Lido.stETH[chainId]) {
        tokenOutForSwaps = Lido.wstETH[chainId];
        tokenOutWrapType = WrapTypes.stETH;
        const rate = await getStEthRate(provider, chainId);
        tokenOutRate = rate;
        if (swapType === SwapTypes.SwapExactOut)
            swapAmountForSwaps = scale(
                bnum(
                    EBigNumber.from(swapAmount.toString()).mul(rate).toString()
                ),
                -18
            );
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
            .multipliedBy(ONE.toString())
            .div(wrappedInfo.tokenOut.rate.toString())
            .dp(0);
        swapInfo.returnAmountConsideringFees =
            swapInfo.returnAmountConsideringFees
                .multipliedBy(ONE.toString())
                .div(wrappedInfo.tokenOut.rate.toString())
                .dp(0);
    }

    // SwapExactOut, stETH in, returnAmount us stETH amount in, returnAmountForSwaps is wstETH amount in
    if (
        swapType === SwapTypes.SwapExactOut &&
        wrappedInfo.tokenIn.wrapType === WrapTypes.stETH
    ) {
        swapInfo.returnAmount = swapInfo.returnAmount
            .multipliedBy(ONE.toString())
            .div(wrappedInfo.tokenIn.rate.toString())
            .dp(0);
        swapInfo.returnAmountConsideringFees =
            swapInfo.returnAmountConsideringFees
                .multipliedBy(ONE.toString())
                .div(wrappedInfo.tokenIn.rate.toString())
                .dp(0);
    }
    return swapInfo;
}
