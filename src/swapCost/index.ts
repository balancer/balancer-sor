import { Contract } from '@ethersproject/contracts';
import { BaseProvider } from '@ethersproject/providers';
import { WETHADDR } from '../constants';
import { BigNumber, bnum, BONE, scale, ZERO } from '../utils/bignumber';
import { getTokenPriceInNativeAsset } from './coingecko';

export function calculateTotalSwapCost(
    tokenPrice: BigNumber,
    swapGas: BigNumber,
    gasPriceWei: BigNumber
): BigNumber {
    return gasPriceWei.times(swapGas).times(tokenPrice).div(BONE);
}

export class SwapCostCalculator {
    private tokenDecimalsCache: Record<string, number>;
    private tokenPriceCache: Record<string, string>;

    private initializeCache(): void {
        this.tokenPriceCache = {
            AddressZero: BONE.toString(),
            [WETHADDR[this.chainId].toLowerCase()]: BONE.toString(),
        };
        this.tokenDecimalsCache = {};
    }

    constructor(private provider: BaseProvider, private chainId: number) {
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
     * @param tokenPrice - the price of the native asset in terms of the provided token
     */
    async getNativeAssetPriceInToken(tokenAddress: string): Promise<BigNumber> {
        // Check if we have token price cached
        const cachedTokenPrice =
            this.tokenPriceCache[tokenAddress.toLowerCase()];
        if (cachedTokenPrice) return bnum(cachedTokenPrice);

        try {
            // Query Coingecko first and only check decimals
            // if we get a valid response to avoid unnecessary queries
            const ethPerToken = await getTokenPriceInNativeAsset(
                this.chainId,
                tokenAddress
            );

            const tokenDecimals = await this.getTokenDecimals(tokenAddress);

            // Coingecko returns price of token in terms of ETH
            // We want the price of 1 ETH in terms of the token base units
            const ethPerTokenWei = scale(bnum(ethPerToken), 18 - tokenDecimals);
            const ethPriceInToken = BONE.div(ethPerTokenWei).dp(0);

            this.setNativeAssetPriceInToken(
                tokenAddress,
                ethPriceInToken.toString()
            );
            return ethPriceInToken;
        } catch (err) {
            console.log('Error Getting Token Price. Defaulting to 0.');
            return ZERO;
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
     * @dev Caches the number of decimals for a particular token to avoid onchain lookups
     * @param tokenAddress - the address of the provided token
     * @param decimals - the number of decimals of the provided token
     */
    setTokenDecimals(tokenAddress: string, decimals: number): void {
        this.tokenDecimalsCache[tokenAddress.toLowerCase()] = decimals;
    }

    /**
     * Calculate the cost of spending a certain amount of gas in terms of a token.
     * This allows us to determine whether an increased amount of tokens gained
     * is worth spending this extra gas (e.g. by including an extra pool in a swap)
     */
    async convertGasCostToToken(
        tokenAddress: string,
        gasPriceWei: BigNumber,
        swapGas: BigNumber = new BigNumber('35000')
    ): Promise<BigNumber> {
        if (gasPriceWei.isZero() || swapGas.isZero()) return ZERO;
        return calculateTotalSwapCost(
            await this.getNativeAssetPriceInToken(tokenAddress),
            swapGas,
            gasPriceWei
        );
    }

    private async getTokenDecimals(tokenAddress: string): Promise<number> {
        const cache = this.tokenDecimalsCache[tokenAddress.toLowerCase()];
        if (cache !== undefined) {
            return cache;
        }

        const tokenContract = new Contract(
            tokenAddress,
            ['function decimals() external view returns (uint256)'],
            this.provider
        );

        const decimals: BigNumber = await tokenContract.decimals();

        this.setTokenDecimals(tokenAddress, decimals.toNumber());

        return decimals.toNumber();
    }
}
