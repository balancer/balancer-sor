import fetch from 'isomorphic-fetch';
import { ethers } from 'ethers';
import * as bmath from './bmath';
import { Pool } from './types';
import { BigNumber } from './utils/bignumber';

const SUBGRAPH_URL =
    process.env.REACT_APP_SUBGRAPH_URL ||
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan';

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

export const parsePoolData = (
    pools,
    tokenIn: string,
    tokenOut: string
): Pool[] => {
    if (pools.length === 0)
        throw Error('There are no pools with selected tokens');

    let poolData: Pool[] = [];
    pools.forEach(p => {
        let tI = p.tokens.find(
            t =>
                ethers.utils.getAddress(t.address) ===
                ethers.utils.getAddress(tokenIn)
        );
        let tO = p.tokens.find(
            t =>
                ethers.utils.getAddress(t.address) ===
                ethers.utils.getAddress(tokenOut)
        );
        let obj = {
            id: p.id,
            decimalsIn: tI.decimals,
            decimalsOut: tO.decimals,
            balanceIn: bmath.scale(bmath.bnum(tI.balance), tI.decimals),
            balanceOut: bmath.scale(bmath.bnum(tO.balance), tO.decimals),
            weightIn: bmath.scale(
                bmath.bnum(tI.denormWeight).div(bmath.bnum(p.totalWeight)),
                18
            ),
            weightOut: bmath.scale(
                bmath.bnum(tO.denormWeight).div(bmath.bnum(p.totalWeight)),
                18
            ),
            swapFee: bmath.scale(bmath.bnum(p.swapFee), 18),
        };

        poolData.push(obj);
    });

    return poolData;
};

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
