// Tests costOutputToken
import { expect } from 'chai';
import { BigNumber, formatFixed } from '@ethersproject/bignumber';
import { calculateTotalSwapCost, SwapCostCalculator } from '../src/swapCost';
import { DAI, MKR, USDC, WETH } from './lib/constants';

describe('calculateTotalSwapCost', () => {
    it('should return correct total swap cost', async () => {
        const gasPriceWei = BigNumber.from('30000000000'); // 30GWEI
        const swapGas = BigNumber.from('100000');
        const tokenPriceWei = BigNumber.from('352480995000000000');

        const totalSwapCost = calculateTotalSwapCost(
            tokenPriceWei,
            swapGas,
            gasPriceWei
        );

        const expectedTotalSwapCost = BigNumber.from('1057442985000000');
        expect(expectedTotalSwapCost).to.eql(totalSwapCost);
    });

    it('should return correct total swap cost', async () => {
        const gasPriceWei = BigNumber.from('30000000000'); // 30GWEI
        const swapGas = BigNumber.from('100000');
        const tokenPriceWei = BigNumber.from('240000000000000000000');

        const totalSwapCost = calculateTotalSwapCost(
            tokenPriceWei,
            swapGas,
            gasPriceWei
        );

        const expectedTotalSwapCost = BigNumber.from('720000000000000000');
        expect(expectedTotalSwapCost).to.eql(totalSwapCost);
    });
});

describe('Test SwapCostCalculator', () => {
    describe('convertGasCostToToken', () => {
        it("Should return 0 if CoinGecko doesn't recognise token", async () => {
            const gasPriceWei = BigNumber.from('30000000000');
            const swapGas = BigNumber.from('100000');

            const costExpected = BigNumber.from('0');
            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                '0x0',
                18,
                gasPriceWei,
                swapGas
            );

            expect(cost).to.eql(costExpected);
        });

        it('Example of full call with DAI & 30GWEI Gas Price', async () => {
            const gasPriceWei = BigNumber.from('30000000000');
            const swapGas = BigNumber.from('100000');

            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                DAI.address,
                DAI.decimals,
                gasPriceWei,
                swapGas
            );
            const costEth = formatFixed(cost, 18);
            console.log(`CostOutputToken DAI: ${costEth.toString()}`);
        }).timeout(5000);

        it('Example of full call with USDC & 30GWEI Gas Price', async () => {
            const gasPriceWei = BigNumber.from('30000000000');
            const swapGas = BigNumber.from('100000');

            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                USDC.address,
                USDC.decimals,
                gasPriceWei,
                swapGas
            );
            const costEth = formatFixed(cost, 6);
            console.log(`CostOutputToken USDC: ${costEth.toString()}`);
        }).timeout(5000);

        it('Example of full call with MKR & 30GWEI Gas Price', async () => {
            const gasPriceWei = BigNumber.from('30000000000');
            const swapGas = BigNumber.from('100000');

            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                MKR.address,
                MKR.decimals,
                gasPriceWei,
                swapGas
            );
            const costEth = formatFixed(cost, 18);
            console.log(`CostOutputToken MKR: ${costEth.toString()}`);
        }).timeout(5000);

        it('Example of full call with WETH & 30GWEI Gas Price', async () => {
            const gasPriceWei = BigNumber.from('30000000000');
            const swapGas = BigNumber.from('100000');

            const cost = await new SwapCostCalculator(1).convertGasCostToToken(
                WETH.address,
                WETH.decimals,
                gasPriceWei,
                swapGas
            );
            const costEth = formatFixed(cost, 18);
            console.log(`CostOutputToken WETH: ${costEth.toString()}`);
        }).timeout(5000);
    });
});
