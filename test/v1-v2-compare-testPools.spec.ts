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
        'stable-and-weighted-token-btp-test',
        'stable-pools-only-wbtc-to-sbtc-exactIn',
        'stable-pools-only-wbtc-to-sbtc-exactOut',
        'stable-and-weighted',
        'stable-and-weighted-gas-price-zero',
        '0x04ec8acaa4f419bc1525eaa8d37faae2d4acb64c5521a3718593c626962de170',
        '0x0a554ce1e35b9820f121ac7faa97069650df754117d6c5eb7c1158f915878343',
        '0x139894ec2cacfeca1035e78968124dbb2d34034bde146f5f2ab311ada75ad04f',
        '0x21d5562b317f9d3b57b3406ee868ad882ab3c87cd67f7af2ff55042e59702bef',
        '0x221c2f98afb75ae7ba165e70c647fc76c777b434eb84375d7261a0c951a0510c',
        '0x2db088f092121c107a1bfe97984be190e5ab72fce044c9749c3611ce2365e4da',
        '0x39fbeeaacdffc7186135ad169c0bbdbdddb42901a3c12cac2081af603f52ccda',
        '0x4538a9ba66778343983d39a744e6c337ee497247be50090e8feb18761d275306',
        '0x462bd3a36b8a1fdf64e0d9dcf88d18c1d246b4dfca1704f26f883face2612c18',
        '0x5fd850f563e180d962bc8e243fbfa27a410e9610faff5f1ecbd2ccdf6599f907',
        '0x6b4011c5e4c17293c0db18fb63e334544107b6451d7e74ce9c88b0b1c07b8fda',
        '0x820b13539ec5117e04380b53c766de9aa604bfb5d751392d3df3d1beff26e30a',
        '0x855d140758a5d0e8839d772ffa8e3afecc522bfbae621cdc91069bfeaaac490c',
        '0x9308920064cab0e15ca98444ec9f91092d24aba03dd383c168f6cc2e45954e0e',
        '0x995a2d20a846226c7680fff641cee4397f81c6e1f0675d69c7d26d05a60b39f3',
        '0x99cc915640bbb9ef7dd6979062fea2a34eff2b400398a4c00405462840956818',
        '0xab11cdebd9d96f2f4d9d29f0df62de0640c457882d92435aff2a7c1049a0be6a',
        '0xbdce4f52f4a863e9d137e44475cc913eb82154e9998819ce55846530dbd3025d',
        '0xfab93b6aece1282a829e8bdcdf2a1aee193a10134279a0a16c989ca71644e85b',
        '0x80422d69eb9272c7b786f602bbce7caad3559a2bd714b5eafb254cfbdd26361c',
    ];

    const testDir = `${__dirname}/testData/testPools/`;

    testFiles.forEach(function(file) {
        const testData = loadTestFile(`${testDir}/${file}.json`);

        if (!testData.tradeInfo) return;

        it(`${file}`, async () => {
            // V2 first to debug faster
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
            /*
            let v2WithFilterSwapData = await getV2SwapWithFilter(
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
                { onChainBalances: false }
            );
            */

            displayResults(
                `${file}.json`,
                testData.tradeInfo,
                [v1SwapData, v2SwapData /*, v2WithFilterSwapData*/],
                false
            );

            assertResults(
                file,
                testData,
                v1SwapData,
                v2SwapData
                // v2WithFilterSwapData
            );
        }).timeout(100000);
    });
});
