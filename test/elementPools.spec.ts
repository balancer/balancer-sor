require('dotenv').config();
import { JsonRpcProvider } from '@ethersproject/providers';
import { loadTestFile } from './lib/testHelpers';
import { compareTest } from './lib/compareHelper';

const provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

// This must be updated with pools of interest (see ./test/testData/testPools)
let testFiles = [
    'elementFinanceTest1',
    'elementFinanceTest2',
    'elementFinanceTest3',
    'elementFinanceTest4',
    'elementFinanceTestFourPools',
];

const testDir = `${__dirname}/testData/elementPools/`;

// npx mocha -r ts-node/register test/elementPools.spec.ts
// This compare V1 vs V2 swaps and V2 vs V2 with filter swaps pools saved in ./test/testData/testPools folder.
// Does not use OnChain balances as the pools were originally saved after a failure and snapshot should have balances, etc that caused issues.
// Compare V1 vs V2 and V2 vs V2 with filter.
// !!! Note - testFiles array must be manually updated to contain pools of interest.
async function loopTests(file) {
    it(`Compare Testing: ${file}`, async () => {
        const testData = loadTestFile(`${testDir}/${file}.json`);

        if (!testData.tradeInfo) return;

        await compareTest(file, provider, testData);
        // assert(false);
    }).timeout(10000);
}

testFiles.forEach(file => {
    loopTests(file);
});
