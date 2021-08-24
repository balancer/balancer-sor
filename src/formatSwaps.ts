import { BigNumber } from './utils/bignumber';
import { SwapTypes, SwapV2, Swap, SwapInfo } from './types';
import { bnum, scale, ZERO } from './utils/bignumber';

/**
 * @returns an array of deduplicated token addresses used in the provided swaps
 */
const getTokenAddresses = (swaps: Swap[][]): string[] => {
    const tokenAddressesSet: Set<string> = new Set(
        swaps.flatMap(sequence =>
            sequence.flatMap((swap): [string, string] => [
                swap.tokenIn,
                swap.tokenOut,
            ])
        )
    );

    return [...tokenAddressesSet];
};

const getTotalSwapAmount = (swaps: SwapV2[]) => {
    return swaps.reduce((acc, { amount }) => acc.plus(amount), ZERO);
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
const formatSequence = (
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

            amountScaled = scale(bnum(swap.swapAmount), scalingFactor)
                .decimalPlaces(0, 1)
                .toString();
        }

        const inIndex = tokenAddresses.indexOf(swap.tokenIn);
        const outIndex = tokenAddresses.indexOf(swap.tokenOut);
        const swapV2: SwapV2 = {
            poolId: swap.pool,
            assetInIndex: inIndex,
            assetOutIndex: outIndex,
            amount: amountScaled,
            userData: '0x',
        };

        return swapV2;
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
    marketSp: BigNumber
): SwapInfo {
    const swaps: Swap[][] = JSON.parse(JSON.stringify(swapsOriginal));

    let tokenInDecimals: number;
    let tokenOutDecimals: number;

    const swapInfo: SwapInfo = {
        tokenAddresses: [],
        swaps: [],
        swapAmount: ZERO,
        swapAmountForSwaps: ZERO,
        returnAmount: ZERO,
        returnAmountConsideringFees: ZERO,
        returnAmountFromSwaps: ZERO,
        tokenIn: '',
        tokenOut: '',
        marketSp: marketSp,
    };

    if (swaps.length === 0) {
        return swapInfo;
    }

    swaps.forEach(sequence => {
        sequence.forEach(swap => {
            if (swap.tokenIn === tokenIn)
                tokenInDecimals = swap.tokenInDecimals;

            if (swap.tokenOut === tokenOut)
                tokenOutDecimals = swap.tokenOutDecimals;
        });
    });

    const tokenArray = getTokenAddresses(swaps);

    const swapsV2: SwapV2[] = swaps.flatMap(sequence =>
        formatSequence(swapType, sequence, tokenArray)
    );
    const totalSwapAmount = getTotalSwapAmount(swapsV2).toString();

    if (swapType === SwapTypes.SwapExactIn) {
        // We need to account for any rounding losses by adding dust to first path
        const swapAmountScaled = scale(swapAmount, tokenInDecimals);
        const dust = swapAmountScaled.minus(totalSwapAmount).dp(0, 0);
        if (dust.gt(0))
            swapsV2[0].amount = bnum(swapsV2[0].amount)
                .plus(dust)
                .toString();

        swapInfo.swapAmount = swapAmountScaled;
        // Using this split to remove any decimals
        swapInfo.returnAmount = bnum(
            scale(returnAmount, tokenOutDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.returnAmountConsideringFees = bnum(
            scale(returnAmountConsideringFees, tokenOutDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.swaps = swapsV2;
    } else {
        // We need to account for any rounding losses by adding dust to first path
        const swapAmountScaled = scale(swapAmount, tokenOutDecimals);
        const dust = swapAmountScaled.minus(totalSwapAmount).dp(0, 0);
        if (dust.gt(0))
            swapsV2[0].amount = bnum(swapsV2[0].amount)
                .plus(dust)
                .toString();

        swapInfo.swapAmount = swapAmountScaled;
        // Using this split to remove any decimals
        swapInfo.returnAmount = bnum(
            scale(returnAmount, tokenInDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.returnAmountConsideringFees = bnum(
            scale(returnAmountConsideringFees, tokenInDecimals)
                .toString()
                .split('.')[0]
        );
        swapInfo.swaps = swapsV2;
    }

    swapInfo.tokenAddresses = tokenArray;
    swapInfo.tokenIn = tokenIn;
    swapInfo.tokenOut = tokenOut;
    return swapInfo;
}
