// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/linear.spec.ts
import { assert, expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { PoolDictionary, NewPath, SwapTypes, SubgraphPoolBase } from '../src';
import {
    filterPoolsOfInterest,
    filterHopPools,
    parseToPoolsDict,
    getBoostedPaths,
} from '../src/routeProposal/filtering';
import { calculatePathLimits } from '../src/routeProposal/pathLimits';
import { checkPath } from './lib/testHelpers';
import {
    DAI,
    aDAI,
    bDAI,
    USDC,
    bUSDC,
    BAL,
    STABAL3PHANTOM,
    TestToken,
    MKR,
    GUSD,
    WETH,
    TUSD,
    bTUSD,
    USDT,
    LINEAR_AUSDT,
    LINEAR_ADAI,
    aUSDT,
    KOVAN_BAL,
    AAVE_USDT,
    sorConfigTest,
    sorConfigKovan,
} from './lib/constants';

// Multiple boosted pools
import boostedPools from './testData/boostedPools/multipleBoosted.json';

const maxPools = 10;
describe('Multiple boosted pools, path creation test', () => {
    context('Case with no linear pools', () => {
        it('TUSD-BAL', () => {
            const tokenIn = TUSD.address;
            const tokenOut = BAL.address;
            const [, , paths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools
            );
            assert.equal(paths.length, 4);
        });
        it('BAL-TUSD', () => {
            const tokenIn = BAL.address;
            const tokenOut = TUSD.address;
            const [, , paths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools
            );
            assert.equal(paths.length, 4);
        });
    });
    context('Case with linear pools', () => {
        it('DAI-BAL', () => {
            const tokenIn = DAI.address;
            const tokenOut = BAL.address;
            const [, , paths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools
            );
            assert.equal(paths.length, 4);
        });
        it('BAL-DAI', () => {
            const tokenIn = BAL.address;
            const tokenOut = DAI.address;
            const [, , paths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools
            );
            assert.equal(paths.length, 4);
        });
    });
    context('BBausd and Weth to Dai', () => {
        it('four combinations', () => {
            const binaryOption = [true, false];
            for (const reverse of binaryOption) {
                const tokens = [
                    [WETH.address, sorConfigTest.BBausd.address],
                    [DAI.address],
                ];
                if (reverse) tokens.reverse();
                for (const tokenIn of tokens[0]) {
                    for (const tokenOut of tokens[1]) {
                        const [, , paths] = getPaths(
                            tokenIn,
                            tokenOut,
                            SwapTypes.SwapExactIn,
                            boostedPools.pools,
                            maxPools
                        );
                        assert.equal(paths.length, 2);
                    }
                }
            }
        });
    });
    // To do: more thorough tests should be applied to verify correctness of paths
});

function getPaths(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools: SubgraphPoolBase[],
    maxPools: number
): [NewPath[], PoolDictionary, NewPath[]] {
    const poolsAll = parseToPoolsDict(cloneDeep(pools), 0);

    const [poolsFilteredDict, hopTokens] = filterPoolsOfInterest(
        poolsAll,
        tokenIn,
        tokenOut,
        maxPools
    );

    let pathData: NewPath[] = [];
    [, pathData] = filterHopPools(
        tokenIn,
        tokenOut,
        hopTokens,
        poolsFilteredDict
    );

    const boostedPaths = getBoostedPaths(
        tokenIn,
        tokenOut,
        poolsAll,
        poolsFilteredDict,
        sorConfigTest
    );
    for (const path of boostedPaths) {
        console.log('Path begins');
        for (const swap of path.swaps) {
            console.log(swap.tokenIn, ' ', swap.tokenOut);
        }
    }
    pathData = pathData.concat(boostedPaths);
    const [paths] = calculatePathLimits(pathData, swapType);
    return [paths, poolsAll, boostedPaths];
}
