// yarn test:only test/PhantomStable.integration.spec.ts
import dotenv from 'dotenv';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Vault__factory } from '@balancer-labs/typechain';
import { vaultAddr } from './testScripts/constants';
import { SubgraphPoolBase, SwapTypes, SOR } from '../src';
import {
    Network,
    MULTIADDR,
    SOR_CONFIG,
    ADDRESSES,
} from './testScripts/constants';
import { OnChainPoolDataService } from './lib/onchainData';
import { TokenPriceService } from '../src';
import { AddressZero } from '@ethersproject/constants';
import { parseFixed } from '@ethersproject/bignumber';
import { expect } from 'chai';
import { closeTo } from './lib/testHelpers';

dotenv.config();

let sor: SOR;
const networkId = Network.MAINNET;
const { ALCHEMY_URL: jsonRpcUrl } = process.env;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, networkId);
const vault = Vault__factory.connect(vaultAddr, provider);
const bbausdt = ADDRESSES[networkId].bbausdcOld.address;
const bbadai = ADDRESSES[networkId].bbadaiOld.address;
const bpt = ADDRESSES[networkId].bbausdOld.address;
const funds = {
    sender: AddressZero,
    recipient: AddressZero,
    fromInternalBalance: false,
    toInternalBalance: false,
};

// bbausd (first interation with PhantomStable)
const testPool: SubgraphPoolBase = {
    id: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
    address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
    poolType: 'StablePhantom',
    swapFee: '0.00001',
    swapEnabled: true,
    totalShares: '3102931.002983334165119968',
    tokens: [
        {
            address: '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
            balance: '961289.310891979395980804',
            decimals: 18,
            weight: null,
            priceRate: '1.017031850267034026',
        },
        {
            address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
            balance: '5192296855431896.625547162164100127',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
            balance: '1083156.226776690537941682',
            decimals: 18,
            weight: null,
            priceRate: '1.011887483271879349',
        },
        {
            address: '0x9210f1204b5a24742eba12f710636d76240df3d0',
            balance: '1075631.693123588669606737',
            decimals: 18,
            weight: null,
            priceRate: '1.010970263031733395',
        },
    ],
    tokensList: [
        '0x2bbf681cc4eb09218bee85ea2a5d3d13fa40fc0c',
        '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
        '0x804cdb9116a10bb78768d3252355a1b18067bf8f',
        '0x9210f1204b5a24742eba12f710636d76240df3d0',
    ],
    amp: '1472',
};

// Setup SOR with data services
function setUp(networkId: Network, provider: JsonRpcProvider): SOR {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const subgraphPoolDataService = new OnChainPoolDataService({
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
describe('PhantomStable', () => {
    context('test swaps vs queryBatchSwap', () => {
        // Setup chain
        before(async function () {
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

        context('ExactIn', () => {
            it('token>token', async () => {
                const swapType = SwapTypes.SwapExactIn;

                const swapInfo = await sor.getSwaps(
                    bbausdt,
                    bbadai,
                    swapType,
                    parseFixed('2301.456', 18)
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
                closeTo(queryResult[1].abs(), swapInfo.returnAmount, 1);
            });
            it('token>bpt', async () => {
                const swapType = SwapTypes.SwapExactIn;

                const swapInfo = await sor.getSwaps(
                    bbausdt,
                    bpt,
                    swapType,
                    parseFixed('2301.456', 18)
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
            });
            it('bpt>token', async () => {
                const swapType = SwapTypes.SwapExactIn;

                const swapInfo = await sor.getSwaps(
                    bpt,
                    bbausdt,
                    swapType,
                    parseFixed('2301.456', 18)
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
                closeTo(queryResult[1].abs(), swapInfo.returnAmount, 1);
            });
        });

        context('ExactOut', () => {
            const swapType = SwapTypes.SwapExactOut;

            it('token>token', async () => {
                const swapInfo = await sor.getSwaps(
                    bbadai,
                    bbausdt,
                    swapType,
                    parseFixed('0.1', 18)
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
                closeTo(queryResult[0].abs(), swapInfo.returnAmount, 2);
            });
            it('token>bpt', async () => {
                const swapInfo = await sor.getSwaps(
                    bbadai,
                    bpt,
                    swapType,
                    parseFixed('1234.5678', 18)
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
                closeTo(queryResult[0].abs(), swapInfo.returnAmount, 2);
            });
            it('bpt>token', async () => {
                const swapInfo = await sor.getSwaps(
                    bpt,
                    bbadai,
                    swapType,
                    parseFixed('987.2345', 18)
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
                expect(queryResult[0].toString()).to.eq(
                    swapInfo.returnAmount.toString()
                );
            });
        });
    });
});
