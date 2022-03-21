// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/staBalPaths.spec.ts
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();
import { config, expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    PoolDictionary,
    SwapPairType,
    SubgraphPoolBase,
    SorConfig,
    NewPath,
    PoolFilter,
    SwapOptions,
    SwapTypes,
} from '../src';
import {
    getPathsUsingStaBalPool,
    createPath,
    getHighestLiquidityPool,
    parseToPoolsDict,
    getBoostedPaths,
} from '../src/routeProposal/filtering';
import staBalPools from './testData/staBal/staBalPools.json';
import { checkPath, poolsCheckPath, simpleCheckPath } from './lib/testHelpers';
import {
    BAL,
    TUSD,
    MKR,
    sorConfigTestStaBal,
    sorConfigEth,
} from './lib/constants';
import { BigNumber } from '@ethersproject/bignumber';
import { RouteProposer } from '../src/routeProposal';

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

            itCreatesCorrectPath(
                tokenIn,
                tokenOut,
                cloneDeep(staBalPools.pools),
                correctPoolIds
            );

            const [pathData] = getPaths(
                tokenIn,
                tokenOut,
                SwapTypes.SwapExactIn,
                cloneDeep(staBalPools.pools),
                10,
                sorConfigTestStaBal
            );
            expect(pathData.length).to.eq(1);
            poolsCheckPath(pathData[0], ['staBalPair2', 'staBalPair1']);
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
                const poolsAll = itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    ['staBalPair1', 'usdcConnecting', 'balPool']
                );

                // Hop out as it is USDC > tokenOut
                const mostLiquidPool = getHighestLiquidityPool(
                    sorConfigTestStaBal.usdcConnectingPool.usdc,
                    tokenOut,
                    SwapPairType.HopOut,
                    poolsAll
                );

                expect(mostLiquidPool).to.eq('balPool');
            });

            it(`should create a valid multihop path`, () => {
                const poolsAll = itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    ['staBalPair1', 'usdcConnecting', 'balPool']
                );

                const staBalPoolIdIn = 'staBalPair1';
                const staBalPoolIn = poolsAll[staBalPoolIdIn];
                const hopTokenStaBal = sorConfigTestStaBal.staBal3Pool.address;
                const usdcConnectingPool =
                    poolsAll[sorConfigTestStaBal.usdcConnectingPool.id];

                const multihopPath = createPath(
                    [
                        tokenIn,
                        hopTokenStaBal,
                        sorConfigTestStaBal.usdcConnectingPool.usdc,
                    ],
                    [staBalPoolIn, usdcConnectingPool]
                );

                checkPath(
                    ['staBalPair1', 'usdcConnecting'],
                    poolsAll,
                    multihopPath,
                    tokenIn,
                    sorConfigTestStaBal.usdcConnectingPool.usdc
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
                const poolsAll = itCreatesCorrectPath(
                    tokenIn,
                    tokenOut,
                    cloneDeep(staBalPools.pools),
                    ['balPool', 'usdcConnecting', 'staBalPair1']
                );

                // Hop in as it is tokenIn > USDC
                const mostLiquidPool = getHighestLiquidityPool(
                    tokenIn,
                    sorConfigTestStaBal.usdcConnectingPool.usdc,
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
    config: SorConfig = sorConfigTestStaBal
): PoolDictionary {
    const poolsAll = parseToPoolsDict(pools, 0);

    const paths = getPathsUsingStaBalPool(
        tokenIn,
        tokenOut,
        poolsAll,
        poolsAll,
        config
    );

    if (expectedPoolIds.length === 0) {
        expect(paths.length).to.eq(0);
        return poolsAll;
    }

    expect(paths.length).to.eq(1);
    poolsCheckPath(paths[0], expectedPoolIds);
    return poolsAll;
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
