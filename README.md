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

[Read More](https://docs.balancer.fi/developers/smart-order-router)

## Overview Of Use And Example

There are two types of swap available:

**swapExactIn** - i.e. You want to swap exactly 1 ETH as input and SOR will calculate X amount of BAL you receive in return.  
or  
**swapExactOut** - i.e. You want to receive exactly 1 BAL and SOR will calculate X amount of ETH you must input.

The SOR will return totalReturn/totalInput as well as a list swaps to achieve the total. Swaps can be through direct pools, i.e. A > POOL1 > B, or via a multihop pool, i.e. A > POOL1 > C > POOL2 > B. The swaps are returned in a format that can be directly to the Vault to execute the trade.

The example file `swapExample.ts` in: [./testScripts](test/testScripts/), demonstrates full examples with comments.

To Run:

Create a .env file in root dir with your infura provider key: `INFURA=your_key`

Install dependencies: `$ yarn install`

Run example: `$ ts-node ./test/testScripts/swapExample.ts`

## Environment Variables

Optional config values can be set in the .env file:

PRICE_ERROR_TOLERANCE - how close we expect prices after swap to be in SOR suggested paths. Defaults 0.00001.

INFINITESIMAL - Infinitesimal is an amount that's used to initialize swap amounts so they are not zero or the path's limit. Defaults 0.000001.

Example:

```
PRICE_ERROR_TOLERANCE=0.00001
INFINITESIMAL=0.000001
```
