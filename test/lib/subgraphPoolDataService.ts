import fetch from 'isomorphic-fetch';
import { PoolDataService, SubgraphPoolBase } from '../../src';
import { getOnChainBalances } from './onchainData';
import { Provider } from '@ethersproject/providers';

const queryWithLinear = `
      {
        pool0: pools(
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
        pool1000: pools(
          first: 1000,
          skip: 1000,
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
        pool0: pools(
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
        pool1000: pools(
          first: 1000,
          skip: 1000,
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
    137: queryWithLinear,
    42161: queryWithLinear,
};

export class SubgraphPoolDataService implements PoolDataService {
    constructor(
        private readonly config: {
            chainId: number;
            multiAddress: string;
            vaultAddress: string;
            subgraphUrl: string;
            provider: Provider;
            onchain: boolean;
        }
    ) {}

    public async getPools(): Promise<SubgraphPoolBase[]> {
        const response = await fetch(this.config.subgraphUrl, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: Query[this.config.chainId] }),
        });

        const { data } = await response.json();

        const pools = [...data.pool0, ...data.pool1000]; /*.filter((p) => {
            return (
                p.id ===
                    '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019' ||
                p.id ===
                    '0x06df3b2bbb68adc8b0e302443692037ed9f91b42000000000000000000000063'
            );
        });*/

        if (this.config.onchain) {
            return getOnChainBalances(
                pools ?? [],
                this.config.multiAddress,
                this.config.vaultAddress,
                this.config.provider
            );
        }

        return data.pools ?? [];
    }
}
