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
