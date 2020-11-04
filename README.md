<p align="center">
  <a href="https://circleci.com/gh/balancer-labs/balancer-sor">
    <img src="https://circleci.com/gh/balancer-labs/balancer-sor.svg?style=svg&circle-token=33636208d3161f79ff283b29c8dba9841bda8931" />
  </a>
  <a href="https://coveralls.io/github/balancer-labs/balancer-sor">
    <img src="https://coveralls.io/repos/github/balancer-labs/balancer-sor/badge.svg?t=7avwwt" />
  </a>
  <a href="https://www.gnu.org/licenses/gpl-3.0">
    <img src="https://img.shields.io/badge/License-GPLv3-green.svg" />
  </a>
  <a href="https://www.npmjs.com/package/@balancer-labs/sor">
    <img src="https://img.shields.io/badge/npm-v0.2.4-blue.svg?style=flat-square" />
  </a>
</p>

<h1 align=center><code>Smart Order Router (SOR)</code></h1>

Smart Order Router, or SOR, is an off-chain linear optimization of routing orders across pools for best price execution.

SOR exists in the Bronze release as a way to aggregate liquidity across all Balancer pools. Future releases of Balancer will accomplish this on-chain and allow aggregate contract fillable liquidity.

Liquidity aggregators are free to use the SOR npm package or create their own order routing across pools.

[Read More](https://docs.balancer.finance/protocol/sor)

## Overview Of Use And Example

There are two types of swap available:

**swapExactIn** - i.e. You want to swap exactly 1 ETH as input and SOR will calculate X amount of BAL you receive in return.  
or  
**swapExactOut** - i.e. You want to receive exactly 1 BAL and SOR will calculate X amount of ETH you must input.

The SOR will return totalReturn/totalInput as well as a list swaps to achieve the total. Swaps can be through direct pools, i.e. A > POOL1 > B, or via a multihop pool, i.e. A > POOL1 > C > POOL2 > B. The swaps can be executed directly on-chain or with something like the [ExchangeProxy](https://github.com/balancer-labs/balancer-registry/blob/master/contracts/ExchangeProxy.sol).

Example Output:

```js
// Following is output for 1USDC->WETH swapExactIn
[
    swaps,
    amountOut,
] = await SOR.getSwaps(....

  console.log(
      `USDC>WETH, SwapExactIn, 1USDC, Total WETH Return: ${amountOut.toString()}`
  );
  // USDC>WETH, SwapExactIn, 1USDC, Total WETH Return: 3090385829490120 - This is the total amount of WETH received for 1USDC
  console.log(`Swaps: `);
  console.log(swaps);

  /*
    This demonstrates a multihop swap going:
    USDC -> BTC++ via pool 0x75286...
    Then BTC++ -> WETH via pool 0xd4dbf...
  */
  [
    // Multihop swap
    [
      // First sequence in swap
      {
        pool: '0x75286e183d923a5f52f52be205e358c5c9101b09',
        tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        tokenOut: '0x0327112423f3a68efdf1fcf402f6c5cb9f7c33fd',
        swapAmount: '1000000',
        limitReturnAmount: '0',
        maxPrice: '115792089237316195423570985008687907853269984665640564039457584007913129639935'
       },
      // Second sequence in swap
      {
        pool: '0xd4dbf96db2fdf8ed40296d8d104b371adf7dee12',
        tokenIn: '0x0327112423f3a68efdf1fcf402f6c5cb9f7c33fd',
        tokenOut: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        swapAmount: '89403274570637',
        limitReturnAmount: '0',
        maxPrice:'115792089237316195423570985008687907853269984665640564039457584007913129639935'
      }
    ]
  ]
```

The file: [example-swapExactIn.ts](test/testScripts/example-swapExactIn.ts), shows full examples with comments for various swaps.

To Run:

Create a .env file in root dir with your infura provider key: `INFURA=your_key`

Install dependencies: `$ yarn install`

Run example: `$ ts-node ./test/testScripts/example-swapExactIn.ts`
