import { BigNumber } from './utils/bignumber';
import { SwapTypes, SwapV2, Swap, SwapInfo } from './types';
import { bnum, scale, ZERO } from './utils/bignumber';

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
    const tokenAddressesSet: Set<string> = new Set();

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

            tokenAddressesSet.add(swap.tokenIn);
            tokenAddressesSet.add(swap.tokenOut);
        });
    });

    const tokenArray = [...tokenAddressesSet];

    if (swapType === SwapTypes.SwapExactIn) {
        const swapsV2: SwapV2[] = [];

        let totalSwapAmount = ZERO;
        /*
         * Multihop swaps can be executed by passing an`amountIn` value of zero for a swap.This will cause the amount out
         * of the previous swap to be used as the amount in of the current one.In such a scenario, `tokenIn` must equal the
         * previous swap's `tokenOut`.
         * */
        swaps.forEach(sequence => {
            sequence.forEach((swap, i) => {
                let amountScaled = '0'; // amount will be 0 for second swap in multihop swap
                if (i == 0) {
                    // First swap so should have a value for both single and multihop
                    amountScaled = scale(
                        bnum(swap.swapAmount),
                        swap.tokenInDecimals
                    )
                        .decimalPlaces(0, 1)
                        .toString();
                    totalSwapAmount = totalSwapAmount.plus(amountScaled);
                }

                const inIndex = tokenArray.indexOf(swap.tokenIn);
                const outIndex = tokenArray.indexOf(swap.tokenOut);
                const swapV2: SwapV2 = {
                    poolId: swap.pool,
                    assetInIndex: inIndex,
                    assetOutIndex: outIndex,
                    amount: amountScaled,
                    userData: '0x',
                };

                swapsV2.push(swapV2);
            });
        });

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
        let swapsV2: SwapV2[] = [];
        let totalSwapAmount = ZERO;
        /*
        SwapExactOut will have order reversed in V2.
        v1 = [[x, y]], [[a, b]]
        v2 = [y, x, b, a]
        */
        swaps.forEach(sequence => {
            if (sequence.length > 2)
                throw new Error(
                    'Multihop with more than 2 swaps not supported'
                );

            const sequenceSwaps = [];
            sequence.forEach((swap, i) => {
                const inIndex = tokenArray.indexOf(swap.tokenIn);
                const outIndex = tokenArray.indexOf(swap.tokenOut);
                const swapV2: SwapV2 = {
                    poolId: swap.pool,
                    assetInIndex: inIndex,
                    assetOutIndex: outIndex,
                    amount: '0', // For a multihop the first swap in sequence should be last in order and have amt = 0
                    userData: '0x',
                };

                if (i == 0 && sequence.length > 1) {
                    sequenceSwaps[1] = swapV2; // Make the swap the last in V2 order for the sequence
                } else {
                    const amountScaled = scale(
                        bnum(swap.swapAmount),
                        swap.tokenOutDecimals
                    )
                        .decimalPlaces(0, 1)
                        .toString();
                    totalSwapAmount = totalSwapAmount.plus(amountScaled);
                    swapV2.amount = amountScaled; // Make the swap the first in V2 order for the sequence with the value
                    sequenceSwaps[0] = swapV2;
                }
            });

            swapsV2 = swapsV2.concat(sequenceSwaps);
        });

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
