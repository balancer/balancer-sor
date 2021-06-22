import fetch from 'isomorphic-fetch';

const SUBGRAPH_URL =
    process.env.SUBGRAPH_URL ||
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan-v2';

// Returns all public pools
export async function fetchSubgraphPools(SubgraphUrl: string = '') {
    // can filter for publicSwap too??
    const query = `
      {
        pools: pools(first: 1000) {
          id
          address
          poolType
          swapFee
          totalShares
          tokens {
            address
            balance
            decimals
            weight
          }
          tokensList
          totalWeight
          amp
          expiryTime
          unitSeconds
          principalToken
          baseToken
        }
      }
    `;

    console.log(
        `fetchSubgraphPools: ${SubgraphUrl === '' ? SUBGRAPH_URL : SubgraphUrl}`
    );
    const response = await fetch(
        SubgraphUrl === '' ? SUBGRAPH_URL : SubgraphUrl,
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
            }),
        }
    );

    const { data } = await response.json();

    return { pools: data.pools };
}
