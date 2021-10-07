import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import cloneDeep from 'lodash.clonedeep';
import { performance } from 'perf_hooks';
import {
    displayResults,
    assertResults,
    getFullSwap,
    TestData,
    Result,
    parseV1Result,
} from './testHelpers';
import { SwapInfo } from '../../src/types';
import { Zero } from '@ethersproject/constants';

export interface TestSettings {
    compareResults: boolean;
    costOutputTokenOveride: {
        isOverRide: boolean;
        overRideCost: BigNumber;
    };
}

export async function compareTest(
    testName: string,
    provider: JsonRpcProvider,
    testData: TestData,
    testSettings: TestSettings = {
        compareResults: true,
        costOutputTokenOveride: { isOverRide: true, overRideCost: Zero },
    }
): Promise<[Result, SwapInfo]> {
    const swapGas = BigNumber.from('100000'); // A pool swap costs approx 100000 gas
    const costOutputToken = Zero;
    const fullSwapStart = performance.now();

    const swapInfo: SwapInfo = await getFullSwap(
        cloneDeep(testData.pools),
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        testData.tradeInfo.ReturnAmountDecimals,
        testData.tradeInfo.NoPools,
        testData.tradeInfo.SwapType,
        testData.tradeInfo.SwapAmount,
        costOutputToken,
        testData.tradeInfo.GasPrice,
        provider,
        swapGas
    );
    const fullSwapEnd = performance.now();
    const fullResult: Result = {
        title: 'Full Swap',
        timeData: { fullSwap: fullSwapEnd - fullSwapStart },
        returnAmount: swapInfo.returnAmount,
        swaps: swapInfo.swaps,
    };

    const v1SwapData = parseV1Result(testData.v1Result);

    displayResults(
        `${testName}`,
        testData.tradeInfo,
        [v1SwapData, fullResult],
        true,
        testData.tradeInfo.NoPools
    );

    if (testSettings.compareResults)
        assertResults(testName, testData, v1SwapData, swapInfo);

    return [v1SwapData, swapInfo];
}
