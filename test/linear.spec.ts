import { assert } from 'chai';
import {
    PoolDictionary,
    SwapPairType,
    PoolTypes,
    NewPath,
    SwapTypes,
    PoolDictionaryByMain,
    SubGraphPoolsBase,
    SwapInfo,
} from '../src/types';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
    filterPoolsOfInterest,
    filterHopPools,
    getPathsUsingLinearPools,
} from '../src/pools';
import { calculatePathLimits, smartOrderRouter } from '../src/sorClass';
import BigNumber from 'bignumber.js';
import { countPoolSwapPairTypes } from './lib/testHelpers';

import subgraphPoolsLargeLinear from './testData/subgraphPoolsLargeLinear.json';
import testPools from './testData/filterTestPools.json';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';
import { SOR } from '../src';
import { bnum } from '../dist/bmath.js';

const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'; // WETH lower case
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase();
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase();

describe('Linear pools tests', () => {
    it('trivial check', async () => {
        let tokenIn = DAI;
        let tokenOut = WETH; // USDC precision 6
        let swapType = SwapTypes.SwapExactIn;
        // Opción que va: DAI - USDC - 100
        let swapAmount = new BigNumber(0.1);

        let pools: PoolDictionary, paths: NewPath[], marketSp: BigNumber;
        const maxPools = 10; //
        let hopTokens: string[];
        let linearPoolsInfo: [PoolDictionaryByMain, MetaStablePool];
        [pools, hopTokens, linearPoolsInfo] = filterPoolsOfInterest(
            subgraphPoolsLargeLinear.pools,
            tokenIn,
            tokenOut,
            maxPools
        );
        let pathData: NewPath[];

        [pools, pathData] = filterHopPools(tokenIn, tokenOut, hopTokens, pools);
        let pathsUsingLinear = getPathsUsingLinearPools(
            tokenIn,
            tokenOut,
            linearPoolsInfo,
            pools
        );
        pathData = pathData.concat(pathsUsingLinear);
        [paths] = calculatePathLimits(pathData, swapType);

        let swaps: any, total: BigNumber, totalConsideringFees: BigNumber;
        [swaps, total, marketSp, totalConsideringFees] = smartOrderRouter(
            JSON.parse(JSON.stringify(pools)), // Need to keep original pools for cache
            paths,
            swapType,
            swapAmount,
            maxPools,
            bnum(10) // costReturnToken
        );
        console.log(swaps);
    });
});
