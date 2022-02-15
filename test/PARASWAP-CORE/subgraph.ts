import fetch from 'isomorphic-fetch';
import { SubgraphPoolBase } from './types';

const query = `
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
          tokens {
            address
            decimals
          }
        }
      }
    `;

export async function getPools(
    subgraphUrl: string
): Promise<SubgraphPoolBase[]> {
    const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });

    const { data } = await response.json();

    return data.pools ?? [];
}
