import { assert } from 'chai';
import cloneDeep from 'lodash.clonedeep';
import {
    PoolDictionary,
    NewPath,
    SwapTypes,
    PoolDictionaryByMain,
    PoolBase,
} from '../src/types';
import {
    filterPoolsOfInterest,
    filterHopPools,
    getPathsUsingLinearPools,
} from '../src/routeProposal/filtering';
import { calculatePathLimits } from '../src/routeProposal/pathLimits';
import BigNumber from 'bignumber.js';
import { formatSwaps } from '../src/formatSwaps';

import subgraphPoolsLargeLinear from './testData/linearPools/subgraphPoolsLargeLinear.json';
import smallLinear from './testData/linearPools/smallLinear.json';
import singleLinear from './testData/linearPools/singleLinear.json';
import { MetaStablePool } from '../src/pools/metaStablePool/metaStablePool';
import { bnum } from '../src/index';
import { getBestPaths } from '../src/router';

const WETH = {
    symbol: 'WETH',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
};
const DAI = {
    symbol: 'DAI',
    address: '0x6b175474e89094c44da98b954eedeac495271d0f',
};
const USDC = {
    symbol: 'USDC',
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
}; // USDC precision = 6
const USDT = {
    symbol: 'USDT',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
}; // USDT precision = 6

describe('linear pools tests', () => {
    it('basic swap case', async () => {
        runSOR(
            DAI,
            USDC,
            SwapTypes.SwapExactIn,
            new BigNumber(2500),
            subgraphPoolsLargeLinear
        );
        console.log('second: ');
        runSOR(
            DAI,
            USDC,
            SwapTypes.SwapExactIn,
            new BigNumber(2500),
            singleLinear
        );
        console.log('third: ');
        runSOR(
            WETH,
            USDC,
            SwapTypes.SwapExactIn,
            new BigNumber(10),
            smallLinear
        );
    });
});

describe('Some more linear pools tests', () => {
    it('more than one linear pathway', async () => {
        let [pools, linearPoolsInfo, paths] = getPaths(
            USDT.address,
            WETH.address,
            SwapTypes.SwapExactIn,
            smallLinear.pools,
            10
        );
        assert.equal(paths.length, 2);
        [pools, linearPoolsInfo, paths] = getPaths(
            DAI.address,
            USDC.address,
            SwapTypes.SwapExactIn,
            smallLinear.pools,
            10
        );
        assert.equal(paths.length, 3);
        [pools, linearPoolsInfo, paths] = getPaths(
            WETH.address,
            DAI.address,
            SwapTypes.SwapExactIn,
            smallLinear.pools,
            10
        );
        assert.equal(paths.length, 3);
    });
});

function runSOR(
    tokIn,
    tokOut,
    swapType: SwapTypes,
    swapAmount: BigNumber,
    jsonPools
) {
    console.log(
        'Input info:\ntoken in: ',
        tokIn.symbol,
        '\ntoken out:',
        tokOut.symbol
    );
    console.log(
        'swap type: ',
        swapType.toString(),
        '\nswap amount: ',
        swapAmount.toString(),
        '\n'
    );
    const maxPools = 10;
    let tokenIn = tokIn.address;
    let tokenOut = tokOut.address;
    let [pools, linearPoolsInfo, paths] = getPaths(
        tokenIn,
        tokenOut,
        swapType,
        jsonPools.pools,
        maxPools
    );
    let swaps: any,
        total: BigNumber,
        totalConsideringFees: BigNumber,
        marketSp: BigNumber;
    [swaps, total, marketSp, totalConsideringFees] = getBestPaths(
        // getBestRoute?
        cloneDeep(pools),
        paths,
        swapType,
        swapAmount,
        maxPools,
        bnum(0.01)
    );
    console.log('swaps: ', swaps);
    /*
    const swapInfo = formatSwaps(
        swaps,
        swapType,
        swapAmount,
        tokIn,
        tokenOut,
        total,
        totalConsideringFees,
        marketSp
    );
    console.log(swapInfo.swaps );
    console.log(swapInfo.tokenAddresses );*/
}

function getPaths(
    tokenIn: string,
    tokenOut: string,
    swapType: SwapTypes,
    pools,
    maxPools
): [PoolDictionary, [PoolDictionaryByMain, MetaStablePool], NewPath[]] {
    let paths: NewPath[];
    let hopTokens: string[];
    let linearPoolsInfo: [PoolDictionaryByMain, MetaStablePool];
    let poolsDict: PoolDictionary;
    [poolsDict, hopTokens, linearPoolsInfo] = filterPoolsOfInterest(
        cloneDeep(pools),
        tokenIn,
        tokenOut,
        maxPools
    );
    let pathData: NewPath[] = [];

    let filteredPoolsDict: PoolDictionary;
    [filteredPoolsDict, pathData] = filterHopPools(
        tokenIn,
        tokenOut,
        hopTokens,
        poolsDict
    );

    let pathsUsingLinear: NewPath[];
    [filteredPoolsDict, pathsUsingLinear] = getPathsUsingLinearPools(
        tokenIn,
        tokenOut,
        linearPoolsInfo,
        poolsDict,
        filteredPoolsDict
    );
    pathData = pathData.concat(pathsUsingLinear);
    [paths] = calculatePathLimits(pathData, swapType);
    return [filteredPoolsDict, linearPoolsInfo, paths];
}
