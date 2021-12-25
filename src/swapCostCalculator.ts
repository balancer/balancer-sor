import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { bnum, scale } from './utils/bignumber';
import { SorConfig, TokenPriceService } from './types';

export class SwapCostCalculator {
    private readonly tokenPriceCache: Record<string, string>;

    constructor(
        config: SorConfig,
        private readonly tokenPriceService: TokenPriceService
    ) {
        this.tokenPriceCache = {
            AddressZero: '1',
            [config.weth.toLowerCase()]: '1',
        };
    }

    /**
     * Calculate the cost of spending a certain amount of gas in terms of a token.
     * This allows us to determine whether an increased amount of tokens gained
     * is worth spending this extra gas (e.g. by including an extra pool in a swap)
     */
    public async convertGasCostToToken(
        tokenAddress: string,
        tokenDecimals: number,
        gasPriceWei: BigNumber,
        swapGas: BigNumber = BigNumber.from('35000')
    ): Promise<BigNumber> {
        if (gasPriceWei.isZero() || swapGas.isZero()) return Zero;
        const tokenPrice = await this.getNativeAssetPriceInToken(tokenAddress);
        const tokenPriceWei = BigNumber.from(
            scale(bnum(tokenPrice), tokenDecimals).dp(0).toString()
        );

        return gasPriceWei.mul(swapGas).mul(tokenPriceWei).div(ONE);
    }

    /**
     * @param tokenAddress - the address of the token for which to express the native asset in terms of
     * @param tokenPrice - the price of the native asset in terms of the provided token
     */
    public setNativeAssetPriceInToken(
        tokenAddress: string,
        tokenPrice: string
    ): void {
        this.tokenPriceCache[tokenAddress.toLowerCase()] = tokenPrice;
    }

    /**
     * @param tokenAddress - the address of the token for which to express the native asset in terms of
     */
    private async getNativeAssetPriceInToken(
        tokenAddress: string
    ): Promise<string> {
        // Check if we have token price cached
        const cachedTokenPrice =
            this.tokenPriceCache[tokenAddress.toLowerCase()];
        if (cachedTokenPrice) return cachedTokenPrice;

        try {
            const ethPriceInToken =
                await this.tokenPriceService.getNativeAssetPriceInToken(
                    tokenAddress
                );

            //cache the price so we don't need to refetch it
            this.setNativeAssetPriceInToken(tokenAddress, ethPriceInToken);

            return ethPriceInToken;
        } catch (err) {
            console.log('Error Getting Token Price. Defaulting to 0.');
            console.log(err);
            return '0';
        }
    }
}
