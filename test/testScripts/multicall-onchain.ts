require('dotenv').config();
import { expect, assert } from 'chai';
import 'mocha';
import { Pool } from '../../src/direct/types';
const sor = require('../../src');
import { BigNumber } from '../../src/utils/bignumber';
import { getSpotPrice } from '../../src/direct/helpers';
import { BONE } from '../../src/bmath';
import { JsonRpcProvider } from 'ethers/providers';

const DAI = '0x6b175474e89094c44da98b954eedeac495271d0f';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const multicall = '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441';
let provider = new JsonRpcProvider(
    `https://mainnet.infura.io/v3/${process.env.INFURA}`
);

const pools = [
    {
        id: '0x165a50bc092f6870dc111c349bae5fc35147ac86',
    },
    {
        id: '0x247ff2b322df7439b78898375be7cdadca11cf17',
    },
];

describe('Multicall Tests', async () => {
    it('should test spot price', async () => {
        const allPools = await sor.getAllPublicSwapPools();
        console.time('getAllPoolDataOnChain');
        const allPoolsOnChain = await sor.getAllPoolDataOnChain(
            allPools,
            multicall,
            provider
        );
        console.timeEnd('getAllPoolDataOnChain');

        expect(allPools).to.eql(allPoolsOnChain);
    }).timeout(10000);
});
