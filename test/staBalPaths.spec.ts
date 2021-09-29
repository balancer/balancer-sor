// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/staBalPaths.spec.ts
require('dotenv').config();
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import { PoolDictionary, SwapPairType, SubgraphPoolBase } from '../src/types';
import {
    filterPoolsOfInterest,
    getPathsUsingStaBalPool,
    createMultihopPath,
    getHighestLiquidityPool,
    filterHopPools,
    parseToPoolsDict,
} from '../src/routeProposal/filtering';
import { STABALADDR, USDCCONNECTINGPOOL } from '../src/constants';
import staBalPools from './testData/staBal/staBalPools.json';
import { checkPath } from './lib/testHelpers';

const maxPools = 4;
const chainId = 99;

const BAL = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3';
const TUSD = '0x0000000000085d4780B73119b644AE5ecd22b376';
const TOKEN_WITH_NO_USDC_PAIR = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2';

describe(`staBalPaths.`, () => {
    it(`should be no USDC connecting pool for mainnet`, () => {
        const tokenIn = TUSD;
        const tokenOut = BAL;
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
        const tokenIn = TUSD;
        const tokenOut = BAL;
        const chainId = 99; // Test chain

        const [poolsOfInterest, , poolsAll] = itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            ['staBalPair1', 'usdcConnecting', 'balPool'],
            chainId
        );

        const staBalPoolIdIn = 'staBalPair1';
        const staBalPoolIn = poolsOfInterest[staBalPoolIdIn];
        const hopTokenStaBal = STABALADDR[chainId];
        const usdcConnectingPool = poolsAll[USDCCONNECTINGPOOL[chainId].id];

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
        const tokenIn = TUSD;
        const tokenOut = BAL;
        const chainId = 99; // Test chain

        const [poolsOfInterest] = itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            ['staBalPair1', 'usdcConnecting', 'balPool'],
            chainId
        );

        // Hop out as it is USDC > tokenOut
        const mostLiquidPool = getHighestLiquidityPool(
            USDCCONNECTINGPOOL[chainId].usdc,
            tokenOut,
            SwapPairType.HopOut,
            poolsOfInterest
        );

        expect(mostLiquidPool).to.eq('balPool');
    });

    it(`should return pool with highest liquidity, hopIn`, () => {
        const tokenIn = BAL;
        const tokenOut = TUSD;
        const chainId = 99; // Test chain

        const [poolsOfInterest] = itCreatesCorrectPath(
            tokenIn,
            tokenOut,
            cloneDeep(staBalPools.pools),
            ['balPool', 'usdcConnecting', 'staBalPair1'],
            chainId
        );

        // Hop in as it is tokenIn > USDC
        const mostLiquidPool = getHighestLiquidityPool(
            tokenIn,
            USDCCONNECTINGPOOL[chainId].usdc,
            SwapPairType.HopIn,
            poolsOfInterest
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
        const tokenIn = TOKEN_WITH_NO_USDC_PAIR;
        const tokenOut = TUSD;
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
        const tokenIn = TUSD;
        const tokenOut = TOKEN_WITH_NO_USDC_PAIR;
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
        const tokenIn = TUSD;
        const tokenOut = BAL;
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
        const tokenIn = BAL;
        const tokenOut = TUSD;
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
        const tokenOut = TUSD;
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
        chainId
    );

    if (expectedPoolIds.length === 0) {
        expect(paths.length).to.eq(0);
        return [poolsOfInterest, hopTokens, poolsAll];
    }

    expect(paths.length).to.eq(1);

    checkPath(expectedPoolIds, poolsAll, paths[0], tokenIn, tokenOut);

    return [poolsOfInterest, hopTokens, poolsAll];
}
