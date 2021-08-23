import { BigNumber, bnum, BONE } from './utils/bignumber';
import { convertTokenToNative } from './utils/coingecko';

export function calculateTotalSwapCost(
    tokenPrice: BigNumber,
    swapCost: BigNumber,
    gasPriceWei: BigNumber
): BigNumber {
    return gasPriceWei
        .times(swapCost)
        .times(tokenPrice)
        .div(BONE);
}

/**
 * Calculate the cost of spending a certain amount of gas in terms of a token.
 * This allows us to determine whether an increased amount of tokens gained
 * is worth spending this extra gas (e.g. by including an extra pool in a swap)
 * @param chainId
 * @param tokenAddress
 * @param tokenDecimals
 * @param gasPriceWei
 * @param swapGasCost
 * @returns
 */
export async function getCostOutputToken(
    chainId: number,
    tokenAddress: string,
    tokenDecimals: number,
    gasPriceWei: BigNumber,
    swapGasCost: BigNumber
): Promise<BigNumber> {
    try {
        const tokenPrice = await convertTokenToNative(
            chainId,
            tokenAddress,
            tokenDecimals
        );

        const costOutputToken = calculateTotalSwapCost(
            bnum(tokenPrice),
            swapGasCost,
            gasPriceWei
        );

        return costOutputToken;
    } catch (err) {
        console.log('Error Getting Token Price. Defaulting to 0.');
        return new BigNumber(0);
    }
}
