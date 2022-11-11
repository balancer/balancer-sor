// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/gyroE.integration.spec.ts

import dotenv from 'dotenv';
import { parseFixed } from '@ethersproject/bignumber';
import { AddressZero } from '@ethersproject/constants';
import { expect } from 'chai';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Vault__factory } from '@balancer-labs/typechain';
import { vaultAddr } from './lib/constants';
import {
    SOR,
    SubgraphPoolBase,
    SwapTypes,
    TokenPriceService,
} from '../src/index';
import { Network, MULTIADDR, SOR_CONFIG } from './testScripts/constants';
import { OnChainPoolDataService } from './lib/onchainData';

dotenv.config();

/*
 * Testing on GOERLI
 * - Update hardhat.config.js with chainId = 5
 * - Update ALCHEMY_URL on .env with a goerli api key
 * - Run goerli node on terminal: yarn run node
 * TO DO - Change this test to mainnet once deployed.
 */

/*
const { ALCHEMY_URL: jsonRpcUrl } = process.env;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, 5);
const vault = Vault__factory.connect(vaultAddr, provider);

const gyroEPool: SubgraphPoolBase = {
    id: '0xe0711573a96806182c01ef6c349948edc6635b040002000000000000000002ab',
    address: '0xe0711573a96806182c01ef6c349948edc6635b04',
    poolType: 'GyroE',
    swapFee: '0.0002',
    totalShares: '0.001132693078136504',
    tokens: [
        {
            address: '0x2a7fa61d84db003a999bf4623942f235bff659a8',
            balance: '1',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0x4ac0909d762f20dfee3efc6a5ce1029c78812648',
            balance: '1',
            decimals: 6,
            weight: null,
            priceRate: '1',
        },
    ],
    tokensList: [
        '0x2a7fa61d84db003a999bf4623942f235bff659a8',
        '0x4ac0909d762f20dfee3efc6a5ce1029c78812648',
    ],
    totalWeight: '0',
    swapEnabled: true,
    wrappedIndex: 0,
    mainIndex: 0,
    alpha: '0.98',
    beta: '1.020408163265306122',
    c: '0.707106781186547524',
    s: '0.707106781186547524',
    lambda: '2500',
    tauAlphaX: '-0.9992168409687262363026689301701759',
    tauAlphaY: '0.03956898690236155895758568963473897',
    tauBetaX: '0.9992168409687262362685980644343916',
    tauBetaY: '0.03956898690236155981796108700303143',
    u: '0.9992168409687262351527623443756247',
    v: '0.0395689869023615593429116906629895',
    w: '0.0000000000000000004301876986841462313',
    z: '-0.00000000000000000001703543286789219094',
    dSq: '0.9999999999999999988662409334210612',
};

// Setup SOR with data services
function setUp(networkId: Network, provider: JsonRpcProvider): SOR {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const subgraphPoolDataService = new OnChainPoolDataService({
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        pools: [gyroEPool],
    });

    class CoingeckoTokenPriceService implements TokenPriceService {
        constructor(private readonly chainId: number) {}
        async getNativeAssetPriceInToken(
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

let sor: SOR;

describe('gyroE integration tests', () => {
    context('test swaps vs queryBatchSwap', () => {
        const tokenIn = '0x2a7fa61d84db003a999bf4623942f235bff659a8';
        const tokenOut = '0x4ac0909d762f20dfee3efc6a5ce1029c78812648';
        const funds = {
            sender: AddressZero,
            recipient: AddressZero,
            fromInternalBalance: false,
            toInternalBalance: false,
        };
        // Setup chain
        before(async function () {
            this.timeout(20000);

            await provider.send('hardhat_reset', [
                {
                    forking: {
                        jsonRpcUrl,
                        blockNumber: 7934310,
                    },
                },
            ]);

            const networkId = Network.GOERLI;
            sor = setUp(networkId, provider);
            await sor.fetchPools();
        });

        it('ExactIn', async () => {
            const swapType = SwapTypes.SwapExactIn;

            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                parseFixed('0.1', 18)
            );

            const queryResult = await vault.callStatic.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                funds
            );
            expect(queryResult[0].toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.returnAmount.toString()
            );
        }).timeout(10000);

        it('ExactOut', async () => {
            const swapType = SwapTypes.SwapExactOut;

            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                parseFixed('0.1', 6)
            );

            const queryResult = await vault.callStatic.queryBatchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                funds
            );
            // Amount out should be exact
            expect(queryResult[1].abs().toString()).to.eq(
                swapInfo.swapAmount.toString()
            );
            const deltaIn = queryResult[0].sub(swapInfo.returnAmount);
            expect(deltaIn.toNumber()).to.be.lessThan(2);
        }).timeout(10000);
    });
});
*/
