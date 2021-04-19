import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getV1Swap,
    displayResults,
    assertResults,
    v2classSwap,
    getWrapperSwap,
} from './testHelpers';
import { bnum } from '../../src/bmath';
import { SwapInfo, DisabledOptions } from '../../src/types';
import { assert, expect } from 'chai';
import BigNumber from 'bignumber.js';

export interface TestSettings {
    compareResults: boolean;
    costOutputTokenOveride: {
        isOverRide: boolean;
        overRideCost: BigNumber;
    };
}

export async function compareTest(
    file: string,
    provider: JsonRpcProvider,
    testData: any,
    disabledOptions: DisabledOptions = {
        isOverRide: false,
        disabledTokens: [],
    },
    testSettings: TestSettings = {
        compareResults: true,
        costOutputTokenOveride: { isOverRide: true, overRideCost: bnum(0) },
    }
) {
    const amountNormalised = testData.tradeInfo.SwapAmount.div(
        bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
    );

    // V2 first to debug faster
    // Uses costOutputToken returned from above.
    const v2SwapData = await v2classSwap(
        provider,
        JSON.parse(JSON.stringify(testData)),
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        testData.tradeInfo.NoPools,
        testData.tradeInfo.SwapType,
        amountNormalised,
        testData.tradeInfo.GasPrice,
        testData.tradeInfo.ReturnAmountDecimals,
        disabledOptions,
        testSettings.costOutputTokenOveride
    );

    // Uses scaled costOutputToken returned from above.
    let v1SwapData = await getV1Swap(
        provider,
        v2SwapData.costOutputToken.times(
            bnum(10 ** testData.tradeInfo.ReturnAmountDecimals)
        ),
        testData.tradeInfo.NoPools,
        1,
        JSON.parse(JSON.stringify(testData)),
        testData.tradeInfo.SwapType,
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        testData.tradeInfo.SwapAmount,
        { onChainBalances: false },
        disabledOptions
    );
    // Normalize returnAmount
    v1SwapData.returnAmount = v1SwapData.returnAmount.div(
        bnum(10 ** testData.tradeInfo.ReturnAmountDecimals)
    );

    const wrapperSwapData: SwapInfo = await getWrapperSwap(
        JSON.parse(JSON.stringify(testData)),
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        testData.tradeInfo.NoPools,
        testData.tradeInfo.SwapType,
        amountNormalised,
        v2SwapData.costOutputToken,
        testData.tradeInfo.GasPrice,
        provider,
        disabledOptions
    );

    displayResults(
        `${file}.json`,
        testData.tradeInfo,
        [v1SwapData, v2SwapData],
        true,
        testData.tradeInfo.NoPools
    );

    // console.log(`--------- WRAPPER SWAPS:`);
    // console.log(wrapperSwapData.swaps);

    if (testSettings.compareResults)
        assertResults(file, testData, v1SwapData, v2SwapData, wrapperSwapData);

    return [v1SwapData, v2SwapData];
}
