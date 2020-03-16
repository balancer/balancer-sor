import fetch from 'isomorphic-fetch';
import { ethers } from 'ethers';

const SUBGRAPH_URL =
    process.env.REACT_APP_SUBGRAPH_URL ||
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer';

export async function getPoolsWithTokens(tokenIn, tokenOut) {
    // GraphQL is case-sensitive
    // Always use checksum addresses
    tokenIn = ethers.utils.getAddress(tokenIn);
    tokenOut = ethers.utils.getAddress(tokenOut);

    const query = `
      query ($tokens: [Bytes!]) {
          pools (where: {tokensList_contains: $tokens, publicSwap: true}) {
            id
            publicSwap
            swapFee
            totalWeight
            tokensList
            tokens {
              id
              address
              balance
              decimals
              symbol
              denormWeight
            }
          }
        }
    `;

    const variables = {
        tokens: [tokenIn, tokenOut],
    };

    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });

    const { data } = await response.json();
    return data;
}

export async function getTokenPairs(token) {
    // GraphQL is case-sensitive
    // Always use checksum addresses
    token = ethers.utils.getAddress(token);

    const query = `
      query ($token: [Bytes!]) {
          pools (where: {tokensList_contains: $token, publicSwap: true}) {
            tokensList
          }
        }
    `;

    const variables = {
        token: [token],
    };

    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });

    const { data } = await response.json();
    return data;
}
