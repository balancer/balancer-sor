// Tests costOutputToken
import { expect } from 'chai';
import { BigNumber, scale } from '../src/utils/bignumber';
import {
    calculateTotalSwapCost,
    SwapCostCalculator,
} from '../src/swapCostCalculator';

describe('calculateTotalSwapCost', () => {
    it('should return correct total swap cost', async () => {
        const gasPriceWei = new BigNumber(30000000000); // 30GWEI
        const swapGasCost = new BigNumber(100000);
        const tokenPriceWei = new BigNumber(352480995000000000);

        const totalSwapCost = calculateTotalSwapCost(
            tokenPriceWei,
            swapGasCost,
            gasPriceWei
        );

        const expectedTotalSwapCost = new BigNumber(1057442985000000);
        expect(expectedTotalSwapCost).to.eql(totalSwapCost);
    });

    it('should return correct total swap cost', async () => {
        const gasPriceWei = new BigNumber(30000000000); // 30GWEI
        const swapGasCost = new BigNumber(100000);
        const tokenPriceWei = new BigNumber(240000000000000000000);

        const totalSwapCost = calculateTotalSwapCost(
            tokenPriceWei,
            swapGasCost,
            gasPriceWei
        );

        const expectedTotalSwapCost = new BigNumber(720000000000000000);
        expect(expectedTotalSwapCost).to.eql(totalSwapCost);
    });
});

describe('Test SwapCostCalculator', () => {
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    describe('convertGasCostToToken', () => {
        it("Should return 0 if CoinGecko doesn't recognise token", async () => {
            const gasPriceWei = new BigNumber(30000000000);
            const swapGasCost = new BigNumber(100000);

            const costExpected = new BigNumber(0);
            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                '0x0',
                18,
                gasPriceWei,
                swapGasCost
            );

            expect(cost).to.eql(costExpected);
        });

        it('Example of full call with DAI & 30GWEI Gas Price', async () => {
            const gasPriceWei = new BigNumber(30000000000);
            const swapGasCost = new BigNumber(100000);

            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                DAI,
                18,
                gasPriceWei,
                swapGasCost
            );
            const costEth = scale(cost, -18);
            console.log(`CostOutputToken DAI: ${costEth.toString()}`);
        }).timeout(5000);

        it('Example of full call with USDC & 30GWEI Gas Price', async () => {
            const gasPriceWei = new BigNumber(30000000000);
            const swapGasCost = new BigNumber(100000);

            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                USDC,
                6,
                gasPriceWei,
                swapGasCost
            );
            const costEth = scale(cost, -6);
            console.log(`CostOutputToken USDC: ${costEth.toString()}`);
        }).timeout(5000);

        it('Example of full call with MKR & 30GWEI Gas Price', async () => {
            const gasPriceWei = new BigNumber(30000000000);
            const swapGasCost = new BigNumber(100000);
            const MKR = '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2';

            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                MKR,
                18,
                gasPriceWei,
                swapGasCost
            );
            const costEth = scale(cost, -18);
            console.log(`CostOutputToken MKR: ${costEth.toString()}`);
        }).timeout(5000);

        it('Example of full call with WETH & 30GWEI Gas Price', async () => {
            const gasPriceWei = new BigNumber(30000000000);
            const swapGasCost = new BigNumber(100000);

            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                WETH,
                18,
                gasPriceWei,
                swapGasCost
            );
            const costEth = scale(cost, -18);
            console.log(`CostOutputToken WETH: ${costEth.toString()}`);
        }).timeout(5000);
    });
});
