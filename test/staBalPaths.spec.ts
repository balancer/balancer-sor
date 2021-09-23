// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/staBalPaths.spec.ts
require('dotenv').config();
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    PoolDictionary,
    SwapPairType,
    NewPath,
    SubgraphPoolBase,
} from '../src/types';
import { StablePool } from '../src/pools/stablePool/stablePool';
import {
    filterPoolsOfInterest,
    getPathsUsingStaBalPool,
    createMultihopPath,
    getHighestLiquidityPool,
    filterHopPools,
} from '../src/routeProposal/filtering';
import { STABALADDR, USDCCONNECTINGPOOL } from '../src/constants';
import staBalPools from './testData/staBal/staBalPools.json';
import { checkPath } from './lib/testHelpers';

const maxPools = 4;
const chainId = 99;

describe(`staBalPaths.`, () => {
    it(`should be no USDC connecting pool for mainnet`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        const chainId = 1;
        const correctPoolIds = [];

        itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            correctPoolIds,
            chainId
        );
    });

    it(`should create a valid multihop path`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376';
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        const chainId = 99; // Test chain

        const testPools: any = cloneDeep(staBalPools.pools);

        const [poolsFiltered, , poolsAll] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools
        );

        const staBalPoolIdIn = 'staBalPair1';
        const staBalPoolIn = poolsFiltered[staBalPoolIdIn];
        const hopTokenStaBal = STABALADDR[chainId];
        const usdcConnectingPool: StablePool = poolsAll[
            USDCCONNECTINGPOOL[chainId].id
        ] as unknown as StablePool;

        const multihopPath = createMultihopPath(
            staBalPoolIn,
            usdcConnectingPool,
            tokenIn,
            hopTokenStaBal,
            USDCCONNECTINGPOOL[chainId].usdc
        );

        checkPath(
            ['staBalPair1', 'usdcConnecting'],
            poolsAll,
            multihopPath,
            tokenIn,
            USDCCONNECTINGPOOL[chainId].usdc
        );
    });

    it(`should return pool with highest liquidity, hopOut`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376';
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        const chainId = 99; // Test chain

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools
        );

        // Hop out as it is USDC > tokenOut
        const mostLiquidPool = getHighestLiquidityPool(
            USDCCONNECTINGPOOL[chainId].usdc,
            tokenOut,
            SwapPairType.HopOut,
            pools
        );

        expect(mostLiquidPool).to.eq('balPool');
    });

    it(`should return pool with highest liquidity, hopIn`, () => {
        const tokenIn = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        const tokenOut = '0x0000000000085d4780B73119b644AE5ecd22b376';
        const chainId = 99; // Test chain

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools
        );

        // Hop in as it is tokenIn > USDC
        const mostLiquidPool = getHighestLiquidityPool(
            tokenIn,
            USDCCONNECTINGPOOL[chainId].usdc,
            SwapPairType.HopIn,
            pools
        );

        expect(mostLiquidPool).to.eq('balPool');
    });

    it(`non staBal pair tokens should have no staBal path`, () => {
        const tokenIn = '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270';
        const tokenOut = '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619';
        const correctPoolIds = [];

        itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            correctPoolIds,
            chainId
        );
    });

    it(`TokenIn has no USDC pool, expect no route`, () => {
        const tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // Token With No USDC Pair
        const tokenOut = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD
        const correctPoolIds = [];

        itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            correctPoolIds,
            chainId
        );
    });

    it(`TokenOut has no USDC pool, expect no route`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD
        const tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // Token With No USDC Pair
        const correctPoolIds = [];

        itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            correctPoolIds,
            chainId
        );
    });

    it(`staBal Paired Token In`, () => {
        // staBal Pair Token In
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        // i.e. TUSD>[staBalPair1]>staBAL>[usdcConnecting]>USDC>[balPool]>BAL
        const correctPoolIds = ['staBalPair1', 'usdcConnecting', 'balPool'];

        itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            correctPoolIds,
            chainId
        );
    });

    it(`staBal Paired Token Out`, () => {
        // staBal Pair Token Out
        const tokenIn = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        const tokenOut = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD
        // i.e. BAL>[balPool]>USDC>[usdcConnecting]>staBAL>[staBalPair1]>TUSD
        const correctPoolIds = ['balPool', 'usdcConnecting', 'staBalPair1'];

        itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            correctPoolIds,
            chainId
        );
    });

    it(`staBal Paired Token In & Out`, () => {
        // staBal Pair Token In & Out
        const tokenIn = '0x0000000000000000000000000000000000000002';
        const tokenOut = '0x0000000000085d4780B73119b644AE5ecd22b376';
        // We expect no specific staBalPaths as the path already exists as multihop
        const correctPoolIds = [];

        const [poolsFiltered, hopTokens, poolsAll] = itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            correctPoolIds,
            chainId
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

function itCreatesCorrectPath(
    tokenIn: string,
    tokenOut: string,
    pools: SubgraphPoolBase[],
    expectedPoolIds: string[],
    chainId = 99
): [PoolDictionary, string[], PoolDictionary] {
    let poolsFiltered: PoolDictionary;
    let poolsAll: PoolDictionary;
    let hopTokens: string[];

    [poolsFiltered, hopTokens, poolsAll] = filterPoolsOfInterest(
        pools,
        tokenIn,
        tokenOut,
        maxPools
    );

    const paths = getPathsUsingStaBalPool(
        tokenIn,
        tokenOut,
        poolsAll,
        poolsFiltered,
        chainId
    );

    if (expectedPoolIds.length === 0) {
        expect(paths.length).to.eq(0);
        return [poolsFiltered, hopTokens, poolsAll];
    }

    expect(paths.length).to.eq(1);

    checkPath(expectedPoolIds, poolsAll, paths[0], tokenIn, tokenOut);

    return [poolsFiltered, hopTokens, poolsAll];
}
