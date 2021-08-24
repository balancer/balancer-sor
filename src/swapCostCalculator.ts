import { WETHADDR } from './constants';
import { BigNumber, bnum, BONE, ZERO } from './utils/bignumber';
import { getTokenPriceInNativeAsset } from './utils/coingecko';

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

export class SwapCostCalculator {
    private chainId: number;
    private tokenPriceCache: Record<string, string> = {
        ZERO_ADDRESS: BONE.toString(),
    };
    private swapCostOverride: Record<string, string> = {};

    private initializeCache(): void {
        this.tokenPriceCache = {
            ZERO_ADDRESS: BONE.toString(),
            [WETHADDR[this.chainId].toLowerCase()]: BONE.toString(),
        };
        this.swapCostOverride = {};
    }

    constructor(chainId: number) {
        this.chainId = chainId;
        this.initializeCache();
    }

    setChainId(chainId: number): void {
        this.chainId = chainId;
        this.initializeCache();
    }

    /**
     * @param tokenAddress
     * @param tokenDecimals
     * @returns
     */
    async getNativeAssetPriceInToken(
        tokenAddress: string,
        tokenDecimals: number
    ): Promise<BigNumber> {
        // Check if we have token price cached
        const cachedTokenPrice = this.tokenPriceCache[
            tokenAddress.toLowerCase()
        ];
        if (cachedTokenPrice) return bnum(cachedTokenPrice);

        try {
            const tokenPrice = await getTokenPriceInNativeAsset(
                this.chainId,
                tokenAddress,
                tokenDecimals
            );

            // Coingecko returns price of token in terms of ETH
            // We want the price of 1 ETH in terms of the token
            const ethPriceInToken = BONE.div(bnum(tokenPrice))
                .dp(0)
                .toString();

            this.tokenPriceCache[tokenAddress.toLowerCase()] = ethPriceInToken;
            return bnum(ethPriceInToken);
        } catch (err) {
            console.log('Error Getting Token Price. Defaulting to 0.');
            return ZERO;
        }
    }

    /**
     * @param tokenAddress
     * @param tokenPrice
     */
    setNativeAssetPriceInToken(tokenAddress: string, tokenPrice: string): void {
        this.tokenPriceCache[tokenAddress.toLowerCase()] = tokenPrice;
    }

    /**
     * We only include this function as a hack as the tests expect to be able to set the swap fee directly
     * @deprecated Use `setNativeAssetPriceInToken`
     */
    setSwapCostOverride(tokenAddress: string, swapCost: string): void {
        this.swapCostOverride[tokenAddress.toLowerCase()] = swapCost;
    }

    /**
     * Calculate the cost of spending a certain amount of gas in terms of a token.
     * This allows us to determine whether an increased amount of tokens gained
     * is worth spending this extra gas (e.g. by including an extra pool in a swap)
     * @param tokenAddress
     * @param tokenDecimals
     * @param gasPriceWei
     * @param swapGasCost
     * @returns
     */
    async convertGasCostToToken(
        tokenAddress: string,
        tokenDecimals: number,
        gasPriceWei: BigNumber,
        swapGasCost: BigNumber
    ): Promise<BigNumber> {
        if (this.swapCostOverride[tokenAddress.toLowerCase()]) {
            return bnum(this.swapCostOverride[tokenAddress.toLowerCase()]);
        }
        return calculateTotalSwapCost(
            await this.getNativeAssetPriceInToken(tokenAddress, tokenDecimals),
            swapGasCost,
            gasPriceWei
        );
    }
}
