import dotenv from 'dotenv';
dotenv.config();
import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { AddressZero, MaxUint256 } from '@ethersproject/constants';
import { AmountDictionary, SOR, SwapInfo, SwapTypes } from '../../src';
import { vaultAddr } from './constants';

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

// Build batchSwap tx data
export function buildTx(
    wallet: Wallet,
    swapInfo: SwapInfo,
    swapType: SwapTypes
): any {
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

// Helper to log output
export async function printOutput(
    swapInfo: SwapInfo,
    sor: SOR,
    tokenIn: any,
    tokenOut: any,
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
        BigNumber.from('35000')
    );
    const costToSwapScaled = formatFixed(cost, returnDecimals);
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
    if (swapInfo.swapFees) {
        console.log(`Swap fees: `);
        for (const token of swapInfo.tokenAddresses) {
            console.log(token, ': ', swapInfo.swapFees[token]);
        }
    }
}
