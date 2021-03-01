# Test Scripts

These scripts can be used to run non-deterministic tests.

### example-simpleSwap.ts

Run: `$ ts-node ./test/testScripts/example-simpleSwap.ts`

Example showing various full swaps using the SOR wrapper. This is the easiest and quickest way to use the SOR.

### example-simpleSwapWithProxy.ts

Run: `$ ts-node ./test/testScripts/example-simpleSwapWithProxy.ts`

Example showing how to use SOR along with the Balancer Exchange Proxy contract to execute the swaps. (Will use real funds to swap.)

### example-swapExactIn.ts

Run: `$ ts-node ./test/testScripts/example-swapExactIn.ts`

Full swapExactIn example for USDC->DAI using SOR functions without wrapper.

### example-swapExactOut.ts

Run: `$ ts-node ./test/testScripts/example-swapExactOut.ts`

Full swapExactOut example for USDC->DAI using SOR functions without wrapper.

### v1-v2-compare-live-pools-random.spec.ts

Run: `npx mocha -r ts-node/register test/testScripts/v1-v2-compare-live-pools-random.spec.ts`

This is using the live pools list from IPFS and on-chain balances so it’s non-deterministic. It’s taking a random pair from a list of 10 tokens along with random swap amounts and max pools. Compare V1 vs V2 and V2 vs V2 with filter.

### v1-v2-compare-pools-random-large.spec.ts

Run: `npx mocha -r ts-node/register test/testScripts/v1-v2-compare-pools-random-large.spec.ts`

This is using pools list from ./testData/testPools which can change so it’s non-deterministic. It’s taking a random pair from a list of 10 tokens along with random swap amounts and max pools. Compare V1 vs V2 and V2 vs V2 with filter. Assumes script running from root (see testDir if not). Will do a large amount of tests and save any that fail. Change MIN_TESTS for number of tests to be run.
