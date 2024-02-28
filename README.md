<p align="center">
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

Create a .env file in root dir. Depending on network being used add an RPC URL (e.g. Alchemy, Infura), e.g.: `RPC_URL_MAINNET=alchemy/infura`

Supported networks out of box for example are:

```
RPC_URL_MAINNET
RPC_URL_POLYGON
RPC_URL_ARBITRUM
RPC_URL_GNOSIS
RPC_URL_ZKEVM
RPC_URL_GOERLI
```

Install dependencies: `$ yarn install`

Run example: `$ ts-node ./test/testScripts/swapExample.ts`

## Contributing/Adding New Pools

Running tests locally:

1. Add .env and add following RPC URLs (e.g. Alchemy, Infura)

```
RPC_URL_MAINNET=
RPC_URL_POLYGON=
```

2. Start local forked nodes to test against:

`$ yarn run node`

`$ yarn run node:polygon`

3. Run tests:
   `$ yarn test`

To run a single test file use `test:only`, e.g.:

`$ yarn test:only test/composableStable.integration.spec.ts`

Adding New Pools:

See info [here](https://www.notion.so/SOR-Adding-New-Pools-fa073ec6fecb4c22b1ba13504b04f5bf?pvs=4)

## Environment Variables

Optional config values can be set in the .env file:

PRICE_ERROR_TOLERANCE - how close we expect prices after swap to be in SOR suggested paths. Defaults 0.00001.

INFINITESIMAL - Infinitesimal is an amount that's used to initialize swap amounts so they are not zero or the path's limit. Defaults 0.000001.

Example:

```
PRICE_ERROR_TOLERANCE=0.00001
INFINITESIMAL=0.000001
```

## Note on Licensing

Except where indicated otherwise, the code in this repository is licensed GPLv3.

Superluminal Labs Ltd. is the owner of the directories `balancer-sor/src/pools/gyro2Pool/`, `balancer-sor/src/pools/gyro3Pool/`, `balancer-sor/src/pools/gyroEPool/`, `balancer-sor/src/pools/gyro2V2Pool/`, and `balancer-sor/src/pools/gyroEV2Pool/` and any accompanying files contained herein (collectively, these “Software”). Use of these Software is exclusively subject to the [Gyroscope Pool License](./src/pools/gyroEPool/LICENSE), which is available at the provided link (the “Gyroscope Pool License”). These Software are not covered by the General Public License and do not confer any rights to the user other than the limited rights specified in the Gyroscope Pool License. A special hybrid license between Superluminal Labs Ltd and Balancer Labs OÜ governs Superluminal Labs Ltd's use of the Balancer Labs OÜ code [Special License](./src/pools/gyroEPool/GyroscopeBalancerLicense.pdf), which is available at the provided link. By using these Software, you agree to be bound by the terms and conditions of the Gyroscope Pool License. If you do not agree to all terms and conditions of the Gyroscope Pool License, do not use any of these Software.
