// Tests costOutputToken
require('dotenv').config();
import { expect } from 'chai';
import { JsonRpcProvider } from 'ethers/providers';
import { BigNumber } from '../src/utils/bignumber';
import { BONE, scale } from '../src/bmath';
import { calculateTotalSwapCost, getAddress } from '../src/costToken';
const sor = require('../src');

describe('Test costOutputToken', () => {
    it('Should get token pair', async () => {
        const provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}` // If running this example make sure you have a .env file saved in root DIR with INFURA=your_key
        );

        console.log(`Retrieving SubGraph Pools...`);
        let allPoolsNonZeroBalances = await sor.getAllPublicSwapPools();

        let original = await sor.getAllPoolDataOnChain(
            allPoolsNonZeroBalances,
            '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
            provider
        );

        let newResult = await sor.getAllPoolDataOnChainNew(
            allPoolsNonZeroBalances,
            '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
            provider
        );

        expect(newResult).to.eql(original);
    }).timeout(60000);
});
