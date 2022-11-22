// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/gyro3.integration.spec.ts
import dotenv from 'dotenv';

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

const gyro3Pool: SubgraphPoolBase = {
    id: '0x24eabc806e3e9b63f41114d1e323a8aa08472ca7000100000000000000000891',
    address: '0x24eabc806e3e9b63f41114d1e323a8aa08472ca7',
    poolType: 'Gyro3',
    swapFee: '0.09',
    totalShares: '6583.623489368247136191',
    tokens: [
        {
            address: '0x11fb9071e69628d804bf0b197cc61eeacd4aaecf',
            balance: '9.999481158411540472',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0x4ea2110a3e277b10c9b098f61d72f58efa8655db',
            balance: '9.997571529493261602',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
        {
            address: '0x5663082e6d6addf940a38ea312b899a5ec86c2dc',
            balance: '9.99848131028051242',
            decimals: 18,
            weight: null,
            priceRate: '1',
        },
    ],
    tokensList: [
        '0x11fb9071e69628d804bf0b197cc61eeacd4aaecf',
        '0x4ea2110a3e277b10c9b098f61d72f58efa8655db',
        '0x5663082e6d6addf940a38ea312b899a5ec86c2dc',
    ],
    totalWeight: '0',
    swapEnabled: true,
    wrappedIndex: 0,
    mainIndex: 0,
    root3Alpha: '0.000099997499906244',
};

// Setup SOR with data services
function setUp(networkId: Network, provider: JsonRpcProvider): SOR {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const subgraphPoolDataService = new OnChainPoolDataService({
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        pools: [gyro3Pool],
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

describe('gyro3 integration tests', () => {
    context('test swaps vs queryBatchSwap', () => {
        const tokenIn = '0x11fb9071e69628d804bf0b197cc61eeacd4aaecf';
        const tokenOut = '0x4ea2110a3e277b10c9b098f61d72f58efa8655db';
        const swapAmount = parseFixed('1.7', 18);
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
                        blockNumber: 32937471,
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
