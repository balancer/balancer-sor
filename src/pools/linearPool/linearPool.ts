import { BigNumber, parseFixed, formatFixed } from '@ethersproject/bignumber';
import { bnum, scale, ZERO } from '../../utils/bignumber';
import { BigNumber as OldBigNumber } from '../../utils/bignumber';
import { WeiPerEther as ONE, Zero } from '@ethersproject/constants';
import { isSameAddress } from '../../utils';
import {
    PoolBase,
    PoolTypes,
    PoolPairBase,
    SwapTypes,
    SubgraphPoolBase,
    SubgraphToken,
} from '../../types';
import {
    _calcBptOutPerMainIn,
    _calcBptInPerWrappedOut,
    _calcBptInPerMainOut,
    _calcWrappedOutPerMainIn,
    _calcWrappedInPerMainOut,
    _calcMainInPerBptOut,
    _calcMainOutPerBptIn,
    _calcMainOutPerWrappedIn,
    _calcMainInPerWrappedOut,
    _calcBptOutPerWrappedIn,
    _calcWrappedInPerBptOut,
    _calcWrappedOutPerBptIn,
    _spotPriceAfterSwapBptOutPerMainIn,
    _spotPriceAfterSwapMainOutPerBptIn,
    _spotPriceAfterSwapBptOutPerWrappedIn,
    _spotPriceAfterSwapWrappedOutPerBptIn,
    _spotPriceAfterSwapWrappedOutPerMainIn,
    _spotPriceAfterSwapMainOutPerWrappedIn,
    _spotPriceAfterSwapMainInPerBptOut,
    _spotPriceAfterSwapBptInPerMainOut,
    _spotPriceAfterSwapWrappedInPerBptOut,
    _spotPriceAfterSwapBptInPerWrappedOut,
    _spotPriceAfterSwapMainInPerWrappedOut,
    _spotPriceAfterSwapWrappedInPerMainOut,
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
    wrappedBalanceScaled: BigNumber; // If main token is USDC then wrapped token is aUSDC (or a wrapped version of it)
    wrappedDecimals: number;
    rate: BigNumber; // PriceRate of wrapped token
    lowerTarget: BigNumber; // Target determine the range where there are positive, zero or negative fees
    upperTarget: BigNumber; // when the "main token" has a balance below lowerTarget, there are negative fees when adding main token
    mainBalanceScaled: BigNumber; // Scaled are used for EVM/SDK maths
    bptBalanceScaled: BigNumber;
    virtualBptSupply: BigNumber;
};

export class LinearPool implements PoolBase {
    poolType: PoolTypes = PoolTypes.Linear;
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
        // https://github.com/balancer-labs/balancer-v2-monorepo/blob/88a14eb623f6a22ef3f1afc5a8c49ebfa7eeceed/pkg/pool-linear/contracts/LinearPool.sol#L247
        // VirtualBPTSupply must be used for the maths
        // TO DO - SG should be updated to so that totalShares should return VirtualSupply
        const bptBalanceScaled = allBalancesScaled[this.bptIndex];
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
            wrappedBalanceScaled: allBalancesScaled[this.wrappedIndex], // Note this is not multiplied by rate
            wrappedDecimals: this.wrappedDecimals,
            rate: parseFixed(this.tokens[this.wrappedIndex].priceRate, 18),
            lowerTarget: this.lowerTarget,
            upperTarget: this.upperTarget,
            mainBalanceScaled: allBalancesScaled[this.mainIndex],
            bptBalanceScaled,
            virtualBptSupply,
        };

        return poolPairData;
    }

    getNormalizedLiquidity(poolPairData: LinearPoolPairData): OldBigNumber {
        return bnum(0);
    }

    getLimitAmountSwap(
        poolPairData: LinearPoolPairData,
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
                return this._mainTokenInForExactBPTOut(
                    poolPairData,
                    balanceOutHuman
                        .times(this.ALMOST_ONE.toString())
                        .div(ONE.toString())
                );
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
                return this._BPTInForExactMainTokenOut(
                    linearPoolPairData,
                    balanceOutHuman
                        .times(this.ALMOST_ONE.toString())
                        .div(ONE.toString())
                );
            } else if (
                linearPoolPairData.pairType === PairTypes.BptToWrappedToken
            ) {
                const limit = this._BPTInForExactWrappedTokenOut(
                    poolPairData,
                    balanceOutHuman
                        .times(this.ALMOST_ONE.toString())
                        .div(ONE.toString())
                );
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
        // Converts to human scaled number and saves.
        T.balance = formatFixed(newBalance, T.decimals);
    }

    _exactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
            return this._exactMainTokenInForBPTOut(poolPairData, amount);
        } else if (poolPairData.pairType === PairTypes.BptToMainToken) {
            return this._exactBPTInForMainTokenOut(poolPairData, amount);
        } else if (poolPairData.pairType === PairTypes.WrappedTokenToBpt) {
            return this._exactWrappedTokenInForBPTOut(poolPairData, amount);
        } else if (poolPairData.pairType === PairTypes.BptToWrappedToken) {
            return this._exactBPTInForWrappedTokenOut(poolPairData, amount);
        } else if (
            poolPairData.pairType === PairTypes.MainTokenToWrappedToken
        ) {
            return this._exactMainTokenInForWrappedOut(poolPairData, amount);
        } else if (
            poolPairData.pairType === PairTypes.WrappedTokenToMainToken
        ) {
            return this._exactWrappedTokenInForMainOut(poolPairData, amount);
        } else return bnum(0);
    }

    _exactWrappedTokenInForMainOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcMainOutPerWrappedIn(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            return ZERO;
        }
    }

    _exactMainTokenInForWrappedOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcWrappedOutPerMainIn(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            return ZERO;
        }
    }

    _exactMainTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcBptOutPerMainIn(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            return ZERO;
        }
    }

    _exactBPTInForMainTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcMainOutPerBptIn(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            return ZERO;
        }
    }

    _exactWrappedTokenInForBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amt = _calcBptOutPerWrappedIn(
                parseFixed(amount.toString(), 18).toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            return ZERO;
        }
    }

    _exactBPTInForWrappedTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcWrappedOutPerBptIn(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            return ZERO;
        }
    }

    _tokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
            return this._mainTokenInForExactBPTOut(poolPairData, amount);
        } else if (poolPairData.pairType === PairTypes.BptToMainToken) {
            return this._BPTInForExactMainTokenOut(poolPairData, amount);
        } else if (poolPairData.pairType === PairTypes.WrappedTokenToBpt) {
            return this._wrappedTokenInForExactBPTOut(poolPairData, amount);
        } else if (poolPairData.pairType === PairTypes.BptToWrappedToken) {
            return this._BPTInForExactWrappedTokenOut(poolPairData, amount);
        } else if (
            poolPairData.pairType === PairTypes.MainTokenToWrappedToken
        ) {
            return this._mainTokenInForExactWrappedOut(poolPairData, amount);
        } else if (
            poolPairData.pairType === PairTypes.WrappedTokenToMainToken
        ) {
            return this._wrappedTokenInForExactMainOut(poolPairData, amount);
        } else return bnum(0); // LinearPool does not support TokenToToken
    }

    _wrappedTokenInForExactMainOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcWrappedInPerMainOut(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            return ZERO;
        }
    }

    _mainTokenInForExactWrappedOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcMainInPerWrappedOut(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_DOWN mode (1)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsOut,
                1
            );
        } catch (err) {
            return ZERO;
        }
    }

    _mainTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);
            // in = main
            // out = BPT
            const amt = _calcMainInPerBptOut(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_UP mode (0)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsIn,
                0
            );
        } catch (err) {
            return ZERO;
        }
    }

    _BPTInForExactMainTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcBptInPerMainOut(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_UP mode (0)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsIn,
                0
            );
        } catch (err) {
            return ZERO;
        }
    }

    _wrappedTokenInForExactBPTOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amtScaled = parseFixed(amount.toString(), 18);

            const amt = _calcWrappedInPerBptOut(
                amtScaled.toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_UP mode (0)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsIn,
                0
            );
        } catch (err) {
            return ZERO;
        }
    }

    _BPTInForExactWrappedTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        try {
            // All values should use 1e18 fixed point
            // i.e. 1USDC => 1e18 not 1e6
            const amt = _calcBptInPerWrappedOut(
                // amtNoRate.toBigInt(),
                parseFixed(amount.toString(), 18).toBigInt(),
                poolPairData.mainBalanceScaled.toBigInt(),
                poolPairData.wrappedBalanceScaled.toBigInt(),
                poolPairData.virtualBptSupply.toBigInt(),
                {
                    fee: poolPairData.swapFee.toBigInt(),
                    lowerTarget: poolPairData.lowerTarget.toBigInt(),
                    upperTarget: poolPairData.upperTarget.toBigInt(),
                    rate: poolPairData.rate.toBigInt(),
                }
            );
            // return human readable number
            // Using BigNumber.js decimalPlaces (dp), allows us to consider token decimal accuracy correctly,
            // i.e. when using token with 2decimals 0.002 should be returned as 0
            // Uses ROUND_UP mode (0)
            return scale(bnum(amt.toString()), -18).dp(
                poolPairData.decimalsIn,
                0
            );
        } catch (err) {
            return ZERO;
        }
    }

    _calcTokensOutGivenExactBptIn(bptAmountIn: BigNumber): BigNumber[] {
        // Linear Pool doesn't have Exit Pool implementation
        return new Array(this.tokens.length).fill(Zero);
    }

    _calcBptOutGivenExactTokensIn(amountsIn: BigNumber[]): BigNumber {
        // Linear Pool doesn't have Exit Pool implementation
        return Zero;
    }

    // SPOT PRICES AFTER SWAP

    _spotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const bigintAmount = parseFixed(
            amount.dp(18).toString(),
            18
        ).toBigInt();
        const mainBalance = poolPairData.mainBalanceScaled.toBigInt();
        const wrappedBalance = poolPairData.wrappedBalanceScaled.toBigInt();
        const bptSupply = poolPairData.virtualBptSupply.toBigInt();
        const params = {
            fee: poolPairData.swapFee.toBigInt(),
            lowerTarget: poolPairData.lowerTarget.toBigInt(),
            upperTarget: poolPairData.upperTarget.toBigInt(),
            rate: poolPairData.rate.toBigInt(),
        };
        let result: bigint;
        if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
            result = _spotPriceAfterSwapBptOutPerMainIn(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (poolPairData.pairType === PairTypes.BptToMainToken) {
            result = _spotPriceAfterSwapMainOutPerBptIn(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (poolPairData.pairType === PairTypes.WrappedTokenToBpt) {
            result = _spotPriceAfterSwapBptOutPerWrappedIn(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (poolPairData.pairType === PairTypes.BptToWrappedToken) {
            result = _spotPriceAfterSwapWrappedOutPerBptIn(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (
            poolPairData.pairType === PairTypes.MainTokenToWrappedToken
        ) {
            result = _spotPriceAfterSwapWrappedOutPerMainIn(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (
            poolPairData.pairType === PairTypes.WrappedTokenToMainToken
        ) {
            result = _spotPriceAfterSwapMainOutPerWrappedIn(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else return bnum(0);
        return scale(bnum(result.toString()), -18).dp(
            poolPairData.decimalsOut,
            0
        );
    }

    _spotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        const bigintAmount = parseFixed(
            amount.dp(18).toString(),
            18
        ).toBigInt();
        const mainBalance = poolPairData.mainBalanceScaled.toBigInt();
        const wrappedBalance = poolPairData.wrappedBalanceScaled.toBigInt();
        const bptSupply = poolPairData.virtualBptSupply.toBigInt();
        const params = {
            fee: poolPairData.swapFee.toBigInt(),
            lowerTarget: poolPairData.lowerTarget.toBigInt(),
            upperTarget: poolPairData.upperTarget.toBigInt(),
            rate: poolPairData.rate.toBigInt(),
        };
        let result: bigint;
        if (poolPairData.pairType === PairTypes.MainTokenToBpt) {
            result = _spotPriceAfterSwapMainInPerBptOut(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (poolPairData.pairType === PairTypes.BptToMainToken) {
            result = _spotPriceAfterSwapBptInPerMainOut(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (poolPairData.pairType === PairTypes.WrappedTokenToBpt) {
            result = _spotPriceAfterSwapWrappedInPerBptOut(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (poolPairData.pairType === PairTypes.BptToWrappedToken) {
            result = _spotPriceAfterSwapBptInPerWrappedOut(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (
            poolPairData.pairType === PairTypes.MainTokenToWrappedToken
        ) {
            result = _spotPriceAfterSwapMainInPerWrappedOut(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else if (
            poolPairData.pairType === PairTypes.WrappedTokenToMainToken
        ) {
            result = _spotPriceAfterSwapWrappedInPerMainOut(
                bigintAmount,
                mainBalance,
                wrappedBalance,
                bptSupply,
                params
            );
        } else return bnum(0);
        return scale(bnum(result.toString()), -18).dp(
            poolPairData.decimalsOut,
            0
        );
    }

    _derivativeSpotPriceAfterSwapExactTokenInForTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return bnum(0);
    }

    _derivativeSpotPriceAfterSwapTokenInForExactTokenOut(
        poolPairData: LinearPoolPairData,
        amount: OldBigNumber
    ): OldBigNumber {
        return bnum(0);
    }
}
