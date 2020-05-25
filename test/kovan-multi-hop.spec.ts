// testing multi-hop using Kovan Subgraph
// Run using yarn test
import { expect, assert } from 'chai';
import 'mocha';
const sor = require('../src');
const BigNumber = require('bignumber.js');
const { ethers, utils } = require('ethers');

const MAX_UINT = ethers.constants.MaxUint256;

describe('Multi-Pool Tests', () => {
    it('should test 10ANT -> ETH, swapExactIn', async () => {
        let tokenIn = '0x37f03a12241E9FD3658ad6777d289c3fb8512Bc9'; // ANT
        let tokenOut = '0xd0A1E359811322d97991E03f863a0C30C2cF029C'; // WETH
        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();

        const swapType = 'swapExactIn';
        const swapAmount = new BigNumber('10000000000000000000');
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

        // SUBZGRAPH GETALLPOOLS

        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.getMultihopPoolsWithTokens(tokenIn, tokenOut);

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            pools,
            pathData,
            swapType,
            swapAmount,
            maxPools,
            returnTokenCostPerPool
        );
        /*
        console.log('SOR swaps WITH multi-hop');
        console.log(sorSwaps);
        console.log('Total return WITH multi-hop');
        console.log(totalReturn.toString());
        */

        assert(sorSwaps.length > 0, `Should have more than 0 swaps.`);
        console.log(utils.formatEther(totalReturn.toString()));
    }).timeout(10000);

    it('should test DAI -> USDC, swapExactIn', async () => {
        // const tokenIn = '0xef13C0c8abcaf5767160018d268f9697aE4f5375'; // MKR
        // !!!!!!! These have to be in correct format !!!!!!!
        //const tokenIn = '0x1528f3fcc26d13f7079325fb78d9442607781c8c'; // DAI
        //const tokenOut = '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5'; // USDC
        let tokenIn = '0x1528F3FCc26d13F7079325Fb78D9442607781c8C'; // DAI
        let tokenOut = '0x2F375e94FC336Cdec2Dc0cCB5277FE59CBf1cAe5'; // USDC
        tokenIn = tokenIn.toLowerCase();
        tokenOut = tokenOut.toLowerCase();

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

        // SUBZGRAPH GETALLPOOLS

        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);

        let mostLiquidPoolsFirstHop, mostLiquidPoolsSecondHop, hopTokens;
        [
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens,
        ] = await sor.getMultihopPoolsWithTokens(tokenIn, tokenOut);

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        console.log(pools);
        console.log(`!!!!!!!`);
        console.log(pathData);

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            pools,
            pathData,
            swapType,
            swapAmount,
            maxPools,
            returnTokenCostPerPool
        );
        /*
        console.log('SOR swaps WITH multi-hop');
        console.log(sorSwaps);
        console.log('Total return WITH multi-hop');
        console.log(totalReturn.toString());
        */

        assert(sorSwaps.length > 0, `Should have more than 0 swaps.`);
    }).timeout(10000);

    it('should test DAI -> USDC, swapExactOut', async () => {
        const tokenIn = '0x1528f3fcc26d13f7079325fb78d9442607781c8c'; // DAI
        const tokenOut = '0x2f375e94fc336cdec2dc0ccb5277fe59cbf1cae5'; // USDC
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

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            pools,
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
    }).timeout(10000);
    /*
    it('should test DAI -> SNX: No direct swap but should have multi-swap.', async () => {
        // At time of writing there was no direct DAI -> SNX so if this fails the pools could have changed.
        const tokenIn = '0x1528f3fcc26d13f7079325fb78d9442607781c8c'; // DAI
        const tokenOut = '0x86436bce20258a6dcfe48c9512d4d49a30c4d8c4'; // SNX
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
        const directPools = await sor.getPoolsWithTokens(tokenIn, tokenOut);
        const directPoolsArray = Object.values(directPools);
        assert(directPoolsArray.length == 0, `Should have no direct pools.`);

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

        let pools, pathData;
        [pools, pathData] = sor.parsePoolData(
            directPools,
            tokenIn,
            tokenOut,
            mostLiquidPoolsFirstHop,
            mostLiquidPoolsSecondHop,
            hopTokens
        );

        const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
            pools,
            pathData,
            swapType,
            swapAmount,
            maxPools,
            returnTokenCostPerPool
        );

        assert(sorSwaps.length > 0, `Should have more than 0 swaps.`);
    }).timeout(10000);
    */
});
