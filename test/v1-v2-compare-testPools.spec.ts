require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getV1Swap,
    getV2Swap,
    loadTestFile,
    displayResults,
    assertResults,
} from './lib/testHelpers';
import { bnum } from '../src/bmath';
import { SOR } from '../src';
import { SwapInfo } from '../src/types';
import { assert } from 'chai';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// npx mocha -r ts-node/register test/v1-v2-compare-testPools.spec.ts
// This compare V1 vs V2 swaps and V2 vs V2 with filter swaps pools saved in ./test/testData/testPools folder.
// Does not use OnChain balances as the pools were originally saved after a failure and snapshot should have balances, etc that caused issues.
// Compare V1 vs V2 and V2 vs V2 with filter.
// !!! Note - testFiles array must be manually updated to contain pools of interest.
describe('Run Tests From Saved Pools', () => {
    // This must be updated with pools of interest (see ./test/testData/testPools)
    let testFiles = [
        // '0x3eb871a70e05bff87dd17b426e80cae10d44b62b198b8c3e3576c31f09de116c',
        // '0x5fccb4ca1117b8a274bc6e939c63493203e5744cdf04d0045cf2bc08b01f4c18',
        // '0x99dd2c21aa009e98e000a3bd515a8ddcbb52748642fde10f9137f9de3cfae957',
        // '0x269e99c9cedfba33d877019c3f6ebebbfbb04c3a2874292765972cdd9ee47b05',
        // '0x6458ba03bd9707104c86c9ead2fcf6fcfdcb0b83d6fac5c683a0b687be4aa7fd',
        // '0x32286e13c9dbfe92f4d9527bfe2ff18edf10dedb55e08b11710bf84cebf4de6d',
        // '0x4049450e9cc2b947409cec9b8fb795e5e8defc6ae5dabae0856b90928082680a',
        // '0x460539952504c660268f525812e0eef7f6d80c5cd24a1d3743df23059f51d243',
        // '0xa7a3cf76686c6d6aa6e976724b4463c6f7b0e98453ad3a8488b6e9daa2fecc42',
        '0x04ec8acaa4f419bc1525eaa8d37faae2d4acb64c5521a3718593c626962de170', //  Had to add "balanceBpt" to pool "0x0e511aa1a137aad267dfe3a6bfca0b856c1a3682"
        '0x0a554ce1e35b9820f121ac7faa97069650df754117d6c5eb7c1158f915878343',
        '0x139894ec2cacfeca1035e78968124dbb2d34034bde146f5f2ab311ada75ad04f',
        '0x17497e9e5230493b79c19bad0dc165e06ac0aac3db8eaa4de441d44a70aa9a03',
        '0x19a742954302f2fee90e823696033c6758b119f17620806971d34e4cda4579af',
        '0x21d5562b317f9d3b57b3406ee868ad882ab3c87cd67f7af2ff55042e59702bef',
        '0x221c2f98afb75ae7ba165e70c647fc76c777b434eb84375d7261a0c951a0510c',
        '0x2db088f092121c107a1bfe97984be190e5ab72fce044c9749c3611ce2365e4da',
        '0x322749d6fee92b32d01f43d9d9e7cba98a3423194bc4d0e8cc1d724540f20aa2',
        '0x39fbeeaacdffc7186135ad169c0bbdbdddb42901a3c12cac2081af603f52ccda',
        '0x3f319e935f56ff76be555f6c7b6e9f410bd425a97c867b848fc8162bb6bd54f1',
        '0x4190309f9453fc3784f13731171f1d4cf0f873dbc6d594dc9a6bb3819727bf6c',
        '0x4538a9ba66778343983d39a744e6c337ee497247be50090e8feb18761d275306',
        '0x462bd3a36b8a1fdf64e0d9dcf88d18c1d246b4dfca1704f26f883face2612c18',
        '0x4c01eda6ce118df14db981777a0afa36276291d2170632ac01dbb8728d02acf2',
        '0x5523ac56f308a7a2b3d26197cc8498a29d2d7ed8bfda52dbed83698166971a27',
        '0x5d8ac083d65d9b16c701964a3a3b34585b883180473a187e9f9ed25531a5d0e3',
        '0x5fd850f563e180d962bc8e243fbfa27a410e9610faff5f1ecbd2ccdf6599f907',
        '0x6abfd063a04f0badbb10d021c3a9fbdb2836f5c953af8c18cd89e940cccd4199',
        '0x6b4011c5e4c17293c0db18fb63e334544107b6451d7e74ce9c88b0b1c07b8fda',
        '0x80422d69eb9272c7b786f602bbce7caad3559a2bd714b5eafb254cfbdd26361c',
        '0x820b13539ec5117e04380b53c766de9aa604bfb5d751392d3df3d1beff26e30a',
        '0x855d140758a5d0e8839d772ffa8e3afecc522bfbae621cdc91069bfeaaac490c',
        '0x8c5e8f7df8206b50f669e44c6ed9f2f88944ab27d46c898218a02fbed21ad1d6',
        '0x9308920064cab0e15ca98444ec9f91092d24aba03dd383c168f6cc2e45954e0e',
        '0x995a2d20a846226c7680fff641cee4397f81c6e1f0675d69c7d26d05a60b39f3',
        '0x99cc915640bbb9ef7dd6979062fea2a34eff2b400398a4c00405462840956818',
        '0xab11cdebd9d96f2f4d9d29f0df62de0640c457882d92435aff2a7c1049a0be6a',
        '0xac60bc1f5ff0fb9a1c981991c9b355c38c65e53f79e3d8d15ee66830910c4ba1',
        '0xbdce4f52f4a863e9d137e44475cc913eb82154e9998819ce55846530dbd3025d',
        '0xef63986beadea3f78acf5afc7665f8087f798627d4a094df134a4f643dda8057',
        '0xfab93b6aece1282a829e8bdcdf2a1aee193a10134279a0a16c989ca71644e85b',
        '0xfc687c72aa619a5c4eb5f5597a2bd69ef1157848243700b57926d36060a6dedc',
        'fleek-11-03-21',
        'stable-and-weighted-gas-price-zero',
        'stable-and-weighted-token-btp-test',
        'stable-and-weighted',
        'stable-pools-only-wbtc-to-sbtc-exactIn',
        'stable-pools-only-wbtc-to-sbtc-exactOut',
        'subgraphPoolsDecimalsTest',
        'subgraphPoolsLarge',
        'subgraphPoolsSmall',
        'subgraphPoolsSmallWithTrade',
    ];

    const testDir = `${__dirname}/testData/testPools/`;

    testFiles.forEach(function(file) {
        const testData = loadTestFile(`${testDir}/${file}.json`);

        if (!testData.tradeInfo) return;

        it(`${file}`, async () => {
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
                testData.tradeInfo.ReturnAmountDecimals
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
                { onChainBalances: false }
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
                testData
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
                assert.equal(
                    swapInfo.swaps[0].poolId,
                    v2SwapData.swaps[0][0].pool
                );
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
        }).timeout(100000);
    });
});
