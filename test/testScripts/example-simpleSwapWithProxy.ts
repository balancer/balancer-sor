// Example showing full swaps using ExchangeProxy contracts
require('dotenv').config();
const sor = require('../../src');
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { MaxUint256 } from '@ethersproject/constants';
import { Contract } from '@ethersproject/contracts';

async function makeSwap() {
    // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key, KEY=pk_of_wallet_to_swap_with
    const isMainnet = false;

    let provider, WETH, USDC, DAI, chainId, poolsUrl, proxyAddr;

    const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    // gasPrice is used by SOR as a factor to determine how many pools to swap against.
    // i.e. higher cost means more costly to trade against lots of different pools.
    // Can be changed in future using SOR.gasPrice = newPrice
    const gasPrice = new BigNumber('25000000000');
    // This determines the max no of pools the SOR will use to swap.
    const maxNoPools = 4;
    const MAX_UINT = MaxUint256;

    if (isMainnet) {
        // Will use mainnet addresses - BE CAREFUL SWAP WILL USE REAL FUNDS
        provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // Mainnet WETH
        USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'; // Mainnet USDC
        DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
        chainId = 1;
        poolsUrl = `https://ipfs.io/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange/pools`;
        proxyAddr = '0x3E66B66Fd1d0b02fDa6C811Da9E0547970DB2f21'; // Mainnet proxy
    } else {
        // Will use Kovan addresses
        provider = new JsonRpcProvider(
            `https://kovan.infura.io/v3/${process.env.INFURA}`
        );
        WETH = '0xd0A1E359811322d97991E03f863a0C30C2cF029C'; // Kovan WETH
        USDC = '0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5'; // Kovan USDC
        DAI = '0x1528F3FCc26d13F7079325Fb78D9442607781c8C'; // Kovan DAI
        chainId = 42;
        poolsUrl = `https://ipfs.io/ipns/balancer-team-bucket.storage.fleek.co/balancer-exchange-kovan/pools`;
        proxyAddr = '0x4e67bf5bD28Dd4b570FBAFe11D0633eCbA2754Ec'; // Kovan proxy
    }

    const SOR = new sor.SOR(provider, gasPrice, maxNoPools, chainId, poolsUrl);

    // This fetches all pools list from URL in constructor then onChain balances using Multicall
    console.log('Fetching pools...');
    await SOR.fetchPools();
    console.log('Pools fetched, get swap info...');

    let tokenIn = WETH;
    let tokenOut = USDC;
    let swapType = 'swapExactIn';
    let amountIn = new BigNumber('1e16');
    // This calculates the cost to make a swap which is used as an input to SOR to allow it to make gas efficient recommendations.
    // Can be set once and will be used for further swap calculations.
    // Defaults to 0 if not called or can be set manually using: await SOR.setCostOutputToken(tokenOut, manualPriceBn)
    await SOR.setCostOutputToken(tokenOut);

    let [swaps, amountOut] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountIn
    );

    console.log(`Total Expected Out Of Token: ${amountOut.toString()}`);

    console.log('Exectuting Swap Using Exchange Proxy...');

    const wallet = new Wallet(process.env.KEY, provider);
    const proxyArtifact = require('./abi/ExchangeProxy.json');
    let proxyContract = new Contract(proxyAddr, proxyArtifact.abi, provider);
    proxyContract = proxyContract.connect(wallet);

    console.log(`Swapping using address: ${wallet.address}...`);
    /*
    This first swap is WETH>TOKEN.
    The ExchangeProxy can accept ETH in place of WETH and it will handle wrapping to Weth to make the swap.
    */

    let tx = await proxyContract.multihopBatchSwapExactIn(
        swaps,
        ETH, // Note TokenIn is ETH address and not WETH as we are sending ETH
        tokenOut,
        amountIn.toString(),
        amountOut.toString(), // This is the minimum amount out you will accept.
        {
            value: amountIn.toString(), // Here we send ETH in place of WETH
            gasPrice: gasPrice.toString(),
        }
    );
    console.log(`Tx Hash: ${tx.hash}`);
    await tx.wait();

    console.log('New Swap, ExactOut...');
    /*
    Now we swap TOKEN>TOKEN & use the swapExactOut swap type to set the exact amount out of tokenOut we want to receive.
    ExchangeProxy will pull required amount of tokenIn to make swap so tokenIn approval must be set correctly.
    */
    tokenIn = USDC;
    tokenOut = DAI;
    swapType = 'swapExactOut'; // New Swap Type.
    amountOut = new BigNumber(1e18); // This is the exact amount out of tokenOut we want to receive

    const tokenArtifact = require('./abi/ERC20.json');
    let tokenInContract = new Contract(tokenIn, tokenArtifact.abi, provider);
    tokenInContract = tokenInContract.connect(wallet);
    console.log('Approving proxy...');
    tx = await tokenInContract.approve(proxyAddr, MAX_UINT);
    await tx.wait();
    console.log('Approved.');

    await SOR.setCostOutputToken(tokenOut);

    // We want to fetch pools again to make sure onchain balances are correct and we have most accurate swap info
    console.log('Update pool balances...');
    await SOR.fetchPools();
    console.log('Pools fetched, get swap info...');

    [swaps, amountIn] = await SOR.getSwaps(
        tokenIn,
        tokenOut,
        swapType,
        amountOut
    );

    console.log(`Required token input amount: ${amountIn.toString()}`);

    console.log('Exectuting Swap Using Exchange Proxy...');

    tx = await proxyContract.multihopBatchSwapExactOut(
        swaps,
        tokenIn,
        tokenOut,
        amountIn.toString(), // This is the max amount of tokenIn you will swap.
        {
            gasPrice: gasPrice.toString(),
        }
    );
    console.log(`Tx Hash: ${tx.hash}`);
    await tx.wait();
    console.log('Check Balances');
}

makeSwap();
