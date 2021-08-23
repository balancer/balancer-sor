import fetch from 'isomorphic-fetch';
import { bnum, BONE, scale } from './bignumber';

const getPlatformId = (chainId: string | number): string => {
    const mapping = {
        '1': 'ethereum',
        '42': 'ethereum',
        '137': 'polygon-pos',
    };

    return mapping[chainId.toString()] || 'ethereum';
};

const getNativeAssetId = (chainId: string | number): string => {
    const mapping = {
        '1': 'eth',
        '42': 'eth',
        '137': '', // CoinGecko does not provide prices in terms of MATIC
    };

    return mapping[chainId.toString()] || 'eth';
};

export async function convertTokenToNative(
    chainId: number,
    tokenAddress: string,
    tokenDecimals: number
): Promise<string> {
    const platformId = getPlatformId(chainId);
    const nativeAssetId = getNativeAssetId(chainId);
    const endpoint = `https://api.coingecko.com/api/v3/simple/token_price/${platformId}?contract_addresses=${tokenAddress}&vs_currencies=${nativeAssetId}`;

    const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json();

    const ethPerToken = data[tokenAddress.toLowerCase()][nativeAssetId];

    // Coingecko returns price of token in terms of ETH
    // We want the price of 1 ETH in terms of the token
    const priceInNativeToken = BONE.div(
        scale(bnum(ethPerToken), 18 - tokenDecimals)
    ).toString();
    return priceInNativeToken;
}
