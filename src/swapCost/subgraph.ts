import fetch from 'isomorphic-fetch';
import { SubgraphLatestTokenPrice } from '../types';

export async function getTokenPriceInNativeAssetFromSubgraph(
    tokenAddress: string,
    wrappedNativeAssetAddress: string,
    subgraphUrl: string
) {
    const latestTokenPrice = await fetchSubgraphLatestTokenPrice(
        tokenAddress,
        wrappedNativeAssetAddress,
        subgraphUrl
    );

    if (!latestTokenPrice) {
        throw Error('No latest token price available from the subgraph');
    }

    return latestTokenPrice.price;
}

async function fetchSubgraphLatestTokenPrice(
    tokenAddress: string,
    wrappedNativeAssetAddress: string,
    subgraphUrl: string
): Promise<SubgraphLatestTokenPrice | null> {
    const query = `
        {
            latestPrice(id: "${tokenAddress.toLowerCase()}-${wrappedNativeAssetAddress.toLowerCase()}") {
                price
                pricingAsset
                asset
                id
            }
        }
    `;

    const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
        }),
    });

    const { data } = await response.json();

    return data.latestPrice ?? null;
}
