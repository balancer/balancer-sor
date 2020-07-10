import { Interface } from '@ethersproject/abi';
import { Contract } from '@ethersproject/contracts';
import { Web3Provider } from '@ethersproject/providers';
import { Pool } from './types';
import * as bmath from './bmath';

export async function parsePoolDataOnChain(
    pools,
    tokenIn: string,
    tokenOut: string,
    multiAddress: string,
    provider: Web3Provider
): Promise<Pool[]> {
    if (pools.length === 0)
        throw Error('There are no pools with selected tokens');

    const multiAbi = require('./abi/multicall.json');
    const bpoolAbi = require('./abi/bpool.json');

    const multi = new Contract(multiAddress, multiAbi, provider);

    const iface = new Interface(bpoolAbi);

    const promises: Promise<any>[] = [];

    let calls = [];

    let poolData: Pool[] = [];
    pools.forEach(p => {
        calls.push([p.id, iface.encodeFunctionData('getBalance', [tokenIn])]);
        calls.push([p.id, iface.encodeFunctionData('getBalance', [tokenOut])]);
        calls.push([
            p.id,
            iface.encodeFunctionData('getNormalizedWeight', [tokenIn]),
        ]);
        calls.push([
            p.id,
            iface.encodeFunctionData('getNormalizedWeight', [tokenOut]),
        ]);
        calls.push([p.id, iface.encodeFunctionData('getSwapFee', [])]);
    });

    try {
        const [blockNumber, response] = await multi.aggregate(calls);
        let i = 0;
        let chunkResponse = [];
        let returnPools: Pool[] = [];
        for (let i = 0; i < response.length; i += 5) {
            let chunk = response.slice(i, i + 5);
            chunkResponse.push(chunk);
        }

        chunkResponse.forEach((r, j) => {
            let obj = {
                id: pools[j].id,
                balanceIn: bmath.bnum(r[0]),
                balanceOut: bmath.bnum(r[1]),
                weightIn: bmath.bnum(r[2]),
                weightOut: bmath.bnum(r[3]),
                swapFee: bmath.bnum(r[4]),
            };
            if (
                obj.balanceIn.gt(bmath.bnum(0)) &&
                obj.balanceOut.gt(bmath.bnum(0))
            ) {
                returnPools.push(obj);
            }
        });

        return returnPools;
    } catch (e) {
        console.error('Failure querying onchain balances', { error: e });
        return;
    }
}
