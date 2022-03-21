// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/linear.spec.ts
import { assert, expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    PoolDictionary,
    NewPath,
    SwapTypes,
    SubgraphPoolBase,
    SorConfig,
    SwapOptions,
    PoolFilter,
} from '../src';
import {
    parseToPoolsDict,
    getBoostedPaths,
} from '../src/routeProposal/filtering';
import { bnum } from '../src/utils/bignumber';
import { calculatePathLimits } from '../src/routeProposal/pathLimits';
import { getFullSwap, simpleCheckPath } from './lib/testHelpers';
import {
    DAI,
    aDAI,
    bbaDAI,
    USDC,
    BAL,
    TestToken,
    MKR,
    GUSD,
    WETH,
    TUSD,
    USDT,
    LINEAR_AUSDT,
    LINEAR_ADAI,
    aUSDT,
    KOVAN_BAL,
    AAVE_USDT,
    sorConfigTestBoosted,
    bbaUSD,
} from './lib/constants';

// Multiple boosted pools
import boostedPools from './testData/boostedPools/multipleBoosted.json';
import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { getOutputAmountSwapForPath } from '../src/router/helpersClass';
import { JsonRpcProvider } from '@ethersproject/providers';
import { RouteProposer } from '../src/routeProposal';

const maxPools = 10;
describe('multiple boosted pools, path creation test', () => {
    context('Case with no linear pools', () => {
        it('TUSD-BAL', () => {
            const tokenIn = TUSD.address;
            const tokenOut = BAL.address;
            const [paths, , boostedPaths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools,
                sorConfigTestBoosted
            );
            const tokensChains = [
                [TUSD.address, WETH.address, BAL.address],
                [TUSD.address, WETH.address, bbaUSD.address, BAL.address],
                [TUSD.address, bbaUSD.address, WETH.address, BAL.address],
                [TUSD.address, bbaUSD.address, BAL.address],
            ];
            const poolsChains = [
                ['weightedTusdWeth', 'weightedBalWeth'],
                ['weightedTusdWeth', 'weightedWeth-BBausd', 'bbaUSD-BAL'],
                ['BBaUSD-TUSD', 'weightedWeth-BBausd', 'weightedBalWeth'],
                ['BBaUSD-TUSD', 'bbaUSD-BAL'],
            ];
            for (let i = 0; i < 4; i++) {
                assert.isTrue(
                    simpleCheckPath(paths[i], poolsChains[i], tokensChains[i])
                );
            }
            assert.equal(boostedPaths.length, 2);
            assert.equal(paths.length, 4);
        });
        it('BAL-TUSD', () => {
            const tokenIn = BAL.address;
            const tokenOut = TUSD.address;
            const [paths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools,
                sorConfigTestBoosted
            );
            assert.equal(paths.length, 4);
            assert.isTrue(checkNoDuplicate(paths));
        });
    });
    context('Case with linear pools', () => {
        it('DAI-BAL', () => {
            const tokenIn = DAI.address;
            const tokenOut = BAL.address;
            const [paths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools,
                sorConfigTestBoosted
            );
            assert.equal(paths.length, 4);
            assert.isTrue(checkNoDuplicate(paths));
        });
        it('BAL-DAI', () => {
            const tokenIn = BAL.address;
            const tokenOut = DAI.address;
            const [paths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools,
                sorConfigTestBoosted
            );
            assert.equal(paths.length, 4);
            const bbfDaiAddress = '0x0000000000000000000000000000000000000000';
            const tokensChains = [
                [BAL.address, bbaUSD.address, bbfDaiAddress, DAI.address],
                [BAL.address, bbaUSD.address, bbaDAI.address, DAI.address],
                // eslint-disable-next-line prettier/prettier
                [
                    BAL.address,
                    WETH.address,
                    bbaUSD.address,
                    bbfDaiAddress,
                    DAI.address,
                ],
                // eslint-disable-next-line prettier/prettier
                [
                    BAL.address,
                    WETH.address,
                    bbaUSD.address,
                    bbaDAI.address,
                    DAI.address,
                ],
            ];
            const poolsChains = [
                ['bbaUSD-BAL', 'bbaUSD-bbfDAI', 'FuseLinearDai'],
                ['bbaUSD-BAL', 'bbaUSD-Pool', 'AaveLinearDai'],
                // eslint-disable-next-line prettier/prettier
                [
                    'weightedBalWeth',
                    'weightedWeth-BBausd',
                    'bbaUSD-bbfDAI',
                    'FuseLinearDai',
                ],
                // eslint-disable-next-line prettier/prettier
                [
                    'weightedBalWeth',
                    'weightedWeth-BBausd',
                    'bbaUSD-Pool',
                    'AaveLinearDai',
                ],
            ];
            for (let i = 0; i < 4; i++) {
                assert.isTrue(
                    simpleCheckPath(paths[i], poolsChains[i], tokensChains[i])
                );
            }
        });
    });
    context('Direct Weth - bbaUSD', () => {
        it('WETH-bbaUSD', () => {
            const tokenIn = WETH.address;
            const tokenOut = bbaUSD.address;
            const [paths, , boostedPaths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools,
                sorConfigTestBoosted
            );
            assert.equal(paths.length, 3);
            assert.equal(boostedPaths.length, 0);
        });
    });
    context('bbausd and Weth to Dai', () => {
        it('four combinations', () => {
            const binaryOption = [true, false];
            if (!sorConfigTestBoosted.bbausd) return;
            for (const reverse of binaryOption) {
                const tokens = [
                    [WETH.address, sorConfigTestBoosted.bbausd.address],
                    [DAI.address],
                ];
                if (reverse) tokens.reverse();
                for (const tokenIn of tokens[0]) {
                    for (const tokenOut of tokens[1]) {
                        const [paths, , boostedPaths] = getPaths(
                            tokenIn,
                            tokenOut,
                            SwapTypes.SwapExactIn,
                            boostedPools.pools,
                            maxPools,
                            sorConfigTestBoosted
                        );
                        assert.equal(paths.length, 2);
                        assert.isTrue(checkNoDuplicate(paths));
                        if (
                            tokenIn == WETH.address ||
                            tokenOut == WETH.address
                        ) {
                            assert.equal(boostedPaths.length, 2);
                        } else {
                            assert.equal(boostedPaths.length, 0);
                        }
                    }
                }
            }
        });
    });
    context('Verify that SOR chooses best path', () => {
        it('swapExactIn case', async () => {
            // For small enough amounts, the best route must typically be
            // formed exclusively by only one path.
            assert(
                checkBestPath(
                    TUSD,
                    BAL,
                    SwapTypes.SwapExactIn,
                    91.23098,
                    boostedPools.pools,
                    sorConfigTestBoosted
                ),
                'SOR path is not the best one'
            );
            assert(
                checkBestPath(
                    BAL,
                    WETH,
                    SwapTypes.SwapExactIn,
                    910000.23098,
                    boostedPools.pools,
                    sorConfigTestBoosted
                ),
                'SOR path is not the best one'
            );
        });
    });

    context('LBP cases', () => {
        it('OHM-BAL', () => {
            const tokenIn = '0x0000000000000000000000000000000000000009';
            const tokenOut = BAL.address;
            const [paths, , boostedPaths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools,
                sorConfigTestBoosted
            );
            assert.equal(
                paths[0].id,
                'LBPweightedTusdOhmweightedTusdWethweightedBalWeth'
            );
            assert.equal(
                paths[3].id,
                'LBPweightedTusdOhmBBaUSD-TUSDbbaUSD-BAL'
            );
            const OHM = tokenIn;
            const tokensChains = [
                [OHM, TUSD.address, WETH.address, bbaUSD.address, BAL.address],
                [OHM, TUSD.address, bbaUSD.address, WETH.address, BAL.address],
            ];
            const poolsChains = [
                [
                    'LBPweightedTusdOhm',
                    'weightedTusdWeth',
                    'weightedWeth-BBausd',
                    'bbaUSD-BAL',
                ],
                [
                    'LBPweightedTusdOhm',
                    'BBaUSD-TUSD',
                    'weightedWeth-BBausd',
                    'weightedBalWeth',
                ],
            ];
            for (const path of paths) {
                console.log(path.id);
            }
            for (let i = 0; i < 2; i++) {
                assert.isTrue(
                    // eslint-disable-next-line prettier/prettier
                    simpleCheckPath(
                        paths[i + 1],
                        poolsChains[i],
                        tokensChains[i]
                    )
                );
            }
            assert.equal(boostedPaths.length, 4);
            assert.equal(paths.length, 4);
        });
        it('DAI-OHM', () => {
            const tokenIn = DAI.address;
            const tokenOut = '0x0000000000000000000000000000000000000009';
            const [paths, , boostedPaths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools,
                sorConfigTestBoosted
            );
            const tokensChains = [
                [
                    DAI.address,
                    bbaDAI.address,
                    bbaUSD.address,
                    WETH.address,
                    TUSD.address,
                    tokenOut,
                ],
            ];
            const poolsChains = [
                [
                    'AaveLinearDai',
                    'bbaUSD-Pool',
                    'weightedWeth-BBausd',
                    'weightedTusdWeth',
                    'LBPweightedTusdOhm',
                ],
            ];
            assert.isTrue(
                simpleCheckPath(paths[0], poolsChains[0], tokensChains[0])
            );
            assert.equal(
                paths[1].id,
                'FuseLinearDaibbaUSD-bbfDAIweightedWeth-BBausdweightedTusdWethLBPweightedTusdOhm'
            );
            assert.equal(
                paths[2].id,
                'FuseLinearDaibbaUSD-bbfDAIBBaUSD-TUSDLBPweightedTusdOhm'
            );
            assert.equal(
                paths[3].id,
                'AaveLinearDaibbaUSD-PoolBBaUSD-TUSDLBPweightedTusdOhm'
            );
            assert.equal(boostedPaths.length, 4);
            assert.equal(paths.length, 4);
        });
        it('OHM-QRE', () => {
            const tokenIn = '0x0000000000000000000000000000000000000009';
            const tokenOut = '0x0000000000000000000000000000000000000011';
            const [paths, , boostedPaths] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                boostedPools.pools,
                maxPools,
                sorConfigTestBoosted
            );
            for (const path of paths) {
                console.log(path.id);
            }
            assert.equal(
                paths[0].id,
                'LBPweightedTusdOhmweightedTusdWethLBPweightedWethQre'
            );
            assert.equal(
                paths[1].id,
                'LBPweightedTusdOhmBBaUSD-TUSDweightedWeth-BBausdLBPweightedWethQre'
            );
            assert.equal(boostedPaths.length, 2);
            assert.equal(paths.length, 2);
        });
        it('Test correctness in absence of LBP raising info at config', () => {
            const sorConfigNoLbpRaising = cloneDeep(sorConfigTestBoosted);
            delete sorConfigNoLbpRaising['lbpRaisingTokens'];
            const sorConfigNoRaisingTusd = cloneDeep(sorConfigNoLbpRaising);
            sorConfigNoRaisingTusd['lbpRaisingTokens'] = [
                '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            ];
            const tokenIn = TUSD.address;
            const tokenOut = BAL.address;
            const pathsCases: NewPath[][] = [];
            const sorConfigCases: SorConfig[] = [
                sorConfigTestBoosted,
                sorConfigNoLbpRaising,
                sorConfigNoRaisingTusd,
            ];
            for (let i = 0; i < 3; i++) {
                const [paths] = getPaths(
                    tokenIn,
                    tokenOut,
                    SwapTypes.SwapExactIn,
                    boostedPools.pools,
                    maxPools,
                    sorConfigCases[i]
                );
                pathsCases.push(paths);
            }
            assert.equal(pathsCases[0].length, pathsCases[1].length);
            assert.equal(pathsCases[0].length, pathsCases[2].length);
            for (let i = 0; i < pathsCases[0].length; i++) {
                assert.equal(pathsCases[0][i].id, pathsCases[1][i].id);
                assert.equal(pathsCases[0][i].id, pathsCases[2][i].id);
            }
        });
    });
});

function checkNoDuplicate(paths: NewPath[]): boolean {
    const n = paths.length;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            if (paths[i] == paths[j]) return false;
        }
    }
    return true;
}

function getPaths(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools: SubgraphPoolBase[],
    maxPools: number,
    config: SorConfig
): [NewPath[], PoolDictionary, NewPath[]] {
    const poolsAll = parseToPoolsDict(cloneDeep(pools), 0);
    const routeProposer = new RouteProposer(config);
    const swapOptions: SwapOptions = {
        gasPrice: BigNumber.from(0),
        swapGas: BigNumber.from(0),
        timestamp: 0,
        maxPools: 10,
        poolTypeFilter: PoolFilter.All,
        forceRefresh: true,
    };

    const paths = routeProposer.getCandidatePaths(
        tokenIn,
        tokenOut,
        swapType,
        pools,
        swapOptions
    );

    const boostedPaths = getBoostedPaths(tokenIn, tokenOut, poolsAll, config);
    return [paths, poolsAll, boostedPaths];
}

export async function checkBestPath(
    tokenIn: TestToken,
    tokenOut: TestToken,
    swapType: SwapTypes,
    amount: number,
    pools: SubgraphPoolBase[],
    config: SorConfig
): Promise<boolean> {
    const [paths] = getPaths(
        tokenIn.address,
        tokenOut.address,
        swapType,
        pools,
        maxPools,
        config
    );
    const bnumSwapAmount = bnum(amount);
    let bestPath = paths[0];
    let bestOutcome = bnum(0);
    for (const path of paths) {
        const outcome = getOutputAmountSwapForPath(
            path,
            swapType,
            bnumSwapAmount,
            tokenIn.decimals
        );
        if (
            !bestOutcome ||
            (swapType == SwapTypes.SwapExactIn &&
                outcome.toNumber() > bestOutcome.toNumber()) ||
            (swapType == SwapTypes.SwapExactOut &&
                outcome.toNumber() < bestOutcome.toNumber())
        ) {
            bestPath = path;
            bestOutcome = outcome;
        }
    }
    const swapAmount = parseFixed(amount.toString(), tokenIn.decimals);
    const costOutputToken = BigNumber.from('0');
    const gasPrice = BigNumber.from(`10000000000`);
    const provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );
    const swapGas = BigNumber.from(`32500`);
    const swapInfo = await getFullSwap(
        cloneDeep(pools),
        tokenIn.address,
        tokenOut.address,
        tokenOut.decimals,
        maxPools,
        swapType,
        swapAmount,
        costOutputToken,
        gasPrice,
        provider,
        swapGas,
        config
    );
    let swapPathId = '';
    for (const swap of swapInfo.swaps) {
        swapPathId += swap.poolId;
    }
    let areEqual = swapPathId == bestPath.id;
    for (let i = 0; i < bestPath.swaps.length; i++) {
        if (bestPath.swaps[i].tokenIn !== swapInfo.tokenAddresses[i]) {
            areEqual = false;
        }
    }
    return areEqual;
}
