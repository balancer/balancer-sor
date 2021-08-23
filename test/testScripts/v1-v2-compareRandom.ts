// npx mocha -r ts-node/register test/testScripts/v1-v2-compareRandom.ts
// This is using pools list from ./testData/testPools which can change so it’s non-deterministic.
// It’s taking a random pair from a list of tokens along with random swap amounts and max pools.
// Compare V1 vs V2 vs Wrapper.
// Assumes script running from root (see testDir if not).
// Will do a large amount of tests and save any that fail. Change MIN_TESTS for number of tests to be run.
require('dotenv').config();
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider } from '@ethersproject/providers';
import {
    getRandomTradeData,
    saveTestFile,
    deleteTestFile,
    loadTestFile,
} from '../lib/testHelpers';
import { compareTest } from '../lib/compareHelper';
import { bnum } from '../../src/bmath';

// Each pool will have 4 tests. Total number will be MIN_TESTS * 4 * NoPools. Will always test each pool at least once.
const MIN_TESTS = 50;

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);
const gasPrice = new BigNumber('30000000000');

enum SwapAmt {
    Small,
    Large,
    Inter1,
    Inter2,
    Single,
    Dust,
}

describe('Run Large Amount Of Tests Using Saved Pools Data', async () => {
    // This must be updated with pools of interest (see ./test/testData/testPools)
    const testFiles = [
        '0x04ec8acaa4f419bc1525eaa8d37faae2d4acb64c5521a3718593c626962de170',
        '0x0a554ce1e35b9820f121ac7faa97069650df754117d6c5eb7c1158f915878343',
        '0x139894ec2cacfeca1035e78968124dbb2d34034bde146f5f2ab311ada75ad04f',
        '0x21d5562b317f9d3b57b3406ee868ad882ab3c87cd67f7af2ff55042e59702bef',
        '0x2db088f092121c107a1bfe97984be190e5ab72fce044c9749c3611ce2365e4da',
        '0x32286e13c9dbfe92f4d9527bfe2ff18edf10dedb55e08b11710bf84cebf4de6d',
        '0x39fbeeaacdffc7186135ad169c0bbdbdddb42901a3c12cac2081af603f52ccda',
        '0x4538a9ba66778343983d39a744e6c337ee497247be50090e8feb18761d275306',
        '0x462bd3a36b8a1fdf64e0d9dcf88d18c1d246b4dfca1704f26f883face2612c18',
        '0x5fccb4ca1117b8a274bc6e939c63493203e5744cdf04d0045cf2bc08b01f4c18',
        '0x5fd850f563e180d962bc8e243fbfa27a410e9610faff5f1ecbd2ccdf6599f907',
        '0x6b4011c5e4c17293c0db18fb63e334544107b6451d7e74ce9c88b0b1c07b8fda',
        '0x80422d69eb9272c7b786f602bbce7caad3559a2bd714b5eafb254cfbdd26361c',
        '0x820b13539ec5117e04380b53c766de9aa604bfb5d751392d3df3d1beff26e30a',
        '0x855d140758a5d0e8839d772ffa8e3afecc522bfbae621cdc91069bfeaaac490c',
        '0x9308920064cab0e15ca98444ec9f91092d24aba03dd383c168f6cc2e45954e0e',
        '0x995a2d20a846226c7680fff641cee4397f81c6e1f0675d69c7d26d05a60b39f3',
        '0x99cc915640bbb9ef7dd6979062fea2a34eff2b400398a4c00405462840956818',
        '0x99dd2c21aa009e98e000a3bd515a8ddcbb52748642fde10f9137f9de3cfae957',
        '0xa7a3cf76686c6d6aa6e976724b4463c6f7b0e98453ad3a8488b6e9daa2fecc42',
        '0xab11cdebd9d96f2f4d9d29f0df62de0640c457882d92435aff2a7c1049a0be6a',
        '0xfab93b6aece1282a829e8bdcdf2a1aee193a10134279a0a16c989ca71644e85b',
        '0xfc687c72aa619a5c4eb5f5597a2bd69ef1157848243700b57926d36060a6dedc',
        'fleek-11-03-21',
        'stable-and-weighted-gas-price-zero',
        'stable-and-weighted-token-btp-test',
        'stable-and-weighted-gas-price-zero',
        'stable-pools-only-wbtc-to-sbtc-exactIn',
        'stable-pools-only-wbtc-to-sbtc-exactOut',
        'subgraphPoolsDecimalsTest',
        'subgraphPoolsLarge',
        'subgraphPoolsSmallWithTrade',
        '0x03b36dce65627cf8a2a392788c2d319659c8de26b2f83f8d117558891fa59216',
        '0x24ecf45a2fc734c487abcfcdaec558e5d6cc1fb4a7c85ad6b362c017649d3156',
        '0x2ee23274910c172db9de340b1740e63f34b7d86db79827024316f173bf1284d9',
        '0x32c912f8f82952f631c39be6c69bd72a1da978d8d0704a7d32b8310431375bfa',
        '0x3fd20d1d22910c0ee8ae926a1e90afca679cbcc65962135eff43e16fbae12745',
        '0x56164d81bf21d9ec5c2a3f6d93dec8cf39e5ed1567e155bbd66f9d2360b15c95',
        '0x5dd7b4c527806eba0d0ae9e381ea9143ed1e91554e8e060f6d1dcd76119bfdcc',
        '0x88bf77edcbdfc9483904316ac6fdb6e162cf7bfa85a73bc1960ccdab22be351b',
        '0x8e0ea7b408b21005b73238a7e718c8f0320f569ea0c001a1a672bef88288cd91',
        '0x94d106cd9a7e5f2d30ea82a404b1dcfb31c4f6bb85fba228769cf543c5ecf2f5',
        '0x958eb7095ad851133bb2d3282a370108832094082e7554e48c9218cf376cd0be',
        '0xc495fe9e8e74880ddc6d8a42a87bb5b011243e9ba28e23183f68f44439b287b1',
        '0xe331382ecdcad2befe8580a779e28cb4d98bc88da9fac74ae1e95c78417acfde',
        '0xf2826c2b04aef9ddab2c3a7088f33dbc7a0485d57b37b5220f9d86da9eb95b2a',
        '0xf4a5ecfa278f50beb4155bc7bbd3ada5e57d5ceb9825852531981fa66bc94844',
    ];

    // Assumes script running from root
    const testDir = `${process.cwd()}/test/testData/testPools/`;

    let testsPerPool = MIN_TESTS / testFiles.length;
    if (testsPerPool < 1) testsPerPool = 1;

    console.log(
        `Total Number of tests: ${testsPerPool * testFiles.length * 10}`
    );

    testFiles.forEach(async function(file) {
        for (let i = 0; i < testsPerPool; i++) {
            await testSwap(
                `swapExactIn`,
                SwapAmt.Small,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactIn`,
                SwapAmt.Large,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactIn`,
                SwapAmt.Inter1,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactIn`,
                SwapAmt.Inter2,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactOut`,
                SwapAmt.Small,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactOut`,
                SwapAmt.Large,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactOut`,
                SwapAmt.Inter1,
                `${testDir}/${file}.json`
            );
            await testSwap(
                `swapExactOut`,
                SwapAmt.Inter2,
                `${testDir}/${file}.json`
            );

            await testSwap(
                `swapExactIn`,
                SwapAmt.Single,
                `${testDir}/${file}.json`
            );

            await testSwap(
                `swapExactOut`,
                SwapAmt.Single,
                `${testDir}/${file}.json`
            );

            await testSwap(
                `swapExactIn`,
                SwapAmt.Dust,
                `${testDir}/${file}.json`
            );

            await testSwap(
                `swapExactOut`,
                SwapAmt.Dust,
                `${testDir}/${file}.json`
            );
        }
    });
});

async function testSwap(swapType: string, swapAmtType: SwapAmt, file: string) {
    it(`${swapType} - ${swapAmtType} swap`, async () => {
        const testData = loadTestFile(file);
        const tradeData = getRandomTradeData(false);
        const tokenIn = tradeData.tokenIn.toLowerCase();
        const tokenOut = tradeData.tokenOut.toLowerCase();
        const tokenInDecimals = tradeData.tokenInDecimals;
        const tokenOutDecimals = tradeData.tokenOutDecimals;
        const maxNoPools = tradeData.maxPools;

        let swapAmount: BigNumber;
        if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Small)
            swapAmount = tradeData.smallSwapAmtIn;
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Large)
            swapAmount = tradeData.largeSwapAmtIn;
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Inter1)
            swapAmount = tradeData.inter1SwapAmtIn;
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Inter2)
            swapAmount = tradeData.inter2SwapAmtIn;
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Small)
            swapAmount = tradeData.smallSwapAmtOut;
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Large)
            swapAmount = tradeData.largeSwapAmtOut;
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Inter1)
            swapAmount = tradeData.inter1SwapAmtOut;
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Single)
            swapAmount = bnum(1).times(bnum(10 ** tokenInDecimals));
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Single)
            swapAmount = bnum(1).times(bnum(10 ** tokenOutDecimals));
        else if (swapType === 'swapExactIn' && swapAmtType === SwapAmt.Dust)
            swapAmount = tradeData.dustRandom;
        else if (swapType === 'swapExactOut' && swapAmtType === SwapAmt.Dust)
            swapAmount = tradeData.dustRandom;
        else swapAmount = tradeData.inter2SwapAmtOut;

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

        // Pools are loaded from the test file but all other trade info is new
        const tradeInfo = {
            SwapType: swapType,
            TokenIn: tokenIn,
            TokenOut: tokenOut,
            NoPools: maxNoPools,
            SwapAmount: swapAmount, // Amount scaled (get normalised in compareTest)
            GasPrice: gasPrice,
            SwapAmountDecimals: swapAmountDecimals,
            ReturnAmountDecimals: returnAmountDecimals,
        };

        const newTestData = {
            pools: testData.pools,
            tradeInfo,
        };

        const [v1SwapData, v2SwapData] = await compareTest(
            `subgraphPoolsDecimalsTest`,
            provider,
            newTestData
        );

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
