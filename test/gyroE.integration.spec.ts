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
    id: '0x9e8a4e666206db7a7b40ce3f1adaba538f01d2cc00020000000000000000020b',
    address: '0x9e8a4e666206db7a7b40ce3f1adaba538f01d2cc',
    poolType: 'GyroCEMM',
    swapFee: '0.09',
    totalShares: '0.000590716337544254',
    tokens: [
        {
            address: '0x0a93a1dc80ce44618bbe75f941f8baadcbf495df',
            balance: '100',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0xdaba5b4979aea49c95fe7c829accfdd47d290797',
            balance: '100',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
    ],
    tokensList: [
        '0x0a93a1dc80ce44618bbe75f941f8baadcbf495df',
        '0xdaba5b4979aea49c95fe7c829accfdd47d290797',
    ],
    totalWeight: '0',
    swapEnabled: true,
    wrappedIndex: 0,
    mainIndex: 0,
    alpha: '0.05000000000002029',
    beta: '0.397316269897841178',
    c: '0.9551573261744535',
    s: '0.29609877111408056',
    lambda: '748956.475',
    tauAlphaX: '-0.9999999999864021682732182209025086',
    tauAlphaY: '0.00000521494821273352387635736307999088',
    tauBetaX: '0.9999999998525122532122146329641983',
    tauBetaY: '0.00001717485123551095031292618834391386',
    u: '0.5656418209561750212254168960022311',
    v: '0.00000626352651807875756896296543790835',
    w: '0.0000033825106624039795790200375365235',
    z: '0.8246510353560980328453878643898328',
    dSq: '1.000000000000000021408113917832164',
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
        const tokenIn = '0x0a93a1dc80ce44618bbe75f941f8baadcbf495df';
        const tokenOut = '0xdaba5b4979aea49c95fe7c829accfdd47d290797';
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
                        blockNumber: 7922862,
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
