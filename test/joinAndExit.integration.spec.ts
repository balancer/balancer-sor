// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/joinAndExit.integration.spec.ts
import dotenv from 'dotenv';
import { Contract } from '@ethersproject/contracts';
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
import {
    Network,
    MULTIADDR,
    SOR_CONFIG,
    SUBGRAPH_URLS,
    ADDRESSES,
} from './testScripts/constants';
import { OnChainPoolDataService } from './lib/onchainData';
import { SubgraphPoolDataServiceWithFilter } from './lib/subgraphPoolDataService';
import { someJoinExit } from './joinAndExit/joinAndExit';

import relayerV4Abi from './abi/RelayerV4.json';

dotenv.config();

const { ALCHEMY_URL: jsonRpcUrl } = process.env;
const rpcUrl = 'http://127.0.0.1:8545';
const provider = new JsonRpcProvider(rpcUrl, 1);
const vault = Vault__factory.connect(vaultAddr, provider);
// mainnet V4
const relayerAddress = '0x2536dfeeCB7A0397CF98eDaDA8486254533b1aFA';
const relayerContract = new Contract(relayerAddress, relayerV4Abi, provider);

// Setup SOR with data services
function setUp(networkId: Network, provider: JsonRpcProvider): SOR {
    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const poolDataService = new SubgraphPoolDataServiceWithFilter({
        chainId: networkId,
        multiAddress: MULTIADDR[networkId],
        vaultAddress: vaultAddr,
        subgraphUrl: SUBGRAPH_URLS[networkId],
        provider,
        onchain: true,
        poolIds: [
            '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
        ],
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
        poolDataService,
        coingeckoTokenPriceService
    );
}

let sor: SOR;
const bal = ADDRESSES[Network.MAINNET].BAL.address;
const weth = ADDRESSES[Network.MAINNET].WETH.address;
const balBpt = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56';

describe('join and exit integration tests', () => {
    context('test swaps vs queryBatchSwap', () => {
        const tokenIn = balBpt;
        const tokenOut = weth;
        const swapAmount = parseFixed('7', 18);
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
                        blockNumber: 15624161,
                    },
                },
            ]);

            const networkId = Network.MAINNET;
            sor = setUp(networkId, provider);
            await sor.fetchPools();
        });

        it('ExactIn', async () => {
            const swapType = SwapTypes.SwapExactIn;
            const swapInfo = await sor.getSwaps(
                tokenIn,
                tokenOut,
                swapType,
                swapAmount,
                undefined,
                true
            );
            expect(someJoinExit(swapInfo.swaps, swapInfo.tokenAddresses)).to.be
                .true;

            // const tx = await relayerContract.multicall([]);
            // const response = await signer.sendTransaction({
            //     to: query.to,
            //     data: query.callData,
            //     gasLimit,
            // });

            // const receipt = await response.wait();
            // console.log('Gas used', receipt.gasUsed.toString());

            // const queryResult = await vault.callStatic.queryBatchSwap(
            //     swapType,
            //     swapInfo.swaps,
            //     swapInfo.tokenAddresses,
            //     funds
            // );
        }).timeout(10000000);
    });
});
