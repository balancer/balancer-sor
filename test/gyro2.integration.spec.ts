// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/gyro2.integration.spec.ts

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
 * Testing on KOVAN
 * - Update hardhat.config.js with chainId = 42
 * - Update ALCHEMY_URL on .env with a kovan api key
 * - Run kovan node on terminal: yarn run node
 * TO DO - Change this test to mainnet once deployed.
 */

/*
const { ALCHEMY_URL: jsonRpcUrl } = process.env;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, 42);
const vault = Vault__factory.connect(vaultAddr, provider);

const gyro2Pool: SubgraphPoolBase = {
    id: '0xd9e058f39c11313103229bd481a8453bddd20d81000200000000000000000999',
    address: '0xd9e058f39c11313103229bd481a8453bddd20d81',
    poolType: 'Gyro2',
    swapFee: '0.09',
    totalShares: '20950.113635776677649258',
    tokens: [
        {
            address: '0x2b7c320d7b915d9d10aeb2f93f94720d4f3fff91',
            balance: '1000',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0x6a7ddccff3141a337f8819fa9d0922e33c405d6f',
            balance: '1000',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
    ],
    tokensList: [
        '0x2b7c320d7b915d9d10aeb2f93f94720d4f3fff91',
        '0x6a7ddccff3141a337f8819fa9d0922e33c405d6f',
    ],
    totalWeight: '0',
    swapEnabled: true,
    wrappedIndex: 0,
    mainIndex: 0,
    sqrtAlpha: '0.9',
    sqrtBeta: '1.1',
};

// Setup SOR with data services
function setUp(networkId: Network, provider: JsonRpcProvider): SOR {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const subgraphPoolDataService = new OnChainPoolDataService({
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        pools: [gyro2Pool],
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

describe('gyro2 integration tests', () => {
    context('test swaps vs queryBatchSwap', () => {
        const tokenIn = '0x2b7c320d7b915d9d10aeb2f93f94720d4f3fff91';
        const tokenOut = '0x6a7ddccff3141a337f8819fa9d0922e33c405d6f';
        const swapAmount = parseFixed('17.789', 18);
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
                        blockNumber: 32941193,
                    },
                },
            ]);

            const networkId = Network.KOVAN;
            sor = setUp(networkId, provider);
            await sor.fetchPools();
        });

        it('ExactIn', async () => {
            const swapType = SwapTypes.SwapExactIn;

            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmount
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
                swapAmount
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
