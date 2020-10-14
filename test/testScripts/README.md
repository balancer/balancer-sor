# Test Scripts

These scripts can be used to run non-deterministic tests.

### multicallTest.ts

Run: `$ ts-node ./test/testScripts/multicallTest.ts`

Testing max number of multicalls. Runs multicall getAllPoolDataOnChain method with increasing amount of calls.

### trade-debug.spec.ts

Run: `$ npx mocha -r ts-node/register test/testScripts/trade-debug.spec.ts`

Tests full multihop-eps trades using live subgraph. Useful for quickly checking trade outputs.

### example-swapExactIn.ts

Run: `$ ts-node ./test/testScripts/example-swapExactIn.ts`

Example showing full swapExactIn, USDC->DAI using full pool on-chain data. Retrieving all on-chain data can take >5s but results in most accurate results.

1. Fetches public pools from Subgraph.
2. Retrieves pool on-chain data (balances, weights, fees) for ALL pools. Uses Multicall.
3. Calculates best swap.

### example-swapExactInWithCheck.ts

Run: `$ ts-node ./test/testScripts/example-swapExactInWithCheck.ts`

Example showing full swapExactIn, USDC->DAI using Subgraph data with a limited on-chain check. Using Subgraph data is much quicker to load but can result in inaccurate swaps if Subgraph isn't correctly sync'd. This method initially calculates best swaps using the Subgraph data then performs a check using on-chain data for the pools of interest. This can result in less optimal swaps but all swaps will at least be valid.

1. Fetches public pools from Subgraph.
2. Calculates best swap.
3. Retrieves on-chain information (balances, weights, fees) for pools used in calculated swaps. Uses Multicall.
4. Check that Subgraph swaps are valid, if not update swap amounts to valid values.

### example-swapExactOut.ts

Run: `$ ts-node ./test/testScripts/example-swapExactOut.ts`

Example showing full swapExactOut, USDC->DAI using full pool on-chain data. Retrieving all on-chain data can take >5s but results in most accurate results.

1. Fetches public pools from Subgraph.
2. Retrieves pool on-chain data (balances, weights, fees) for ALL pools. Uses Multicall.
3. Calculates best swap.

### example-swapExactOutWithCheck.ts

Run: `$ ts-node ./test/testScripts/example-swapExactOutWithCheck.ts`

Example showing full swapExactOut, USDC->DAI using Subgraph data with a limited on-chain check. Using Subgraph data is much quicker to load but can result in inaccurate swaps if Subgraph isn't correctly sync'd. This method initially calculates best swaps using the Subgraph data then performs a check using on-chain data for the pools of interest. This can result in less optimal swaps but all swaps will at least be valid.

1. Fetches public pools from Subgraph.
2. Calculates best swap.
3. Retrieves on-chain information (balances, weights, fees) for pools used in calculated swaps. Uses Multicall.
4. Check that Subgraph swaps are valid, if not update swap amounts to valid values.
