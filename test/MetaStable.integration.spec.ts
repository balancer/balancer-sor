// yarn test:only test/MetaStable.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { defaultAbiCoder } from '@ethersproject/abi';
import { BalancerHelpers__factory } from '@balancer-labs/typechain';
import { vaultAddr } from './testScripts/constants';
import { SubgraphPoolBase, SOR } from '../src';
import {
    Network,
    MULTIADDR,
    SOR_CONFIG,
    ADDRESSES,
} from './testScripts/constants';
import { OnChainPoolDataService } from './lib/onchainData';
import { TokenPriceService } from '../src';
import { AddressZero } from '@ethersproject/constants';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';

dotenv.config();

// Balancer USDC-USDT Oracle Stable Pool
const testPool: SubgraphPoolBase = {
    id: '0x9f383f91c89cbd649c700c2bf69c2a828af299aa0002000000000000000003a6',
    address: '0x9f383f91c89cbd649c700c2bf69c2a828af299aa',
    swapEnabled: true,
    poolType: 'MetaStable',
    swapFee: '0.000001',
    totalWeight: '0',
    totalShares: '1.501763384758054657',
    tokensList: [
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
    ],
    tokens: [
        {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            balance: '1.129827',
            decimals: 6,
            priceRate: '0.9992',
            weight: null,
        },
        {
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            balance: '0.382611',
            decimals: 6,
            priceRate: '1',
            weight: null,
        },
    ],
};

let sor: SOR;
const networkId = Network.MAINNET;
const { ALCHEMY_URL: jsonRpcUrl } = process.env;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, networkId);
let subgraphPoolDataService: OnChainPoolDataService;

// Setup SOR with data services
function setUp(networkId: Network, provider: JsonRpcProvider): SOR {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    subgraphPoolDataService = new OnChainPoolDataService({
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        pools: [testPool],
    });

    class CoingeckoTokenPriceService implements TokenPriceService {
        constructor(private readonly chainId: number) {}
        async getNativeAssetPriceInToken(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            tokenAddress: string
        ): Promise<string> {
            return '0';
        }
    }

    // Use coingecko to fetch token price information. Used to calculate cost of additonal swaps/hops.
    const coingeckoTokenPriceService = new CoingeckoTokenPriceService(
        networkId
    );

    return new SOR(
        provider,
        SOR_CONFIG[networkId],
        subgraphPoolDataService,
        coingeckoTokenPriceService
    );
}

export async function queryJoin(
    network: number,
    poolId: string,
    assets: string[],
    amountsIn: string[]
): Promise<
    [BigNumber, BigNumber[]] & { bptOut: BigNumber; amountsIn: BigNumber[] }
> {
    const helpers = BalancerHelpers__factory.connect(
        ADDRESSES[network].balancerHelpers,
        provider
    );
    const EXACT_TOKENS_IN_FOR_BPT_OUT = 1; // Alternative is: TOKEN_IN_FOR_EXACT_BPT_OUT
    const minimumBPT = '0';
    const abi = ['uint256', 'uint256[]', 'uint256'];
    const data = [EXACT_TOKENS_IN_FOR_BPT_OUT, amountsIn, minimumBPT];
    const userDataEncoded = defaultAbiCoder.encode(abi, data);
    const joinPoolRequest = {
        assets,
        maxAmountsIn: amountsIn,
        userData: userDataEncoded,
        fromInternalBalance: false,
    };

    /*
    {
      "assets": [
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "0xdac17f958d2ee523a2206206994597c13d831ec7"
      ],
      "maxAmountsIn": [ "12300", "45600" ],
      "userData": "0x0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000300c000000000000000000000000000000000000000000000000000000000000b220",
      "fromInternalBalance": false
    }
    */

    const query = await helpers.queryJoin(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        joinPoolRequest
    );
    return query;
}

export async function queryExit(
    network: number,
    poolId: string,
    assets: string[],
    bptAmountIn: string
): Promise<
    [BigNumber, BigNumber[]] & { bptIn: BigNumber; amountsOut: BigNumber[] }
> {
    const helpers = BalancerHelpers__factory.connect(
        ADDRESSES[network].balancerHelpers,
        provider
    );
    const EXACT_BPT_IN_FOR_TOKENS_OUT = 1; // Alternative is: BPT_IN_FOR_EXACT_TOKENS_OUT (No proportional)
    const abi = ['uint256', 'uint256'];

    const data = [EXACT_BPT_IN_FOR_TOKENS_OUT, bptAmountIn];
    const userDataEncoded = defaultAbiCoder.encode(abi, data);

    const exitPoolRequest = {
        assets,
        minAmountsOut: assets.map(() => '0'),
        userData: userDataEncoded,
        toInternalBalance: false,
    };
    const query = await helpers.queryExit(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        exitPoolRequest
    );
    return query;
}

export async function querySingleTokenExit(
    network: number,
    poolId: string,
    assets: string[],
    bptAmountIn: string,
    exitTokenIndex: number
): Promise<
    [BigNumber, BigNumber[]] & { bptIn: BigNumber; amountsOut: BigNumber[] }
> {
    const helpers = BalancerHelpers__factory.connect(
        ADDRESSES[network].balancerHelpers,
        provider
    );
    const EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0; // Alternative is: BPT_IN_FOR_EXACT_TOKENS_OUT (No proportional)
    const abi = ['uint256', 'uint256', 'uint256'];

    const data = [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptAmountIn, exitTokenIndex];
    const userDataEncoded = defaultAbiCoder.encode(abi, data);

    const exitPoolRequest = {
        assets,
        minAmountsOut: assets.map(() => '0'),
        userData: userDataEncoded,
        toInternalBalance: false,
    };
    const query = await helpers.queryExit(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        exitPoolRequest
    );
    return query;
}

describe('MetaStable', () => {
    context('test joins vs queryJoin', () => {
        // Setup chain
        before(async function () {
            this.timeout(20000);

            await provider.send('hardhat_reset', [
                {
                    forking: {
                        jsonRpcUrl,
                        blockNumber: 16447247,
                    },
                },
            ]);

            sor = setUp(networkId, provider);
            await sor.fetchPools();
        });
        context('Joins', () => {
            it('Join with many tokens', async () => {
                const amountsIn = [
                    parseFixed('0.0123', 6),
                    parseFixed('0.0456', 6),
                ];

                const pools = await subgraphPoolDataService.getPools();
                const pool = MetaStablePool.fromPool(pools[0]);
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                const deltas = await queryJoin(
                    networkId,
                    testPool.id,
                    testPool.tokensList,
                    amountsIn.map((a) => a.toString())
                );
                console.log('bptOut       ', formatFixed(bptOut, 18));
                console.log('delta bptOut ', formatFixed(deltas.bptOut, 18));
                // TODO: check if it's ok to have a small difference - diff comes from divDown not matching between TS and SC math
                expect(bptOut.sub(deltas.bptOut).toNumber()).to.closeTo(0, 1);
                expect(deltas.amountsIn.toString()).to.eq(amountsIn.toString());
            });
            it('Join with single token', async () => {
                const amountsIn = [parseFixed('0', 6), parseFixed('0.0789', 6)];
                const pools = await subgraphPoolDataService.getPools();
                const pool = MetaStablePool.fromPool(pools[0]);
                const bptOut = pool._calcBptOutGivenExactTokensIn(amountsIn);

                const deltas = await queryJoin(
                    networkId,
                    testPool.id,
                    testPool.tokensList,
                    amountsIn.map((a) => a.toString())
                );
                console.log('bptOut       ', formatFixed(bptOut, 18));
                console.log('delta bptOut ', formatFixed(deltas.bptOut, 18));
                // TODO: check if it's ok to have a small difference - diff comes from divDown not matching between TS and SC math
                expect(bptOut.sub(deltas.bptOut).toNumber()).to.closeTo(0, 1);
                expect(deltas.amountsIn.toString()).to.eq(amountsIn.toString());
            });
        });
    });
    context('test exits vs queryExit', () => {
        // Setup chain
        before(async function () {
            this.timeout(20000);

            await provider.send('hardhat_reset', [
                {
                    forking: {
                        jsonRpcUrl,
                        blockNumber: 16447247,
                    },
                },
            ]);

            sor = setUp(networkId, provider);
            await sor.fetchPools();
        });
        context('Exits', () => {
            // TODO: pending single token out implementation on metaStable pool
            // it('BPT>token', async () => {
            //     const tokenIndex = 0; // usdc
            //     const bptInHuman = '0.123';
            //     const bptInEvm = parseFixed(bptInHuman, 18);
            //     const pools = await subgraphPoolDataService.getPools();
            //     const pool = MetaStablePool.fromPool(pools[0]);
            //     const pairData = pool.parsePoolPairData(
            //         testPool.address,
            //         pool.tokensList[tokenIndex]
            //     );
            //     const amountOutHuman = pool._exactTokenInForTokenOut(
            //         pairData,
            //         bnum(bptInHuman)
            //     );
            //     const amountOutEvm = parseFixed(
            //         amountOutHuman.toString(),
            //         pairData.decimalsOut
            //     );

            //     const deltas = await querySingleTokenExit(
            //         networkId,
            //         testPool.id,
            //         testPool.tokensList,
            //         bptInEvm.toString(),
            //         tokenIndex
            //     );
            //     expect(deltas.bptIn.toString()).to.eq(bptInEvm.toString());
            //     deltas.amountsOut.forEach((a, i) => {
            //         if (i === tokenIndex)
            //             expect(a.toString()).to.eq(amountOutEvm.toString());
            //         else expect(a.toString()).to.eq('0');
            //     });
            // });
            it('BPT>tokens', async () => {
                const bptIn = parseFixed('0.0123', 18);
                const pools = await subgraphPoolDataService.getPools();
                const pool = MetaStablePool.fromPool(pools[0]);
                const amountOut = pool._calcTokensOutGivenExactBptIn(bptIn);
                const deltas = await queryExit(
                    networkId,
                    testPool.id,
                    testPool.tokensList,
                    bptIn.toString()
                );
                console.log('amountOut       ', amountOut.toString());
                console.log('delta amountOut ', deltas.amountsOut.toString());
                expect(deltas.bptIn.toString()).to.eq(bptIn.toString());
                deltas.amountsOut.forEach((a, i) => {
                    expect(a.toString()).to.eq(amountOut[i].toString());
                });
            });
        });
    });
});
