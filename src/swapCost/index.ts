import { BigNumber } from '@ethersproject/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { bnum, scale } from '../utils/bignumber';
import { WETHADDR } from '../constants';
import { getTokenPriceInNativeAsset } from './coingecko';
import { getTokenPriceInNativeAssetFromSubgraph } from './subgraph';

export function calculateTotalSwapCost(
    tokenPriceWei: BigNumber,
    swapGas: BigNumber,
    gasPriceWei: BigNumber
): BigNumber {
    return gasPriceWei.mul(swapGas).mul(tokenPriceWei).div(ONE);
}

export class SwapCostCalculator {
    private tokenPriceCache: Record<string, string>;

    private initializeCache(): void {
        this.tokenPriceCache = {
            AddressZero: '1',
            [WETHADDR[this.chainId].toLowerCase()]: '1',
        };
    }

    constructor(private chainId: number, private subgraphUrl: string | null) {
        this.initializeCache();
    }

    /**
     * Sets the chain ID to be used when querying asset prices
     * @param chainId - the chain ID of the chain to switch to
     */
    setChainId(chainId: number): void {
        this.chainId = chainId;
        this.initializeCache();
    }

    /**
     * @param tokenAddress - the address of the token for which to express the native asset in terms of
     */
    async getNativeAssetPriceInToken(tokenAddress: string): Promise<string> {
        // Check if we have token price cached
        const cachedTokenPrice =
            this.tokenPriceCache[tokenAddress.toLowerCase()];
        if (cachedTokenPrice) return cachedTokenPrice;

        try {
            // Query either the subgraph or Coingecko first and only check decimals
            // if we get a valid response to avoid unnecessary queries
            const ethPerToken = this.subgraphUrl
                ? await getTokenPriceInNativeAssetFromSubgraph(
                      tokenAddress,
                      WETHADDR[this.chainId].toLowerCase(),
                      this.subgraphUrl
                  )
                : await getTokenPriceInNativeAsset(this.chainId, tokenAddress);

            // We get the price of token in terms of ETH
            // We want the price of 1 ETH in terms of the token base units
            const ethPriceInToken = bnum(1).div(bnum(ethPerToken)).toString();

            this.setNativeAssetPriceInToken(tokenAddress, ethPriceInToken);
            return ethPriceInToken;
        } catch (err) {
            console.log('Error Getting Token Price. Defaulting to 0.');
            console.log(err);
            return '0';
        }
    }

    /**
     * @param tokenAddress - the address of the token for which to express the native asset in terms of
     * @param tokenPrice - the price of the native asset in terms of the provided token
     */
    setNativeAssetPriceInToken(tokenAddress: string, tokenPrice: string): void {
        this.tokenPriceCache[tokenAddress.toLowerCase()] = tokenPrice;
    }

    /**
     * Calculate the cost of spending a certain amount of gas in terms of a token.
     * This allows us to determine whether an increased amount of tokens gained
     * is worth spending this extra gas (e.g. by including an extra pool in a swap)
     */
    async convertGasCostToToken(
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
        return calculateTotalSwapCost(tokenPriceWei, swapGas, gasPriceWei);
    }
}
