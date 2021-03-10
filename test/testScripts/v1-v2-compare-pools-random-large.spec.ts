require('dotenv').config();
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getV1Swap,
    getV2Swap,
    getRandomTradeData,
    saveTestFile,
    deleteTestFile,
    displayResults,
    assertResults,
    loadTestFile,
} from '../lib/testHelpers';
import { SwapInfo } from '../../src/types';
import { bnum } from '../../src/bmath';
import { SOR } from '../../src';
import { assert } from 'chai';

// Each pool will have 4 tests. Total number will be MIN_TESTS * 4 * NoPools. Will always test each pool at least once.
const MIN_TESTS = 1;

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const gasPrice = new BigNumber('30000000000');
const chainId = 1;

// npx mocha -r ts-node/register test/testScripts/v1-v2-compare-pools-random-large.spec.ts
// This is using pools list from ./testData/testPools which can change so it’s non-deterministic.
// It’s taking a random pair from a list of 10 tokens along with random swap amounts and max pools.
// Compare V1 vs V2 and V2 vs Wrapper.
// Assumes script running from root (see testDir if not).
// Will do a large amount of tests and save any that fail. Change MIN_TESTS for number of tests to be run.
describe('Run Large Amount Of Tests Using Saved Pools Data', async () => {
    // This must be updated with pools of interest (see ./test/testData/testPools)
    let testFiles = [
        // 'stable-and-weighted-token-btp-test',
        // 'stable-pools-only-wbtc-to-sbtc-exactIn',
        // 'stable-pools-only-wbtc-to-sbtc-exactOut',
        // 'stable-and-weighted',
        // 'stable-and-weighted-gas-price-zero',
        '0x04ec8acaa4f419bc1525eaa8d37faae2d4acb64c5521a3718593c626962de170', //  Had to add "balanceBpt" to pool "0x0e511aa1a137aad267dfe3a6bfca0b856c1a3682"
        '0x0a554ce1e35b9820f121ac7faa97069650df754117d6c5eb7c1158f915878343',
        '0x139894ec2cacfeca1035e78968124dbb2d34034bde146f5f2ab311ada75ad04f',
        '0x21d5562b317f9d3b57b3406ee868ad882ab3c87cd67f7af2ff55042e59702bef', // To debug
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
        'subgraphPoolsSmallWithTrade',
    ];

    // Assumes script running from root
    const testDir = `${process.cwd()}/test/testData/testPools/`;

    let testsPerPool = MIN_TESTS / testFiles.length;
    if (testsPerPool < 1) testsPerPool = 1;

    console.log(
        `Total Number of tests: ${testsPerPool * testFiles.length * 4}`
    );

    testFiles.forEach(async function(file) {
        for (let i = 0; i < testsPerPool; i++) {
            await testSwap(`swapExactIn`, true, `${testDir}/${file}.json`);
            await testSwap(`swapExactIn`, false, `${testDir}/${file}.json`);
            await testSwap(`swapExactOut`, true, `${testDir}/${file}.json`);
            await testSwap(`swapExactOut`, false, `${testDir}/${file}.json`);
        }
    });
});

async function testSwap(swapType, isSmall, file) {
    it(`${swapType} - ${isSmall ? 'Small' : 'Large'} swap`, async () => {
        console.log(`${swapType} ${isSmall} ${file}`);

        const testData = loadTestFile(file);
        const tradeData = getRandomTradeData();
        const tokenIn = tradeData.tokenIn.toLowerCase();
        const tokenOut = tradeData.tokenOut.toLowerCase();
        const tokenInDecimals = tradeData.tokenInDecimals;
        const tokenOutDecimals = tradeData.tokenOutDecimals;
        const maxNoPools = tradeData.maxPools;

        let swapAmount;
        if (swapType === 'swapExactIn' && isSmall)
            swapAmount = tradeData.smallSwapAmtIn;
        else if (swapType === 'swapExactIn' && !isSmall)
            swapAmount = tradeData.largeSwapAmtIn;
        else if (swapType === 'swapExactOut' && isSmall)
            swapAmount = tradeData.smallSwapAmtOut;
        else swapAmount = tradeData.largeSwapAmtOut;

        let swapAmountDecimals = tradeData.tokenInDecimals.toString();
        let returnAmountDecimals = tradeData.tokenOutDecimals.toString();

        if (swapType === 'swapExactOut') {
            swapAmountDecimals = tradeData.tokenOutDecimals.toString();
            returnAmountDecimals = tradeData.tokenInDecimals.toString();
        }

        // We save the test file ahead of a failed test because there are times when the test hangs and we want to capture those
        const newFile = saveTestFile(
            testData,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools.toString(),
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );

        let v1SwapData = await getV1Swap(
            provider,
            gasPrice,
            maxNoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount,
            { onChainBalances: false }
        );
        // Normalize returnAmount
        v1SwapData.returnAmount = v1SwapData.returnAmount.div(
            bnum(10 ** returnAmountDecimals)
        );

        let v2SwapData = await getV2Swap(
            provider,
            gasPrice,
            maxNoPools,
            1,
            JSON.parse(JSON.stringify(testData)),
            swapType,
            tokenIn,
            tokenOut,
            swapAmount.div(bnum(10 ** swapAmountDecimals)),
            { onChainBalances: false },
            returnAmountDecimals
        );

        const displayData = {
            tradeInfo: {
                SwapType: swapType,
                TokenIn: tokenIn,
                TokenOut: tokenOut,
                SwapAmount: swapAmount,
            },
        };

        displayResults(
            `${file}.json`,
            displayData.tradeInfo,
            [v1SwapData, v2SwapData],
            false
        );

        assertResults(file, displayData, v1SwapData, v2SwapData);

        const sor = new SOR(provider, gasPrice, maxNoPools, 1, testData);

        if (swapType === 'swapExactIn')
            await sor.setCostOutputToken(tokenOut, v2SwapData.costOutputToken);
        else {
            await sor.setCostOutputToken(tokenIn, v2SwapData.costOutputToken);
        }

        const isFetched = await sor.fetchPools(false);
        assert(isFetched, 'Pools should be fetched in wrapper');

        const swapInfo: SwapInfo = await sor.getSwaps(
            tokenIn,
            tokenOut,
            swapType,
            swapAmount.div(bnum(10 ** swapAmountDecimals))
        );

        assert.equal(
            swapInfo.returnAmount.toString(),
            v2SwapData.returnAmount.toString(),
            `Wrapper should have same amount as helper.`
        );

        // Rough check for same swaps
        if (swapInfo.swaps.length > 0) {
            assert.equal(swapInfo.swaps[0].poolId, v2SwapData.swaps[0][0].pool);
        }

        // All tests passed so no need to keep file
        deleteTestFile(
            testData,
            swapType,
            tokenIn,
            tokenOut,
            tokenInDecimals,
            tokenOutDecimals,
            maxNoPools.toString(),
            swapAmount.toString(),
            gasPrice.toString(),
            './test/testData/testPools/'
        );
    }).timeout(100000);
}
