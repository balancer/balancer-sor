import { gql, request } from 'graphql-request';
import { TokenPriceService } from '../../src';
import { Network } from '../testScripts/constants';

export class ApiTokenPriceService implements TokenPriceService {
    private chainKey: string;

    private balancerApiUrl = 'https://api-v3.balancer.fi/';

    private tokenPriceQuery = gql`
        query queryTokenPrices($chainKey: GqlChain!) {
            tokenGetCurrentPrices(chains: [$chainKey]) {
                address
                price
            }
        }
    `;

    constructor(private readonly chainId: number) {
        this.chainKey = Network[chainId];
    }
    async getNativeAssetPriceInToken(tokenAddress: string): Promise<string> {
        const { tokenGetCurrentPrices: tokenPrices } = await request(
            this.balancerApiUrl,
            this.tokenPriceQuery,
            {
                chainKey: this.chainKey,
            }
        );
        const tokenPriceUsd = (
            tokenPrices as { address: string; price: number }[]
        ).find(
            ({ address }) =>
                address.toLowerCase() === tokenAddress.toLowerCase()
        );
        if (!tokenPriceUsd) {
            throw new Error('Token Price not found in the API');
        }
        const nativeAssetPriceUsd = (
            tokenPrices as { address: string; price: number }[]
        ).find(
            ({ address }) =>
                address.toLowerCase() ===
                NativeAssetAddress[
                    this.chainKey as keyof typeof NativeAssetAddress
                ]
        );
        if (!nativeAssetPriceUsd) {
            throw new Error('Native Token Price not found in the API');
        }
        const tokenPriceInNativeAsset =
            tokenPriceUsd.price / nativeAssetPriceUsd.price;
        return String(tokenPriceInNativeAsset);
    }
}

enum NativeAssetAddress {
    MAINNET = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    POLYGON = '0x0000000000000000000000000000000000001010',
    ARBITRUM = '0x912ce59144191c1204e64559fe8253a0e49e6548',
    AVALANCHE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    BASE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    FANTOM = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    GNOSIS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    OPTIMISM = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    ZKEVM = '0xa2036f0538221a77a3937f1379699f44945018d0',
}
