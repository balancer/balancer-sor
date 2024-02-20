import dotenv from 'dotenv';
dotenv.config();
import { defaultAbiCoder } from '@ethersproject/abi';
import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { AddressZero, MaxUint256, WeiPerEther } from '@ethersproject/constants';
import { BalancerHelpers__factory } from '@balancer-labs/typechain';
import {
    FundManagement,
    SOR,
    SubgraphPoolBase,
    SwapInfo,
    SwapTypes,
} from '../../src';
import {
    ADDRESSES,
    MULTIADDR,
    Network,
    SOR_CONFIG,
    vaultAddr,
} from './constants';
import { OnChainPoolDataService } from '../lib/onchainData';
import { TokenPriceService } from '../../src';

import erc20abi from '../abi/ERC20.json';

// Helper to check/set allowances for tokens being traded via vault
export async function handleAllowances(
    wallet: Wallet,
    tokenIn: string,
    amount: BigNumber
): Promise<void> {
    if (tokenIn !== AddressZero) {
        // Vault needs approval for swapping non ETH
        console.log('Checking vault allowance...');
        const tokenInContract = new Contract(
            tokenIn,
            erc20abi,
            wallet.provider
        );

        let allowance = await tokenInContract.allowance(
            wallet.address,
            vaultAddr
        );

        if (allowance.lt(amount)) {
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
}

// Helper to set batchSwap limits
export function getLimits(
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

type SwapTx = {
    funds: FundManagement;
    limits: string[];
    overRides: Record<string, unknown>;
    deadline: BigNumber;
};

// Build batchSwap tx data
export function buildTx(
    wallet: Wallet,
    swapInfo: SwapInfo,
    swapType: SwapTypes
): SwapTx {
    const funds = {
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

    const overRides = {};
    // overRides['gasLimit'] = '200000';
    // overRides['gasPrice'] = '20000000000';
    // ETH in swaps must send ETH value
    if (swapInfo.tokenIn === AddressZero) {
        overRides['value'] = swapInfo.swapAmount.toString();
    }

    const deadline = MaxUint256;

    return {
        funds,
        limits,
        overRides,
        deadline,
    };
}

type Token = {
    address: string;
    decimals: number;
    symbol: string;
};

// Helper to log output
export async function printOutput(
    swapInfo: SwapInfo,
    sor: SOR,
    tokenIn: Token,
    tokenOut: Token,
    swapType: SwapTypes,
    swapAmount: BigNumber,
    gasPrice: BigNumber,
    limits: string[]
): Promise<void> {
    // Scale to human numbers
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

    const swapTypeStr =
        swapType === SwapTypes.SwapExactIn ? 'SwapExactIn' : 'SwapExactOut';

    // This calculates the cost to make a swap which is used as an input to sor to allow it to make gas efficient recommendations.
    // Note - tokenOut for SwapExactIn, tokenIn for SwapExactOut
    const outputToken = swapType === SwapTypes.SwapExactIn ? tokenOut : tokenIn;
    const cost = await sor.getCostOfSwapInToken(
        outputToken.address,
        outputToken.decimals,
        gasPrice,
        BigNumber.from('85000')
    );
    const costToSwapScaled = formatFixed(cost, returnDecimals);
    console.log(`Spot price: `, swapInfo.marketSp);
    console.log(`Swaps:`);
    console.log(swapInfo.swaps);
    console.log(swapInfo.tokenAddresses);
    console.log(limits);
    console.log(swapTypeStr);
    console.log(`Token In: ${tokenIn.symbol}, Amt: ${amtInScaled.toString()}`);
    console.log(
        `Token Out: ${tokenOut.symbol}, Amt: ${amtOutScaled.toString()}`
    );
    console.log(`Cost to swap: ${costToSwapScaled.toString()}`);
    console.log(`Return Considering Fees: ${returnWithFeesScaled.toString()}`);
    console.log('spot price: ', swapInfo.marketSp);
}

// Setup SOR with data services
export const setUp = async (
    networkId: Network,
    provider: JsonRpcProvider,
    pools: SubgraphPoolBase[],
    jsonRpcUrl: string,
    blockNumber: number
): Promise<SOR> => {
    await provider.send('hardhat_reset', [
        {
            forking: {
                jsonRpcUrl,
                blockNumber,
            },
        },
    ]);

    // The SOR needs to fetch pool data from an external source. This provider fetches from Subgraph and onchain calls.
    const onChainPoolDataService = new OnChainPoolDataService({
        vaultAddress: vaultAddr,
        multiAddress: MULTIADDR[networkId],
        provider,
        pools,
    });
    class MockTokenPriceService implements TokenPriceService {
        constructor(private readonly chainId: number) {}
        async getNativeAssetPriceInToken(
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            tokenAddress: string
        ): Promise<string> {
            return '0';
        }
    }

    // Mock token price information. Used to calculate cost of additonal swaps/hops.
    const mockTokenPriceService = new MockTokenPriceService(networkId);

    return new SOR(
        provider,
        SOR_CONFIG[networkId],
        onChainPoolDataService,
        mockTokenPriceService
    );
};

export const accuracy = (
    amount: BigNumber,
    expectedAmount: BigNumber
): number => {
    if (amount.eq(expectedAmount)) return 1;
    if (expectedAmount.eq(0))
        throw new Error("Can't check accuracy for expectedAmount 0");
    const accuracyEvm = amount.mul(WeiPerEther).div(expectedAmount);
    const accuracy = formatFixed(accuracyEvm, 18);
    return parseFloat(accuracy);
};

export async function queryJoin(
    provider: JsonRpcProvider,
    poolId: string,
    assets: string[],
    amounts: string[]
): Promise<
    [BigNumber, BigNumber[]] & { bptOut: BigNumber; amountsIn: BigNumber[] }
> {
    const helpers = BalancerHelpers__factory.connect(
        ADDRESSES[provider.network.chainId].balancerHelpers,
        provider
    );
    const EXACT_TOKENS_IN_FOR_BPT_OUT = 1; // Alternative is: TOKEN_IN_FOR_EXACT_BPT_OUT
    const minimumBPT = '0';
    const abi = ['uint256', 'uint256[]', 'uint256'];
    // Remove BPT from amounts to be passed into data
    const bptAddress = poolId.slice(0, 42); // Get BPT address from poolId
    const bptIndex = assets.findIndex(
        (a) => a.toLowerCase() === bptAddress.toLowerCase()
    );
    const amountsWithoutBpt = [...amounts];
    if (bptIndex !== -1) {
        amountsWithoutBpt.splice(bptIndex, 1);
    }
    const data = [EXACT_TOKENS_IN_FOR_BPT_OUT, amountsWithoutBpt, minimumBPT]; // Must not include amount for BPT
    const userDataEncoded = defaultAbiCoder.encode(abi, data);
    const joinPoolRequest = {
        assets,
        maxAmountsIn: amounts, // Must include BPT
        userData: userDataEncoded,
        fromInternalBalance: false,
    };
    const query = await helpers.queryJoin(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        joinPoolRequest
    );
    return query;
}

export async function querySingleTokenExit(
    provider: JsonRpcProvider,
    poolId: string,
    assets: string[],
    bptIn: string,
    exitTokenIndex: number
): Promise<
    [BigNumber, BigNumber[]] & { bptIn: BigNumber; amountsOut: BigNumber[] }
> {
    const helpers = BalancerHelpers__factory.connect(
        ADDRESSES[provider.network.chainId].balancerHelpers,
        provider
    );
    const EXACT_BPT_IN_FOR_ONE_TOKEN_OUT = 0; // Alternative is: BPT_IN_FOR_EXACT_TOKENS_OUT (No proportional)
    const abi = ['uint256', 'uint256', 'uint256'];

    // Remove BPT from amounts to be passed into data
    const bptAddress = poolId.slice(0, 42); // Get BPT address from poolId
    const bptIndex = assets.findIndex((a) => a === bptAddress);
    // Exit token index must be adjusted if BPT is included in assets
    if (bptIndex > -1 && bptIndex < exitTokenIndex) exitTokenIndex -= 1;

    const data = [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptIn, exitTokenIndex];
    const userData = defaultAbiCoder.encode(abi, data);

    const exitPoolRequest = {
        assets,
        minAmountsOut: assets.map(() => '0'),
        userData,
        toInternalBalance: false,
    };
    const query = await helpers.queryExit(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        exitPoolRequest
    );
    return query;
}

export async function queryExit(
    provider: JsonRpcProvider,
    poolId: string,
    assets: string[],
    bptIn: string,
    isComposablePool = false
): Promise<
    [BigNumber, BigNumber[]] & { bptIn: BigNumber; amountsOut: BigNumber[] }
> {
    const helpers = BalancerHelpers__factory.connect(
        ADDRESSES[provider.network.chainId].balancerHelpers,
        provider
    );
    const EXACT_BPT_IN_FOR_TOKENS_OUT = isComposablePool ? 2 : 1; // Alternative is: BPT_IN_FOR_EXACT_TOKENS_OUT (No proportional)
    const abi = ['uint256', 'uint256'];

    const data = [EXACT_BPT_IN_FOR_TOKENS_OUT, bptIn];
    const userData = defaultAbiCoder.encode(abi, data);

    const exitPoolRequest = {
        assets,
        minAmountsOut: assets.map(() => '0'),
        userData,
        toInternalBalance: false,
    };
    const query = await helpers.queryExit(
        poolId,
        AddressZero, // Not important for query
        AddressZero,
        exitPoolRequest
    );
    return query;
}
