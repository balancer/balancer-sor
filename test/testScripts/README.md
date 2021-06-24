# Test Scripts

Examples and some non-deterministic testing helpers.

### swapExample.ts

Run: `$ ts-node ./test/testScripts/swapExample.ts`

Example showing how to use SOR and Vault to execute swaps. Can configure different swap types and pool sources as well as use Mainnet or Kovan.

### v1-v2-compareRandom.ts

Run: `npx mocha -r ts-node/register test/testScripts/v1-v2-compareRandom.ts`

This is using pools list from ./testData/testPools which can change so it’s non-deterministic. Takes a random pair from a list of tokens along with random swap amounts and max pools. Compares V1 vs V2 vs Wrapper. Used for generating large amount of random tests.

### v1-v2-compareRandomStableOnly.ts

Run: `npx mocha -r ts-node/register test/testScripts/v1-v2-compareRandomStableOnly.spec.ts`

Same as above but only uses stable pools.
