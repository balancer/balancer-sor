// testing multi-hop
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const ethers = require('ethers');

const MAX_UINT = ethers.constants.MaxUint256;

// MAINNET
let tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI
let tokenOut = '0xc011a72400e58ecd99ee497cf89e3775d4bd732f'; // SNX
// const tokenIn = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
// const tokenOut = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
// const tokenIn = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
// const tokenOut = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC
// const tokenOut = '0x0327112423f3a68efdf1fcf402f6c5cb9f7caaaa'; // Token that does not exist
// const tokenOut = '0x0327112423f3a68efdf1fcf402f6c5cb9f7c33fd'; // BTC++
// const tokenIn = '0x0d8775f648430679a709e98d2b0cb6250d2887ef'; // BAT
// const tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR

const swapType = 'swapExactIn';
// const swapType = 'swapExactOut';

const swapAmount = new BigNumber('1000000000000000000'); // 1ETH
const maxPools = new BigNumber('4');
const returnTokenCostPerPool = new BigNumber('0');

describe('Multihop Tests Mainnet Data', () => {
    it('should have more than 0 DAI > SNX Pools', async () => {
        let tokenIn = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
        let tokenOut = '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F'; // SNX
        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);
        console.log(tokenIn);
        console.log(tokenOut);
        assert(
            Object.keys(directPools).length > 0,
            `Should have more than 0 swaps.`
        );
    });

    it('should have more than 0 DAI > SNX Pools', async () => {
        let tokenIn = '0x6b175474e89094c44da98b954eedeac495271d0f'; // DAI
        let tokenOut = '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F'; // SNX

        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();
        tokenIn = ethers.utils.getAddress(tokenIn);
        tokenOut = ethers.utils.getAddress(tokenOut);
        console.log(tokenIn);
        console.log(tokenOut);

        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        assert(
            Object.keys(directPools).length > 0,
            `Should have more than 0 swaps.`
        );
    });

    it('should have more than 0 DAI > WETH Pools, Checksum String', async () => {
        let tokenIn = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
        let tokenOut = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        assert(
            Object.keys(directPools).length > 0,
            `Should have more than 0 swaps.`
        );
    });

    it('should have more than 0 DAI > WETH Pools, Checksum Address', async () => {
        let tokenIn = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
        let tokenOut = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH

        tokenIn = ethers.utils.getAddress(tokenIn);
        tokenOut = ethers.utils.getAddress(tokenOut);
        console.log(tokenIn);
        console.log(tokenOut);

        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        assert(
            Object.keys(directPools).length > 0,
            `Should have more than 0 swaps.`
        );
    });

    it('should have more than 0 DAI > WETH Pools, lower case Address', async () => {
        let tokenIn = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
        let tokenOut = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH

        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();
        console.log(tokenIn);
        console.log(tokenOut);

        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        assert(
            Object.keys(directPools).length > 0,
            `Should have more than 0 swaps.`
        );
    });

    it('should have more than 0 MKR > ANT Pools, checksum Address', async () => {
        let tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR
        let tokenOut = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT

        tokenIn = ethers.utils.getAddress(tokenIn);
        tokenOut = ethers.utils.getAddress(tokenOut);
        console.log(tokenIn);
        console.log(tokenOut);

        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        assert(
            Object.keys(directPools).length === 0,
            `Should have more than 0 swaps.`
        );
    });

    it('should have more than 0 MKR > ANT Pools, lowercase Address', async () => {
        let tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR
        let tokenOut = '0x960b236a07cf122663c4303350609a66a7b288c0'; // ANT

        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();
        console.log(tokenIn);
        console.log(tokenOut);

        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        console.log(directPools);

        assert(Object.keys(directPools).length === 0, `Should have 0 swaps.`);
    });
});
/*
(async function() {
    const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

    let pools;

    let pathDataDirectPoolsOnly;
    [pools, pathDataDirectPoolsOnly] = sor.parsePoolData(
        directPools,
        tokenIn,
        tokenOut
    );

    const [
        sorSwapsDirectPoolsOnly,
        totalReturnDirectPoolsOnly,
    ] = sor.smartOrderRouterMultiHop(
        JSON.parse(JSON.stringify(pools)), // Passing clone to avoid change in original pools
        pathDataDirectPoolsOnly,
        swapType,
        swapAmount,
        maxPools,
        returnTokenCostPerPool
    );
    console.log('SOR swaps WITHOUT multi-hop');
    console.log(sorSwapsDirectPoolsOnly);
    console.log('Total return WITHOUT multi-hop');
    console.log(totalReturnDirectPoolsOnly.toString());

    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens,
    ] = await sor.getMultihopPoolsWithTokens(tokenIn, tokenOut);

    let pathData;
    [pools, pathData] = sor.parsePoolData(
        directPools,
        tokenIn,
        tokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
        // pools,
        JSON.parse(JSON.stringify(pools)), // Passing clone to avoid change in original pools
        pathData,
        swapType,
        swapAmount,
        maxPools,
        returnTokenCostPerPool
    );
    console.log('SOR swaps WITH multi-hop');
    console.log(sorSwaps);
    console.log('Total return WITH multi-hop');
    console.log(totalReturn.toNumber() / 10 ** 18);
})();
*/
