// testing multi-hop
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');
const allPools = require('./allPools.json');
import { Pool } from '../src/direct/types';
import { BONE, calcOutGivenIn, calcInGivenOut } from '../src/bmath';

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

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI

const swapType = 'swapExactIn';
// const swapType = 'swapExactOut';

const swapAmount = new BigNumber('1000000000000000000'); // 1ETH
const maxPools = new BigNumber('4');
const returnTokenCostPerPool = new BigNumber('0');

BigNumber.config({
    EXPONENTIAL_AT: [-100, 100],
    ROUNDING_MODE: BigNumber.ROUND_HALF_EVEN,
    DECIMAL_PLACES: 18,
});

export function bnum(val: string | number): any {
    return new BigNumber(val.toString());
}

export function scale(input: any, decimalPlaces: number): any {
    const scalePow = new BigNumber(decimalPlaces.toString());
    const scaleMul = new BigNumber(10).pow(scalePow);
    return input.times(scaleMul);
}

function toChecksum(address) {
    return ethers.utils.getAddress(address);
}

function findPoolsWithTokens(tokenIn, tokenOut): Pool[] {
    let poolData: Pool[] = [];

    allPools.pools.forEach(p => {
        let tI: any = p.tokens.find(
            t => toChecksum(t.address) === toChecksum(tokenIn)
        );
        let tO: any = p.tokens.find(
            t => toChecksum(t.address) === toChecksum(tokenOut)
        );

        if (tI && tO) {
            if (tI.balance > 0 && tO.balance > 0) {
                let obj: Pool = {
                    id: toChecksum(p.id),
                    // decimalsIn: tI.decimals,
                    // decimalsOut: tO.decimals,
                    balanceIn: scale(bnum(tI.balance), tI.decimals),
                    balanceOut: scale(bnum(tO.balance), tO.decimals),
                    weightIn: scale(
                        bnum(tI.denormWeight).div(bnum(p.totalWeight)),
                        18
                    ),
                    weightOut: scale(
                        bnum(tO.denormWeight).div(bnum(p.totalWeight)),
                        18
                    ),
                    swapFee: scale(bnum(p.swapFee), 18),
                };

                poolData.push(obj);
            }
        }
    });

    return poolData;
}

const calcTotalOutput = (swaps: any[], poolData: Pool[]): any => {
    let totalAmountOut = bnum(0);
    swaps.forEach(swap => {
        const pool = poolData.find(p => p.id === swap.pool);
        if (!pool) {
            throw new Error(
                '[Invariant] No pool found for selected balancer index'
            );
        }

        const preview = calcOutGivenIn(
            pool.balanceIn,
            pool.weightIn,
            pool.balanceOut,
            pool.weightOut,
            bnum(swap.amount),
            pool.swapFee
        );

        totalAmountOut = totalAmountOut.plus(preview);
    });
    return totalAmountOut;
};

const calcTotalInput = (swaps: any[], poolData: Pool[]): any => {
    let totalAmountIn = bnum(0);
    swaps.forEach(swap => {
        const pool = poolData.find(p => p.id === swap.pool);
        if (!pool) {
            throw new Error(
                '[Invariant] No pool found for selected balancer index'
            );
        }

        const preview = calcInGivenOut(
            pool.balanceIn,
            pool.weightIn,
            pool.balanceOut,
            pool.weightOut,
            bnum(swap.amount),
            pool.swapFee
        );

        totalAmountIn = totalAmountIn.plus(preview);
    });

    return totalAmountIn;
};

describe('Multihop Tests Mainnet Data', () => {
    it('pool check', async () => {
        // Compares saved pools @25/05/20 to current Subgraph pools.
        //const sg = await sor.getAllPublicSwapPools();
        //expect(allPools).to.eql(sg)
        assert.equal(allPools.pools.length, 57, 'Should be 57 pools');
    });

    it('Direct SOR - WETH->DAI, swapExactIn', async () => {
        console.time('findPoolsWithTokens');
        const pools = findPoolsWithTokens(WETH, DAI);
        console.timeEnd('findPoolsWithTokens');

        var amountIn = new BigNumber(1).times(BONE);

        console.time('smartOrderRouter');
        // Find best swaps
        var swaps = sor.smartOrderRouter(
            pools,
            'swapExactIn',
            amountIn,
            4,
            new BigNumber(0)
        );
        console.timeEnd('smartOrderRouter');

        var totalOutPut = calcTotalOutput(swaps, pools);

        assert.equal(pools.length, 9, 'Should have 9 pools with tokens.');
        assert.equal(swaps.length, 4, 'Should have 4 swaps.');
        // ADD SWAP CHECK
        assert.equal(
            utils.formatEther(totalOutPut.toString()),
            '201.551912488644695653',
            'Total Out Should Match'
        );
    });

    it('Direct SOR - WETH->DAI, swapExactOut', async () => {
        var amountOut = new BigNumber(1000).times(BONE);

        const pools = findPoolsWithTokens(WETH, DAI);

        // Find best swaps
        var swaps = sor.smartOrderRouter(
            pools,
            'swapExactOut',
            amountOut,
            4,
            new BigNumber(0)
        );

        var totalOutPut = calcTotalInput(swaps, pools);
        assert.equal(pools.length, 9, 'Should have 9 pools with tokens.');
        assert.equal(swaps.length, 4, 'Should have 4 swaps.');
        assert.equal(
            utils.formatEther(totalOutPut.toString()),
            '4.981406985571843872'
        );
    });

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
