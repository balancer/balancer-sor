# Test Scripts

These scripts can be used for to run non-deterministic tests.

Run using: `$ ts-node ./test/testScripts/file-name.ts`

### compare.ts

Will run multiswap SOR and direct SOR (using live Mainnet Subgraph).

Alternates between swapExactIn/swapExactOut trade types each token.

Set number of tokens by changing runLoop variable in main run() function.

Can set `amounts` to try different trade amounts. Currently tries 0.1, 1.7, 107.6 and 1000.77 per trade.

Displays a table of results at the end. Last column highlights any issues.

#### Functions

directLegacy:

-   Method used in original Exchange app. Non multiswap SOR.
-   sor.getAllPublicSwapPools()
-   Uses same helper function used in legacy exchange to find token pools
-   sor.smartOrderRouter()
-   Uses same helper function used in legacy exchange to calc total output

SorDirectOnly:

-   Uses Multihop SOR but with direct pools only.
-   Should match (or be better than) directLegacy.

Multihop:

-   Multihop SOR with all pools.
-   sor.getAllPublicSwapPools();
-   sor.filterPoolsWithTokensDirect(allPoolsReturned, tokenIn, tokenOut);
-   sor.filterPoolsWithTokensMultihop(allPoolsReturned, tokenIn, tokenOut);
-   sor.parsePoolData
-   [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop
