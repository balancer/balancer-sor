import fetch from 'isomorphic-fetch';
import { ethers } from 'ethers';
import * as bmath from '../../../src/bmath';
import { PoolPairData, Path } from '../../../src/types';
import { BigNumber } from '../../../src/utils/bignumber';

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
