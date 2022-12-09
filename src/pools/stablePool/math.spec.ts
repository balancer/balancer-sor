import dotenv from 'dotenv';
dotenv.config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { PhantomStablePool, SubgraphPoolBase, ZERO } from '../../../src';
import { SubgraphPoolDataService } from '../../../test/lib/subgraphPoolDataService';
import {
    Network,
    SUBGRAPH_URLS,
    PROVIDER_URLS,
    vaultAddr,
    MULTIADDR,
} from '../../../test/testScripts/constants';
import { BigNumber } from '@ethersproject/bignumber';

// Setup SOR with data services
async function setUp(
    networkId: Network,
    provider: JsonRpcProvider
): Promise<void> {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const subgraphPoolDataService = new SubgraphPoolDataService({
        chainId: networkId,
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        subgraphUrl: SUBGRAPH_URLS[networkId],
        onchain: true,
    });

    const pools = await subgraphPoolDataService.getPools();

    const pool = pools.filter((p) => {
        return (
            p.address.toLowerCase() ===
            '0x45631a4b3cab78e6dfdd21a7025a61fac7683919'.toLowerCase()
        );
    });

    console.log(pool);
    const amountsIn = [
        BigNumber.from('100000000000000000000'),
        BigNumber.from('100000000000000000000'),
    ];
    const composablePool = PhantomStablePool.fromPool(
        pool[0] as SubgraphPoolBase
    );

    const bpt = composablePool._calcBptOutGivenExactTokensIn(amountsIn);
    console.log(bpt.toString(), 'bptOut');
}

export async function swap(): Promise<void> {
    const networkId = Network.GOERLI;
    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);
    await setUp(networkId, provider);
}

// $ TS_NODE_PROJECT='tsconfig.testing.json' ts-node ./src/pools/stablePool/math.spec.ts
swap();
