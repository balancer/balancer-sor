import { JsonRpcProvider } from '@ethersproject/providers';
import { MULTIADDR, Network, SOR_CONFIG, vaultAddr } from './constants';
import { SOR, SubgraphPoolBase, SwapTypes, TokenPriceService } from '../../src';
import { OnChainPoolDataService } from '../lib/onchainData';
import filteredPools from '../testData/filteredPools.json'
import _ from 'lodash';

const network = Network.MAINNET;
const rpcUrl = 'https://rpc.ankr.com/eth';
const provider = new JsonRpcProvider(rpcUrl, network);
const pools = [];

const tokenIn = '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56';
const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

export async function getBestSwaps(): Promise<void> {
    const onChainPoolDataService = new OnChainPoolDataService({
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[network],
        provider,
        pools,
    });
    class MockTokenPriceService implements TokenPriceService {
        constructor(private readonly chainId: number) { }
        async getNativeAssetPriceInToken(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            tokenAddress: string
        ): Promise<string> {
            return '1';
        }
    }
    const mockTokenPriceService = new MockTokenPriceService(network);

    const sor = new SOR(
        provider,
        SOR_CONFIG[network],
        onChainPoolDataService,
        mockTokenPriceService
    );

    const swapInfo = await sor.getSwapsWithFilteredPoolsInput(
        tokenIn,
        tokenOut,
        SwapTypes.SwapExactIn,
        BigInt(14e18),
        filteredPools.map((obj) =>
            _.omitBy(obj, _.isNull)
        ) as SubgraphPoolBase[],
        undefined,
        false
    );
    console.log(swapInfo.returnAmount.toString());

}

getBestSwaps();
