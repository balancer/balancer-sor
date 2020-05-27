// testing multi-hop using Kovan Subgraph
// Run using yarn test
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');

const MAX_UINT = ethers.constants.MaxUint256;

describe('Multi-Pool Tests', () => {
    it('should test DAI -> USDC, swapExactIn', async () => {
        // const tokenIn = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'; // MKR
        const tokenIn = '0x1528F3FCc26d13F7079325Fb78D9442607781c8C'; // DAI
        const tokenOut = '0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5'; // USDC

        console.time('total');
        console.time('getPools');
        const allPools = await sor.getAllPublicSwapPools();
        console.timeEnd('getPools');

        console.time('getTokenPairsMultiHop');
        let [directTokenPairs, allTokenPairs] = await sor.getTokenPairsMultiHop(
            tokenIn,
            allPools.pools
        );
        console.timeEnd('getTokenPairsMultiHop');
        console.timeEnd('total');

        console.log(directTokenPairs);
        console.log(allTokenPairs);

        const legacyDirect = [
            '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5',
            '0x1528f3fcc26d13f7079325fb78d9442607781c8c',
            '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
            '0xaaf64bfcc32d0f15873a02163e7e500671a4ffcd',
            '0xef13c0c8abcaf5767160018d268f9697ae4f5375',
            '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
            '0x965b0270a0f64601041b17194d9799b645fb04a9',
            '0xe0c9275e44ea80ef17579d33c55136b7da269aeb',
            '0x8c9e6c40d3402480ace624730524facc5482798c',
        ];

        const legacyAllTokenPairs = [
            '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5',
            '0x1528f3fcc26d13f7079325fb78d9442607781c8c',
            '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
            '0xaaf64bfcc32d0f15873a02163e7e500671a4ffcd',
            '0xef13c0c8abcaf5767160018d268f9697ae4f5375',
            '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
            '0x965b0270a0f64601041b17194d9799b645fb04a9',
            '0xe0c9275e44ea80ef17579d33c55136b7da269aeb',
            '0x8c9e6c40d3402480ace624730524facc5482798c',
            '0x1f1f156e0317167c11aa412e3d1435ea29dc3cce',
            '0xccb0f4cf5d3f97f4a55bb5f5ca321c3ed033f244',
            '0xe7bc397dbd069fc7d0109c0636d06888bb50668c',
            '0x34737f90fd62bc9b897760cd16f3dfa4418096e1',
            '0x86436bce20258a6dcfe48c9512d4d49a30c4d8c4',
            '0x37f03a12241e9fd3658ad6777d289c3fb8512bc9',
            '0x6d2246a20ddc7fe7a5dd1d1378d14df424d4dad6',
        ];

        assert(allTokenPairs.length > 0, `Should have more than pairs swaps.`);
        expect(directTokenPairs).to.have.members(legacyDirect);
        expect(directTokenPairs).to.eql(legacyDirect);
        expect(allTokenPairs).to.have.members(legacyAllTokenPairs);
        expect(allTokenPairs).to.eql(legacyAllTokenPairs);
    }).timeout(10000);
    /*
    it('should test DAI -> USDC, swapExactIn', async () => {
        // const tokenIn = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'; // MKR
        const tokenIn = '0x1528F3FCc26d13F7079325Fb78D9442607781c8C'; // DAI
        const tokenOut = '0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5'; // USDC

        console.time('getTokenPairsMultiHop');

        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.getMultihopPoolsWithTokens(tokenIn, tokenOut);

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        let [directTokenPairs, allTokenPairs] = await sor.getTokenPairsMultiHopOld(tokenIn, pools);
        console.timeEnd('getTokenPairsMultiHop');

        console.log(directTokenPairs);
        console.log(allTokenPairs);
        /*
        [ '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5',
  '0x1528f3fcc26d13f7079325fb78d9442607781c8c',
  '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
  '0xaaf64bfcc32d0f15873a02163e7e500671a4ffcd',
  '0xef13c0c8abcaf5767160018d268f9697ae4f5375',
  '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
  '0x965b0270a0f64601041b17194d9799b645fb04a9',
  '0xe0c9275e44ea80ef17579d33c55136b7da269aeb',
  '0x8c9e6c40d3402480ace624730524facc5482798c' ]
[ '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5',
  '0x1528f3fcc26d13f7079325fb78d9442607781c8c',
  '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
  '0xaaf64bfcc32d0f15873a02163e7e500671a4ffcd',
  '0xef13c0c8abcaf5767160018d268f9697ae4f5375',
  '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
  '0x965b0270a0f64601041b17194d9799b645fb04a9',
  '0xe0c9275e44ea80ef17579d33c55136b7da269aeb',
  '0x8c9e6c40d3402480ace624730524facc5482798c',
  '0x1f1f156e0317167c11aa412e3d1435ea29dc3cce',
  '0xccb0f4cf5d3f97f4a55bb5f5ca321c3ed033f244',
  '0xe7bc397dbd069fc7d0109c0636d06888bb50668c',
  '0x34737f90fd62bc9b897760cd16f3dfa4418096e1',
  '0x86436bce20258a6dcfe48c9512d4d49a30c4d8c4',
  '0x37f03a12241e9fd3658ad6777d289c3fb8512bc9',
  '0x6d2246a20ddc7fe7a5dd1d1378d14df424d4dad6' ]
  */

    //assert(allTokenPairs.length > 0, `Should have more than pairs swaps.`);
    /*
    }).timeout(10000);
    */
});
