const sor = require('../../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');
import { Pool } from '../../src/direct/types';
import { BONE, calcOutGivenIn, calcInGivenOut } from '../../src/bmath';

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca';
const IMBTC = '0x3212b29e33587a00fb1c83346f5dbfa69a458923';

const amountIn = new BigNumber(1).times(BONE);
const tokenIn = IMBTC;
const tokenOut = DAI;

export function bnum(val: string | number): any {
    return new BigNumber(val.toString());
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

export function scale(input: any, decimalPlaces: number): any {
    const scalePow = new BigNumber(decimalPlaces.toString());
    const scaleMul = new BigNumber(10).pow(scalePow);
    return input.times(scaleMul);
}

function toChecksum(address) {
    return ethers.utils.getAddress(address);
}

async function direct() {
    console.log('Direct Start');

    const allPoolsReturned = await sor.getAllPublicSwapPools();
    const pools = findPoolsWithTokens(allPoolsReturned, tokenIn, tokenOut);

    // Find best swaps
    var swaps = sor.smartOrderRouter(
        pools,
        'swapExactIn',
        amountIn,
        4,
        new BigNumber(0)
    );

    var totalOutPut = calcTotalOutput(swaps, pools);

    console.log(utils.formatEther(totalOutPut.toString()));
}

async function multi() {
    const allPoolsReturned = await sor.getAllPublicSwapPools();
    const directPools = await sor.filterPoolsWithTokensDirect(
        allPoolsReturned,
        tokenIn,
        tokenOut
    );

    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens,
    ] = await sor.filterPoolsWithTokensMultihop(
        allPoolsReturned,
        tokenIn,
        tokenOut
    );

    console.log(`mostLiquidPoolsFirstHop: ${mostLiquidPoolsFirstHop.length}`);
    console.log(`mostLiquidPoolsSecondHop: ${mostLiquidPoolsSecondHop.length}`);

    let pools, pathData;
    [pools, pathData] = sor.parsePoolData(
        directPools,
        // tokenIn,
        // tokenOut,
        tokenIn.toLowerCase(),
        tokenOut.toLowerCase(),
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    console.log(`pools: ${pools.length}`);
    console.log(`pathData: ${pathData.length}`);

    const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
        JSON.parse(JSON.stringify(pools)),
        pathData,
        'swapExactIn',
        amountIn,
        4,
        new BigNumber(0)
    );

    console.log(utils.formatEther(totalReturn.toString()));
    console.log(`MultiHop Swaps: `);
    console.log(sorSwaps);
}

async function run() {
    await direct();
    await multi();
}

run();
