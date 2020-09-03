// Compares timings for different methods of getting all pools without any 0 balances
import { expect, assert } from 'chai';
const sor = require('../../src');
import { Set } from 'jsclass/src/set';
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
        allPools = await sor.getAllPublicSwapPools(); // Only returns pools with balance
        console.timeEnd('getPools');
        console.log(allPools.pools.length);

        // Just to prove this Subgraph method won't work.
        let filtered = await getPoolsFiltered();
        console.log(filtered.pools.length);
    }).timeout(10000);
});
