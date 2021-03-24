import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getV1Swap,
    getV2Swap,
    displayResults,
    assertResults,
} from './testHelpers';
import { bnum } from '../../src/bmath';
import { SOR } from '../../src';
import { SwapInfo, DisabledOptions } from '../../src/types';
import { assert } from 'chai';

export async function compareTest(
    file: string,
    provider: JsonRpcProvider,
    testData: any,
    disabledOptions: DisabledOptions = { isOverRide: false, disabledTokens: [] }
) {
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
        testData.tradeInfo.SwapAmount.div(
            bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
        ),
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

    const swapInfo: SwapInfo = await sor.getSwaps(
        testData.tradeInfo.TokenIn,
        testData.tradeInfo.TokenOut,
        testData.tradeInfo.SwapType,
        testData.tradeInfo.SwapAmount.div(
            bnum(10 ** testData.tradeInfo.SwapAmountDecimals)
        )
    );

    assert.equal(
        swapInfo.returnAmount.toString(),
        v2SwapData.returnAmount
            .times(bnum(10 ** testData.tradeInfo.ReturnAmountDecimals))
            .toString(),
        `Wrapper should have same amount as helper.`
    );

    // Rough check for same swaps
    if (swapInfo.swaps.length > 0) {
        assert.equal(swapInfo.swaps[0].poolId, v2SwapData.swaps[0][0].pool);
    }

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
