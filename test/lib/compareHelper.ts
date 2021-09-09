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
import { bnum } from '../../src/utils/bignumber';
import { SwapInfo } from '../../src/types';
import BigNumber from 'bignumber.js';

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
        costOutputTokenOveride: { isOverRide: true, overRideCost: bnum(0) },
    }
): Promise<[Result, SwapInfo]> {
    const amountNormalised = testData.tradeInfo.SwapAmount.div(
        bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
    );

    const swapGas = bnum('100000'); // A pool swap costs approx 100000 gas
    const costOutputToken = bnum(0);
    const fullSwapStart = performance.now();
    const swapInfo: SwapInfo = await getFullSwap(
        cloneDeep(testData.pools),
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        testData.tradeInfo.ReturnAmountDecimals,
        testData.tradeInfo.NoPools,
        testData.tradeInfo.SwapType,
        amountNormalised,
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
    v1SwapData.returnAmount = bnum(v1SwapData.returnAmount);

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
