// Test direct SOR (legacy version with direct pools only)
// Uses allPools.json which has Mainnet pool data from 25/05/20
import { assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');
const allPools = require('./allPools.json');
import { Pool } from '../src/direct/types';
import { BONE, calcOutGivenIn, calcInGivenOut } from '../src/bmath';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
const ANT = '0x960b236A07cf122663c4303350609A66A7B288C0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2';

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

// This is similar to function used in legacy Exchange app to format pool data
function findPoolsWithTokens(allPools, tokenIn, tokenOut): Pool[] {
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

// Similar to legacy Exchange App
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

// Similar to legacy Exchange App
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

describe('Test direct SOR (legacy version with direct pools only) using allPools.json', () => {
    it('getPoolsWithTokens timer check', async () => {
        // Timing data for Subgraph calls.
        console.time('getPoolsWithTokens');
        await sor.getPoolsWithTokens(WETH, DAI);
        console.timeEnd('getPoolsWithTokens');

        console.time('getPoolsWithTokensNoPools');
        await sor.getPoolsWithTokens(USDC, MKR);
        console.timeEnd('getPoolsWithTokensNoPools');
    });

    it('Saved pool check', async () => {
        // Compares saved pools @25/05/20 to current Subgraph pools.
        assert.equal(allPools.pools.length, 59, 'Should be 59 pools');
    });

    it('Direct SOR - WETH->DAI, swapExactIn', async () => {
        console.time('findPoolsWithTokens');
        const allPoolsReturned = allPools; // Replicates sor.getAllPublicSwapPools() call
        const pools = findPoolsWithTokens(allPoolsReturned, WETH, DAI);
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

        assert.equal(pools.length, 10, 'Should have 10 pools with tokens.');
        assert.equal(swaps.length, 3, 'Should have 3 swaps.');
        // ADD SWAP CHECK
        assert.equal(
            utils.formatEther(totalOutPut.toString()),
            '202.860557251722913901',
            'Total Out Should Match'
        );
    });

    it('Direct SOR - WETH->DAI, swapExactOut', async () => {
        var amountOut = new BigNumber(1000).times(BONE);
        const allPoolsReturned = allPools; // Replicates sor.getAllPublicSwapPools() call
        const pools = findPoolsWithTokens(allPoolsReturned, WETH, DAI);
        // Find best swaps
        var swaps = sor.smartOrderRouter(
            pools,
            'swapExactOut',
            amountOut,
            4,
            new BigNumber(0)
        );

        var totalOutPut = calcTotalInput(swaps, pools);
        assert.equal(pools.length, 10, 'Should have 10 pools with tokens.');
        assert.equal(swaps.length, 4, 'Should have 4 swaps.');
        assert.equal(
            utils.formatEther(totalOutPut.toString()),
            '4.978956703358553061'
        );
    });

    it('Direct SOR - WETH->ANT, no direct swaps', async () => {
        var amountOut = new BigNumber(1000).times(BONE);
        const allPoolsReturned = allPools; // Replicates sor.getAllPublicSwapPools() call

        const pools = findPoolsWithTokens(allPoolsReturned, WETH, ANT);

        // Find best swaps
        var swaps = sor.smartOrderRouter(
            pools,
            'swapExactIn',
            amountOut,
            4,
            new BigNumber(0)
        );

        var totalOutPut = calcTotalInput(swaps, pools);
        assert.equal(pools.length, 0, 'Should have 0 pools with tokens.');
        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
    });

    it('Direct SOR - USDC->MKR, no direct swaps', async () => {
        var amountOut = new BigNumber(1000).times(BONE);
        const allPoolsReturned = allPools; // Replicates sor.getAllPublicSwapPools() call

        const pools = findPoolsWithTokens(allPoolsReturned, USDC, MKR);

        // Find best swaps
        var swaps = sor.smartOrderRouter(
            pools,
            'swapExactIn',
            amountOut,
            4,
            new BigNumber(0)
        );

        var totalOutPut = calcTotalInput(swaps, pools);
        assert.equal(pools.length, 0, 'Should have 0 pools with tokens.');
        assert.equal(swaps.length, 0, 'Should have 0 swaps.');
    });
});
