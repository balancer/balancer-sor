import fetch from 'isomorphic-fetch';
const sor = require('../../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');
import { Pool } from '../../src/direct/types';
import { BONE, calcOutGivenIn, calcInGivenOut } from '../../src/bmath';

const SUBGRAPH_URL =
    'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer';

export async function getPoolTokens() {
    const query = `
      {
        poolTokens {
          symbol
          address
        }
      }
    `;

    const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query,
        }),
    });

    const { data } = await response.json();
    return data;
}

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

// This uses legacy SOR to get direct swaps
// & helper functions from Exchange app to calc total output
async function directLegacy(
    allPoolsReturned,
    tokenIn,
    tokenOut,
    trade,
    amount
) {
    const pools = findPoolsWithTokens(allPoolsReturned, tokenIn, tokenOut);

    // Find best swaps
    const swaps = sor.smartOrderRouter(
        pools,
        trade,
        amount,
        4,
        new BigNumber(0)
    );

    const totalOutPut = calcTotalOutput(swaps, pools);

    // console.log(`Legacy Direct Total: ${utils.formatEther(totalOutPut.toString())}`);
    return [swaps, totalOutPut];
}

// Uses new SOR functions but with only Direct Pools
async function SorDirectOnly(
    allPoolsReturned,
    tokenIn,
    tokenOut,
    trade,
    amount
) {
    let parsedPools, pathDataDirectPoolsOnly;

    const filteredPools = sor.filterPoolsWithTokensDirect(
        allPoolsReturned,
        tokenIn,
        tokenOut
    );

    [parsedPools, pathDataDirectPoolsOnly] = sor.parsePoolData(
        filteredPools,
        tokenIn.toLowerCase(),
        tokenOut.toLowerCase()
    );

    const returnTokenCostPerPool = new BigNumber('0');
    const maxPools = new BigNumber('4');

    let paths = sor.processPaths(pathDataDirectPoolsOnly, parsedPools, trade);

    let epsOfInterest = sor.processEpsOfInterestMultiHop(
        pathDataDirectPoolsOnly,
        trade,
        maxPools
    );

    const [
        sorSwapsDirectPoolsOnly,
        totalReturnDirectPoolsOnly,
    ] = sor.smartOrderRouterMultiHopEpsOfInterest(
        JSON.parse(JSON.stringify(parsedPools)),
        pathDataDirectPoolsOnly,
        trade,
        amount,
        maxPools,
        new BigNumber(0),
        epsOfInterest
    );
    //console.log('SOR swaps WITHOUT multi-hop');
    //console.log(sorSwapsDirectPoolsOnly);
    // console.log(`SOR Direct Total: ${utils.formatEther(totalReturnDirectPoolsOnly.toString())}`);
    return [sorSwapsDirectPoolsOnly, totalReturnDirectPoolsOnly];
}

async function SorMultihop(allPoolsReturned, tokenIn, tokenOut, trade, amount) {
    let poolsTokenIn, poolsTokenOut, directPools, hopTokens;
    [directPools, hopTokens, poolsTokenIn, poolsTokenOut] = sor.filterPools(
        allPoolsNonZeroBalances.pools,
        tokenIn,
        tokenOut
    );

    let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop;
    [
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
    ] = sor.sortPoolsMostLiquid(
        tokenIn,
        tokenOut,
        hopTokens,
        poolsTokenIn,
        poolsTokenOut
    );

    let pools, pathData;
    [pools, pathData] = sor.parsePoolData(
        directPools,
        tokenIn.toLowerCase(),
        tokenOut.toLowerCase(),
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );

    let paths = sor.processPaths(pathData, allPoolsReturned, swapType);

    let epsOfInterest = sor.processEpsOfInterestMultiHop(
        paths,
        swapType,
        noPools
    );

    let swaps, totalReturnWei;
    [swaps, totalReturnWei] = sor.smartOrderRouterMultiHopEpsOfInterest(
        JSON.parse(JSON.stringify(allPoolsReturned)),
        paths,
        swapType,
        amountOut,
        noPools,
        new BigNumber(0),
        epsOfInterest
    );

    // console.log(`SOR Multihop Total: ${utils.formatEther(totalReturn.toString())}`);
    // console.log(`MultiHop Swaps: `);
    // console.log(sorSwaps);
    return [sorSwaps, totalReturn];
}

async function run() {
    // For manual input reference
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
    const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca';
    const IMBTC = '0x3212b29e33587a00fb1c83346f5dbfa69a458923';

    const runLoop = 7;
    const amounts = [
        new BigNumber(0.1).times(BONE),
        new BigNumber(1.7).times(BONE),
        new BigNumber(107.6).times(BONE),
        new BigNumber(1000.77).times(BONE),
    ];

    let trade: string = 'swapExactOut';
    const allPoolsReturned = await sor.getAllPublicSwapPools();
    const poolTokens = await getPoolTokens();

    let resultTable = [];

    console.log(`Running for ${runLoop} random tokens...`);

    for (let i = 0; i < runLoop; i++) {
        trade = trade === 'swapExactIn' ? 'swapExactOut' : 'swapExactIn';
        const tokenOneIndex = Math.floor(
            Math.random() * poolTokens.poolTokens.length
        );
        const tokenTwoIndex = Math.floor(
            Math.random() * poolTokens.poolTokens.length
        );

        for (let j = 0; j < amounts.length; j++) {
            let amount = amounts[j];
            console.log(
                `${i}: ${utils.formatEther(amount.toString())} ${
                    poolTokens.poolTokens[tokenOneIndex].symbol
                }/${poolTokens.poolTokens[tokenTwoIndex].symbol}`
            );

            let directSwaps,
                directTotal = bnum(0);

            if (trade !== 'swapExactOut') {
                [directSwaps, directTotal] = await directLegacy(
                    allPoolsReturned,
                    poolTokens.poolTokens[tokenOneIndex].address,
                    poolTokens.poolTokens[tokenTwoIndex].address,
                    trade,
                    amount
                );
            }
            let [sorDirectSwaps, sorDirectTotal] = await SorDirectOnly(
                allPoolsReturned,
                poolTokens.poolTokens[tokenOneIndex].address,
                poolTokens.poolTokens[tokenTwoIndex].address,
                trade,
                amount
            );
            let [sorMultiSwaps, sorMultiTotal] = await SorMultihop(
                allPoolsReturned,
                poolTokens.poolTokens[tokenOneIndex].address,
                poolTokens.poolTokens[tokenTwoIndex].address,
                trade,
                amount
            );

            let result = '';

            if (trade !== 'swapExactOut') {
                if (
                    !directTotal.eq(sorDirectTotal) &&
                    sorDirectTotal.lt(directTotal)
                ) {
                    console.log(`!!!! Difference in Direct Compare`);
                    result += `Direct Compare Issue. `;
                }
            }

            if (sorMultiTotal.lt(sorDirectTotal) && trade === 'swapExactIn') {
                console.log(`!!!! swapExactIn Multiswap Total < Direct !!!!`);
                result += `Multiswap Total < Direct`;
            } else if (
                sorMultiTotal.gt(sorDirectTotal) &&
                trade === 'swapExactOut'
            ) {
                if (!sorDirectTotal.isZero()) {
                    console.log(
                        `!!!! swapExactOut Multiswap Total In > Direct !!!!`
                    );
                    result += `Multiswap Total In > Direct`;
                }
            }

            /*
            if(sorMultiTotal.isZero()){
              i--;
            }
            */

            result = result === '' ? 'OK' : result;
            const totalMultiSwaps = sorMultiSwaps.reduce(
                (acc, seq) => acc + seq.length,
                0
            );

            let resultObj = {
                trade: `${trade} ${utils.formatEther(amount.toString())}`,
                pairs: `${poolTokens.poolTokens[tokenOneIndex].symbol}/${poolTokens.poolTokens[tokenTwoIndex].symbol}`,
                directTotal: utils.formatEther(directTotal.toString()),
                sorDirectTotal: utils.formatEther(sorDirectTotal.toString()),
                sorMultiHopTotal: utils.formatEther(sorMultiTotal.toString()),
                noSwapsMulti: totalMultiSwaps,
                result: result,
            };

            resultTable.push(resultObj);
        }
    }

    console.table(resultTable);
}

run();
