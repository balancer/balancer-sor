// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/xaveFxPool.integration.spec.ts

/*
 * Testing on Polygon
 * - Update hardhat.config.js with chainId = 137
 * - Update ALCHEMY_URL on .env with a polygon api key
 * - Run polygon node on terminal: yarn run node
 */

/*

const { ALCHEMY_URL: jsonRpcUrl } = process.env;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, 137);
const vault = new Contract(vaultAddr, vaultArtifact, provider);
const xaveFxPool: SubgraphPoolBase = {
    id: '0x726e324c29a1e49309672b244bdc4ff62a270407000200000000000000000702',
    address: '0x726e324c29a1e49309672b244bdc4ff62a270407',
    swapFee: '0',
    poolType: 'FX',
    totalShares: '1187294',
    swapEnabled: true,
    tokens: [
        {
            address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            balance: '731837',
            decimals: 6,
            priceRate: '1',
            weight: null,
            fxRate: '100000000',
        },
        {
            address: '0xDC3326e71D45186F113a2F448984CA0e8D201995',
            balance: '639986',
            decimals: 6,
            priceRate: '1',
            weight: null,
            fxRate: '74376600',
        },
    ],
    tokensList: [
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        '0xdc3326e71d45186f113a2f448984ca0e8d201995',
    ],
    alpha: '0.8',
    beta: '0.48',
    lambda: '0.3',
    delta: '0.2734375',
    epsilon: '0.0005',
};

// Setup SOR with data services
function setUp(networkId: Network, provider: JsonRpcProvider): SOR {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const subgraphPoolDataService = new OnChainPoolDataService({
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        pools: [xaveFxPool],
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
describe('xaveFxPool integration tests', () => {
    context('test swaps vs queryBatchSwap', () => {
        const tokenIn = ADDRESSES[Network.POLYGON].USDC.address;
        const tokenOut = ADDRESSES[Network.POLYGON].XSGD.address;
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
                        blockNumber: 38546978,
                    },
                },
            ]);
            const networkId = Network.POLYGON;
            sor = setUp(networkId, provider);
            await sor.fetchPools();
        });
        it('ExactIn', async () => {
            const swapType = SwapTypes.SwapExactIn;
            const swapAmount = parseFixed('100', 6);

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
            const swapAmount = parseFixed('100000', 6);
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
