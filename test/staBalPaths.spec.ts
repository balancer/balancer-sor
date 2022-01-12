// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/staBalPaths.spec.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    PoolDictionary,
    SwapPairType,
    SubgraphPoolBase,
    SorConfig,
} from '../src';
import {
    filterPoolsOfInterest,
    getPathsUsingStaBalPool,
    createPath,
    getHighestLiquidityPool,
    filterHopPools,
    parseToPoolsDict,
} from '../src/routeProposal/filtering';
import staBalPools from './testData/staBal/staBalPools.json';
import { checkPath } from './lib/testHelpers';
import { BAL, TUSD, MKR, sorConfigTest, sorConfigEth } from './lib/constants';

const maxPools = 4;

describe(`staBalPaths.`, () => {
    it(`should be no USDC connecting pool for mainnet`, () => {
        const tokenIn = TUSD.address;
        const tokenOut = BAL.address;
        const correctPoolIds = [];

        itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            correctPoolIds,
            sorConfigEth
        );
    });

    context('when both tokens are paired with staBAL', () => {
        const tokenIn = '0x0000000000000000000000000000000000000002';
        const tokenOut = TUSD.address;
        it('returns an empty array', () => {
            // We expect no staBalPaths as the path already exists as multihop
            const correctPoolIds = [];

            const [poolsFiltered, hopTokens, poolsAll] = itCreatesCorrectPath(
                tokenIn,
                tokenOut,
                cloneDeep(staBalPools.pools),
                correctPoolIds
            );

            // Returns multihop path: TUSD2>[staBalPair2]>staBAL>[staBalPair1]>TUSD
            const [, pathData] = filterHopPools(
                tokenIn,
                tokenOut,
                hopTokens,
                poolsFiltered
            );

            expect(pathData.length).to.eq(1);

            checkPath(
                ['staBalPair2', 'staBalPair1'],
                poolsAll,
                pathData[0],
                tokenIn,
                tokenOut
            );
        });
    });

    context('when neither token is paired with staBAL', () => {
        const tokenIn = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
        const tokenOut = '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619';
        it('returns an empty array', () => {
            const correctPoolIds = [];

            itCreatesCorrectPath(
                tokenIn,
                tokenOut,
                cloneDeep(staBalPools.pools),
                correctPoolIds
            );
        });
    });

    context('when tokenIn is paired with staBAL', () => {
        const tokenIn = TUSD.address;
        context('when tokenOut is paired with USDC', () => {
            const tokenOut = BAL.address;
            it('returns the expected route', () => {
                // i.e. TUSD>[staBalPair1]>staBAL>[usdcConnecting]>USDC>[balPool]>BAL
                const correctPoolIds = [
                    'staBalPair1',
                    'usdcConnecting',
                    'balPool',
                ];

                itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    correctPoolIds
                );
            });

            it('should use the most liquid tokenOut-USDC pool', () => {
                const [, , poolsAll] = itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    ['staBalPair1', 'usdcConnecting', 'balPool']
                );

                // Hop out as it is USDC > tokenOut
                const mostLiquidPool = getHighestLiquidityPool(
                    sorConfigTest.usdcConnectingPool.usdc,
                    tokenOut,
                    SwapPairType.HopOut,
                    poolsAll
                );

                expect(mostLiquidPool).to.eq('balPool');
            });

            it(`should create a valid multihop path`, () => {
                const [poolsOfInterest, , poolsAll] = itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    ['staBalPair1', 'usdcConnecting', 'balPool']
                );

                const staBalPoolIdIn = 'staBalPair1';
                const staBalPoolIn = poolsOfInterest[staBalPoolIdIn];
                const hopTokenStaBal = sorConfigTest.staBal3Pool.address;
                const usdcConnectingPool =
                    poolsAll[sorConfigTest.usdcConnectingPool.id];

                const multihopPath = createPath(
                    [
                        tokenIn,
                        hopTokenStaBal,
                        sorConfigTest.usdcConnectingPool.usdc,
                    ],
                    [staBalPoolIn, usdcConnectingPool]
                );

                checkPath(
                    ['staBalPair1', 'usdcConnecting'],
                    poolsAll,
                    multihopPath,
                    tokenIn,
                    sorConfigTest.usdcConnectingPool.usdc
                );
            });
        });

        context('when tokenOut is not paired with USDC', () => {
            const tokenOut = MKR.address;
            it(`returns an empty array`, () => {
                const correctPoolIds = [];

                itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    correctPoolIds
                );
            });
        });
    });

    context('when tokenOut is paired with staBAL', () => {
        const tokenOut = TUSD.address;
        context('when tokenIn is paired with USDC', () => {
            const tokenIn = BAL.address;

            it('returns the expected route', () => {
                // i.e. BAL>[balPool]>USDC>[usdcConnecting]>staBAL>[staBalPair1]>TUSD
                const correctPoolIds = [
                    'balPool',
                    'usdcConnecting',
                    'staBalPair1',
                ];

                itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    correctPoolIds
                );
            });

            it('should use the most liquid tokenIn-USDC pool', () => {
                const [, , poolsAll] = itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    ['balPool', 'usdcConnecting', 'staBalPair1']
                );

                // Hop in as it is tokenIn > USDC
                const mostLiquidPool = getHighestLiquidityPool(
                    tokenIn,
                    sorConfigTest.usdcConnectingPool.usdc,
                    SwapPairType.HopIn,
                    poolsAll
                );

                expect(mostLiquidPool).to.eq('balPool');
            });
        });

        context('when tokenIn is not paired with USDC', () => {
            it(`returns an empty array`, () => {
                const tokenIn = MKR.address;
                const tokenOut = TUSD.address;
                const correctPoolIds = [];

                itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    correctPoolIds
                );
            });
        });
    });
});

function itCreatesCorrectPath(
    tokenIn: string,
    tokenOut: string,
    pools: SubgraphPoolBase[],
    expectedPoolIds: string[],
    config: SorConfig = sorConfigTest
): [PoolDictionary, string[], PoolDictionary] {
    const poolsAll = parseToPoolsDict(pools, 0);

    const [poolsOfInterest, hopTokens] = filterPoolsOfInterest(
        poolsAll,
        tokenIn,
        tokenOut,
        maxPools
    );

    const paths = getPathsUsingStaBalPool(
        tokenIn,
        tokenOut,
        poolsAll,
        poolsOfInterest,
        config
    );

    if (expectedPoolIds.length === 0) {
        expect(paths.length).to.eq(0);
        return [poolsOfInterest, hopTokens, poolsAll];
    }

    expect(paths.length).to.eq(1);

    checkPath(expectedPoolIds, poolsAll, paths[0], tokenIn, tokenOut);

    return [poolsOfInterest, hopTokens, poolsAll];
}
