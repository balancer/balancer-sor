import { BigNumber } from '@ethersproject/bignumber';
import cloneDeep from 'lodash.clonedeep';
import { bnum, scale } from './utils/bignumber';
import { EMPTY_SWAPINFO } from './constants';
import {
    SwapTypes,
    SwapV2,
    Swap,
    SwapInfo,
    SwapInfoRoute,
    SwapInfoRouteHop,
} from './types';
import { Zero } from '@ethersproject/constants';

/**
 * @returns an array of deduplicated token addresses used in the provided swaps
 */
const getTokenAddresses = (swaps: Swap[][]): string[] => {
    const tokenAddressesSet: Set<string> = new Set(
        swaps.flatMap((sequence) =>
            sequence.flatMap((swap): [string, string] => [
                swap.tokenIn,
                swap.tokenOut,
            ])
        )
    );

    return [...tokenAddressesSet];
};

/**
 * @returns an array of deduplicated token addresses used in the provided swaps
 */
export const getTokenAddressesForSwap = (swaps: Swap[]): string[] => {
    const tokenAddressesSet: Set<string> = new Set(
        swaps.flatMap((swap): [string, string] => [swap.tokenIn, swap.tokenOut])
    );

    return [...tokenAddressesSet];
};

/**
 * @dev Assumes that intermediate swaps have been properly formatted using the zero sentinel value
 * @returns the total amount of tokens used in the described batchSwap
 */
const getTotalSwapAmount = (swaps: SwapV2[]) => {
    return swaps.reduce((acc, { amount }) => acc.add(amount), Zero);
};

/**
 * Formats a sequence of swaps to the format expected by the Balance Vault.
 * @dev Intermediate swaps' amounts are replaced with the sentinel value of zero
 *      and exact output sequences are reversed.
 * @param swapKind - a SwapTypes enum for whether the swap has an exact input or exact output
 * @param sequence - a sequence of swaps which form a path from the input token to the output token
 * @param tokenAddresses - an array of all the token address which are involved in the batchSwap
 * @returns
 */
export const formatSequence = (
    swapKind: SwapTypes,
    sequence: Swap[],
    tokenAddresses: string[]
): SwapV2[] => {
    if (swapKind === SwapTypes.SwapExactOut) {
        // GIVEN_OUT sequences must be passed to the vault in reverse order.
        // After reversing the sequence we can treat them almost equivalently to GIVEN_IN sequences
        sequence = sequence.reverse();
    }

    return sequence.map((swap, i) => {
        // Multihop swaps can be executed by passing an `amountIn` value of zero for a swap. This will cause the amount out
        // of the previous swap to be used as the amount in of the current one. In such a scenario, `tokenIn` must equal the
        // previous swap's `tokenOut`.
        let amountScaled = '0';

        // First swap needs to be given a value so we inject this from SOR solution
        if (i === 0) {
            // If it's a GIVEN_IN swap then swapAmount is in terms of tokenIn
            // and vice versa for GIVEN_OUT
            const scalingFactor =
                swapKind === SwapTypes.SwapExactIn
                    ? swap.tokenInDecimals
                    : swap.tokenOutDecimals;

            amountScaled = scale(bnum(swap.swapAmount as string), scalingFactor)
                .decimalPlaces(0, 1)
                .toString();
        }

        const assetInIndex = tokenAddresses.indexOf(swap.tokenIn);
        const assetOutIndex = tokenAddresses.indexOf(swap.tokenOut);
        return {
            poolId: swap.pool,
            assetInIndex,
            assetOutIndex,
            amount: amountScaled,
            userData: '0x',
        };
    });
};

export function formatSwaps(
    swapsOriginal: Swap[][],
    swapType: SwapTypes,
    swapAmount: BigNumber,
    tokenIn: string,
    tokenOut: string,
    returnAmount: BigNumber,
    returnAmountConsideringFees: BigNumber,
    marketSp: string
): SwapInfo {
    if (swapsOriginal.length === 0) {
        return cloneDeep(EMPTY_SWAPINFO);
    }

    const swapsClone = cloneDeep(swapsOriginal);
    const tokenAddresses = getTokenAddresses(swapsClone);
    const swaps: SwapV2[] = swapsClone.flatMap((sequence) =>
        formatSequence(swapType, sequence, tokenAddresses)
    );

    // We need to account for any rounding losses by adding dust to first path
    const dust = swapAmount.sub(getTotalSwapAmount(swaps));
    if (dust.gt(0)) {
        swaps[0].amount = BigNumber.from(swaps[0].amount).add(dust).toString();
    }

    const routes = formatRoutes(swapsOriginal, swapAmount);

    const swapInfo: SwapInfo = {
        swapAmount,
        swapAmountForSwaps: swapAmount,
        returnAmount,
        returnAmountFromSwaps: returnAmount,
        returnAmountConsideringFees,
        swaps,
        tokenAddresses,
        tokenIn,
        tokenOut,
        marketSp,
        routes,
    };

    return swapInfo;
}

/**
 * Formats a sequence of swaps to a format that is useful for displaying the routes in user interfaces.
 * @dev The swaps are converted to an array of routes, where each route has an array of hops
 * @param routes - The original Swaps
 * @param swapAmount - The total amount being swapped
 * @returns SwapInfoRoute[] - The swaps formatted as routes with hops
 */
function formatRoutes(
    routes: Swap[][],
    swapAmount: BigNumber
): SwapInfoRoute[] {
    return routes.map((swaps) => {
        const first = swaps[0];
        const last = swaps[swaps.length - 1];
        const tokenInAmountScaled = scale(
            bnum(first.swapAmount || '0'),
            first.tokenInDecimals
        );

        return {
            tokenIn: first.tokenIn,
            tokenOut: last.tokenOut,
            tokenInAmount: first.swapAmount || '0',
            tokenOutAmount: last.swapAmountOut || '0',
            share: tokenInAmountScaled
                .div(bnum(swapAmount.toString()))
                .toNumber(),
            hops: swaps.map((swap): SwapInfoRouteHop => {
                return {
                    tokenIn: swap.tokenIn,
                    tokenOut: swap.tokenOut,
                    tokenInAmount: swap.swapAmount || '0',
                    tokenOutAmount: swap.swapAmountOut || '0',
                    poolId: swap.pool,
                };
            }),
        };
    });
}
