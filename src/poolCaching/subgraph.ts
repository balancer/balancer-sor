import fetch from 'isomorphic-fetch';
import { SubgraphPoolBase } from '../types';

const queryWithLinear = `
      {
        pools: pools(
          first: 1000,
          where: { swapEnabled: true },
          orderBy: totalLiquidity,
          orderDirection: desc
        ) {
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
            priceRate
          }
          tokensList
          totalWeight
          amp
          expiryTime
          unitSeconds
          principalToken
          baseToken
          swapEnabled
          wrappedIndex
          mainIndex
          lowerTarget
          upperTarget
        }
      }
    `;

const queryWithOutLinear = `
      {
        pools: pools(
          first: 1000,
          where: { swapEnabled: true },
          orderBy: totalLiquidity,
          orderDirection: desc
        ) {
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
            priceRate
          }
          tokensList
          totalWeight
          amp
          expiryTime
          unitSeconds
          principalToken
          baseToken
          swapEnabled
        }
      }
    `;

export const Query: { [chainId: number]: string } = {
    1: queryWithLinear,
    3: queryWithLinear,
    4: queryWithLinear,
    5: queryWithLinear,
    42: queryWithLinear,
    137: queryWithOutLinear,
    42161: queryWithLinear,
};

// Returns all public pools
export async function fetchSubgraphPools(
    subgraphUrl: string,
    chainId = 1
): Promise<SubgraphPoolBase[]> {
    const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: Query[chainId] }),
    });

    const { data } = await response.json();

    return data.pools ?? [];
}
