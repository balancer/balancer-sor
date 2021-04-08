import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getV1Swap,
    getV2Swap,
    displayResults,
    assertResults,
    v2classSwap,
    getWrapperSwap,
} from './testHelpers';
import { bnum } from '../../src/bmath';
import { SOR } from '../../src';
import { formatSwaps } from '../../src/helpersClass';
import { SwapInfo, DisabledOptions, SwapTypes } from '../../src/types';
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
    // Uses saved balances instead of onChain. Test data is a snapshot of balance state. Onchain balances can change between calls.
    let v2SwapData = await getV2Swap(
        provider,
        testData.tradeInfo.GasPrice,
        testData.tradeInfo.NoPools,
        1,
        JSON.parse(JSON.stringify(testData)),
        testData.tradeInfo.SwapType,
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        amountNormalised,
        { onChainBalances: false },
        testData.tradeInfo.ReturnAmountDecimals,
        disabledOptions,
        testSettings.costOutputTokenOveride
    );

    // Uses costOutputToken returned from above.
    let [swaps, total, marketSp] = v2classSwap(
        JSON.parse(JSON.stringify(testData)),
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        testData.tradeInfo.NoPools,
        testData.tradeInfo.SwapType,
        amountNormalised,
        v2SwapData.costOutputToken,
        disabledOptions
    );

    // TO DO - Delete this once fully move to class code
    if (testSettings.compareResults) {
        assert.equal(
            v2SwapData.returnAmount.toString(),
            total.toString(),
            'V2 Class should have same return'
        );
        expect(v2SwapData.swaps).to.deep.equal(swaps);
    }

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
        testData.tradeInfo.SwapAmount.div(
            bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
        ),
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

    if (testSettings.compareResults)
        assertResults(file, testData, v1SwapData, v2SwapData, wrapperSwapData);

    return [v1SwapData, v2SwapData];
}
