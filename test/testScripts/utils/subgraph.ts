import fetch from 'isomorphic-fetch';
import { ethers } from 'ethers';
import * as bmath from '../../../src/bmath';
import {
    PoolPairData,
    Path,
    SubGraphPools,
    DisabledToken,
} from '../../../src/types';
import { BigNumber } from '../../../src/utils/bignumber';
import * as sor from '../../../src';

const SUBGRAPH_URL =
    process.env.REACT_APP_SUBGRAPH_URL ||
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer';

export async function getPoolsWithSingleToken(token) {
    // GraphQL is case-sensitive
    // Always use checksum addresses
    token = ethers.utils.getAddress(token);

    const query = `
      query ($tokens: [Bytes!]) {
          pools (first: 1000, where: {tokensList_contains: $tokens, publicSwap: true}) {
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

    // Create a dictionary for fast access with pool id and filter out pools
    // that have 0 balance for token
    const pools = {};
    data.pools.forEach((p, i) => {
        if (
            p.tokens.find(t => ethers.utils.getAddress(t.address) === token)
                .balance != 0
        )
            pools[p.id] = p;
    });

    return pools;
}

// Filters for only pools with balance and converts to wei/bnum format.
export function formatAndFilterPools(
    allPools: SubGraphPools,
    disabledTokens: DisabledToken[] = []
) {
    let allTokens = [];
    let allTokensSet = new Set();
    let allPoolsNonZeroBalances = { pools: [] };

    for (let pool of allPools.pools) {
        // Build list of non-zero balance pools
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0) {
            if (pool.tokens[0].balance != '0') {
                let tokens = [];
                pool.tokensList.forEach(token => {
                    if (
                        !disabledTokens.find(
                            t =>
                                ethers.utils.getAddress(t.address) ===
                                ethers.utils.getAddress(token)
                        )
                    ) {
                        tokens.push(token);
                    }
                });

                if (tokens.length > 1) {
                    allTokens.push(tokens.sort()); // Will add without duplicate
                }

                allPoolsNonZeroBalances.pools.push(pool);
            }
        }
    }

    allTokensSet = new Set(
        Array.from(new Set(allTokens.map(a => JSON.stringify(a))), json =>
            JSON.parse(json)
        )
    );

    // Formats Subgraph to wei/bnum format
    sor.formatSubgraphPools(allPoolsNonZeroBalances);

    return [allTokensSet, allPoolsNonZeroBalances];
}

export function filterPools(allPools: any) {
    let allTokens = [];
    let allTokensSet = new Set();
    let allPoolsNonZeroBalances = [];

    let i = 0;

    for (let pool of allPools.pools) {
        // Build list of non-zero balance pools
        // Only check first balance since AFAIK either all balances are zero or none are:
        if (pool.tokens.length != 0) {
            if (pool.tokens[0].balance != '0') {
                allTokens.push(pool.tokensList.sort()); // Will add without duplicate
                allPoolsNonZeroBalances.push(pool);
                i++;
            }
        }
    }

    allTokensSet = new Set(
        Array.from(new Set(allTokens.map(a => JSON.stringify(a))), json =>
            JSON.parse(json)
        )
    );

    return [allTokensSet, allPoolsNonZeroBalances];
}
