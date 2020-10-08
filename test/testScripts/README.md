# Test Scripts

These scripts can be used for to run non-deterministic tests.

### multicallTest.ts

Run: `$ ts-node ./test/testScripts/multicallTest.ts`

Testing max number of multicalls. Runs multicall getAllPoolDataOnChain method with increasing amount of calls.

### trade-debug.spec.ts

Run: `$ npx mocha -r ts-node/register test/testScripts/trade-debug.spec.ts`

Tests full multihop-eps trades using live subgraph. Useful for quickly checking trade outputs.

### example-swapExactIn.ts

Run: `$ ts-node ./test/testScripts/example-swapExactIn.ts`

Example showing full swapExactIn, USDC->DAI.
