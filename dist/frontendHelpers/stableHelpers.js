"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_1 = require("../utils/bignumber");
const stableMath = __importStar(require("../pools/stablePool/stableMath"));
/////////
/// UI Helpers
/////////
// Get BPT amount for token amounts with zero-price impact
// This function is the same regardless of whether we are considering
// an Add or Remove liquidity operation: The spot prices of BPT in tokens
// are the same regardless.
function BPTForTokensZeroPriceImpact(allBalances, decimals, amounts, // This has to have the same lenght as allBalances
bptTotalSupply, amp) {
    if (allBalances.length != amounts.length)
        throw 'allBalances and amounts have to have same length';
    let zero = new bignumber_1.BigNumber(0);
    let amountBPTOut = new bignumber_1.BigNumber(0);
    // Calculate the amount of BPT adding this liquidity would result in
    // if there were no price impact, i.e. using the spot price of tokenIn/BPT
    // We need to scale down allBalances
    let allBalancesDownScaled = [];
    for (let i = 0; i < allBalances.length; i++) {
        allBalancesDownScaled.push(allBalances[i].times(new bignumber_1.BigNumber(10).pow(-decimals[i])));
    }
    for (let i = 0; i < allBalances.length; i++) {
        // We need to scale down amounts
        amounts[i] = amounts[i].times(new bignumber_1.BigNumber(10).pow(-decimals[i]));
        let poolPairData = {
            amp: amp,
            allBalances: allBalancesDownScaled,
            tokenIndexIn: i,
            balanceOut: bptTotalSupply.times(new bignumber_1.BigNumber(10).pow(-18)),
            swapFee: zero,
        };
        let BPTPrice = stableMath._spotPriceAfterSwapTokenInForExactBPTOut(zero, poolPairData);
        amountBPTOut = amountBPTOut.plus(amounts[i].div(BPTPrice));
    }
    // We need to scale up the amount of BPT out
    return amountBPTOut.times(new bignumber_1.BigNumber(10).pow(18));
}
exports.BPTForTokensZeroPriceImpact = BPTForTokensZeroPriceImpact;
