// Compares timings for different methods of getting all pools without any 0 balances
import { expect, assert } from 'chai';
const sor = require('../../src');
const Set = require('jsclass/src/set').Set;
import fetch from 'isomorphic-fetch';

const SUBGRAPH_URL =
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer';

// Confirmation that this doesn't filter as desired
export async function getPoolsFiltered() {
    const query = `
      {
        pools(first: 1000, where: {publicSwap: true}) {
          id
          tokens (where: {balance_gt: "0"}) {
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

    const response = await fetch(SUBGRAPH_URL, {
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
    return data;
}

describe('Test Methods Of Getting All Pools Without 0 Balances', () => {
    let allPools;

    it('getPools timer check', async () => {
        console.time('getPools');
        allPools = await sor.getAllPublicSwapPools();
        console.timeEnd('getPools');
        console.log(allPools.pools.length);

        let filtered = await getPoolsFiltered();
        console.log(filtered.pools.length);
    }).timeout(10000);

    it('filters all pools with 0 balance (using jsclass)', () => {
        console.time('filterAllPools');
        let allTokensSet = new Set();
        let allPoolsNonZeroBalances = [];

        for (var i = allPools.pools.length - 1; i >= 0; i--) {
            allTokensSet.add(new Set(allPools.pools[i].tokensList));

            // Build list of non-zero balance pools
            // Only check first balance since AFAIK either all balances are zero or none are:
            if (allPools.pools[i].tokens.length != 0)
                if (allPools.pools[i].tokens[0].balance != '0')
                    allPoolsNonZeroBalances.push(allPools.pools[i]);
        }
        console.timeEnd('filterAllPools');
    });
});
