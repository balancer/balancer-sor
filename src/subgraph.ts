import fetch from 'isomorphic-fetch';
import { ethers } from 'ethers';
import * as bmath from './bmath';
import { Pool, Path } from './types';
import { BigNumber } from './utils/bignumber';

const SUBGRAPH_URL =
    process.env.REACT_APP_SUBGRAPH_URL ||
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer';

export async function getPoolsWithSingleToken(token) {
    // GraphQL is case-sensitive
    // Always use checksum addresses
    token = ethers.utils.getAddress(token);

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
        tokens: [token],
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

export const parsePoolAndPathData = (
    directPools,
    tokenIn: string,
    tokenOut: string,
    mostLiquidPoolsFirstHop,
    mostLiquidPoolsSecondHop,
    hopTokens
): [Pool[], Path[]] => {
    let poolData: Pool[] = [];
    let pathData: Path[] = [];

    // First add direct pair paths
    directPools.forEach(p => {
        let pool = parsePoolForTokenPair(p, tokenIn, tokenOut);
        poolData.push(pool);

        let path = {
            id: pool.id,
            pools: [pool],
        };
        pathData.push(path);
    });

    // Now add multi-hop paths.
    // mostLiquidPoolsFirstHop always has the same lengh of mostLiquidPoolsSecondHop
    for (let i = 0; i < mostLiquidPoolsFirstHop.length; i++) {
        let poolFirstHop = parsePoolForTokenPair(
            mostLiquidPoolsFirstHop[i],
            tokenIn,
            hopTokens[i]
        );
        let poolSecondHop = parsePoolForTokenPair(
            mostLiquidPoolsSecondHop[i],
            hopTokens[i],
            tokenOut
        );
        poolData.push(poolFirstHop);
        poolData.push(poolSecondHop);

        let path = {
            id: poolFirstHop.id + poolSecondHop.id, // Path id is the concatenation of the ids of poolFirstHop and poolSecondHop
            pools: [poolFirstHop, poolSecondHop],
        };

        pathData.push(path);
    }
    return [poolData, pathData];
};

export const parsePoolForTokenPair = (
    p,
    tokenIn: string,
    tokenOut: string
): Pool => {
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
    let pool = {
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

    return pool;
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
