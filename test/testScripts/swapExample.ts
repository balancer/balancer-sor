// Example showing SOR with Vault batchSwap and Subgraph pool data, run using: $ TS_NODE_PROJECT='tsconfig.testing.json' ts-node ./test/testScripts/swapExample.ts

require('dotenv').config();
import {
    BigNumber,
    BigNumberish,
    formatFixed,
    parseFixed,
} from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { AddressZero, MaxUint256 } from '@ethersproject/constants';
import {
    PoolDataService,
    SOR,
    SorConfig,
    SwapInfo,
    SwapTypes,
    TokenPriceService,
} from '../../src';
import vaultArtifact from '../../src/abi/Vault.json';
import relayerAbi from '../abi/BatchRelayer.json';
import erc20abi from '../abi/ERC20.json';
import { CoingeckoTokenPriceService } from '../lib/coingeckoTokenPriceService';
import { SubgraphPoolDataService } from '../lib/subgraphPoolDataService';
import { mockPoolDataService } from '../lib/mockPoolDataService';

export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
    ARBITRUM = 42161,
}

export const SOR_CONFIG: Record<Network, SorConfig> = {
    [Network.MAINNET]: {
        chainId: Network.MAINNET, //1
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        staBal3Pool: {
            id: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb20000000000000000000000fe',
            address: '0x7b50775383d3d6f0215a8f290f2c9e2eebbeceb2',
        },
    },
    [Network.KOVAN]: {
        chainId: Network.KOVAN, //42
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
        staBal3Pool: {
            id: '0x8fd162f338b770f7e879030830cde9173367f3010000000000000000000004d8',
            address: '0x8fd162f338b770f7e879030830cde9173367f301',
        },
        wethStaBal3: {
            id: '0x6be79a54f119dbf9e8ebd9ded8c5bd49205bc62d00020000000000000000033c',
            address: '0x6be79a54f119dbf9e8ebd9ded8c5bd49205bc62d',
        },
    },
    [Network.GOERLI]: {
        chainId: Network.GOERLI, //5
        vault: '0x65748E8287Ce4B9E6D83EE853431958851550311',
        weth: '0x9A1000D492d40bfccbc03f413A48F5B6516Ec0Fd',
    },
    [Network.POLYGON]: {
        chainId: Network.POLYGON, //137
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    },
    [Network.ARBITRUM]: {
        chainId: Network.ARBITRUM, //42161
        vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
        weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    },
};

export const PROVIDER_URLS = {
    [Network.MAINNET]: `https://mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.GOERLI]: `https://goerli.infura.io/v3/${process.env.INFURA}`,
    [Network.KOVAN]: `https://kovan.infura.io/v3/${process.env.INFURA}`,
    [Network.POLYGON]: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.ARBITRUM]: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA}`,
};

export const MULTIADDR: { [chainId: number]: string } = {
    1: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
    3: '0x53c43764255c17bd724f74c4ef150724ac50a3ed',
    4: '0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821',
    5: '0x3b2A02F22fCbc872AF77674ceD303eb269a46ce3',
    42: '0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A',
    137: '0xa1B2b503959aedD81512C37e9dce48164ec6a94d',
    42161: '0x269ff446d9892c9e19082564df3f5e8741e190a1',
    99: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
};

export const SUBGRAPH_URLS = {
    [Network.MAINNET]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
    [Network.GOERLI]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-goerli-v2',
    [Network.KOVAN]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-kovan-v2',
    [Network.POLYGON]:
        'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-polygon-v2',
    [Network.ARBITRUM]: `https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-arbitrum-v2`,
};

export const ADDRESSES = {
    [Network.MAINNET]: {
        BatchRelayer: {
            address: '0xdcdbf71A870cc60C6F9B621E28a7D3Ffd6Dd4965',
        },
        ETH: {
            address: AddressZero,
            decimals: 18,
            symbol: 'ETH',
        },
        BAL: {
            address: '0xba100000625a3754423978a60c9317c58a424e3d',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
            symbol: 'USDC',
        },
        WBTC: {
            address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            decimals: 8,
            symbol: 'WBTC',
        },
        WETH: {
            address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            decimals: 18,
            symbol: 'WETH',
        },
        DAI: {
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            decimals: 18,
            symbol: 'DAI',
        },
        STETH: {
            address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
            decimals: 18,
            symbol: 'STETH',
        },
        wSTETH: {
            address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
            decimals: 18,
            symbol: 'wSTETH',
        },
    },
    [Network.KOVAN]: {
        // Visit https://balancer-faucet.on.fleek.co/#/faucet for test tokens
        BatchRelayer: {
            address: '0x41B953164995c11C81DA73D212ED8Af25741b7Ac',
        },
        ETH: {
            address: AddressZero,
            decimals: 18,
            symbol: 'ETH',
        },
        BAL: {
            address: '0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xc2569dd7d0fd715B054fBf16E75B001E5c0C1115',
            decimals: 6,
            symbol: 'USDC',
        },
        WBTC: {
            address: '0x1C8E3Bcb3378a443CC591f154c5CE0EBb4dA9648',
            decimals: 8,
            symbol: 'WBTC',
        },
        WETH: {
            address: '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1',
            decimals: 18,
            symbol: 'WETH',
        },
        DAI: {
            address: '0x04DF6e4121c27713ED22341E7c7Df330F56f289B',
            decimals: 18,
            symbol: 'DAI',
        },
        STETH: {
            address: '0x4803bb90d18a1cb7a2187344fe4feb0e07878d05',
            decimals: 18,
            symbol: 'STETH',
        },
        wSTETH: {
            address: '0xa387b91e393cfb9356a460370842bc8dbb2f29af',
            decimals: 18,
            symbol: 'wSTETH',
        },
        USDT_from_AAVE: {
            address: '0x13512979ade267ab5100878e2e0f485b568328a4',
            decimals: 6,
            symbol: 'USDT_from_AAVE',
        },
        aUSDT: {
            address: '0xe8191aacfcdb32260cda25830dc6c9342142f310',
            decimals: 6,
            symbol: 'aUSDT',
        },
        bUSDT: {
            address: '0xe667d48618e71c2a02e4a1b66ed9def1426938b6',
            decimals: 18,
            symbol: 'bUSDT',
        },
        USDC_from_AAVE: {
            address: '0xe22da380ee6b445bb8273c81944adeb6e8450422',
            decimals: 6,
            symbol: 'USDC_from_AAVE',
        },
        aUSDC: {
            address: '0x0fbddc06a4720408a2f5eb78e62bc31ac6e2a3c4',
            decimals: 6,
            symbol: 'aUSDC',
        },
        DAI_from_AAVE: {
            address: '0xff795577d9ac8bd7d90ee22b6c1703490b6512fd',
            decimals: 18,
            symbol: 'DAI_from_AAVE',
        },
        bDAI: {
            address: '0xfcccb77a946b6a3bd59d149f083b5bfbb8004d6d',
            decimals: 18,
            symbol: 'bDAI',
        },
        STABAL3: {
            address: '0x8fd162f338b770f7e879030830cde9173367f301',
            decimals: 18,
            symbol: 'STABAL3',
        },
    },
    [Network.POLYGON]: {
        MATIC: {
            address: AddressZero,
            decimals: 18,
            symbol: 'MATIC',
        },
        BAL: {
            address: '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            decimals: 6,
            symbol: 'USDC',
        },
        WBTC: {
            address: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
            decimals: 8,
            symbol: 'WBTC',
        },
        WETH: {
            address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
            decimals: 18,
            symbol: 'WETH',
        },
        DAI: {
            address: '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063',
            decimals: 18,
            symbol: 'DAI',
        },
    },
    [Network.ARBITRUM]: {
        WETH: {
            address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            decimals: 18,
            symbol: 'WETH',
        },
        BAL: {
            address: '0x040d1edc9569d4bab2d15287dc5a4f10f56a56b8',
            decimals: 18,
            symbol: 'BAL',
        },
        USDC: {
            address: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
            decimals: 6,
            symbol: 'USDC',
        },
        STETH: {
            address: 'N/A',
            decimals: 18,
            symbol: 'STETH',
        },
    },
};

// This is the same across networks
const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

async function getSwap(
    provider: JsonRpcProvider,
    config: SorConfig,
    poolDataService: PoolDataService,
    tokenPriceService: TokenPriceService,
    tokenIn: { symbol: string; address: string; decimals: number },
    tokenOut: { symbol: string; address: string; decimals: number },
    swapType: SwapTypes,
    swapAmount: BigNumberish
): Promise<SwapInfo> {
    const sor = new SOR(provider, config, poolDataService, tokenPriceService);

    await sor.fetchPools();

    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    const gasPrice = BigNumber.from('40000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxPools = 4;

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Note - tokenOut for SwapExactIn, tokenIn for SwapExactOut
    const outputToken =
        swapType === SwapTypes.SwapExactOut ? tokenIn : tokenOut;
    const cost = await sor.getCostOfSwapInToken(
        outputToken.address,
        outputToken.decimals,
        gasPrice,
        BigNumber.from('35000')
    );
    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn.address,
        tokenOut.address,
        swapType,
        swapAmount,
        { gasPrice, maxPools }
    );

    const amtInScaled =
        swapType === SwapTypes.SwapExactIn
            ? formatFixed(swapAmount, tokenIn.decimals)
            : formatFixed(swapInfo.returnAmount, tokenIn.decimals);
    const amtOutScaled =
        swapType === SwapTypes.SwapExactIn
            ? formatFixed(swapInfo.returnAmount, tokenOut.decimals)
            : formatFixed(swapAmount, tokenOut.decimals);

    const returnDecimals =
        swapType === SwapTypes.SwapExactIn
            ? tokenOut.decimals
            : tokenIn.decimals;

    const returnWithFeesScaled = formatFixed(
        swapInfo.returnAmountConsideringFees,
        returnDecimals
    );

    const costToSwapScaled = formatFixed(cost, returnDecimals);

    const swapTypeStr =
        swapType === SwapTypes.SwapExactIn ? 'SwapExactIn' : 'SwapExactOut';
    console.log(swapTypeStr);
    console.log(`Token In: ${tokenIn.symbol}, Amt: ${amtInScaled.toString()}`);
    console.log(
        `Token Out: ${tokenOut.symbol}, Amt: ${amtOutScaled.toString()}`
    );
    console.log(`Cost to swap: ${costToSwapScaled.toString()}`);
    console.log(`Return Considering Fees: ${returnWithFeesScaled.toString()}`);
    console.log(`Swaps:`);
    console.log(swapInfo.swaps);
    console.log(swapInfo.tokenAddresses);

    return swapInfo;
}

async function makeTrade(
    provider: JsonRpcProvider,
    swapInfo: SwapInfo,
    swapType: SwapTypes
) {
    if (!swapInfo.returnAmount.gt(0)) {
        console.log(`Return Amount is 0. No swaps to exectute.`);
        return;
    }
    const key: any = process.env.TRADER_KEY;
    const wallet = new Wallet(key, provider);

    // if (swapInfo.tokenIn !== AddressZero) {
    //     // Vault needs approval for swapping non ETH
    //     console.log('Checking vault allowance...');
    //     const tokenInContract = new Contract(
    //         swapInfo.tokenIn,
    //         erc20abi,
    //         provider
    //     );

    //     let allowance = await tokenInContract.allowance(
    //         wallet.address,
    //         vaultAddr
    //     );

    //     if (allowance.lt(swapInfo.swapAmount)) {
    //         console.log(
    //             `Not Enough Allowance: ${allowance.toString()}. Approving vault now...`
    //         );
    //         const txApprove = await tokenInContract
    //             .connect(wallet)
    //             .approve(vaultAddr, MaxUint256);
    //         await txApprove.wait();
    //         console.log(`Allowance updated: ${txApprove.hash}`);
    //         allowance = await tokenInContract.allowance(
    //             wallet.address,
    //             vaultAddr
    //         );
    //     }

    //     console.log(`Allowance: ${allowance.toString()}`);
    // }

    const vaultContract = new Contract(vaultAddr, vaultArtifact, provider);
    vaultContract.connect(wallet);

    type FundManagement = {
        sender: string;
        recipient: string;
        fromInternalBalance: boolean;
        toInternalBalance: boolean;
    };

    const funds: FundManagement = {
        sender: wallet.address,
        recipient: wallet.address,
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    const limits: string[] = getLimits(
        swapInfo.tokenIn,
        swapInfo.tokenOut,
        swapType,
        swapInfo.swapAmount,
        swapInfo.returnAmount,
        swapInfo.tokenAddresses
    );
    const deadline = MaxUint256;

    console.log(funds);
    console.log(swapInfo.tokenAddresses);
    console.log(limits);
    console.log('Swapping...');

    const overRides = {};
    // overRides['gasLimit'] = '200000';
    // overRides['gasPrice'] = '20000000000';
    // ETH in swaps must send ETH value
    if (swapInfo.tokenIn === AddressZero) {
        overRides['value'] = swapInfo.swapAmount.toString();
    }

    const deltas = await vaultContract.queryBatchSwap(
        swapType, // SwapType 0=SwapExactIn, 1=SwapExactOut
        swapInfo.swaps,
        swapInfo.tokenAddresses,
        funds
    );
    console.log(deltas.toString());

    // const tx = await vaultContract
    //     .connect(wallet)
    //     .batchSwap(
    //         swapType,
    //         swapInfo.swaps,
    //         swapInfo.tokenAddresses,
    //         funds,
    //         limits,
    //         deadline,
    //         overRides
    //     );

    // console.log(`tx: ${tx.hash}`);
}

function getLimits(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    swapAmount: BigNumber,
    returnAmount: BigNumber,
    tokenAddresses: string[]
): string[] {
    // Limits:
    // +ve means max to send
    // -ve mean min to receive
    // For a multihop the intermediate tokens should be 0
    // This is where slippage tolerance would be added
    const limits: string[] = [];
    const amountIn =
        swapType === SwapTypes.SwapExactIn ? swapAmount : returnAmount;
    const amountOut =
        swapType === SwapTypes.SwapExactIn ? returnAmount : swapAmount;

    tokenAddresses.forEach((token, i) => {
        if (token.toLowerCase() === tokenIn.toLowerCase())
            limits[i] = amountIn.toString();
        else if (token.toLowerCase() === tokenOut.toLowerCase()) {
            limits[i] = amountOut
                .mul('990000000000000000') // 0.99
                .div('1000000000000000000')
                .mul(-1)
                .toString()
                .split('.')[0];
        } else {
            limits[i] = '0';
        }
    });

    return limits;
}

async function makeRelayerTrade(
    provider: JsonRpcProvider,
    swapInfo: SwapInfo,
    swapType: SwapTypes,
    chainId: number
) {
    if (!swapInfo.returnAmount.gt(0)) {
        console.log(`Return Amount is 0. No swaps to exectute.`);
        return;
    }
    const key: any = process.env.TRADER_KEY;
    const wallet = new Wallet(key, provider);

    if (swapInfo.tokenIn !== AddressZero) {
        // Vault needs approval for swapping non ETH
        console.log('Checking vault allowance...');
        const tokenInContract = new Contract(
            swapInfo.tokenIn,
            erc20abi,
            provider
        );

        let allowance = await tokenInContract.allowance(
            wallet.address,
            vaultAddr
        );
        if (allowance.lt(swapInfo.swapAmount)) {
            console.log(
                `Not Enough Allowance: ${allowance.toString()}. Approving vault now...`
            );
            const txApprove = await tokenInContract
                .connect(wallet)
                .approve(vaultAddr, MaxUint256);
            await txApprove.wait();
            console.log(`Allowance updated: ${txApprove.hash}`);
            allowance = await tokenInContract.allowance(
                wallet.address,
                vaultAddr
            );
        }

        console.log(`Allowance: ${allowance.toString()}`);
    }

    const relayerContract = new Contract(
        ADDRESSES[chainId].BatchRelayer.address,
        relayerAbi,
        provider
    );
    relayerContract.connect(wallet);

    type FundManagement = {
        sender: string;
        recipient: string;
        fromInternalBalance: boolean;
        toInternalBalance: boolean;
    };

    const funds: FundManagement = {
        sender: wallet.address,
        recipient: wallet.address,
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    let tokenIn = swapInfo.tokenIn;
    let tokenOut = swapInfo.tokenOut;
    if (swapInfo.tokenIn === ADDRESSES[chainId].STETH.address) {
        tokenIn = ADDRESSES[chainId].wSTETH.address;
    }
    if (swapInfo.tokenOut === ADDRESSES[chainId].STETH.address) {
        tokenOut = ADDRESSES[chainId].wSTETH.address;
    }

    const limits: string[] = getLimits(
        swapInfo.tokenIn,
        swapInfo.tokenOut,
        swapType,
        swapInfo.swapAmount,
        swapInfo.returnAmount,
        swapInfo.tokenAddresses
    );

    const deadline = MaxUint256;

    console.log(funds);
    console.log(swapInfo.tokenAddresses);
    console.log(limits);

    console.log('Swapping...');

    const overRides = {};
    overRides['gasLimit'] = '450000';
    overRides['gasPrice'] = '20000000000';
    // ETH in swaps must send ETH value
    if (swapInfo.tokenIn === AddressZero) {
        overRides['value'] = swapInfo.swapAmountForSwaps?.toString();
    }

    if (swapInfo.swaps.length === 1) {
        console.log('SINGLE SWAP');
        const single = {
            poolId: swapInfo.swaps[0].poolId,
            kind: swapType,
            assetIn: swapInfo.tokenAddresses[swapInfo.swaps[0].assetInIndex],
            assetOut: swapInfo.tokenAddresses[swapInfo.swaps[0].assetOutIndex],
            amount: swapInfo.swaps[0].amount,
            userData: swapInfo.swaps[0].userData,
        };

        if (!swapInfo.returnAmountFromSwaps) return;

        let limit = swapInfo.returnAmountFromSwaps.mul(1.01).toString(); // Max In
        if (swapType === SwapTypes.SwapExactIn)
            limit = swapInfo.returnAmountFromSwaps.mul(0.99).toString(); // Min return

        const tx = await relayerContract
            .connect(wallet)
            .callStatic.swap(single, funds, limit, deadline, overRides);
        console.log(tx.toString());
        console.log(swapInfo.returnAmountFromSwaps.mul(1.01).toString());
    } else {
        const tx = await relayerContract
            .connect(wallet)
            .batchSwap(
                swapType,
                swapInfo.swaps,
                swapInfo.tokenAddresses,
                funds,
                limits,
                deadline,
                overRides
            );
        console.log(`tx:`);
        console.log(tx);
    }
}

export async function simpleSwap() {
    const networkId = Network.KOVAN;
    // Pools source can be Subgraph URL or pools data set passed directly
    // Update pools list with most recent onchain balances
    const tokenIn = ADDRESSES[networkId].DAI_from_AAVE;
    const tokenOut = ADDRESSES[networkId].USDC_from_AAVE;
    const swapType = SwapTypes.SwapExactIn;
    const swapAmount = parseFixed('100', 18);
    const executeTrade = true;

    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);

    // This can be useful for debug
    // Fetch & print list of pools from Subgraph
    // let subgraphPools = await fetchSubgraphPools(SUBGRAPH_URLS[networkId]);
    // console.log(`-------`)
    // console.log(JSON.stringify(subgraphPools));
    // console.log(`-------`);

    const subgraphPoolDataService = new SubgraphPoolDataService({
        chainId: networkId,
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        subgraphUrl: SUBGRAPH_URLS[networkId],
        onchain: true,
    });

    // Use the mock pool data service if you want to use pool data from a file.
    // const poolsSource = require('../testData/testPools/gusdBug.json');
    // mockPoolDataService.setPools(poolsSource);

    const coingeckoTokenPriceService = new CoingeckoTokenPriceService(
        networkId
    );

    // Use the mock token price service if you want to manually set the token price in native asset
    //  mockTokenPriceService.setTokenPrice('0.001');

    const swapInfo = await getSwap(
        provider,
        SOR_CONFIG[Network.KOVAN],
        subgraphPoolDataService,
        // mockPoolDataService,
        coingeckoTokenPriceService,
        // mockTokenPriceService,
        tokenIn,
        tokenOut,
        swapType,
        swapAmount
    );

    if (executeTrade) {
        if ([tokenIn, tokenOut].includes(ADDRESSES[networkId].STETH)) {
            console.log('RELAYER SWAP');
            await makeRelayerTrade(provider, swapInfo, swapType, networkId);
        } else {
            console.log('VAULT SWAP');
            await makeTrade(provider, swapInfo, swapType);
        }
    }
}

// $ TS_NODE_PROJECT='tsconfig.testing.json' ts-node ./test/testScripts/swapExample.ts
simpleSwap();
