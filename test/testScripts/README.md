# Test Scripts

Examples and some non-deterministic testing helpers.

### swapExactInEthIn.ts

Run: `$ ts-node ./test/testScripts/swapExactInEthIn.ts`

Example showing how to use SOR and Vault to execute an ExactIn, Eth to token swap.

### swapExactInEthOut.ts

Run: `$ ts-node ./test/testScripts/swapExactInEthOut.ts`

Example showing how to use SOR and Vault to execute an ExactIn, token to Eth swap.

### swapExactInIpfs.ts

Run: `$ ts-node ./test/testScripts/swapExactInIpfs.ts`

Example showing how to use SOR and Vault to execute an ExactIn, token to token swap using Pools data retrieved from an IPFS URL.

### swapExactInSubgraph.ts

Run: `$ ts-node ./test/testScripts/swapExactInSubgraph.ts`

Example showing how to use SOR and Vault to execute an ExactIn, token to token swap using Pools data retrieved from Subgraph.

### swapExactOutEthIn.ts

Run: `$ ts-node ./test/testScripts/swapExactOutEthIn.ts`

Example showing how to use SOR and Vault to execute an ExactOut, Eth to token swap.

### swapExactOutEthOut.ts

Run: `$ ts-node ./test/testScripts/swapExactOutEthOut.ts`

Example showing how to use SOR and Vault to execute an ExactOut, token to Eth swap.

### swapExactOutIpfs.ts

Run: `$ ts-node ./test/testScripts/swapExactOutIpfs.ts`

Example showing how to use SOR and Vault to execute an ExactOut, token to token swap using Pools data retrieved from an IPFS URL.

### v1-v2-compareRandom.ts

Run: `npx mocha -r ts-node/register test/testScripts/v1-v2-compareRandom.ts`

This is using pools list from ./testData/testPools which can change so it’s non-deterministic. Takes a random pair from a list of tokens along with random swap amounts and max pools. Compares V1 vs V2 vs Wrapper. Used for generating large amount of random tests.

### v1-v2-compareRandomStableOnly.ts

Run: `npx mocha -r ts-node/register test/testScripts/v1-v2-compareRandomStableOnly.spec.ts`

Same as above but only uses stable pools.
