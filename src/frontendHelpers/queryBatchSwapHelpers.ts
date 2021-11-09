import { BigNumberish } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { AddressZero } from '@ethersproject/constants';
import { SwapTypes, SwapInfo, SwapV2 } from '../types';
import { SOR } from '../index';

type FundManagement = {
    sender: string;
    recipient: string;
    fromInternalBalance: boolean;
    toInternalBalance: boolean;
};

/*
 * queryBatchSwap simulates a call to `batchSwap`, returning an array of Vault asset deltas. Calls to `swap` cannot be
 * simulated directly, but an equivalent `batchSwap` call can and will yield the exact same result.
 *
 * Each element in the array corresponds to the asset at the same index, and indicates the number of tokens (or ETH)
 * the Vault would take from the sender (if positive) or send to the recipient (if negative). The arguments it
 * receives are the same that an equivalent `batchSwap` call would receive.
 *
 * Unlike `batchSwap`, this function performs no checks on the sender or recipient field in the `funds` struct.
 * This makes it suitable to be called by off-chain applications via eth_call without needing to hold tokens,
 * approve them for the Vault, or even know a user's address.
 */
export async function queryBatchSwap(
    vaultContract: Contract,
    swapType: SwapTypes,
    swaps: SwapV2[],
    assets: string[]
): Promise<string[]> {
    const funds: FundManagement = {
        sender: AddressZero,
        recipient: AddressZero,
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    return await vaultContract.queryBatchSwap(swapType, swaps, assets, funds);
}

/*
Use SOR to get swapInfo for tokenIn>tokenOut.
SwapInfos.swaps has path information.
*/
async function getSorSwapInfo(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    amount: string,
    sor: SOR
): Promise<SwapInfo> {
    const swapInfo = await sor.getSwaps(tokenIn, tokenOut, swapType, amount);
    return swapInfo;
}

/*
Format multiple individual swaps/assets into a single swap/asset.
*/
function batchSwaps(
    assetArray: string[][],
    swaps: SwapV2[][]
): { swaps: SwapV2[]; assets: string[] } {
    // assest addresses without duplicates
    const newAssetArray = [...new Set(assetArray.flat())];

    // Update indices of each swap to use new asset array
    swaps.forEach((swap, i) => {
        swap.forEach((poolSwap) => {
            poolSwap.assetInIndex = newAssetArray.indexOf(
                assetArray[i][poolSwap.assetInIndex]
            );
            poolSwap.assetOutIndex = newAssetArray.indexOf(
                assetArray[i][poolSwap.assetOutIndex]
            );
        });
    });

    // Join Swaps into a single batchSwap
    const batchedSwaps = swaps.flat();
    return { swaps: batchedSwaps, assets: newAssetArray };
}

/*
Uses SOR to create and query a batchSwap for multiple tokens in > single tokenOut.
For example can be used to join staBal3 with DAI/USDC/USDT.
*/
export async function queryBatchSwapTokensIn(
    sor: SOR,
    vaultContract: Contract,
    tokensIn: string[],
    amountsIn: BigNumberish[],
    tokenOut: string
): Promise<{ amountTokenOut: string; swaps: SwapV2[]; assets: string[] }> {
    const swaps: SwapV2[][] = [];
    const assetArray: string[][] = [];
    // get path information for each tokenIn
    for (let i = 0; i < tokensIn.length; i++) {
        const swap = await getSorSwapInfo(
            tokensIn[i],
            tokenOut,
            SwapTypes.SwapExactIn,
            amountsIn[i].toString(),
            sor
        );
        swaps.push(swap.swaps);
        assetArray.push(swap.tokenAddresses);
    }

    // Join swaps and assets together correctly
    const batchedSwaps = batchSwaps(assetArray, swaps);

    // Onchain query
    const deltas = await queryBatchSwap(
        vaultContract,
        SwapTypes.SwapExactIn,
        batchedSwaps.swaps,
        batchedSwaps.assets
    );

    const amountTokenOut = deltas[batchedSwaps.assets.indexOf(tokenOut)];

    return {
        amountTokenOut,
        swaps: batchedSwaps.swaps,
        assets: batchedSwaps.assets,
    };
}

/*
queryBatchSwap for multiple tokens in > single tokenOut.
Uses existing swaps/assets information and updates swap amounts.
*/
export async function queryBatchSwapTokensInUpdateAmounts(
    vaultContract: Contract,
    swaps: SwapV2[],
    assets: string[],
    tokens: string[],
    newAmounts: BigNumberish[],
    tokenOut: string
): Promise<{ amountTokenOut: string; swaps: SwapV2[]; assets: string[] }> {
    for (let i = 0; i < tokens.length; i++) {
        const tokenIndex = assets.indexOf(tokens[i]);
        swaps.forEach((poolSwap) => {
            if (
                poolSwap.assetInIndex === tokenIndex ||
                poolSwap.assetOutIndex === tokenIndex
            )
                poolSwap.amount = newAmounts[i].toString();
        });
    }

    // Onchain query
    const deltas = await queryBatchSwap(
        vaultContract,
        SwapTypes.SwapExactIn,
        swaps,
        assets
    );

    const amountTokenOut = deltas[assets.indexOf(tokenOut)];

    return {
        amountTokenOut,
        swaps,
        assets,
    };
}

/*
Uses SOR to create and query a batchSwap for a single token in > multiple tokens out.
For example can be used to exit staBal3 to DAI/USDC/USDT.
*/
export async function queryBatchSwapTokensOut(
    sor: SOR,
    vaultContract: Contract,
    tokenIn: string,
    amountsIn: BigNumberish[],
    tokensOut: string[]
): Promise<{ amountTokensOut: string[]; swaps: SwapV2[]; assets: string[] }> {
    const swaps: SwapV2[][] = [];
    const assetArray: string[][] = [];
    // get path information for each tokenOut
    for (let i = 0; i < tokensOut.length; i++) {
        const swap = await getSorSwapInfo(
            tokenIn,
            tokensOut[i],
            SwapTypes.SwapExactIn,
            amountsIn[i].toString(),
            sor
        );
        swaps.push(swap.swaps);
        assetArray.push(swap.tokenAddresses);
    }

    // Join swaps and assets together correctly
    const batchedSwaps = batchSwaps(assetArray, swaps);

    // Onchain query
    const deltas = await queryBatchSwap(
        vaultContract,
        SwapTypes.SwapExactIn,
        batchedSwaps.swaps,
        batchedSwaps.assets
    );

    const amountTokensOut: string[] = [];
    tokensOut.forEach((t) => {
        const amount = deltas[batchedSwaps.assets.indexOf(t)];
        if (amount) amountTokensOut.push(amount);
        else amountTokensOut.push('0');
    });

    return {
        amountTokensOut,
        swaps: batchedSwaps.swaps,
        assets: batchedSwaps.assets,
    };
}

/*
queryBatchSwap for a single token in > multiple tokens out.
Uses existing swaps/assets information and updates swap amounts.
*/
export async function queryBatchSwapTokensOutUpdateAmounts(
    vaultContract: Contract,
    swaps: SwapV2[],
    assets: string[],
    newAmounts: BigNumberish[],
    tokensOut: string[]
): Promise<{ amountTokensOut: string[]; swaps: SwapV2[]; assets: string[] }> {
    for (let i = 0; i < tokensOut.length; i++) {
        const tokenIndex = assets.indexOf(tokensOut[i]);
        swaps.forEach((poolSwap) => {
            if (
                poolSwap.assetInIndex === tokenIndex ||
                poolSwap.assetOutIndex === tokenIndex
            )
                poolSwap.amount = newAmounts[i].toString();
        });
    }

    // Onchain query
    const deltas = await queryBatchSwap(
        vaultContract,
        SwapTypes.SwapExactIn,
        swaps,
        assets
    );

    const amountTokensOut: string[] = [];
    tokensOut.forEach((t) => {
        const amount = deltas[assets.indexOf(t)];
        if (amount) amountTokensOut.push(amount);
        else amountTokensOut.push('0');
    });

    return {
        amountTokensOut,
        swaps: swaps,
        assets: assets,
    };
}
