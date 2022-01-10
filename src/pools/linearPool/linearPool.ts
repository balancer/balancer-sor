import { BigNumber, parseFixed } from '@ethersproject/bignumber';
import { bnum, scale, ZERO } from '../../utils/bignumber';
import { BigNumber as OldBigNumber } from '../../utils/bignumber';
import { WeiPerEther as ONE } from '@ethersproject/constants';
import { isSameAddress } from '../../utils';
import {
    _calcBptInPerWrappedOut,
    _calcMainOutPerWrappedIn,
    _calcWrappedOutPerMainIn,
    _calcBptOutPerMainIn,
    _calcMainOutPerBptIn,
    _calcBptOutPerWrappedIn,
    _calcWrappedOutPerBptIn,
    _calcWrappedInPerMainOut,
    _calcMainInPerWrappedOut,
    _calcMainInPerBptOut,
    _calcBptInPerMainOut,
    _calcWrappedInPerBptOut,
} from './exactMaths';
import {
    PoolBase,
    PoolTypes,
    SwapPairType,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import {
    _exactMainTokenInForBPTOut,
    _exactBPTInForMainTokenOut,
    _mainTokenInForExactBPTOut,
    _BPTInForExactMainTokenOut,
    _spotPriceAfterSwapExactTokenInForTokenOut,
    _spotPriceAfterSwapExactTokenInForBPTOut,
    _spotPriceAfterSwapExactBPTInForTokenOut,
    _spotPriceAfterSwapTokenInForExactTokenOut,
    _spotPriceAfterSwapTokenInForExactBPTOut,
    _spotPriceAfterSwapBPTInForExactTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut,
    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut,
    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut,
    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut,
    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut,
} from './linearMath';

export enum PairTypes {
    BptToMainToken,
    MainTokenToBpt,
    MainTokenToWrappedToken,
    WrappedTokenToMainToken,
    BptToWrappedToken,
    WrappedTokenToBpt,
}

type LinearPoolToken = Pick<
    SubgraphToken,
    'address' | 'balance' | 'decimals' | 'priceRate'
>;

export type LinearPoolPairData = PoolPairBase & {
    pairType: PairTypes;
    wrappedBalance: OldBigNumber; // If main token is USDC then wrapped token is aUSDC (or a wrapped version of it)
    wrappedDecimals: number;
    rate: OldBigNumber; // PriceRate of wrapped token
    lowerTarget: BigNumber; // Target determine the range where there are positive, zero or negative fees
    upperTarget: BigNumber; // when the "main token" has a balance below lowerTarget, there are negative fees when adding main token
    mainBalanceScaled: BigNumber; // Scaled are used for EVM/SDK maths
    wrappedBalanceScaled: BigNumber;
    bptBalanceScaled: BigNumber;
    virtualBptSupply: BigNumber;
};

export class LinearPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Linear;
    swapPairType: SwapPairType;
    id: string;
    address: string;
    swapFee: BigNumber;
    totalShares: BigNumber;
    tokens: LinearPoolToken[];
    tokensList: string[];

    wrappedIndex: number;
    wrappedDecimals: number;
    mainIndex: number;
    bptIndex: number;
    lowerTarget: BigNumber;
    upperTarget: BigNumber;
    MAX_RATIO = parseFixed('10', 18); // Specific for Linear pool types
    ALMOST_ONE = parseFixed('0.99', 18);
    // Used for VirutalBpt and can be removed if SG is updated with VirtualBpt value
    MAX_TOKEN_BALANCE = BigNumber.from('2').pow('112').sub('1');

    static fromPool(pool: SubgraphPoolBase): LinearPool {
        if (pool.mainIndex === undefined)
            throw new Error('LinearPool missing mainIndex');
        if (pool.wrappedIndex === undefined)
            throw new Error('LinearPool missing wrappedIndex');
        if (!pool.lowerTarget)
            throw new Error('LinearPool missing lowerTarget');
        if (!pool.upperTarget)
            throw new Error('LinearPool missing upperTarget');
        return new LinearPool(
            pool.id,
            pool.address,
            pool.swapFee,
            pool.totalShares,
            pool.tokens,
            pool.tokensList,
            pool.mainIndex,
            pool.wrappedIndex,
            pool.lowerTarget,
            pool.upperTarget
        );
    }

    constructor(
        id: string,
        address: string,
        swapFee: string,
        totalShares: string,
        tokens: LinearPoolToken[],
        tokensList: string[],
        mainIndex: number,
        wrappedIndex: number,
        lowerTarget: string,
        upperTarget: string
    ) {
        this.id = id;
        this.address = address;
        this.swapFee = parseFixed(swapFee, 18);
        this.totalShares = parseFixed(totalShares, 18);
        this.tokens = tokens;
        this.tokensList = tokensList;
        this.mainIndex = mainIndex;
        this.bptIndex = this.tokensList.indexOf(this.address);
        this.wrappedIndex = wrappedIndex;
        this.wrappedDecimals = this.tokens[this.wrappedIndex].decimals;
        this.lowerTarget = parseFixed(lowerTarget, 18); // Wrapped token will have same decimals as underlying
        this.upperTarget = parseFixed(upperTarget, 18);
    }

    setTypeForSwap(type: SwapPairType): void {
        this.swapPairType = type;
    }

    parsePoolPairData(tokenIn: string, tokenOut: string): LinearPoolPairData {
        let pairType: PairTypes;

        const tI = this.tokens.find((t) => isSameAddress(t.address, tokenIn));
        if (!tI) throw Error(`Pool does not contain token in ${tokenIn}`);
        const decimalsIn = tI.decimals;
        const balanceIn = parseFixed(tI.balance, decimalsIn);

        const tO = this.tokens.find((t) => isSameAddress(t.address, tokenOut));
        if (!tO) throw Error(`Pool does not contain token out ${tokenOut}`);
        const decimalsOut = tO.decimals;
        const balanceOut = parseFixed(tO.balance, decimalsOut);

        // Linear pools allow trading between token and pool BPT (phantom BPT)
        if (isSameAddress(tokenIn, this.address)) {
            if (isSameAddress(tokenOut, this.tokens[this.wrappedIndex].address))
                pairType = PairTypes.BptToWrappedToken;
            else pairType = PairTypes.BptToMainToken;
        } else if (isSameAddress(tokenOut, this.address)) {
            if (isSameAddress(tokenIn, this.tokens[this.wrappedIndex].address))
                pairType = PairTypes.WrappedTokenToBpt;
            else pairType = PairTypes.MainTokenToBpt;
        } else {
            if (isSameAddress(tokenIn, this.tokens[this.wrappedIndex].address))
                pairType = PairTypes.WrappedTokenToMainToken;
            else pairType = PairTypes.MainTokenToWrappedToken;
        }

        // Get all token balances scaled to 18
        const allBalancesScaled = this.tokens.map(({ balance }) =>
            parseFixed(balance, 18)
        );
        const priceRate = this.tokens[this.wrappedIndex].priceRate;
        const mainBalanceScaled = allBalancesScaled[this.mainIndex];
        const wrappedBalanceScaled = allBalancesScaled[this.wrappedIndex]
            .mul(parseFixed(priceRate, 18))
            .div(ONE);
        const bptBalanceScaled = allBalancesScaled[this.bptIndex];
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/88a14eb623f6a22ef3f1afc5a8c49ebfa7eeceed/pkg/pool-linear/contracts/LinearPool.sol#L247
        // VirtualBPTSupply must be used for the maths
        // TO DO - SG should be updated to so that totalShares should return VirtualSupply
        const virtualBptSupply = this.MAX_TOKEN_BALANCE.sub(bptBalanceScaled);

        const poolPairData: LinearPoolPairData = {
            id: this.id,
            address: this.address,
            poolType: this.poolType,
            pairType: pairType,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            decimalsIn: Number(decimalsIn),
            decimalsOut: Number(decimalsOut),
            balanceIn: balanceIn,
            balanceOut: balanceOut,
            swapFee: this.swapFee,
            wrappedBalance: scale(
                bnum(this.tokens[this.wrappedIndex].balance),
                this.wrappedDecimals
            ),
            wrappedDecimals: this.wrappedDecimals,
            rate: scale(bnum(priceRate), 18),
            lowerTarget: this.lowerTarget,
            upperTarget: this.upperTarget,
            mainBalanceScaled,
            wrappedBalanceScaled,
            bptBalanceScaled,
            virtualBptSupply,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: LinearPoolPairData): OldBigNumber {
        return bnum(0);
    }

    getLimitAmountSwap(
        poolPairData: PoolPairBase,
        swapType: SwapTypes
    ): OldBigNumber {
        // Needs to return human scaled numbers
        const linearPoolPairData = poolPairData as LinearPoolPairData;
        const balanceOutHuman = scale(
            bnum(poolPairData.balanceOut.toString()),
            -poolPairData.decimalsOut
        );

        if (swapType === SwapTypes.SwapExactIn) {
            if (linearPoolPairData.pairType === PairTypes.MainTokenToBpt) {
                return _mainTokenInForExactBPTOut(
                    balanceOutHuman,
                    linearPoolPairData
                )
                    .times(bnum(this.ALMOST_ONE.toString()))
                    .div(bnum(ONE.toString()));
            } else if (
                linearPoolPairData.pairType === PairTypes.WrappedTokenToBpt
            ) {
                // Swapping to BPT allows for a very large amount so using pre-minted amount as estimation
                return scale(bnum(this.MAX_TOKEN_BALANCE.toString()), -18);
            } else if (
                linearPoolPairData.pairType === PairTypes.BptToMainToken
            ) {
                // Limit is amount of BPT in for pool balance of tokenOut
                // Amount must be in human scale
                const limit = _BPTInForExactMainTokenOut(
                    balanceOutHuman,
                    linearPoolPairData
                )
                    .times(bnum(this.ALMOST_ONE.toString()))
                    .div(bnum(ONE.toString()));

                return limit;
            } else if (
                linearPoolPairData.pairType === PairTypes.BptToWrappedToken
            ) {
                // Limit is amount of BPT in for pool balance of tokenOut
                const limit = _calcBptInPerWrappedOut(
                    bnum(poolPairData.balanceOut.toString()),
                    bnum(linearPoolPairData.mainBalanceScaled.toString()),
                    bnum(linearPoolPairData.wrappedBalanceScaled.toString()),
                    bnum(linearPoolPairData.bptBalanceScaled.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        lowerTarget: bnum(
                            linearPoolPairData.lowerTarget.toString()
                        ),
                        upperTarget: bnum(
                            linearPoolPairData.upperTarget.toString()
                        ),
                    }
                )
                    .times(bnum(this.ALMOST_ONE.toString()))
                    .div(bnum(ONE.toString()))
                    .div(bnum(ONE.toString()));

                // Returning Human scale
                return limit;
            } else if (
                linearPoolPairData.pairType ===
                    PairTypes.MainTokenToWrappedToken ||
                linearPoolPairData.pairType ===
                    PairTypes.WrappedTokenToMainToken
            ) {
                const limit = bnum(
                    poolPairData.balanceOut
                        .mul(this.ALMOST_ONE)
                        .div(ONE)
                        .toString()
                );
                return scale(limit, -poolPairData.decimalsOut);
            } else return bnum(0);
        } else {
            if (
                linearPoolPairData.pairType === PairTypes.MainTokenToBpt ||
                linearPoolPairData.pairType === PairTypes.WrappedTokenToBpt
            ) {
                const limit = bnum(
                    poolPairData.balanceOut
                        .mul(this.MAX_RATIO)
                        .div(ONE)
                        .toString()
                );
                return scale(limit, -poolPairData.decimalsOut);
            } else if (
                linearPoolPairData.pairType === PairTypes.BptToMainToken ||
                linearPoolPairData.pairType === PairTypes.BptToWrappedToken ||
                linearPoolPairData.pairType ===
                    PairTypes.MainTokenToWrappedToken ||
                linearPoolPairData.pairType ===
                    PairTypes.WrappedTokenToMainToken
            ) {
                const limit = bnum(
                    poolPairData.balanceOut
                        .mul(this.ALMOST_ONE)
                        .div(ONE)
                        .toString()
                );
                return scale(limit, -poolPairData.decimalsOut);
            } else return bnum(0);
        }
    }

    // Updates the balance of a given token for the pool
    updateTokenBalanceForPool(token: string, newBalance: BigNumber): void {
        const T = this.tokens.find((t) => isSameAddress(t.address, token));
        if (!T) throw Error('Pool does not contain this token');
        T.balance = newBalance.toString();
    }

    _exactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
            return this._exactMainTokenInForBPTOut(poolPairData, amount, exact);
        } else if (poolPairData.pairType === PairTypes.BptToMainToken) {
            return this._exactBPTInForMainTokenOut(poolPairData, amount, exact);
        } else if (poolPairData.pairType === PairTypes.WrappedTokenToBpt) {
            return this._exactWrappedTokenInForBPTOut(
                poolPairData,
                amount,
                exact
            );
        } else if (poolPairData.pairType === PairTypes.BptToWrappedToken) {
            return this._exactBPTInForWrappedTokenOut(
                poolPairData,
                amount,
                exact
            );
        } else if (
            poolPairData.pairType === PairTypes.MainTokenToWrappedToken
        ) {
            return this._exactMainTokenInForWrappedOut(
                poolPairData,
                amount,
                exact
            );
        } else if (
            poolPairData.pairType === PairTypes.WrappedTokenToMainToken
        ) {
            return this._exactWrappedTokenInForMainOut(
                poolPairData,
                amount,
                exact
            );
        } else return bnum(0);
    }

    _exactWrappedTokenInForMainOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            const amt = _calcMainOutPerWrappedIn(
                amtScaled,
                bnum(poolPairData.mainBalanceScaled.toString()),
                {
                    fee: bnum(poolPairData.swapFee.toString()),
                    lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                    upperTarget: bnum(poolPairData.upperTarget.toString()),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            return ZERO;
        }
    }

    _exactMainTokenInForWrappedOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            const amt = _calcWrappedOutPerMainIn(
                amtScaled,
                bnum(poolPairData.mainBalanceScaled.toString()),
                {
                    fee: bnum(poolPairData.swapFee.toString()),
                    lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                    upperTarget: bnum(poolPairData.upperTarget.toString()),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            return ZERO;
        }
    }

    _exactMainTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // All values should use 1e18 fixed point
                // i.e. 1USDC => 1e18 not 1e6
                const amtScaled = scale(amount, 18);

                const amt = _calcBptOutPerMainIn(
                    amtScaled,
                    bnum(poolPairData.mainBalanceScaled.toString()),
                    bnum(poolPairData.wrappedBalanceScaled.toString()),
                    bnum(poolPairData.virtualBptSupply.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                        upperTarget: bnum(poolPairData.upperTarget.toString()),
                    }
                );
                // return human readable number
                // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
                // i.e. when using token with 2decimals 0.002 should be returned as 0
                // Uses ROUND_DOWN mode (1)
                return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
            } catch (err) {
                return ZERO;
            }
        } else {
            return _exactMainTokenInForBPTOut(amount, poolPairData);
        }
    }

    _exactBPTInForMainTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // All values should use 1e18 fixed point
                // i.e. 1USDC => 1e18 not 1e6
                const amtScaled = scale(amount, 18);

                const amt = _calcMainOutPerBptIn(
                    amtScaled,
                    bnum(poolPairData.mainBalanceScaled.toString()),
                    bnum(poolPairData.wrappedBalanceScaled.toString()),
                    bnum(poolPairData.virtualBptSupply.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                        upperTarget: bnum(poolPairData.upperTarget.toString()),
                    }
                );
                // return human readable number
                // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
                // i.e. when using token with 2decimals 0.002 should be returned as 0
                // Uses ROUND_DOWN mode (1)
                return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
            } catch (err) {
                return ZERO;
            }
        } else return _exactBPTInForMainTokenOut(amount, poolPairData);
    }

    _exactWrappedTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            const amt = _calcBptOutPerWrappedIn(
                amtScaled,
                bnum(poolPairData.mainBalanceScaled.toString()),
                bnum(poolPairData.wrappedBalanceScaled.toString()),
                bnum(poolPairData.virtualBptSupply.toString()),
                {
                    fee: bnum(poolPairData.swapFee.toString()),
                    lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                    upperTarget: bnum(poolPairData.upperTarget.toString()),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            return ZERO;
        }
    }

    _exactBPTInForWrappedTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            const amt = _calcWrappedOutPerBptIn(
                amtScaled,
                bnum(poolPairData.mainBalanceScaled.toString()),
                bnum(poolPairData.wrappedBalanceScaled.toString()),
                bnum(poolPairData.virtualBptSupply.toString()),
                {
                    fee: bnum(poolPairData.swapFee.toString()),
                    lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                    upperTarget: bnum(poolPairData.upperTarget.toString()),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
            return this._mainTokenInForExactBPTOut(poolPairData, amount, exact);
        } else if (poolPairData.pairType === PairTypes.BptToMainToken) {
            return this._BPTInForExactMainTokenOut(poolPairData, amount, exact);
        } else if (poolPairData.pairType === PairTypes.WrappedTokenToBpt) {
            return this._wrappedTokenInForExactBPTOut(
                poolPairData,
                amount,
                exact
            );
        } else if (poolPairData.pairType === PairTypes.BptToWrappedToken) {
            return this._BPTInForExactWrappedTokenOut(
                poolPairData,
                amount,
                exact
            );
        } else if (
            poolPairData.pairType === PairTypes.MainTokenToWrappedToken
        ) {
            return this._mainTokenInForExactWrappedOut(
                poolPairData,
                amount,
                exact
            );
        } else if (
            poolPairData.pairType === PairTypes.WrappedTokenToMainToken
        ) {
            return this._wrappedTokenInForExactMainOut(
                poolPairData,
                amount,
                exact
            );
        } else return bnum(0); // LinearPool does not support TokenToToken
    }

    _wrappedTokenInForExactMainOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            const amt = _calcWrappedInPerMainOut(
                amtScaled,
                bnum(poolPairData.mainBalanceScaled.toString()),
                {
                    fee: bnum(poolPairData.swapFee.toString()),
                    lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                    upperTarget: bnum(poolPairData.upperTarget.toString()),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            return ZERO;
        }
    }

    _mainTokenInForExactWrappedOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            const amt = _calcMainInPerWrappedOut(
                amtScaled,
                bnum(poolPairData.mainBalanceScaled.toString()),
                {
                    fee: bnum(poolPairData.swapFee.toString()),
                    lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                    upperTarget: bnum(poolPairData.upperTarget.toString()),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            return ZERO;
        }
    }

    _mainTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // All values should use 1e18 fixed point
                // i.e. 1USDC => 1e18 not 1e6
                const amtScaled = scale(amount, 18);
                // in = main
                // out = BPT
                const amt = _calcMainInPerBptOut(
                    amtScaled,
                    bnum(poolPairData.mainBalanceScaled.toString()),
                    bnum(poolPairData.wrappedBalanceScaled.toString()),
                    bnum(poolPairData.virtualBptSupply.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                        upperTarget: bnum(poolPairData.upperTarget.toString()),
                    }
                );
                // return human readable number
                // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
                // i.e. when using token with 2decimals 0.002 should be returned as 0
                // Uses ROUND_UP mode (0)
                return scale(amt, -18).dp(poolPairData.decimalsIn, 0);
            } catch (err) {
                return ZERO;
            }
        }
        return _mainTokenInForExactBPTOut(amount, poolPairData);
    }

    _BPTInForExactMainTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        if (exact) {
            try {
                // All values should use 1e18 fixed point
                // i.e. 1USDC => 1e18 not 1e6
                const amtScaled = scale(amount, 18);

                const amt = _calcBptInPerMainOut(
                    amtScaled,
                    bnum(poolPairData.mainBalanceScaled.toString()),
                    bnum(poolPairData.wrappedBalanceScaled.toString()),
                    bnum(poolPairData.virtualBptSupply.toString()),
                    {
                        fee: bnum(poolPairData.swapFee.toString()),
                        lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                        upperTarget: bnum(poolPairData.upperTarget.toString()),
                    }
                );
                // return human readable number
                // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
                // i.e. when using token with 2decimals 0.002 should be returned as 0
                // Uses ROUND_UP mode (0)
                return scale(amt, -18).dp(poolPairData.decimalsIn, 0);
            } catch (err) {
                return ZERO;
            }
        }
        return _BPTInForExactMainTokenOut(amount, poolPairData);
    }

    _wrappedTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            const amt = _calcWrappedInPerBptOut(
                amtScaled,
                bnum(poolPairData.mainBalanceScaled.toString()),
                bnum(poolPairData.wrappedBalanceScaled.toString()),
                bnum(poolPairData.virtualBptSupply.toString()),
                {
                    fee: bnum(poolPairData.swapFee.toString()),
                    lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                    upperTarget: bnum(poolPairData.upperTarget.toString()),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            return ZERO;
        }
    }

    _BPTInForExactWrappedTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber,
        exact: boolean
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = scale(amount, 18);

            const amt = _calcBptInPerWrappedOut(
                amtScaled,
                bnum(poolPairData.mainBalanceScaled.toString()),
                bnum(poolPairData.wrappedBalanceScaled.toString()),
                bnum(poolPairData.virtualBptSupply.toString()),
                {
                    fee: bnum(poolPairData.swapFee.toString()),
                    lowerTarget: bnum(poolPairData.lowerTarget.toString()),
                    upperTarget: bnum(poolPairData.upperTarget.toString()),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(amt, -18).dp(poolPairData.decimalsOut, 1);
        } catch (err) {
            return ZERO;
        }
    }

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        // For now we used the main token eqn for wrapped token as that maths isn't written and estimate should be ok for limited available paths
        if (
            poolPairData.pairType === PairTypes.MainTokenToBpt ||
            poolPairData.pairType === PairTypes.WrappedTokenToBpt
        ) {
            return this._spotPriceAfterSwapExactTokenInForBPTOut(
                poolPairData,
                amount
            );
        } else if (
            poolPairData.pairType === PairTypes.BptToMainToken ||
            poolPairData.pairType === PairTypes.BptToWrappedToken
        ) {
            return this._spotPriceAfterSwapExactBPTInForTokenOut(
                poolPairData,
                amount
            );
        } else
            return _spotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                poolPairData
            );
    }

    _spotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapExactTokenInForBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapExactBPTInForTokenOut(amount, poolPairData);
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        // For now we used the main token eqn for wrapped token as that maths isn't written and estimate should be ok for limited available paths
        if (
            poolPairData.pairType === PairTypes.MainTokenToBpt ||
            poolPairData.pairType === PairTypes.WrappedTokenToBpt
        ) {
            return this._spotPriceAfterSwapTokenInForExactBPTOut(
                poolPairData,
                amount
            );
        } else if (
            poolPairData.pairType === PairTypes.BptToMainToken ||
            poolPairData.pairType === PairTypes.BptToWrappedToken
        ) {
            return this._spotPriceAfterSwapBPTInForExactTokenOut(
                poolPairData,
                amount
            );
        } else
            return _spotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                poolPairData
            );
    }

    _spotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapTokenInForExactBPTOut(amount, poolPairData);
    }

    _spotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _spotPriceAfterSwapBPTInForExactTokenOut(amount, poolPairData);
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
            return this._derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
                poolPairData,
                amount
            );
        } else if (poolPairData.pairType === PairTypes.BptToMainToken) {
            return this._derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
                poolPairData,
                amount
            );
        } else
            return _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
                amount,
                poolPairData
            );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapExactTokenInForBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapExactBPTInForTokenOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
            return this._derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
                poolPairData,
                amount
            );
        } else if (poolPairData.pairType === PairTypes.BptToMainToken) {
            return this._derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
                poolPairData,
                amount
            );
        } else
            return _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
                amount,
                poolPairData
            );
    }

    _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapTokenInForExactBPTOut(
            amount,
            poolPairData
        );
    }

    _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return _derivativeSpotPriceAfterSwapBPTInForExactTokenOut(
            amount,
            poolPairData
        );
    }
}
