// testing multi-hop using Kovan Subgraph
// Run using yarn test
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');

const MAX_UINT = ethers.constants.MaxUint256;

describe('Multi-Pool Tests', () => {
    it('should test DAI -> USDC, swapExactIn', async () => {
        // const tokenIn = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'; // MKR
        const tokenIn = '0x1528F3FCc26d13F7079325Fb78D9442607781c8C'; // DAI
        const tokenOut = '0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5'; // USDC
        const swapType = 'swapExactIn';
        const swapAmount = new BigNumber('1000000000000000000');
        const maxPools = 4;
        const returnTokenCostPerPool = new BigNumber('0');

        console.log(
            `!!!!!!! ${tokenIn} ${tokenOut} ${swapType} ${utils.formatEther(
                swapAmount.toString()
            )} ${maxPools} ${utils.formatEther(
                returnTokenCostPerPool.toString()
            )}`
        );
        //// We find all pools with the direct trading pair (tokenIn -> tokenOut)
        // TODO avoid another subgraph call by filtering pools with single tokenIn AND tokenOut
        const data = await sor.getPoolsWithTokens(tokenIn, tokenOut);
        const directPools = data.pools;

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.getMultihopPoolsWithTokens(tokenIn, tokenOut);

        const pathData = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            pathData,
            swapType,
            swapAmount,
            maxPools,
            returnTokenCostPerPool
        );
        console.log('SOR swaps WITH multi-hop');
        console.log(sorSwaps);
        console.log('Total return WITH multi-hop');
        console.log(totalReturn.toString());

        assert(sorSwaps.length > 0, `Should have more than 0 swaps.`);

        /*
      let [directTokenPairs, allTokenPairs] = await sor.getTokenPairsMultiHop(
          tokenIn
      );
      console.log('directTokenPairs');
      console.log(directTokenPairs);
      console.log('allTokenPairs');
      console.log(allTokenPairs);
      */
    }).timeout(10000);

    it('should test DAI -> USDC, swapExactOut', async () => {
        const tokenIn = '0x1528F3FCc26d13F7079325Fb78D9442607781c8C'; // DAI
        const tokenOut = '0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5'; // USDC
        const swapType = 'swapExactOut';
        const swapAmount = new BigNumber('1000000'); // 1 USDC
        const maxPools = 4;
        const returnTokenCostPerPool = new BigNumber('0');

        console.log(
            `!!!!!!! ${tokenIn} ${tokenOut} ${swapType} ${utils.formatEther(
                swapAmount.toString()
            )} ${maxPools} ${utils.formatEther(
                returnTokenCostPerPool.toString()
            )}`
        );
        //// We find all pools with the direct trading pair (tokenIn -> tokenOut)
        // TODO avoid another subgraph call by filtering pools with single tokenIn AND tokenOut
        const data = await sor.getPoolsWithTokens(tokenIn, tokenOut);
        const directPools = data.pools;

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.getMultihopPoolsWithTokens(tokenIn, tokenOut);

        const pathData = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            pathData,
            swapType,
            swapAmount,
            maxPools,
            returnTokenCostPerPool
        );
        console.log('SOR swaps WITH multi-hop');
        console.log(sorSwaps);
        console.log('Total return WITH multi-hop');
        console.log(totalReturn.toString());

        assert(sorSwaps.length > 0, `Should have more than 0 swaps.`);

        /*
      let [directTokenPairs, allTokenPairs] = await sor.getTokenPairsMultiHop(
          tokenIn
      );
      console.log('directTokenPairs');
      console.log(directTokenPairs);
      console.log('allTokenPairs');
      console.log(allTokenPairs);
      */
    }).timeout(10000);

    it('should test DAI -> SNX: No direct swap but should have multi-swap.', async () => {
        // At time of writing there was no direct DAI -> SNX so if this fails the pools could have changed.
        const tokenIn = '0x1528F3FCc26d13F7079325Fb78D9442607781c8C'; // DAI
        const tokenOut = '0x86436BcE20258a6DcfE48C9512d4d49A30C4d8c4'; // SNX
        const swapType = 'swapExactIn';
        const swapAmount = new BigNumber('1000000000000000000');
        const maxPools = 4;
        const returnTokenCostPerPool = new BigNumber('0');

        console.log(
            `!!!!!!! ${tokenIn} ${tokenOut} ${swapType} ${utils.formatEther(
                swapAmount.toString()
            )} ${maxPools} ${utils.formatEther(
                returnTokenCostPerPool.toString()
            )}`
        );
        //// We find all pools with the direct trading pair (tokenIn -> tokenOut)
        // TODO avoid another subgraph call by filtering pools with single tokenIn AND tokenOut
        const data = await sor.getPoolsWithTokens(tokenIn, tokenOut);
        const directPools = data.pools;

        assert(directPools.length == 0, `Should have no direct pools.`);

        let [directTokenPairs, allTokenPairs] = await sor.getTokenPairsMultiHop(
            tokenIn
        );

        const directCheck = directTokenPairs.find(
            token =>
                ethers.utils.getAddress(token) ===
                ethers.utils.getAddress(tokenOut)
        );

        const allCheck = allTokenPairs.find(
            token =>
                ethers.utils.getAddress(token) ===
                ethers.utils.getAddress(tokenOut)
        );
        assert.equal(
            directCheck,
            undefined,
            `Direct pairs shouldn't include token out.`
        );
        assert.equal(
            ethers.utils.getAddress(allCheck),
            ethers.utils.getAddress(tokenOut),
            `All token pairs should include token out.`
        );

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.getMultihopPoolsWithTokens(tokenIn, tokenOut);

        const pathData = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            pathData,
            swapType,
            swapAmount,
            maxPools,
            returnTokenCostPerPool
        );

        assert(sorSwaps.length > 0, `Should have more than 0 swaps.`);
    }).timeout(10000);
});
