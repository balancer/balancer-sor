import fetch from 'isomorphic-fetch';
import { TokenPriceService } from '../../src';

export class CoingeckoTokenPriceService implements TokenPriceService {
    constructor(private readonly chainId: number) {}

    public async getNativeAssetPriceInToken(
        tokenAddress: string
    ): Promise<string> {
        const ethPerToken = await this.getTokenPriceInNativeAsset(tokenAddress);

        // We get the price of token in terms of ETH
        // We want the price of 1 ETH in terms of the token base units
        return `${1 / parseFloat(ethPerToken)}`;
    }

    /**
     * @dev Assumes that the native asset has 18 decimals
     * @param tokenAddress - the address of the token contract
     * @returns the price of 1 ETH in terms of the token base units
     */
    async getTokenPriceInNativeAsset(tokenAddress: string): Promise<string> {
        const endpoint = `https://api.coingecko.com/api/v3/simple/token_price/${this.platformId}?contract_addresses=${tokenAddress}&vs_currencies=${this.nativeAssetId}`;

        const response = await fetch(endpoint, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (
            data[tokenAddress.toLowerCase()][this.nativeAssetId] === undefined
        ) {
            throw Error('No price returned from Coingecko');
        }

        return data[tokenAddress.toLowerCase()][this.nativeAssetId];
    }

    private get platformId(): string {
        switch (this.chainId) {
            case 1:
                return 'ethereum';
            case 42:
                return 'ethereum';
            case 137:
                return 'polygon-pos';
            case 42161:
                return 'arbitrum-one';
        }

        return '2';
    }

    private get nativeAssetId(): string {
        switch (this.chainId) {
            case 1:
                return 'eth';
            case 42:
                return 'eth';
            case 137:
                return '';
            case 42161:
                return 'eth';
        }

        return '';
    }
}
