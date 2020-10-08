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
// Following is output for 1BAL->ANT swapExactIn
[
    swaps,
    totalReturnWei,
] = sor.smartOrderRouterMultiHopEpsOfInterest(....

console.log(totalReturnWei);
// 4637139997385211870  - This is the total amount of ANT received for 1BAL

console.log(swaps);

  /*
    This demonstrates a multihop swap going:
    BAL -> REN via pool 0x89ede...
    Then REN -> ANT via pool 0x9e04b42...
  */
  [
    // Multihop swap
    [
      // First sequence in swap
      {
        pool: '0x89edee8eb84a17396d374f7bbc8dc8ed95a133f9',
        tokenIn: '0xba100000625a3754423978a60c9317c58a424e3d',
        tokenOut: '0x408e41876cccdc0f92210600ef50372656052a38',
        swapAmount: '1000000000000000000',
        limitReturnAmount: '0',
        maxPrice: '115792089237316195423570985008687907853269984665640564039457584007913129639935'
      },
      // Second sequence in swap
      {
        pool: '0x9e04b421149043c04b33865d5ecd8f6c87f174b6',
        tokenIn: '0x408e41876cccdc0f92210600ef50372656052a38',
        tokenOut: '0x960b236a07cf122663c4303350609a66a7b288c0',
        swapAmount: '61607795579834805630',
        limitReturnAmount: '0',
        maxPrice: '115792089237316195423570985008687907853269984665640564039457584007913129639935'
      }
    ]
  ]
```

The file: [example-swapExactIn.ts](test/testScripts/example-swapExactIn.ts), shows a full example with comments for a USDC->DAI swapExactIn for 1 USDC input:

To Run:

Create a .env file in root dir with your infura provider key: `INFURA=your_key`

Install dependencies: `$ yarn install`

Run example: `$ ts-node ./test/testScripts/example-swapExactIn.ts`
