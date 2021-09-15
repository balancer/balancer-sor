// TS_NODE_PROJECT='tsconfig.testing.json' npx mocha -r ts-node/register test/staBalPaths.spec.ts
require('dotenv').config();
import { expect } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    NewPath,
    PoolDictionary,
    SubgraphPoolBase,
    SwapPairType,
} from '../src/types';
import { StablePool } from '../src/pools/stablePool/stablePool';
import {
    filterPoolsOfInterest,
    getPathUsingStaBalPools,
    createMultihopPath,
    getHighestLiquidityPool,
    filterHopPools,
} from '../src/routeProposal/filtering';
import { STABALADDR, USDCCONNECTINGPOOL } from '../src/constants';
import staBalPools from './testData/staBal/staBalPools.json';

const maxPools = 4;
const chainId = 99;

describe(`staBalPaths.`, () => {
    it(`should be no USDC connecting pool for mainnet`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376';
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            1
        );
        expect(usdcConnectingPool).to.be.empty;
    });

    it(`should return USDC connecting pool`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376';
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
        );
        expect(usdcConnectingPool.id).to.be.eq(USDCCONNECTINGPOOL[chainId].id);
    });

    it(`should create a valid multihop path`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376';
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        const chainId = 99; // Test chain

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
        );

        const staBalPoolIdIn = 'staBalPair1';
        const staBalPoolIn = pools[staBalPoolIdIn];
        const hopTokenStaBal = STABALADDR[chainId];

        const multihopPath = createMultihopPath(
            staBalPoolIn,
            usdcConnectingPool,
            tokenIn,
            hopTokenStaBal,
            USDCCONNECTINGPOOL[chainId].usdc
        );

        const poolPairDataFirst = staBalPoolIn.parsePoolPairData(
            tokenIn,
            hopTokenStaBal
        );
        const poolPairDataSecond = usdcConnectingPool.parsePoolPairData(
            hopTokenStaBal,
            USDCCONNECTINGPOOL[chainId].usdc
        );

        expect(multihopPath.id).to.eq(
            `${staBalPoolIdIn + usdcConnectingPool.id}`
        );
        expect(multihopPath.swaps.length).to.eq(2);
        expect(multihopPath.swaps[0].pool).to.eq(staBalPoolIn.id);
        expect(multihopPath.swaps[0].tokenIn).to.eq(tokenIn);
        expect(multihopPath.swaps[0].tokenOut).to.eq(hopTokenStaBal);
        expect(multihopPath.swaps[1].pool).to.eq(usdcConnectingPool.id);
        expect(multihopPath.swaps[1].tokenIn).to.eq(hopTokenStaBal);
        expect(multihopPath.swaps[1].tokenOut).to.eq(
            USDCCONNECTINGPOOL[chainId].usdc
        );
        expect(multihopPath.poolPairData.length).to.eq(2);
        expect(multihopPath.poolPairData[0]).deep.eq(poolPairDataFirst);
        expect(multihopPath.poolPairData[1]).deep.eq(poolPairDataSecond);
        expect(multihopPath.pools.length).to.eq(2);
        expect(multihopPath.pools[0]).deep.eq(staBalPoolIn);
        expect(multihopPath.pools[1]).deep.eq(usdcConnectingPool);
    });

    it(`should return pool with highest liquidity, hopOut`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376';
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        const chainId = 99; // Test chain

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
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

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
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

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
        );

        const pathUsingStaBal: NewPath = getPathUsingStaBalPools(
            tokenIn,
            tokenOut,
            pools,
            usdcConnectingPool,
            chainId
        );

        expect(pathUsingStaBal).to.be.empty;
    });

    it(`TokenIn has no USDC pool, expect no route`, () => {
        const tokenIn = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // Token With No USDC Pair
        const tokenOut = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
        );

        const pathUsingStaBal: NewPath = getPathUsingStaBalPools(
            tokenIn,
            tokenOut,
            pools,
            usdcConnectingPool,
            chainId
        );

        expect(pathUsingStaBal).to.be.empty;
    });

    it(`TokenOut has no USDC pool, expect no route`, () => {
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD
        const tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // Token With No USDC Pair

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
        );

        const pathUsingStaBal: NewPath = getPathUsingStaBalPools(
            tokenIn,
            tokenOut,
            pools,
            usdcConnectingPool,
            chainId
        );

        expect(pathUsingStaBal).to.be.empty;
    });

    it(`staBal Paired Token In`, () => {
        // staBal Pair Token In
        // i.e. TUSD>[staBalPair1]>staBAL>[usdcConnecting]>USDC>[balPool]>BAL
        const tokenIn = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD
        const tokenOut = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
        );

        const pathUsingStaBal: NewPath = getPathUsingStaBalPools(
            tokenIn,
            tokenOut,
            pools,
            usdcConnectingPool,
            chainId
        );

        const staBalPoolIdIn = 'staBalPair1';
        const hopTokenStaBal = STABALADDR[chainId];

        expect(pathUsingStaBal.swaps[0].pool).to.eq(staBalPoolIdIn);
        expect(pathUsingStaBal.swaps[0].tokenIn).to.eq(tokenIn);
        expect(pathUsingStaBal.swaps[0].tokenOut).to.eq(hopTokenStaBal);
        expect(pathUsingStaBal.swaps[1].pool).to.eq(
            USDCCONNECTINGPOOL[chainId].id
        );
        expect(pathUsingStaBal.swaps[1].tokenIn).to.eq(hopTokenStaBal);
        expect(pathUsingStaBal.swaps[1].tokenOut).to.eq(
            USDCCONNECTINGPOOL[chainId].usdc
        );
        expect(pathUsingStaBal.swaps[2].pool).to.eq('balPool');
        expect(pathUsingStaBal.swaps[2].tokenIn).to.eq(
            USDCCONNECTINGPOOL[chainId].usdc
        );
        expect(pathUsingStaBal.swaps[2].tokenOut).to.eq(tokenOut);
    });

    it(`staBal Paired Token Out`, () => {
        // staBal Pair Token Out
        // i.e. BAL>[balPool]>USDC>[usdcConnecting]>staBAL>[staBalPair1]>TUSD
        const tokenIn = '0x9a71012b13ca4d3d0cdc72a177df3ef03b0e76a3'; // BAL
        const tokenOut = '0x0000000000085d4780B73119b644AE5ecd22b376'; // TUSD

        const testPools: any = cloneDeep(staBalPools.pools);

        const [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
        );

        const pathUsingStaBal: NewPath = getPathUsingStaBalPools(
            tokenIn,
            tokenOut,
            pools,
            usdcConnectingPool,
            chainId
        );

        const staBalPoolId = 'staBalPair1';
        const hopTokenStaBal = STABALADDR[chainId];

        expect(pathUsingStaBal.swaps[0].pool).to.eq('balPool');
        expect(pathUsingStaBal.swaps[0].tokenIn).to.eq(tokenIn);
        expect(pathUsingStaBal.swaps[0].tokenOut).to.eq(
            USDCCONNECTINGPOOL[chainId].usdc
        );
        expect(pathUsingStaBal.swaps[1].pool).to.eq(
            USDCCONNECTINGPOOL[chainId].id
        );
        expect(pathUsingStaBal.swaps[1].tokenIn).to.eq(
            USDCCONNECTINGPOOL[chainId].usdc
        );
        expect(pathUsingStaBal.swaps[1].tokenOut).to.eq(hopTokenStaBal);
        expect(pathUsingStaBal.swaps[2].pool).to.eq(staBalPoolId);
        expect(pathUsingStaBal.swaps[2].tokenIn).to.eq(hopTokenStaBal);
        expect(pathUsingStaBal.swaps[2].tokenOut).to.eq(tokenOut);
    });

    it(`staBal Paired Token In & Out`, () => {
        // staBal Pair Token In & Out
        // i.e. TUSD>[staBalPair1]>staBAL>[staBalPair2]>TUSD2 --- Should already be handled?
        const tokenIn = '0x0000000000000000000000000000000000000002';
        const tokenOut = '0x0000000000085d4780B73119b644AE5ecd22b376';

        let pools: PoolDictionary;
        let hopTokens: string[];
        let usdcConnectingPool: StablePool;
        const testPools: any = cloneDeep(staBalPools.pools);

        [pools, hopTokens, usdcConnectingPool] = filterPoolsOfInterest(
            testPools,
            tokenIn,
            tokenOut,
            maxPools,
            chainId
        );

        const pathUsingStaBal: NewPath = getPathUsingStaBalPools(
            tokenIn,
            tokenOut,
            pools,
            usdcConnectingPool,
            chainId
        );

        const [filteredPoolsDict, pathData] = filterHopPools(
            tokenIn,
            tokenOut,
            hopTokens,
            pools
        );

        const hopTokenStaBal = STABALADDR[chainId];

        // We expect no specific staBalPaths as the path already exists as multihop
        expect(pathData.length).to.eq(1);
        expect(pathData[0].swaps.length).to.eq(2);
        expect(pathData[0].swaps[0].pool).to.eq('staBalPair2');
        expect(pathData[0].swaps[0].tokenIn).to.eq(tokenIn);
        expect(pathData[0].swaps[0].tokenOut).to.eq(hopTokenStaBal);
        expect(pathData[0].swaps[1].pool).to.eq('staBalPair1');
        expect(pathData[0].swaps[1].tokenIn).to.eq(hopTokenStaBal);
        expect(pathData[0].swaps[1].tokenOut).to.eq(tokenOut);
    });
});
