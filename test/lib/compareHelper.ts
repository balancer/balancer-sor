import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getV1Swap,
    getV2Swap,
    displayResults,
    assertResults,
} from './testHelpers';
import { bnum } from '../../src/bmath';
import { SOR } from '../../src';
import { formatSwaps } from '../../src/helpers';
import { SwapInfo, DisabledOptions } from '../../src/types';
import { assert, expect } from 'chai';

export async function compareTest(
    file: string,
    provider: JsonRpcProvider,
    testData: any,
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
) {
    const amountNormalised = testData.tradeInfo.SwapAmount.div(
        bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
    );

    // V2 first to debug faster
    // This method will only work for V1 pools onChain balances as uses BPool V1 contract to compare vs V1.
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
        disabledOptions
    );

    let v1SwapData = await getV1Swap(
        provider,
        testData.tradeInfo.GasPrice,
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

    displayResults(
        `${file}.json`,
        testData.tradeInfo,
        [v1SwapData, v2SwapData],
        false,
        testData.tradeInfo.NoPools
    );

    assertResults(file, testData, v1SwapData, v2SwapData);

    // Now checks the Wrapper swap which should be the same as V2
    const sor = new SOR(
        provider,
        testData.tradeInfo.GasPrice,
        testData.tradeInfo.NoPools,
        1,
        JSON.parse(JSON.stringify(testData)),
        disabledOptions
    );

    if (testData.tradeInfo.SwapType === 'swapExactIn')
        await sor.setCostOutputToken(
            testData.tradeInfo.TokenOut,
            v2SwapData.costOutputToken
        );
    else
        await sor.setCostOutputToken(
            testData.tradeInfo.TokenIn,
            v2SwapData.costOutputToken
        );

    const isFetched = await sor.fetchPools(false);
    assert(isFetched, 'Pools should be fetched in wrapper');

    const swapInfoWrapper: SwapInfo = await sor.getSwaps(
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        testData.tradeInfo.SwapType,
        testData.tradeInfo.SwapAmount.div(
            bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
        )
    );

    assert.equal(
        swapInfoWrapper.returnAmount.toString(),
        v2SwapData.returnAmount
            .times(bnum(10 ** testData.tradeInfo.ReturnAmountDecimals))
            .toString(),
        `Wrapper should have same amount as helper.`
    );

    const v2formatted = formatSwaps(
        v2SwapData.swaps,
        testData.tradeInfo.SwapType,
        amountNormalised,
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        v2SwapData.returnAmount,
        swapInfoWrapper.marketSp
    );

    expect(swapInfoWrapper).to.deep.equal(v2formatted);

    if (testData.tradeInfo.RefResultV1) {
        assert.equal(
            v1SwapData.returnAmount.toString(),
            testData.tradeInfo.RefResultV1,
            'Result should be same as saved reference'
        );
        assert.equal(
            v2SwapData.returnAmount.toString(),
            testData.tradeInfo.RefResultV2,
            'Result should be same as saved reference'
        );
    }

    return [v1SwapData, v2SwapData];
}
