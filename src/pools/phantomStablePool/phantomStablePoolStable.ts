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
} from '../stablePool/stableMath';
import { StablePoolPairData } from '../stablePool/stablePool';
import cloneDeep from 'lodash.clonedeep';

enum PairTypes {
    BptToToken,
    TokenToBpt,
    TokenToToken,
}

export type PhantomStablePoolPairData = StablePoolPairData & {
    pairType: PairTypes;
    bptIndex: number;
};

type PhantomStablePoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals'
>;

export class PhantomStablePool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Stable;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    amp: BigNumber;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: PhantomStablePoolToken[];
    tokensList: string[];
    isPhantom: boolean;
    MAX_IN_RATIO = parseFixed('0.3', 18);
    MAX_OUT_RATIO = parseFixed('0.3', 18);
    // Used for VirutalBpt and can be removed if SG is updated with VirtualBpt value
    MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');

    static AMP_DECIMALS = 3;

    static fromPool(pool: SubgraphPoolBase): PhantomStablePool {
        if (!pool.amp) throw new Error('PhantomStablePool missing amp factor');
        return new PhantomStablePool(
            pool.id,
            pool.address,
            pool.amp,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList
        );
    }

    static removeBPT(
        poolPairData: PhantomStablePoolPairData
    ): PhantomStablePoolPairData {
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

    constructor(
        id: string,
        address: string,
        amp: string,
        swapFee: string,
        totalShares: string,
        tokens: PhantomStablePoolToken[],
        tokensList: string[]
    ) {
        this.id = id;
        this.address = address;
        this.amp = parseFixed(amp, PhantomStablePool.AMP_DECIMALS);
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        // A PhantomPool will have its BPT in token list
        this.isPhantom = this.tokensList.includes(this.address);
    }

    setTypeForSwap(type: SwapPairType): void {
        this.swapPairType = type;
    }

    parsePoolPairData(
        tokenIn: string,
        tokenOut: string
    ): PhantomStablePoolPairData {
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

        // Stable Phantom pools will allow trading between token and pool BPT
        let pairType: PairTypes;
        if (this.isPhantom && isSameAddress(tokenIn, this.address)) {
            pairType = PairTypes.BptToToken;
        } else if (this.isPhantom && isSameAddress(tokenOut, this.address)) {
            pairType = PairTypes.TokenToBpt;
        } else {
            pairType = PairTypes.TokenToToken;
        }

        const bptIndex = this.tokensList.indexOf(this.address);
        const inv = _invariant(this.amp, allBalances);

        const poolPairData: PhantomStablePoolPairData = {
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

    getNormalizedLiquidity(
        poolPairData: PhantomStablePoolPairData
    ): OldBigNumber {
        // This is an approximation as the actual normalized liquidity is a lot more complicated to calculate
        return bnum(
            formatFixed(
                poolPairData.balanceOut.mul(poolPairData.amp),
                poolPairData.decimalsOut + PhantomStablePool.AMP_DECIMALS
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
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18); // scale(amount, 18);
            const amtWithFee = this.subtractSwapFeeAmount(
                amtScaled,
                poolPairData.swapFee
            );
            console.log(`amtWithFee: ${amtWithFee.toString()}`);
            const amp = bnum(this.amp.toString());
            const poolPairDataNoBPT = PhantomStablePool.removeBPT(poolPairData);
            const balances = poolPairDataNoBPT.allBalancesScaled.map(
                (balance) => bnum(balance.toString())
            );
            const tokenIndexIn = poolPairDataNoBPT.tokenIndexIn;
            const tokenIndexOut = poolPairDataNoBPT.tokenIndexOut;
            const swapFee = bnum(poolPairData.swapFee.toString());
            let amt: OldBigNumber;

            //EVM - 9901097957797894
            //SOR - 9934289675943491
            //SOR - 10001109048103954 (with 0 fee)
            const t = bnum('9901097957797894');
            const s = bnum('10001109048103954');
            // const s = bnum('9934289675943491');
            console.log(`CHECK: ${s.minus(t).toString()}`);
            // console.log(`CHECK: ${t.div(s).toString()}`);

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                // VirtualBPTSupply must be used for the maths
                // TO DO - SG should be updated to so that totalShares should return VirtualSupply
                const virtualBptSupply = this.MAX_TOKEN_BALANCE.sub(
                    poolPairData.allBalancesScaled[tokenIndexOut]
                );
                const amountsIn: OldBigNumber[] = [];
                for (let i = 0; i < balances.length; i++) {
                    const newValue =
                        i === tokenIndexIn ? bnum(amtWithFee.toString()) : ZERO;
                    amountsIn.push(newValue);
                }
                amt = SDK.StableMath._calcBptOutGivenExactTokensIn(
                    amp,
                    balances,
                    amountsIn,
                    bnum(virtualBptSupply.toString()),
                    bnum('0') //swapFee
                );
                console.log(`!!!!!!! TokenToBpt AmtIn: ${amount.toString()}`);
                console.log(amp.toString());
                console.log(swapFee.toString());
                balances.forEach((b) => console.log(b.toString()));
                console.log(`Amts:`);
                amountsIn.forEach((b) => console.log(b.toString()));
                console.log(`!!!!!!! TokenToBpt: ${amt.toString()}`);
                console.log(
                    poolPairData.allBalancesScaled[tokenIndexOut].toString()
                );

                // _trackDueProtocolFeeByBpt
                // uint256 feeAmount = _addSwapFeeAmount(bptAmount).sub(bptAmount);
                //  - amount.divUp(FixedPoint.ONE.sub(getSwapFeePercentage()));
                // uint256 protocolFeeAmount = feeAmount.mulDown(protocolSwapFeePercentage);
                // _dueProtocolFeeBptAmount = _dueProtocolFeeBptAmount.add(protocolFeeAmount);
                const _addSwapFeeAmount = amt
                    .div(bnum(1e18).minus(swapFee))
                    .times(1e18);
                console.log(
                    `_addSwapFeeAmount ${_addSwapFeeAmount.toString()}`
                );
                const feeAmount = _addSwapFeeAmount.minus(amt);
                console.log(feeAmount.toString());
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                // VirtualBPTSupply must be used for the maths
                // TO DO - SG should be updated to so that totalShares should return VirtualSupply
                const virtualBptSupply = this.MAX_TOKEN_BALANCE.sub(
                    poolPairData.allBalancesScaled[tokenIndexIn]
                );

                amt = SDK.StableMath._calcTokenOutGivenExactBptIn(
                    amp,
                    balances,
                    tokenIndexOut,
                    bnum(amtWithFee.toString()),
                    bnum(virtualBptSupply.toString()),
                    bnum('0') // swapFee
                );
            } else {
                amt = SDK.StableMath._calcOutGivenIn(
                    amp,
                    balances,
                    tokenIndexIn,
                    tokenIndexOut,
                    bnum(amtWithFee.toString()),
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
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);
            const amp = bnum(this.amp.toString());
            const poolPairDataNoBPT = PhantomStablePool.removeBPT(poolPairData);
            const balances = poolPairDataNoBPT.allBalancesScaled.map(
                (balance) => bnum(balance.toString())
            );
            const tokenIndexIn = poolPairDataNoBPT.tokenIndexIn;
            const tokenIndexOut = poolPairDataNoBPT.tokenIndexOut;
            const swapFee = bnum(poolPairData.swapFee.toString());
            let amt: OldBigNumber;

            if (poolPairData.pairType === PairTypes.TokenToBpt) {
                // VirtualBPTSupply must be used for the maths
                // TO DO - SG should be updated to so that totalShares should return VirtualSupply
                const virtualBptSupply = this.MAX_TOKEN_BALANCE.sub(
                    poolPairData.allBalancesScaled[tokenIndexOut]
                );
                amt = SDK.StableMath._calcTokenInGivenExactBptOut(
                    amp,
                    balances,
                    tokenIndexIn,
                    amtScaled,
                    bnum(virtualBptSupply.toString()),
                    swapFee
                );
            } else if (poolPairData.pairType === PairTypes.BptToToken) {
                const amountsOut: OldBigNumber[] = [];
                for (let i = 0; i < balances.length; i++) {
                    const newValue = i === tokenIndexOut ? amtScaled : ZERO;
                    amountsOut.push(newValue);
                }

                // VirtualBPTSupply must be used for the maths
                // TO DO - SG should be updated to so that totalShares should return VirtualSupply
                const virtualBptSupply = this.MAX_TOKEN_BALANCE.sub(
                    poolPairData.allBalancesScaled[tokenIndexIn]
                );

                amt = SDK.StableMath._calcBptInGivenExactTokensOut(
                    amp,
                    balances,
                    amountsOut,
                    bnum(virtualBptSupply.toString()),
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
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _spotPriceAfterSwapExactTokenInForBPTOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _spotPriceAfterSwapExactBPTInForTokenOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        } else {
            result = _spotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        }
        return result;
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _spotPriceAfterSwapTokenInForExactBPTOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _spotPriceAfterSwapBPTInForExactTokenOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        } else {
            result = _spotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        }
        return result;
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        } else {
            result = _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        }
        return result;
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: PhantomStablePoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        let result: OldBigNumber;
        if (poolPairData.pairType === PairTypes.TokenToBpt) {
            result = _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        } else if (poolPairData.pairType === PairTypes.BptToToken) {
            result = _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        } else {
            result = _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                PhantomStablePool.removeBPT(poolPairData)
            );
        }
        return result;
    }

    subtractSwapFeeAmount(amount: BigNumber, swapFee: BigNumber): BigNumber {
        const feeAmount = amount.mul(swapFee).div(ONE);
        return amount.sub(feeAmount);
    }
}
