// Example showing SOR with Vault batchSwap and Subgraph pool data, run using: $ ts-node ./test/testScripts/swapExample.ts
require('dotenv').config();
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { MaxUint256 } from '@ethersproject/constants';
import {
    SOR,
    SwapInfo,
    SwapTypes,
    SubGraphPoolsBase,
    ZERO_ADDRESS,
    scale,
    bnum,
} from '../../src';
import vaultArtifact from '../../src/abi/Vault.json';
import relayerAbi from '../abi/BatchRelayer.json';
import erc20abi from '../abi/ERC20.json';

export enum Network {
    MAINNET = 1,
    GOERLI = 5,
    KOVAN = 42,
    POLYGON = 137,
}

export const PROVIDER_URLS = {
    [Network.MAINNET]: `https://mainnet.infura.io/v3/${process.env.INFURA}`,
    [Network.GOERLI]: `https://goerli.infura.io/v3/${process.env.INFURA}`,
    [Network.KOVAN]: `https://kovan.infura.io/v3/${process.env.INFURA}`,
    [Network.POLYGON]: `https://rpc-mainnet.matic.network`,
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
};

export const ADDRESSES = {
    [Network.MAINNET]: {
        ETH: {
            address: ZERO_ADDRESS,
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
    },
    [Network.KOVAN]: {
        // Visit https://balancer-faucet.on.fleek.co/#/faucet for test tokens
        BatchRelayer: {
            address: '0x2C606C7D152D745633665F4De17F34c213BCCA2F',
        },
        ETH: {
            address: ZERO_ADDRESS,
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
    },
    [Network.POLYGON]: {
        MATIC: {
            address: ZERO_ADDRESS,
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
};

// This is the same across networks
const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

async function getSwap(
    provider: JsonRpcProvider,
    networkId,
    poolsSource: string | SubGraphPoolsBase,
    queryOnChain: boolean,
    tokenIn,
    tokenOut,
    swapType: SwapTypes,
    swapAmount: BigNumber
): Promise<SwapInfo> {
    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    // Can be changed in future using sor.gasPrice = newPrice
    const gasPrice = new BigNumber('40000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxNoPools = 4;

    const sor = new SOR(provider, gasPrice, maxNoPools, networkId, poolsSource);

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await sor.setCostOutputToken(tokenOut, manualPriceBn)
    // Note - tokenOut for SwapExactIn, tokenIn for SwapExactOut
    let cost: BigNumber;
    if (swapType === SwapTypes.SwapExactOut)
        cost = await sor.setCostOutputToken(tokenIn.address, tokenIn.decimals);
    else
        cost = await sor.setCostOutputToken(
            tokenOut.address,
            tokenOut.decimals
        );

    // Will get onChain data for pools list
    await sor.fetchPools(queryOnChain);

    const swapInfo: SwapInfo = await sor.getSwaps(
        tokenIn.address,
        tokenOut.address,
        swapType,
        swapAmount
    );

    const amtInScaled =
        swapType === SwapTypes.SwapExactIn
            ? swapAmount.toString()
            : scale(swapInfo.returnAmount, -tokenIn.decimals).toString();
    const amtOutScaled =
        swapType === SwapTypes.SwapExactIn
            ? scale(swapInfo.returnAmount, -tokenOut.decimals).toString()
            : swapAmount.toString();
    const swapTypeStr =
        swapType === SwapTypes.SwapExactIn ? 'SwapExactIn' : 'SwapExactOut';
    console.log(swapTypeStr);
    console.log(`Token In: ${tokenIn.symbol}, Amt: ${amtInScaled}`);
    console.log(
        `Token Out: ${tokenOut.symbol}, Amt: ${amtOutScaled.toString()}`
    );
    console.log(`Cost to swap: ${cost.toString()}`);
    console.log(`Swaps:`);
    console.log(swapInfo.swaps);
    console.log(swapInfo.tokenAddresses);

    return swapInfo;
}

async function makeTrade(
    provider: JsonRpcProvider,
    swapInfo: SwapInfo,
    swapType
) {
    const wallet = new Wallet(process.env.TRADER_KEY, provider);

    if (swapInfo.tokenIn !== ZERO_ADDRESS) {
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
        if (bnum(allowance).lt(swapInfo.swapAmount)) {
            console.log(
                `Not Enough Allowance: ${allowance.toString()}. Approving vault now...`
            );
            let txApprove = await tokenInContract
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

    // Limits:
    // +ve means max to send
    // -ve mean min to receive
    // For a multihop the intermediate tokens should be 0
    // This is where slippage tolerance would be added
    const limits = [];
    if (swapType === SwapTypes.SwapExactIn) {
        swapInfo.tokenAddresses.forEach((token, i) => {
            if (token.toLowerCase() === swapInfo.tokenIn.toLowerCase()) {
                limits[i] = swapInfo.swapAmount.toString();
            } else if (
                token.toLowerCase() === swapInfo.tokenOut.toLowerCase()
            ) {
                limits[i] = swapInfo.returnAmount
                    .times(-0.99)
                    .toString()
                    .split('.')[0];
            } else {
                limits[i] = '0';
            }
        });
    } else {
        swapInfo.tokenAddresses.forEach((token, i) => {
            if (token.toLowerCase() === swapInfo.tokenIn.toLowerCase()) {
                limits[i] = swapInfo.returnAmount.toString();
            } else if (
                token.toLowerCase() === swapInfo.tokenOut.toLowerCase()
            ) {
                limits[i] = swapInfo.swapAmount
                    .times(-0.99)
                    .toString()
                    .split('.')[0];
            } else {
                limits[i] = '0';
            }
        });
    }
    const deadline = MaxUint256;

    console.log(funds);
    console.log(swapInfo.tokenAddresses);
    console.log(limits);

    console.log('Swapping...');

    let overRides = {};
    // overRides['gasLimit'] = '200000';
    // overRides['gasPrice'] = '20000000000';
    // ETH in swaps must send ETH value
    if (swapInfo.tokenIn === ZERO_ADDRESS) {
        overRides['value'] = swapInfo.swapAmount.toString();
    }

    let tx = await vaultContract
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

    console.log(`tx: ${tx.hash}`);
}

async function makeRelayerTrade(
    provider: JsonRpcProvider,
    swapInfo: SwapInfo,
    swapType: SwapTypes,
    chainId: number
) {
    const wallet = new Wallet(process.env.TRADER_KEY, provider);

    if (swapInfo.tokenIn !== ZERO_ADDRESS) {
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
        if (bnum(allowance).lt(swapInfo.swapAmount)) {
            console.log(
                `Not Enough Allowance: ${allowance.toString()}. Approving vault now...`
            );
            let txApprove = await tokenInContract
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

    // Limits:
    // +ve means max to send
    // -ve mean min to receive
    // For a multihop the intermediate tokens should be 0
    // This is where slippage tolerance would be added
    const limits = [];
    if (swapType === SwapTypes.SwapExactIn) {
        swapInfo.tokenAddresses.forEach((token, i) => {
            if (token.toLowerCase() === tokenIn.toLowerCase()) {
                limits[i] = swapInfo.swapAmountForSwaps.toString();
            } else if (token.toLowerCase() === tokenOut.toLowerCase()) {
                limits[i] = swapInfo.returnAmountForSwaps
                    .times(-0.99)
                    .toString()
                    .split('.')[0];
            } else {
                limits[i] = '0';
            }
        });
    } else {
        swapInfo.tokenAddresses.forEach((token, i) => {
            if (token.toLowerCase() === tokenIn.toLowerCase()) {
                limits[i] = swapInfo.returnAmountForSwaps
                    .times(1.05)
                    .toString()
                    .split('.')[0];
            } else if (token.toLowerCase() === tokenOut.toLowerCase()) {
                limits[i] = swapInfo.swapAmountForSwaps.times(-1).toString();
            } else {
                limits[i] = '0';
            }
        });
    }
    const deadline = MaxUint256;

    console.log(funds);
    console.log(swapInfo.tokenAddresses);
    console.log(limits);

    console.log('Swapping...');

    let overRides = {};
    // overRides['gasLimit'] = '450000';
    // overRides['gasPrice'] = '20000000000';
    // ETH in swaps must send ETH value
    if (swapInfo.tokenIn === ZERO_ADDRESS) {
        overRides['value'] = swapInfo.swapAmount.toString();
    }

    let tx = await relayerContract
        .connect(wallet)
        .lidoBatchSwap(
            swapType,
            swapInfo.swaps,
            swapInfo.tokenAddresses,
            funds,
            limits,
            deadline,
            overRides
        );

    console.log(`tx: ${tx.hash}`);
}

async function simpleSwap() {
    // const networkId = Network.MAINNET;
    const networkId = Network.KOVAN;
    // Pools source can be Subgraph URL or pools data set passed directly
    const poolsSource = SUBGRAPH_URLS[networkId];
    // const poolsSource = require('../testData/testPools/gusdBug.json');
    // Update pools list with most recent onchain balances
    const queryOnChain = true;
    const tokenIn = ADDRESSES[networkId].WETH;
    const tokenOut = ADDRESSES[networkId].STETH;
    const swapType = SwapTypes.SwapExactIn;
    const swapAmount = new BigNumber(0.000157); // In normalized format, i.e. 1USDC = 1
    const executeTrade = true;

    const provider = new JsonRpcProvider(PROVIDER_URLS[networkId]);

    // This can be useful for debug
    // Fetch & print list of pools from Subgraph
    // let subgraphPools = await fetchSubgraphPools(SUBGRAPH_URLS[networkId]);
    // console.log(`-------`)
    // console.log(JSON.stringify(subgraphPools));
    // console.log(`-------`);

    const swapInfo = await getSwap(
        provider,
        networkId,
        poolsSource,
        queryOnChain,
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

simpleSwap();
