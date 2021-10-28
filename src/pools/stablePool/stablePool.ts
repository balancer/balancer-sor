import { getAddress } from '@ethersproject/address';
import { BigNumber, formatFixed, parseFixed } from '@ethersproject/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import {
    BigNumber as OldBigNumber,
    bnum,
    scale,
    ZERO,
} from '../../utils/bignumber';
import { isSameAddress } from '../../utils';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import * as SDK from '@georgeroman/balancer-v2-pools';
import {
    _invariant,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _spotPriceAfterSwapTokenInForExactBPTOut,
    _spotPriceAfterSwapBPTInForExactTokenOut,
    _spotPriceAfterSwapExactTokenInForBPTOut,
    _spotPriceAfterSwapExactBPTInForTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut,
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut,
} from './stableMath';
import cloneDeep from 'lodash.clonedeep';

type StablePoolToken = Pick<SubgraphToken, 'address' | 'balance' | 'decimals'>;

export enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

export type StablePoolPairData = PoolPairBase & {
    allBalances: OldBigNumber[];
    allBalancesScaled: BigNumber[]; // EVM Maths uses everything in 1e18 upscaled format and this avoids repeated scaling
    invariant: OldBigNumber;
    amp: BigNumber;
    tokenIndexIn: number;
    tokenIndexOut: number;
    pairType: PairTypes;
    bptIndex: number;
};

export class StablePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Stable;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: StablePoolToken[];
    tokensList: string[];
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);

    static AMP_DECIMALS = 3;

    static fromPool(pool: SubgraphPoolBase): StablePool {
        if (!pool.amp) throw new Error('StablePool missing amp factor');
        return new StablePool(
            pool.id,
            pool.address,
            pool.amp,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList
        );
    }

    constructor(
        id: string,
        address: string,
        amp: string,
        swapFee: string,
        totalShares: string,
        tokens: StablePoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.address = address;
        this.amp = parseFixed(amp, StablePool.AMP_DECIMALS);
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
    }

    setTypeForSwap(type: SwapPairType): void {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): StablePoolPairData {
        const tokenIndexIn = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenIn)
        );
        if (tokenIndexIn < 0) throw 'Pool does not contain tokenIn';
        const tI = this.tokens[tokenIndexIn];
        const balanceIn = tI.balance;
        const decimalsIn = tI.decimals;

        const tokenIndexOut = this.tokens.findIndex(
            (t) => getAddress(t.address) === getAddress(tokenOut)
        );
        if (tokenIndexOut < 0) throw 'Pool does not contain tokenOut';
        const tO = this.tokens[tokenIndexOut];
        const balanceOut = tO.balance;
        const decimalsOut = tO.decimals;

        // Get all token balances
        const allBalances = this.tokens.map(({ balance }) => bnum(balance));
        const allBalancesScaled = this.tokens.map(({ balance }) =>
            parseFixed(balance, 18)
        );

        // Stable pools will allow trading between token and pool BPT
        let pairType: PairTypes;
        if (isSameAddress(tokenIn, this.address)) {
            pairType = PairTypes.BptToToken;
        } else if (isSameAddress(tokenOut, this.address)) {
            pairType = PairTypes.TokenToBpt;
        } else {
            pairType = PairTypes.TokenToToken;
        }

        const bptIndex = this.tokensList.indexOf(this.address);
        const inv = _invariant(this.amp, allBalances);

        const poolPairData: StablePoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            bptIndex: bptIndex,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            balanceIn: parseFixed(balanceIn, decimalsIn),
            balanceOut: parseFixed(balanceOut, decimalsOut),
            invariant: inv,
            swapFee: this.swapFee,
            allBalances,
            allBalancesScaled,
            amp: this.amp,
            tokenIndexIn: tokenIndexIn,
            tokenIndexOut: tokenIndexOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: StablePoolPairData): OldBigNumber {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return bnum(
            formatFixed(
                poolPairData.balanceOut.mul(poolPairData.amp),
                poolPairData.decimalsOut + StablePool.AMP_DECIMALS
            )
        );
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        // We multiply ratios by 10**-18 because we are in normalized space
        // so 0.5 should be 0.5 and not 500000000000000000
        // TODO: update bmath to use everything normalized
        if (swapType === SwapTypes.SwapExactIn) {
            return bnum(
                formatFixed(
                    poolPairData.balanceIn.mul(this.MAX_IN_RATIO).div(ONE),
                    poolPairData.decimalsIn
                )
            );
        } else {
            return bnum(
                formatFixed(
                    poolPairData.balanceOut.mul(this.MAX_OUT_RATIO).div(ONE),
                    poolPairData.decimalsOut
                )
            );
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        // token is BPT
        if (this.address == token) {
            this.totalShares = newBalance;
        } else {
            // token is underlying in the pool
            const T = this.tokens.find((t) => isSameAddress(t.address, token));
            if (!T) throw Error('Pool does not contain this token');
            T.balance = formatFixed(newBalance, T.decimals);
        }
    }

    _exactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            const amp = bnum(this.amp.toString());
            const poolPairDataNoBPT = removeBPT(poolPairData);
            const balances = poolPairDataNoBPT.allBalancesScaled.map(
                (balance) => bnum(balance.toString())
            );
            const tokenIndexIn = poolPairDataNoBPT.tokenIndexIn;
            const tokenIndexOut = poolPairDataNoBPT.tokenIndexOut;
            const swapFee = bnum(poolPairData.swapFee.toString());
            const totalShares = bnum(this.totalShares.toString());
            let amt: OldBigNumber;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                const amountsIn: OldBigNumber[] = [];
                for (let i = 0; i < balances.length - 1; i++) {
                    const newValue = i === tokenIndexIn ? amtScaled : ZERO;
                    amountsIn.push(newValue);
                }
                amt = SDK.StableMath._calcBptOutGivenExactTokensIn(
                    amp,
                    balances,
                    amountsIn,
                    totalShares,
                    swapFee
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                amt = SDK.StableMath._calcTokenOutGivenExactBptIn(
                    amp,
                    balances,
                    tokenIndexOut,
                    amtScaled,
                    totalShares,
                    swapFee
                );
            } else {
                amt = SDK.StableMath._calcOutGivenIn(
                    amp,
                    balances,
                    tokenIndexIn,
                    tokenIndexOut,
                    amtScaled,
                    bnum(poolPairData.swapFee.toString())
                );
            }

            // return normalised amount
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            console.error(`_evmoutGivenIn: ${err.message}`);
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            const amp = bnum(this.amp.toString());
            const poolPairDataNoBPT = removeBPT(poolPairData);
            const balances = poolPairDataNoBPT.allBalancesScaled.map(
                (balance) => bnum(balance.toString())
            );
            const tokenIndexIn = poolPairDataNoBPT.tokenIndexIn;
            const tokenIndexOut = poolPairDataNoBPT.tokenIndexOut;
            const swapFee = bnum(poolPairData.swapFee.toString());
            const totalShares = bnum(this.totalShares.toString());
            let amt: OldBigNumber;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                amt = SDK.StableMath._calcTokenInGivenExactBptOut(
                    amp,
                    balances,
                    tokenIndexIn,
                    amtScaled,
                    totalShares,
                    swapFee
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                const amountsOut: OldBigNumber[] = [];
                for (let i = 0; i < balances.length - 1; i++) {
                    const newValue = i === tokenIndexOut ? amtScaled : ZERO;
                    amountsOut.push(newValue);
                }
                amt = SDK.StableMath._calcBptInGivenExactTokensOut(
                    amp,
                    balances,
                    amountsOut,
                    totalShares,
                    swapFee
                );
            } else {
                amt = SDK.StableMath._calcInGivenOut(
                    amp,
                    balances,
                    poolPairData.tokenIndexIn,
                    poolPairData.tokenIndexOut,
                    amtScaled,
                    swapFee
                );
            }
            // return normalised amount
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_UP mode (0)
            return scale(amt, -18).dp(poolPairData.decimalsIn, 0);
        } catch (err) {
            console.error(`_evminGivenOut: ${err.message}`);
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _spotPriceAfterSwapExactTokenInForBPTOut(
                amount,
                removeBPT(poolPairData)
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _spotPriceAfterSwapExactBPTInForTokenOut(
                amount,
                removeBPT(poolPairData)
            );
        } else {
            result = _spotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                removeBPT(poolPairData)
            );
        }
        return result;
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _spotPriceAfterSwapTokenInForExactBPTOut(
                amount,
                removeBPT(poolPairData)
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _spotPriceAfterSwapBPTInForExactTokenOut(
                amount,
                removeBPT(poolPairData)
            );
        } else {
            result = _spotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                removeBPT(poolPairData)
            );
        }
        return result;
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                amount,
                removeBPT(poolPairData)
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                amount,
                removeBPT(poolPairData)
            );
        } else {
            result = _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                removeBPT(poolPairData)
            );
        }
        return result;
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: StablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                amount,
                removeBPT(poolPairData)
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                amount,
                removeBPT(poolPairData)
            );
        } else {
            result = _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                removeBPT(poolPairData)
            );
        }
        return result;
    }
}

export function removeBPT(
    poolPairData: StablePoolPairData
): StablePoolPairData {
    const ans = cloneDeep(poolPairData);
    const bptIndex = poolPairData.bptIndex;
    if (bptIndex != -1) {
        ans.allBalances.splice(bptIndex, 1);
        ans.allBalancesScaled.splice(bptIndex, 1);
        if (bptIndex < poolPairData.tokenIndexIn) ans.tokenIndexIn -= 1;
        if (bptIndex < poolPairData.tokenIndexOut) ans.tokenIndexOut -= 1;
    }
    return ans;
}
