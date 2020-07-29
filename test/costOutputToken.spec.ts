// Tests costOutputToken
require('dotenv').config();
import { expect } from 'chai';
import { JsonRpcProvider } from 'ethers/providers';
import { BigNumber } from '../src/utils/bignumber';
import { BONE } from '../src/bmath';
import { calculateTotalSwapCost, getAddress } from '../src/costToken';
const sor = require('../src');

const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

describe('Test costOutputToken (Uses UniSwap V2 SDK)', () => {
    it('Should get token pair', async () => {
        // See Factory https://uniswap.org/docs/v2/smart-contracts/factory/#getpair
        const CONFIRMED_ADDR = '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11';

        let addr = getAddress(WETH, DAI);
        expect(addr).to.eql(CONFIRMED_ADDR);
        addr = getAddress(DAI, WETH);
        expect(addr).to.eql(CONFIRMED_ADDR);
        addr = getAddress(DAI, WETH.toLowerCase());
        expect(addr).to.eql(CONFIRMED_ADDR);
        addr = getAddress(DAI.toLowerCase(), WETH);
        expect(addr).to.eql(CONFIRMED_ADDR);
        addr = getAddress(DAI.toLowerCase(), WETH.toLowerCase());
        expect(addr).to.eql(CONFIRMED_ADDR);
    });

    it('Should return correct total swap cost', async () => {
        let gasPriceWei = new BigNumber(30000000000); // 30GWEI
        let swapGasCost = new BigNumber(100000);
        let tokenPriceWei = new BigNumber(352480995000000000);

        let totalSwapCost = calculateTotalSwapCost(
            tokenPriceWei,
            swapGasCost,
            gasPriceWei
        );

        let expectedTotalSwapCost = new BigNumber(1057442985000000);
        expect(expectedTotalSwapCost).to.eql(totalSwapCost);
    });

    it('Should return correct total swap cost', async () => {
        let gasPriceWei = new BigNumber(30000000000); // 30GWEI
        let swapGasCost = new BigNumber(100000);
        let tokenPriceWei = new BigNumber(240000000000000000000);

        let totalSwapCost = calculateTotalSwapCost(
            tokenPriceWei,
            swapGasCost,
            gasPriceWei
        );

        let expectedTotalSwapCost = new BigNumber(720000000000000000);
        expect(expectedTotalSwapCost).to.eql(totalSwapCost);
    });

    it('Should return 0 cost if no UniSwap pool for Eth/Token', async () => {
        let provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        let gasPriceWei = new BigNumber(30000000000);
        let swapGasCost = new BigNumber(100000);

        let costExpected = new BigNumber(0);
        let cost = await sor.getCostOutputToken(
            '0x0',
            18,
            gasPriceWei,
            swapGasCost,
            provider
        );

        expect(cost).to.eql(costExpected);
    });

    it('Should return 0 if not Mainnet', async () => {
        let provider = new JsonRpcProvider(
            `https://kovan.infura.io/v3/${process.env.INFURA}`
        );
        let gasPriceWei = new BigNumber(30000000000);
        let swapGasCost = new BigNumber(100000);

        let costExpected = new BigNumber(0);
        let cost = await sor.getCostOutputToken(
            DAI,
            18,
            gasPriceWei,
            swapGasCost,
            provider
        );

        expect(cost).to.eql(costExpected);
    }).timeout(5000);

    it('Example of full call with DAI & 30GWEI Gas Price', async () => {
        let provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        let gasPriceWei = new BigNumber(30000000000);
        let swapGasCost = new BigNumber(100000);

        let cost = await sor.getCostOutputToken(
            DAI,
            18,
            gasPriceWei,
            swapGasCost,
            provider
        );
        let costEth = cost.div(BONE);
        console.log(`CostOutputToken DAI: ${costEth.toString()}`);
    }).timeout(5000);

    it('Example of full call with MKR & 30GWEI Gas Price', async () => {
        let provider = new JsonRpcProvider(
            `https://mainnet.infura.io/v3/${process.env.INFURA}`
        );
        let gasPriceWei = new BigNumber(30000000000);
        let swapGasCost = new BigNumber(100000);
        let MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2';

        let cost = await sor.getCostOutputToken(
            MKR,
            18,
            gasPriceWei,
            swapGasCost,
            provider
        );
        let costEth = cost.div(BONE);
        console.log(`CostOutputToken MKR: ${costEth.toString()}`);
    }).timeout(5000);
});
