import { BigNumber } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import { AddressZero, WeiPerEther as ONE } from '@ethersproject/constants';
import { Lido, getStEthRate } from './pools/lido';
import { SwapTypes, SwapInfo, SorConfig } from './types';
import {
    TokensToUnbuttonWrapperMap,
    getWrapperRate as getUnbuttonWrapperRate,
} from './wrappers/unbutton';
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
    ETH, // ETH -> WETH
    stETH, // stETH -> wSTETH
    Unbutton, // [rebasing Token] -> ubToken
}

export async function getWrappedInfo(
    provider: Provider,
    swapType: SwapTypes,
    tokenIn: string,
    tokenOut: string,
    config: SorConfig,
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

    //--------------------------------------------------------------------------
    // ETH/WETH

    // Handle ETH wrapping
    if (tokenIn === AddressZero) {
        tokenInForSwaps = config.weth.toLowerCase();
        tokenInWrapType = WrapTypes.ETH;
    }

    // Handle WETH unwrapping
    if (tokenOut === AddressZero) {
        tokenOutForSwaps = config.weth.toLowerCase();
        tokenOutWrapType = WrapTypes.ETH;
    }

    //--------------------------------------------------------------------------
    // stETH/wstETH

    // Handle stETH wrapping
    if (tokenIn === Lido.stETH[config.chainId]) {
        tokenInForSwaps = Lido.wstETH[config.chainId];
        tokenInWrapType = WrapTypes.stETH;
        const rate = await getStEthRate(provider, config.chainId);
        tokenInRate = rate;
        if (swapType === SwapTypes.SwapExactIn)
            swapAmountForSwaps = swapAmount.mul(rate).div(ONE);
    }

    // Handle wstETH unwrapping
    if (tokenOut === Lido.stETH[config.chainId]) {
        tokenOutForSwaps = Lido.wstETH[config.chainId];
        tokenOutWrapType = WrapTypes.stETH;
        const rate = await getStEthRate(provider, config.chainId);
        tokenOutRate = rate;
        if (swapType === SwapTypes.SwapExactOut)
            swapAmountForSwaps = swapAmount.mul(rate).div(ONE);
    }

    //--------------------------------------------------------------------------
    // ubTokens

    // Gets a list of all the tokens and their unbutton wrappers
    const tokensToUBWrapperMap =
        TokensToUnbuttonWrapperMap[config.chainId] || {};

    // Handle token unbutton wrapping
    if (tokensToUBWrapperMap[tokenIn]) {
        tokenInForSwaps = tokensToUBWrapperMap[tokenIn];
        tokenInWrapType = WrapTypes.Unbutton;
        tokenInRate = await getUnbuttonWrapperRate(provider, tokenInForSwaps);
        if (swapType === SwapTypes.SwapExactIn)
            swapAmountForSwaps = swapAmount.mul(tokenInRate).div(ONE);
    }

    // Handle unbutton token unwrapping
    if (tokensToUBWrapperMap[tokenOut]) {
        tokenOutForSwaps = tokensToUBWrapperMap[tokenOut];
        tokenOutWrapType = WrapTypes.Unbutton;
        tokenOutRate = await getUnbuttonWrapperRate(provider, tokenOutForSwaps);
        if (swapType === SwapTypes.SwapExactOut)
            swapAmountForSwaps = swapAmount.mul(tokenOutRate).div(ONE);
    }

    //--------------------------------------------------------------------------

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
    config: SorConfig
): SwapInfo {
    if (swapInfo.swaps.length === 0) return swapInfo;

    swapInfo.tokenIn = wrappedInfo.tokenIn.addressOriginal;
    swapInfo.tokenOut = wrappedInfo.tokenOut.addressOriginal;

    swapInfo.swapAmountForSwaps = swapInfo.swapAmount;
    swapInfo.returnAmountFromSwaps = swapInfo.returnAmount;

    // No wrapping required
    if (
        wrappedInfo.tokenIn.wrapType === WrapTypes.None &&
        wrappedInfo.tokenOut.wrapType === WrapTypes.None
    ) {
        return swapInfo;
    }

    //--------------------------------------------------------------------------
    // Wrappers which are 1:1 (ETH/WETH), ie UnscaledWrappers
    // Replace weth with ZERO/ETH in assets for Vault to handle ETH directly
    if (
        wrappedInfo.tokenIn.wrapType === WrapTypes.ETH ||
        wrappedInfo.tokenOut.wrapType === WrapTypes.ETH
    ) {
        swapInfo.tokenAddresses = swapInfo.tokenAddresses.map((addr) =>
            isSameAddress(addr, config.weth) ? AddressZero : addr
        );
    }

    //--------------------------------------------------------------------------
    // Wrappers which are NOT 1:1 (stETH/wstETH, AMPL/WAMPL, all ubTokens etc)
    // ie ScaledWrappers

    const isScaledWrapper = (wrapType) =>
        wrapType === WrapTypes.stETH || wrapType === WrapTypes.Unbutton;

    // Scaling required for wrappers which don't scale 1:1 with the underlying token
    // swap amount and return amounts are scaled if swap type is SwapExact

    // Handle swap amount scaling
    if (
        (isScaledWrapper(wrappedInfo.tokenIn.wrapType) &&
            swapType === SwapTypes.SwapExactIn) ||
        (isScaledWrapper(wrappedInfo.tokenOut.wrapType) &&
            swapType === SwapTypes.SwapExactOut)
    ) {
        swapInfo.swapAmount = wrappedInfo.swapAmountOriginal;
        swapInfo.swapAmountForSwaps = wrappedInfo.swapAmountForSwaps;
    }

    // Handle return amount scaling
    // SwapExactIn, unwrapped out, returnAmount is unwrapped amount out, returnAmountForSwaps is wrapped amount out
    if (
        swapType === SwapTypes.SwapExactIn &&
        isScaledWrapper(wrappedInfo.tokenOut.wrapType)
    ) {
        swapInfo.returnAmount = swapInfo.returnAmount
            .mul(ONE)
            .div(wrappedInfo.tokenOut.rate);

        swapInfo.returnAmountConsideringFees =
            swapInfo.returnAmountConsideringFees
                .mul(ONE)
                .div(wrappedInfo.tokenOut.rate);
    }

    // SwapExactOut, unwrapped in, returnAmount us unwrapped amount in, returnAmountForSwaps is wrapped amount in
    if (
        swapType === SwapTypes.SwapExactOut &&
        isScaledWrapper(wrappedInfo.tokenIn.wrapType)
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
