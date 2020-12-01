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
