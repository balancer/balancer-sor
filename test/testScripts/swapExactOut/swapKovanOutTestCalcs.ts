// Example comparing EVM maths to result: $ ts-node ./test/testScripts/swapExactOut/swapKovanOutTestCalcs.ts
require('dotenv').config();
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { Contract } from '@ethersproject/contracts';
import { MaxUint256 } from '@ethersproject/constants';
import { SOR, SwapInfo, SwapTypes, fetchSubgraphPools } from '../../../src';
import { scale, bnum } from '../../../src/bmath';
import vaultArtifact from '../../../src/abi/Vault.json';
import erc20abi from '../../abi/ERC20.json';
import { calcInGivenOut } from './stableMathEvm';

export type FundManagement = {
    sender: string;
    recipient: string;
    fromInternalBalance: boolean;
    toInternalBalance: boolean;
};

const BAL = '0x41286Bb1D3E870f3F750eB7E1C25d7E48c8A1Ac7';
const WETH = '0xdFCeA9088c8A88A76FF74892C1457C17dfeef9C1';
const USDC = '0xc2569dd7d0fd715b054fbf16e75b001e5c0c1115';
const DAI = '0x04df6e4121c27713ed22341e7c7df330f56f289b';
const GUSD = '0x22ee6c3b011facc530dd01fe94c58919344d6db5';
const vaultAddr = '0xBA12222222228d8Ba445958a75a0704d566BF2C8';

async function simpleSwap() {
    // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
    const provider = new JsonRpcProvider(
        `https://kovan.infura.io/v3/${process.env.INFURA}`
    );

    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    // Can be changed in future using sor.gasPrice = newPrice
    const gasPrice = new BigNumber('40000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxNoPools = 4;
    const chainId = 42;
    const tokenIn = DAI;
    const tokenOut = USDC;
    const swapType = SwapTypes.SwapExactOut;
    // In normalized format, i.e. 1USDC = 1
    const swapAmount = new BigNumber(7);
    const decimalsIn = 18;
    const decimalsOut = 6;

    // Using filtered pool from file
    const subgraphPools = require('./tempKovanPool.json');
    const sor = new SOR(provider, gasPrice, maxNoPools, chainId, subgraphPools);

    // Will get onChain balances, etc
    await sor.fetchPools(true, subgraphPools);
    const onChainPools = sor.onChainBalanceCache;
    //console.log(JSON.stringify(onChainPools));

    // V2 function seems to handle everything scaled to 18 decimals, i.e. treat 1USDC and 1DAI same = 1e18
    // Apart from Amp - this seems to be treated as plain integer
    const scaledAmtOut = scale(swapAmount, 18);
    const scaledSwapFee = scale(bnum(onChainPools.pools[0].swapFee), 18);
    let scaledBalances = [];
    let tokenInIndex;
    let tokenOutIndex;
    let tokenAddresses = [];
    // Setup for static call against vault. Scale all balances and get tokenAddresses and index to correct format for swap
    onChainPools.pools[0].tokens.forEach((token, i) => {
        tokenAddresses.push(token.address);
        scaledBalances.push(scale(bnum(token.balance), 18));
        if (token.address === tokenIn) tokenInIndex = i;
        if (token.address === tokenOut) tokenOutIndex = i;
    });

    // Actual calculation
    const amtIn = calcInGivenOut(
        scaledBalances,
        onChainPools.pools[0].amp,
        tokenInIndex,
        tokenOutIndex,
        scaledAmtOut,
        scaledSwapFee
    );

    // Alternatively as a test this scales everything to local decimals, i.e. 1USDC = 1e6 but this doesn't appear to work
    // const scaledAmtOut = scale(swapAmount, decimalsOut);
    // const scaledSwapFee = scale(bnum(onChainPools.pools[0].swapFee), 18);
    // const scaledAmp = scale(bnum(onChainPools.pools[0].amp), 18);
    // let scaledBalances = [];
    // let tokenInIndex;
    // let tokenOutIndex;
    // let tokenAddresses = [];
    // onChainPools.pools[0].tokens.forEach((token, i) => {
    //     tokenAddresses.push(token.address);
    //     scaledBalances.push(scale(bnum(token.balance), Number(token.decimals)));
    //     if (token.address === tokenIn)
    //         tokenInIndex = i;
    //     if (token.address === tokenOut)
    //         tokenOutIndex = i;
    // });
    // const amtIn = calcInGivenOut(
    //     scaledBalances,
    //     scaledAmp,
    //     tokenInIndex,
    //     tokenOutIndex,
    //     scaledAmtOut,
    //     scaledSwapFee
    // );

    // Single swap and we already know Id. For exactOut we just have to supply amt out
    const swaps = [
        {
            poolId:
                '0xebfed10e11dc08fcda1af1fda146945e8710f22e00000000000000000000007f',
            assetInIndex: tokenInIndex,
            assetOutIndex: tokenOutIndex,
            amount: scale(swapAmount, decimalsOut).toString(),
            userData: '0x',
        },
    ];

    const funds: FundManagement = {
        sender: '0x6aB9E397d22634dCB71FcD1A075EC434050b8647',
        recipient: '0x6aB9E397d22634dCB71FcD1A075EC434050b8647',
        fromInternalBalance: false,
        toInternalBalance: false,
    };

    const vaultContract = new Contract(vaultAddr, vaultArtifact, provider);

    // Static call on vault to see what it returns as delta
    let deltas = await vaultContract.callStatic.queryBatchSwap(
        swapType,
        swaps,
        tokenAddresses,
        funds
    );

    console.log('Calculated Return Amt:');
    console.log(amtIn.toString());
    console.log('Real deltas:');
    deltas.forEach(delta => console.log(delta.toString()));
}

simpleSwap();
