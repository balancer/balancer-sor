// Create paths of different lengths 1, 2, 3, 4
// and test getLimitAmountSwapForPath, getOutputAmountSwapForPath,
// getSpotPriceAfterSwapForPath, getDerivativeSpotPriceAfterSwapForPath
// Each of the last two should be the derivative of the previous one.

import { assert } from 'chai';
import { NewPath, PoolBase, PoolPairBase, Swap, SwapTypes } from '../src/types';
import {
    calculatePathLimits,
    getLimitAmountSwapForPath,
} from '../src/routeProposal/pathLimits';
import testInfo from './testData/pathMath/pathPools.json';
import { Zero } from '@ethersproject/constants';
import { parseFixed, BigNumber } from '@ethersproject/bignumber';
import { BigNumber as OldBigNumber, bnum } from '../src/utils/bignumber';
import { DAI, USDC, WETH } from './lib/constants';
import { getOutputAmountSwap } from '../src/pools';
import { parseToPoolsDict } from '../src/routeProposal/filtering';
import {
    getDerivativeSpotPriceAfterSwapForPath,
    getOutputAmountSwapForPath,
    getSpotPriceAfterSwapForPath,
} from '../src/router/helpersClass';

describe('pathMath: Tests path quantities derived from underlying pools quantities', () => {
    const poolsAllDict = parseToPoolsDict(testInfo.pools, 1);

    // USDC > [...] > WETH > [...] > DAI > [...] > WBTC > [...] > SNX
    let longPath = createPath(
        [
            USDC.address,
            WETH.address,
            DAI.address,
            '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC (but different)
            '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', // SNX
        ],
        [
            poolsAllDict['0x12d6b6e24fdd9849abd42afd8f5775d36084a828'],
            poolsAllDict['0x165a50bc092f6870dc111c349bae5fc35147ac86'],
            poolsAllDict['0x2dbd24322757d2e28de4230b1ca5b88e49a76979'],
            poolsAllDict['0x07d13ed39ee291c1506675ff42f9b2b6b50e2d3e'],
        ]
    );
    const length = longPath.pools.length;
    assert.equal(length, 4, 'path length expected to be 4');

    // Test to consider: apply the following checks systematically for many different paths.
    it('Test path limits for long paths', async () => {
        [[longPath]] = calculatePathLimits([longPath], SwapTypes.SwapExactIn);
        let pathLimit = longPath.limitAmount;
        let expectedPathLimit = getExpectedPathLimit(
            longPath,
            SwapTypes.SwapExactIn
        );

        assert.approximately(
            expectedPathLimit.sub(pathLimit).toNumber(),
            0,
            // or for relative error use: PRECISION = One.mul(10 ** 10);
            // expectedPathLimit.mul(PRECISION).div(pathLimit).toNumber(),
            // PRECISION.toNumber(),
            1,
            'incorrect limit'
        );

        [[longPath]] = calculatePathLimits([longPath], SwapTypes.SwapExactOut);
        pathLimit = longPath.limitAmount;
        expectedPathLimit = getExpectedPathLimit(
            longPath,
            SwapTypes.SwapExactOut
        );

        assert.approximately(
            expectedPathLimit.sub(pathLimit).toNumber(),
            0,
            1,
            'incorrect limit'
        );
    });

    it('Path limits, inclusion tests', async () => {
        // A path contained in another with same starting token must have a smaller limit.
        // exact in
        let previousLimit = BigNumber.from(0);
        for (let i = 1; i <= length; i++) {
            const path = getSubpath(longPath, 0, i);
            const limit = getLimitAmountSwapForPath(
                path,
                SwapTypes.SwapExactIn
            );
            // isAtMost verifies that first argument <= second argument
            if (i >= 2)
                assert.isAtMost(
                    limit.toNumber(),
                    previousLimit.toNumber(),
                    'each limit has to be at most as much as the previous one'
                );
            previousLimit = limit;
        }
        // exact out
        previousLimit = BigNumber.from(0);
        for (let i = length - 1; i >= 0; i--) {
            const path = getSubpath(longPath, i, length);
            const limit = getLimitAmountSwapForPath(
                path,
                SwapTypes.SwapExactOut
            );
            if (i <= length - 2)
                assert.isAtMost(
                    limit.sub(previousLimit).toNumber(),
                    0,
                    'each limit has to be at most as much as the previous one'
                );
            previousLimit = limit;
        }
    });
    let delta = 10;
    const error = 0.0001;

    context('Path spot prices', async () => {
        it('Check derivatives, exact in', async () => {
            const inputDecimals = 6; // USDC
            const amount = bnum(400);
            for (let i = 1; i <= length; i++) {
                let path = getSubpath(longPath, 0, i);
                [[path]] = calculatePathLimits([path], SwapTypes.SwapExactIn);
                checkPathDerivative(
                    getOutputAmountSwapForPath,
                    getSpotPriceAfterSwapForPath,
                    path,
                    SwapTypes.SwapExactIn,
                    amount,
                    inputDecimals,
                    delta,
                    error,
                    true
                );
                checkPathDerivative(
                    getSpotPriceAfterSwapForPath,
                    getDerivativeSpotPriceAfterSwapForPath,
                    path,
                    SwapTypes.SwapExactIn,
                    amount,
                    inputDecimals,
                    delta,
                    error,
                    false
                );
            }
        });
        it('Check derivatives, exact out', async () => {
            const inputDecimals = 6; // SNX
            const amount = bnum(40000);
            delta = 500;
            for (let i = length - 1; i >= 0; i--) {
                let path = getSubpath(longPath, i, length);
                [[path]] = calculatePathLimits([path], SwapTypes.SwapExactOut);
                checkPathDerivative(
                    getOutputAmountSwapForPath,
                    getSpotPriceAfterSwapForPath,
                    path,
                    SwapTypes.SwapExactOut,
                    amount,
                    inputDecimals,
                    delta,
                    error,
                    false
                );
                checkPathDerivative(
                    getSpotPriceAfterSwapForPath,
                    getDerivativeSpotPriceAfterSwapForPath,
                    path,
                    SwapTypes.SwapExactOut,
                    amount,
                    inputDecimals,
                    delta,
                    error,
                    false
                );
            }
        });
    });
});

function getExpectedPathLimit(path: NewPath, swapType: SwapTypes): BigNumber {
    const poolPairData = path.poolPairData;
    const length = poolPairData.length;
    let decimals: number;
    const pools = path.pools;
    let limit: OldBigNumber = bnum(Infinity);
    if (swapType == SwapTypes.SwapExactIn) {
        decimals = poolPairData[0].decimalsIn;
        for (let i = 0; i < length; i++) {
            const poolLimit = pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactIn
            );
            let pulledPoolLimit = poolLimit;
            for (let j = i; j > 0; j--) {
                pulledPoolLimit = getOutputAmountSwap(
                    pools[j - 1],
                    poolPairData[j - 1],
                    SwapTypes.SwapExactOut,
                    pulledPoolLimit
                );
            }
            limit = pulledPoolLimit.lt(limit) ? pulledPoolLimit : limit;
        }
    } else {
        // SwapExactOut
        decimals = poolPairData[length - 1].decimalsOut;
        for (let i = 0; i < length; i++) {
            const poolLimit = pools[i].getLimitAmountSwap(
                poolPairData[i],
                SwapTypes.SwapExactOut
            );
            let pushedPoolLimit = poolLimit;
            for (let j = i + 1; j < length; j++) {
                pushedPoolLimit = getOutputAmountSwap(
                    pools[j],
                    poolPairData[j],
                    SwapTypes.SwapExactIn,
                    pushedPoolLimit
                );
            }
            limit = pushedPoolLimit.lt(limit) ? pushedPoolLimit : limit;
        }
    }
    return parseFixed(limit.dp(decimals).toString(), decimals);
}

function checkPathDerivative(
    fn: (
        path: NewPath,
        swapType: SwapTypes,
        amount: OldBigNumber,
        inputDecimals: number
    ) => OldBigNumber,
    der: (
        path: NewPath,
        swapType: SwapTypes,
        amount: OldBigNumber
    ) => OldBigNumber,
    path: NewPath,
    swapType: SwapTypes,
    amount: OldBigNumber,
    inputDecimals: number,
    delta: number,
    error: number,
    inverse = false
) {
    const x = amount;
    const f1 = fn(path, swapType, x.plus(delta), inputDecimals);
    const f2 = fn(path, swapType, x, inputDecimals);
    let incrementalQuotient = f1.minus(f2).div(delta);
    if (inverse) incrementalQuotient = bnum(1).div(incrementalQuotient);
    const der_ans = der(path, swapType, x);
    assert.approximately(
        incrementalQuotient.div(der_ans).toNumber(),
        1,
        error,
        'wrong result'
    );
}

function getSubpath(path: NewPath, startIndex: number, endIndex: number) {
    const pools = path.pools.slice(startIndex, endIndex);
    const poolPairData = path.poolPairData.slice(startIndex, endIndex);
    const tokens: string[] = [poolPairData[0].tokenIn];
    for (const eachPoolPairData of poolPairData) {
        tokens.push(eachPoolPairData.tokenOut);
    }
    return createPath(tokens, pools);
}

function createPath(tokens: string[], pools: PoolBase[]): NewPath {
    let tI: string, tO: string;
    const swaps: Swap[] = [];
    const poolPairData: PoolPairBase[] = [];
    let id = '';

    for (let i = 0; i < pools.length; i++) {
        tI = tokens[i];
        tO = tokens[i + 1];
        const poolPair = pools[i].parsePoolPairData(tI, tO);
        poolPairData.push(poolPair);
        id = id + poolPair.id;

        const swap: Swap = {
            pool: pools[i].id,
            tokenIn: tI,
            tokenOut: tO,
            tokenInDecimals: poolPair.decimalsIn,
            tokenOutDecimals: poolPair.decimalsOut,
        };
        swaps.push(swap);
    }
    const path: NewPath = {
        id,
        swaps,
        limitAmount: Zero,
        poolPairData,
        pools,
    };

    return path;
}
