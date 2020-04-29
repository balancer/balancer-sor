// testing multi-hop

const sor = require('/Users/fernandomartinelli/0.Balancer_Local_Repos/balancer-sor/');
const BigNumber = require('bignumber.js');
const ethers = require('ethers');

const MAX_UINT = ethers.constants.MaxUint256;

// MAINNET
const tokenIn = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
const tokenOut = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH

// const tokenOut = '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'; // MKR
// const tokenIn = '0x0d8775f648430679a709e98d2b0cb6250d2887ef'; // BAT

// const tokenOut = '0x39aa39c021dfbae8fac545936693ac917d5e7563'; // cUSDC

(async function() {
    //// Multi-hop trades: we find the best pools that connect tokenIn and tokenOut through a multi-hop (intermediate) token
    // First: we get all tokens that can be used to be traded with tokenIn excluding
    // tokens that are in pools that already contain tokenOut (in which case multi-hop is not necessary)
    const dataTokenIn = await sor.getPoolsWithSingleToken(tokenIn);
    const poolsTokenInNoTokenOut = filterPoolsWithoutToken(
        dataTokenIn.pools,
        tokenOut
    );
    // console.log(poolsTokenInNoTokenOut);

    const tokenInHopTokens = getTokensPairedToToken(
        poolsTokenInNoTokenOut,
        tokenIn
    );

    // Second: we get all tokens that can be used to be traded with tokenOut excluding
    // tokens that are in pools that already contain tokenIn (in which case multi-hop is not necessary)
    const dataTokenOut = await sor.getPoolsWithSingleToken(tokenOut);
    const poolsTokenOutNoTokenIn = filterPoolsWithoutToken(
        dataTokenOut.pools,
        tokenIn
    );
    // console.log(poolsTokenOutNoTokenIn);

    const tokenOutHopTokens = getTokensPairedToToken(
        poolsTokenOutNoTokenIn,
        tokenOut
    );

    // Third: we find the intersection of the two previous sets so we can trade tokenIn for tokenOut with 1 multi-hop
    // code from https://stackoverflow.com/a/31931146
    var hopTokensSet = new Set(
        [...Array.from(tokenInHopTokens)].filter(i => tokenOutHopTokens.has(i))
    );
    // Transform set into Array
    var hopTokens = Array.from(hopTokensSet);
    console.log(hopTokens);

    // Find the most liquid pool for each pair (tokenIn -> hopToken). We store an object in the form:
    // mostLiquidPoolsFirstHop = {hopToken1: mostLiquidPool, hopToken2: mostLiquidPool, ... , hopTokenN: mostLiquidPool}
    // Here we could query subgraph for all pools with pair (tokenIn -> hopToken), but to
    // minimize subgraph calls we loop through poolsTokenInNoTokenOut, and check the liquidity
    // only for those that have hopToken
    var mostLiquidPoolsFirstHop = [];
    for (var i = 0; i < hopTokens.length; i++) {
        var highestNormalizedLiquidity = 0; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        var highestNormalizedLiquidityIndex = 0; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (var k = 0; k < poolsTokenInNoTokenOut.length; k++) {
            // We now loop to check if this pool has hopToken
            var found = false;
            for (
                var j = 0;
                j < poolsTokenInNoTokenOut[k].tokensList.length;
                j++
            ) {
                if (
                    poolsTokenInNoTokenOut[k].tokensList[j].toLowerCase() ==
                    hopTokens[i]
                ) {
                    found = true;
                    break;
                }
            }
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (found) {
                let normalizedLiquidity = sor.getNormalizedLiquidity(
                    sor.parsePoolForTokenPair(
                        poolsTokenInNoTokenOut[k],
                        tokenIn,
                        hopTokens[i]
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThan(
                        highestNormalizedLiquidity
                    )
                ) {
                    highestNormalizedLiquidity = normalizedLiquidity;
                    highestNormalizedLiquidityIndex = k;
                }
            }
        }
        mostLiquidPoolsFirstHop[i] =
            poolsTokenInNoTokenOut[highestNormalizedLiquidityIndex];
        // console.log(highestNormalizedLiquidity)
        // console.log(mostLiquidPoolsFirstHop)
    }

    console.log('mostLiquidPoolsFirstHop');
    console.log(mostLiquidPoolsFirstHop);

    // Now similarly find the most liquid pool for each pair (hopToken -> tokenOut)
    var mostLiquidPoolsSecondHop = [];
    for (var i = 0; i < hopTokens.length; i++) {
        var highestNormalizedLiquidity = 0; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        var highestNormalizedLiquidityIndex = 0; // Aux variable to find pool with most liquidity for pair (tokenIn -> hopToken)
        for (var k = 0; k < poolsTokenOutNoTokenIn.length; k++) {
            // We now loop to check if this pool has hopToken
            var found = false;
            for (
                var j = 0;
                j < poolsTokenOutNoTokenIn[k].tokensList.length;
                j++
            ) {
                if (
                    poolsTokenOutNoTokenIn[k].tokensList[j].toLowerCase() ==
                    hopTokens[i]
                ) {
                    found = true;
                    break;
                }
            }
            // If this pool has hopTokens[i] calculate its normalized liquidity
            if (found) {
                let normalizedLiquidity = sor.getNormalizedLiquidity(
                    sor.parsePoolForTokenPair(
                        poolsTokenOutNoTokenIn[k],
                        hopTokens[i],
                        tokenOut
                    )
                );

                if (
                    normalizedLiquidity.isGreaterThan(
                        highestNormalizedLiquidity
                    )
                ) {
                    highestNormalizedLiquidity = normalizedLiquidity;
                    highestNormalizedLiquidityIndex = k;
                }
            }
        }
        mostLiquidPoolsSecondHop[i] =
            poolsTokenOutNoTokenIn[highestNormalizedLiquidityIndex];
        // console.log(highestNormalizedLiquidity)
        // console.log(mostLiquidPoolsSecondHop)
    }

    console.log('mostLiquidPoolsSecondHop');
    console.log(mostLiquidPoolsSecondHop);

    //// We find all pools with the direct trading pair (tokenIn -> tokenOut)
    // TODO avoid another subgraph call by filtering pools with single tokenIn AND tokenOut
    const data = await sor.getPoolsWithTokens(tokenIn, tokenOut);

    const directPools = data.pools;

    // console.log("datapools");
    // console.log(data.pools);

    const [poolData, pathData] = sor.parsePoolAndPathData(
        directPools,
        tokenIn,
        tokenOut,
        mostLiquidPoolsFirstHop,
        mostLiquidPoolsSecondHop,
        hopTokens
    );
    // console.log(poolData);
    // console.log(pathData);

    const [sorSwaps, totalReturn] = sor.smartOrderRouterMultiHop(
        poolData,
        pathData,
        'swapExactIn',
        // 'swapExactOut',
        new BigNumber('10000000000000000000'),
        new BigNumber('10'),
        0
    );
    console.log(sorSwaps);
    console.log(totalReturn.toString());
})();

// TO DO: move these functions to the ideal file
function filterPoolsWithoutToken(pools, token) {
    var found;
    var OutputPools = [];
    for (var i = 0; i < pools.length; i++) {
        found = false;
        for (var k = 0; k < pools[i].tokensList.length; k++) {
            if (pools[i].tokensList[k].toLowerCase() == token.toLowerCase()) {
                found = true;
                break;
            }
        }
        //Append pool if token not found
        if (!found) OutputPools.push(pools[i]);
    }
    return OutputPools;
}

// Inputs:
// - pools: All pools that contain a token
// - token: Token for which we are looking for pairs
// Outputs:
// - tokens: Set (without duplicate elements) of all tokens that pair with token
function getTokensPairedToToken(pools, token) {
    var found;
    var tokens = new Set();
    for (var i = 0; i < pools.length; i++) {
        found = false;
        for (var k = 0; k < pools[i].tokensList.length; k++) {
            if (pools[i].tokensList[k].toLowerCase() != token.toLowerCase()) {
                tokens.add(pools[i].tokensList[k]);
            }
        }
    }
    return tokens;
}
