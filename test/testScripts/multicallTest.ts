require('dotenv').config();
import fetch from 'isomorphic-fetch';
const sor = require('../../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');
import { Pool } from '../../src/direct/types';
import { BONE, calcOutGivenIn, calcInGivenOut } from '../../src/bmath';
import { JsonRpcProvider } from 'ethers/providers';
import _ from 'lodash'; // Import the entire lodash library

async function run() {
    const multicall = '0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441';
    let provider = new JsonRpcProvider(
        `https://mainnet.infura.io/v3/${process.env.INFURA}`
    );
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
    const LINK = '0x514910771af9ca656af840dff83e8264ecf986ca';
    const IMBTC = '0x3212b29e33587a00fb1c83346f5dbfa69a458923';

    let allPools = await sor.getAllPublicSwapPools();
    let i = 0;
    let numberOfLoops = 1;
    while (i < numberOfLoops) {
        console.log(allPools.pools.length);
        try {
            let allPoolsOnChain = await sor.getAllPoolDataOnChain(
                allPools,
                multicall,
                provider
            );

            console.log(allPoolsOnChain.pools[0]);
            console.log(
                `Swap fee: ${allPoolsOnChain.pools[0].swapFee.toString()}`
            );
            console.log(
                `Total Weight: ${allPoolsOnChain.pools[0].totalWeight.toString()}`
            );

            allPoolsOnChain.pools[0].tokens.forEach(token => {
                console.log(token.address);
                console.log(token.balance.toString());
                console.log(token.denormWeight.toString());
            });
        } catch (error) {
            break;
        }

        let newPools = _.cloneDeep(allPools.pools);

        newPools = allPools.pools.concat(newPools);
        allPools.pools = newPools;

        i++;
    }

    return;
}

run();
