import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getV1Swap,
    getV2Swap,
    displayResults,
    assertResults,
    v2classSwap,
} from './testHelpers';
import { bnum } from '../../src/bmath';
import { SOR } from '../../src';
import { formatSwaps } from '../../src/helpersClass';
import { SwapInfo, DisabledOptions, SwapTypes } from '../../src/types';
import { assert, expect } from 'chai';

export async function compareTest(
    file: string,
    provider: JsonRpcProvider,
    testData: any,
    disabledOptions: DisabledOptions = {
        isOverRide: false,
        disabledTokens: [],
    },
    costOutputTokenOveride = { isOverRide: false, overRideCost: bnum(0) }
) {
    costOutputTokenOveride = { isOverRide: true, overRideCost: bnum(0) };
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
        costOutputTokenOveride
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

    assert.equal(
        v2SwapData.returnAmount.toString(),
        total.toString(),
        'V2 Class should have same return'
    );
    expect(v2SwapData.swaps).to.deep.equal(swaps);

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

    let swapTypeCorrect = SwapTypes.SwapExactIn;

    if (testData.tradeInfo.SwapType === 'swapExactIn')
        await sor.setCostOutputToken(
            testData.tradeInfo.TokenOut,
            v2SwapData.costOutputToken
        );
    else {
        swapTypeCorrect = SwapTypes.SwapExactOut;
        await sor.setCostOutputToken(
            testData.tradeInfo.TokenIn,
            v2SwapData.costOutputToken
        );
    }

    const isFetched = await sor.fetchPools(false);
    assert(isFetched, 'Pools should be fetched in wrapper');

    const swapInfoWrapper: SwapInfo = await sor.getSwaps(
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        swapTypeCorrect,
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
        swapTypeCorrect,
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
